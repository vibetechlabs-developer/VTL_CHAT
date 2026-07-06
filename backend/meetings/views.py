from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Meeting, MeetingParticipant
from .serializers import (
    MeetingSerializer,
    MeetingParticipantSerializer
)

class MeetingListCreateView(APIView):

    def get(self, request):

        meetings = Meeting.objects.filter(
            Q(host=request.user) |
            Q(channel__team__members__user=request.user) |
            Q(channel__members=request.user)
        ).distinct().order_by("start_time")

        serializer = MeetingSerializer(
            meetings,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        serializer = MeetingSerializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save(host=request.user)

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
class MeetingDetailView(APIView):

    def get(self, request, meeting_id):

        meeting = Meeting.objects.filter(
            id=meeting_id
        ).filter(
            Q(host=request.user) |
            Q(channel__team__members__user=request.user) |
            Q(channel__members=request.user)
        ).distinct().first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = MeetingSerializer(meeting)
        return Response(serializer.data)

    def put(self, request, meeting_id):

        meeting = Meeting.objects.filter(
            id=meeting_id,
            host=request.user
        ).first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = MeetingSerializer(
            meeting,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, meeting_id):

        meeting = Meeting.objects.filter(
            id=meeting_id,
            host=request.user
        ).first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        meeting.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
class MeetingParticipantListCreateView(APIView):

    def get(self, request, meeting_id):
        meeting = Meeting.objects.filter(id=meeting_id).first()
        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        is_host = (meeting.host == request.user)
        if meeting.channel.team:
            is_member = meeting.channel.team.members.filter(user=request.user).exists()
        else:
            is_member = meeting.channel.members.filter(id=request.user.id).exists()
        if not (is_host or is_member):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )

        participants = MeetingParticipant.objects.filter(
            meeting_id=meeting_id
        )

        serializer = MeetingParticipantSerializer(
            participants,
            many=True
        )

        return Response(serializer.data)

    def post(self, request, meeting_id):
        meeting = Meeting.objects.filter(id=meeting_id).filter(
            Q(host=request.user) |
            Q(channel__team__members__user=request.user) |
            Q(channel__members=request.user)
        ).distinct().first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        user_id = request.data.get("user") or request.user.id

        if int(user_id) != request.user.id and meeting.host != request.user:
            return Response(
                {"error": "Only the host can add other participants to this meeting."},
                status=status.HTTP_403_FORBIDDEN
            )

        if meeting.channel.team:
            if not meeting.channel.team.members.filter(user_id=user_id).exists():
                return Response(
                    {"error": "User is not a member of this team"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            if not meeting.channel.members.filter(id=user_id).exists():
                return Response(
                    {"error": "User is not a member of this channel"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        role = request.data.get("role", "PARTICIPANT")
        is_self = (int(user_id) == request.user.id)

        # Check if the call is starting (no one is currently present)
        is_call_starting = is_self and not MeetingParticipant.objects.filter(
            meeting=meeting,
            is_present=True
        ).exists()

        existing_participant = MeetingParticipant.objects.filter(
            meeting=meeting,
            user_id=user_id
        ).first()

        if existing_participant:
            if not existing_participant.is_present:
                existing_participant.is_present = True
                existing_participant.joined_at = timezone.now()
                existing_participant.save()
            serializer = MeetingParticipantSerializer(existing_participant)
        else:
            participant = MeetingParticipant.objects.create(
                meeting=meeting,
                user_id=user_id,
                role=role,
                is_present=is_self,
                joined_at=timezone.now() if is_self else None
            )
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
                    is_system=True
                )

                # Broadcast the message
                msg_serializer = MessageSerializer(msg)
                broadcast_to_channel(meeting.channel_id, {"type": "message", "payload": msg_serializer.data})
            except Exception as e:
                print("Failed to post call started message:", e)

        return Response(serializer.data, status=status.HTTP_200_OK if existing_participant else status.HTTP_201_CREATED)


class MeetingParticipantDetailView(APIView):

    def get(
        self,
        request,
        meeting_id,
        participant_id
    ):

        participant = MeetingParticipant.objects.filter(
            id=participant_id,
            meeting_id=meeting_id
        ).first()

        
        if not participant:
            return Response(
                {"error": "Participant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if (
            participant.user != request.user
            and participant.meeting.host != request.user
        ):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = MeetingParticipantSerializer(participant)
        return Response(serializer.data)

    def put(
        self,
        request,
        meeting_id,
        participant_id
    ):

        participant = MeetingParticipant.objects.filter(
            id=participant_id,
            meeting_id=meeting_id
        ).first()

        if not participant:

            return Response(
                {"error": "Participant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if (
                participant.user != request.user
                and participant.meeting.host != request.user
            ):
                return Response(
                    {"error": "Permission denied"},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = MeetingParticipantSerializer(
            participant,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            was_present = participant.is_present
            is_present = request.data.get("is_present")

            serializer.save()

            if was_present and is_present is False:
                # User left the call
                participant.left_at = timezone.now()
                participant.save()

                meeting = participant.meeting
                any_present = MeetingParticipant.objects.filter(
                    meeting=meeting,
                    is_present=True
                ).exists()

                if not any_present:
                    # No one left in the call! Call has ended.
                    try:
                        # Find the earliest joined_at to calculate duration
                        earliest_participant = MeetingParticipant.objects.filter(
                            meeting=meeting,
                            joined_at__isnull=False
                        ).order_by('joined_at').first()

                        start_time = earliest_participant.joined_at if earliest_participant else meeting.created_at
                        end_time = timezone.now()
                        duration = end_time - start_time

                        total_seconds = int(duration.total_seconds())
                        hours = total_seconds // 3600
                        minutes = (total_seconds % 3600) // 60
                        seconds = total_seconds % 60

                        duration_str = ""
                        if hours > 0:
                            duration_str += f"{hours}h "
                        if minutes > 0 or hours > 0:
                            duration_str += f"{minutes}m "
                        duration_str += f"{seconds}s"

                        from chat.models import Message
                        from chat.utils import broadcast_to_channel
                        from chat.serializers import MessageSerializer

                        msg = Message.objects.create(
                            sender=meeting.host,
                            channel=meeting.channel,
                            content=f"Call ended. Duration: {duration_str}",
                            is_system=True
                        )

                        msg_serializer = MessageSerializer(msg)
                        broadcast_to_channel(meeting.channel_id, {"type": "message", "payload": msg_serializer.data})
                    except Exception as e:
                        print("Failed to post call ended message:", e)

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(
        self,
        request,
        meeting_id,
        participant_id
    ):

        participant = MeetingParticipant.objects.filter(
            id=participant_id,
            meeting_id=meeting_id
        ).first()



        if not participant:

            return Response(
                {"error": "Participant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if (
                participant.user != request.user
                and participant.meeting.host != request.user
            ):
                return Response(
                    {"error": "Permission denied"},
                    status=status.HTTP_403_FORBIDDEN
                )

        participant.delete()

        return Response(
            {
                "message":
                "Participant removed successfully"
            },
            status=status.HTTP_200_OK
        )