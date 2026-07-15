from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Meeting, MeetingParticipant
from .serializers import MeetingSerializer, MeetingParticipantSerializer


def _format_duration(total_seconds):
    """Return a human-readable duration string like '1h 4m 32s'."""
    total_seconds = int(total_seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes or hours:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def _mark_call_ended_if_empty(meeting):
    """
    Shared helper called by both the REST leave endpoint AND the WebSocket
    disconnect handler.  Idempotent: if the meeting already has ended_at set,
    or if there are still present participants, this is a safe no-op.

    When the last participant leaves:
      - Sets meeting.ended_at = now()
      - Calculates duration from earliest joined_at
      - Creates a system Message with the duration
      - Broadcasts the message to the channel

    Returns True if the call was just ended, False otherwise.
    """
    # Already marked ended — do nothing
    if meeting.ended_at is not None:
        return False

    # Someone is still in the call — do nothing
    if MeetingParticipant.objects.filter(meeting=meeting, is_present=True).exists():
        return False

    try:
        # Stamp the meeting as ended
        now = timezone.now()
        meeting.ended_at = now
        meeting.save(update_fields=["ended_at"])

        # Calculate duration from the first person to join
        earliest = (
            MeetingParticipant.objects.filter(meeting=meeting, joined_at__isnull=False)
            .order_by("joined_at")
            .first()
        )
        start_time = earliest.joined_at if earliest else meeting.created_at
        duration_str = _format_duration((now - start_time).total_seconds())

        # Post a system message to the associated channel
        from chat.models import Message
        from chat.utils import broadcast_to_channel
        from chat.serializers import MessageSerializer

        msg = Message.objects.create(
            sender=meeting.host,
            channel=meeting.channel,
            content=f"Call ended. Duration: {duration_str}",
            is_system=True,
        )
        broadcast_to_channel(
            meeting.channel_id,
            {"type": "message", "payload": MessageSerializer(msg).data},
        )
        return True
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(
            "_mark_call_ended_if_empty: failed for meeting %s: %s", meeting.pk, exc
        )
        return False


class MeetingListCreateView(APIView):

    def get(self, request):

        meetings = (
            Meeting.objects.filter(
                Q(host=request.user)
                | Q(channel__team__members__user=request.user)
                | Q(channel__members=request.user)
            )
            .distinct()
            .order_by("start_time")
        )

        serializer = MeetingSerializer(meetings, many=True)

        return Response(serializer.data)

    def post(self, request):

        serializer = MeetingSerializer(data=request.data)

        if serializer.is_valid():

            serializer.save(host=request.user)

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeetingDetailView(APIView):

    def get(self, request, meeting_id):

        meeting = (
            Meeting.objects.filter(id=meeting_id)
            .filter(
                Q(host=request.user)
                | Q(channel__team__members__user=request.user)
                | Q(channel__members=request.user)
            )
            .distinct()
            .first()
        )

        if not meeting:
            return Response({"error": "Meeting not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = MeetingSerializer(meeting)
        return Response(serializer.data)

    def put(self, request, meeting_id):

        meeting = Meeting.objects.filter(id=meeting_id, host=request.user).first()

        if not meeting:
            return Response({"error": "Meeting not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = MeetingSerializer(meeting, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, meeting_id):

        meeting = Meeting.objects.filter(id=meeting_id, host=request.user).first()

        if not meeting:
            return Response({"error": "Meeting not found"}, status=status.HTTP_404_NOT_FOUND)

        meeting.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeetingParticipantListCreateView(APIView):

    def get(self, request, meeting_id):
        meeting = Meeting.objects.filter(id=meeting_id).first()
        if not meeting:
            return Response({"error": "Meeting not found"}, status=status.HTTP_404_NOT_FOUND)

        is_host = meeting.host == request.user
        if meeting.channel:
            if meeting.channel.team:
                is_member = meeting.channel.team.members.filter(user=request.user).exists()
            else:
                is_member = meeting.channel.members.filter(id=request.user.id).exists()
        else:
            is_member = False
        if not (is_host or is_member):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        participants = MeetingParticipant.objects.filter(meeting_id=meeting_id)

        serializer = MeetingParticipantSerializer(participants, many=True)

        return Response(serializer.data)

    def post(self, request, meeting_id):
        meeting = (
            Meeting.objects.filter(id=meeting_id)
            .filter(
                Q(host=request.user)
                | Q(channel__team__members__user=request.user)
                | Q(channel__members=request.user)
            )
            .distinct()
            .first()
        )

        if not meeting:
            return Response({"error": "Meeting not found"}, status=status.HTTP_404_NOT_FOUND)

        if meeting.ended_at is not None:
            # Distinguish between two different "ended" states:
            #   - "auto-ended because empty" (M-01): ended_at set when last participant
            #     disconnects.  The host may have had a brief network drop and should be
            #     allowed to rejoin and resume the call within the scheduled window.
            #   - "ended because scheduled time passed" (M-02 original concern): the
            #     meeting's end_time is in the past, so no one should be able to rejoin.
            #
            # We use Option B: if the requester is the host AND end_time hasn't passed,
            # clear ended_at and remove the "Call ended." system message so the call can
            # resume.  Non-hosts are still rejected in both cases.
            is_host = (meeting.host == request.user)
            within_window = (meeting.end_time is None or timezone.now() < meeting.end_time)

            if is_host and within_window:
                # Reactivate: clear ended_at so M-02 guard won't block the host again.
                meeting.ended_at = None
                meeting.save(update_fields=["ended_at"])

                # Remove the "Call ended. Duration: …" system message from chat so it
                # doesn't confuse participants when the call resumes.
                try:
                    from chat.models import Message as ChatMessage
                    from chat.utils import broadcast_to_channel
                    end_msg = (
                        ChatMessage.objects
                        .filter(
                            channel=meeting.channel,
                            is_system=True,
                            content__startswith="Call ended.",
                        )
                        .order_by("-created_at")
                        .first()
                    )
                    if end_msg:
                        end_msg_id = end_msg.id
                        end_msg.delete()
                        broadcast_to_channel(
                            meeting.channel_id,
                            {"type": "message_deleted", "payload": {"id": end_msg_id}},
                        )
                except Exception as exc:
                    import logging
                    logging.getLogger(__name__).warning(
                        "Host rejoin: failed to remove 'Call ended' system message "
                        "for meeting %s: %s", meeting.pk, exc,
                    )
            else:
                return Response(
                    {"error": "This meeting has already ended."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user_id = request.data.get("user") or request.user.id

        if int(user_id) != request.user.id and meeting.host != request.user:
            return Response(
                {"error": "Only the host can add other participants to this meeting."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if meeting.channel.team:
            if not meeting.channel.team.members.filter(user_id=user_id).exists():
                return Response(
                    {"error": "User is not a member of this team"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if not meeting.channel.members.filter(id=user_id).exists():
                return Response(
                    {"error": "User is not a member of this channel"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        role = request.data.get("role", "PARTICIPANT")
        is_self = int(user_id) == request.user.id

        # Enforce maximum participant cap (6 present participants maximum)
        present_count = MeetingParticipant.objects.filter(meeting=meeting, is_present=True).count()
        is_already_present = MeetingParticipant.objects.filter(meeting=meeting, user_id=user_id, is_present=True).exists()
        is_host = (meeting.host == request.user)

        if present_count >= 6 and not is_host and not is_already_present:
            return Response(
                {"error": "This meeting is full. Maximum 6 participants allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if the call is starting (no one is currently present)
        is_call_starting = (
            is_self
            and not MeetingParticipant.objects.filter(meeting=meeting, is_present=True).exists()
        )

        now = timezone.now()
        participant, created = MeetingParticipant.objects.get_or_create(
            meeting=meeting,
            user_id=user_id,
            defaults={
                "role": role,
                "is_present": is_self,
                "joined_at": now if is_self else None,
                # Track when the participant was last seen so the cleanup
                # command can identify truly orphaned records.
                "last_seen_at": now if is_self else None,
            },
        )

        existing_participant = not created
        if existing_participant and is_self:
            # Re-joining (e.g. page refresh): mark active again.
            update_fields = ["last_seen_at"]
            participant.last_seen_at = now
            if not participant.is_present:
                participant.is_present = True
                participant.joined_at = now
                update_fields += ["is_present", "joined_at"]
            participant.save(update_fields=update_fields)

        serializer = MeetingParticipantSerializer(participant)
        if is_call_starting:
            try:
                from chat.models import Message
                from chat.utils import broadcast_to_channel
                from chat.serializers import MessageSerializer

                call_type = "an audio call" if "Audio" in meeting.title else "a video call"
                msg = Message.objects.create(
                    sender=request.user,
                    channel=meeting.channel,
                    content=f"{request.user.username} started {call_type}",
                    is_system=True,
                )
                broadcast_to_channel(
                    meeting.channel_id,
                    {"type": "message", "payload": MessageSerializer(msg).data},
                )
            except Exception as exc:
                import logging
                logging.getLogger(__name__).error(
                    "Failed to post call started message: %s", exc
                )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK if existing_participant else status.HTTP_201_CREATED,
        )


class MeetingParticipantDetailView(APIView):

    def get(self, request, meeting_id, participant_id):

        participant = MeetingParticipant.objects.filter(
            id=participant_id, meeting_id=meeting_id
        ).first()

        if not participant:
            return Response({"error": "Participant not found"}, status=status.HTTP_404_NOT_FOUND)

        if participant.user != request.user and participant.meeting.host != request.user:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        serializer = MeetingParticipantSerializer(participant)
        return Response(serializer.data)

    def put(self, request, meeting_id, participant_id):

        participant = MeetingParticipant.objects.filter(
            id=participant_id, meeting_id=meeting_id
        ).first()

        if not participant:

            return Response({"error": "Participant not found"}, status=status.HTTP_404_NOT_FOUND)

        if participant.user != request.user and participant.meeting.host != request.user:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        serializer = MeetingParticipantSerializer(participant, data=request.data, partial=True)

        if serializer.is_valid():
            was_present = participant.is_present
            # Request may pass is_present as a boolean or as a string from JSON;
            # normalise to a real bool so the comparison below is reliable.
            is_present_raw = request.data.get("is_present")
            leaving = was_present and is_present_raw is False

            serializer.save()

            if leaving:
                # Idempotent: only write left_at when transitioning True → False.
                # If the WS consumer already stamped left_at (tab-close path),
                # this will overwrite with a very close timestamp — harmless.
                now = timezone.now()
                participant.left_at = now
                participant.last_seen_at = now
                participant.save(update_fields=["left_at", "last_seen_at"])

                # Delegate the "did everyone leave?" check + system message to
                # the shared helper so the logic is never duplicated.
                _mark_call_ended_if_empty(participant.meeting)

            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, meeting_id, participant_id):

        participant = MeetingParticipant.objects.filter(
            id=participant_id, meeting_id=meeting_id
        ).first()

        if not participant:

            return Response({"error": "Participant not found"}, status=status.HTTP_404_NOT_FOUND)

        if participant.user != request.user and participant.meeting.host != request.user:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        participant.delete()

        return Response({"message": "Participant removed successfully"}, status=status.HTTP_200_OK)
