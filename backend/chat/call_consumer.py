"""
WebRTC signaling consumer for video/audio call rooms.

Route: ws/call/{meeting_id}/
Protocol:
  - On connect: user joins meeting group, existing peers are notified,
    and the participant's last_seen_at is stamped in the database.
  - Clients exchange SDP offers/answers and ICE candidates via JSON messages.
  - On disconnect: the participant's is_present flag is cleared in the database
    (handles abrupt disconnects such as tab-close, network loss, or crashes),
    and if no participants remain the call is automatically marked as ended.

M-01 FIX SUMMARY
----------------
Previously, disconnect() only broadcast a peer_left WebSocket event but never
touched the database.  If a user closed their browser tab the MeetingParticipant
row kept is_present=True forever.

Now disconnect() calls remove_participant_presence() via database_sync_to_async,
which:
  1. Sets is_present=False + left_at=now() for this user+meeting (idempotent).
  2. Calls the shared _mark_call_ended_if_empty() helper from meetings.views to
     check if the call is now empty, stamp meeting.ended_at, and broadcast the
     "Call ended. Duration: …" system message.

The DB call is wrapped in try/except so a database hiccup never silences the
peer_left broadcast that other clients depend on to clean up their RTCPeerConnection.
"""

import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from meetings.models import Meeting, MeetingParticipant

logger = logging.getLogger(__name__)


class CallConsumer(AsyncWebsocketConsumer):

    # ------------------------------------------------------------------
    # Database helpers (run in a thread-pool via database_sync_to_async)
    # ------------------------------------------------------------------

    @database_sync_to_async
    def user_can_join(self, user, meeting_id):
        """Check that the meeting exists and the user is a team/channel member."""
        try:
            meeting = Meeting.objects.select_related("channel__team").get(pk=meeting_id)
        except Meeting.DoesNotExist:
            return False
        if meeting.host == user:
            return True
        if meeting.channel:
            if meeting.channel.team:
                return meeting.channel.team.members.filter(user=user).exists()
            else:
                return meeting.channel.members.filter(id=user.id).exists()
        return False

    @database_sync_to_async
    def stamp_last_seen(self, user, meeting_id):
        """
        Update last_seen_at for the participant when they connect.
        This is a best-effort operation — failure is logged but not fatal.
        """
        MeetingParticipant.objects.filter(
            meeting_id=meeting_id, user=user
        ).update(last_seen_at=timezone.now())

    @database_sync_to_async
    def remove_participant_presence(self, user, meeting_id):
        """
        Core of the M-01 fix.

        Marks the participant as no longer present in the database, then
        checks whether the call should be closed entirely.

        Idempotent: if the row already has is_present=False (e.g. the client
        managed to fire the REST PUT before the socket closed) we still refresh
        left_at to the current time but we do NOT double-fire _mark_call_ended.

        Returns True if the call was just ended, False otherwise.
        """
        now = timezone.now()

        # Fetch with select_related so _mark_call_ended_if_empty can access
        # meeting.channel / meeting.host without extra queries.
        try:
            participant = MeetingParticipant.objects.select_related(
                "meeting__channel__team", "meeting__host"
            ).get(meeting_id=meeting_id, user=user)
        except MeetingParticipant.DoesNotExist:
            # Participant record was never created (e.g. join failed mid-way).
            return False

        was_present = participant.is_present

        # Always stamp left_at and last_seen_at on a WS disconnect.
        participant.is_present = False
        participant.left_at = now
        participant.last_seen_at = now
        participant.save(update_fields=["is_present", "left_at", "last_seen_at"])

        if not was_present:
            # Already marked as not present (REST PUT fired before socket closed).
            # _mark_call_ended_if_empty would be a no-op, but skip the import entirely.
            return False

        # Delegate to the shared helper so the call-ended logic is never duplicated.
        from meetings.views import _mark_call_ended_if_empty
        return _mark_call_ended_if_empty(participant.meeting)

    # ------------------------------------------------------------------
    # WebSocket lifecycle
    # ------------------------------------------------------------------

    async def connect(self):
        self.meeting_id = self.scope["url_route"]["kwargs"]["meeting_id"]
        self.room_group = f"call_{self.meeting_id}"
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        if not await self.user_can_join(user, self.meeting_id):
            await self.close(code=4003)
            return

        self.user = user
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        # Stamp last_seen_at so cleanup tooling knows this connection is live.
        # Best-effort: if the participant record doesn't exist yet (race with the
        # REST join POST) the UPDATE silently matches 0 rows.
        try:
            await self.stamp_last_seen(user, self.meeting_id)
        except Exception as exc:
            logger.warning(
                "CallConsumer.connect: stamp_last_seen failed for user=%s meeting=%s: %s",
                user.id, self.meeting_id, exc,
            )

        # Notify existing peers that a new user joined.
        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "call.event",
                "data": {
                    "type": "peer_joined",
                    "sender_id": user.id,
                    "sender_username": user.username,
                },
                "sender_channel": self.channel_name,
            },
        )

    async def disconnect(self, close_code):
        if not hasattr(self, "room_group"):
            return

        # ----------------------------------------------------------------
        # M-01 FIX: clean up participant presence in the DB.
        #
        # We do this BEFORE broadcasting peer_left so that if the broadcast
        # fails the DB is still consistent.  The try/except guarantees that
        # a DB error never swallows the peer_left broadcast.
        # ----------------------------------------------------------------
        if hasattr(self, "user") and self.user.is_authenticated:
            try:
                await self.remove_participant_presence(self.user, self.meeting_id)
            except Exception as exc:
                logger.error(
                    "CallConsumer.disconnect: remove_participant_presence failed "
                    "for user=%s meeting=%s: %s",
                    self.user.id, self.meeting_id, exc,
                )

            # Notify remaining peers regardless of whether the DB call succeeded.
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "call.event",
                    "data": {
                        "type": "peer_left",
                        "sender_id": self.user.id,
                        "sender_username": self.user.username,
                    },
                    "sender_channel": self.channel_name,
                },
            )

        await self.channel_layer.group_discard(self.room_group, self.channel_name)

    # ------------------------------------------------------------------
    # Message relay (signaling)
    # ------------------------------------------------------------------

    async def receive(self, text_data):
        """Relay SDP offer/answer and ICE candidate messages between peers."""
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = data.get("type")

        if msg_type in ("offer", "answer", "ice_candidate"):
            # These are point-to-point: routed to the full group but filtered
            # client-side by target_user_id.
            target_user_id = data.get("target")
            payload = {
                "type": "call.event",
                "data": {
                    "type": msg_type,
                    "sender_id": self.user.id,
                    "sender_username": self.user.username,
                    "target": target_user_id,
                    **{k: v for k, v in data.items() if k not in ("type", "target")},
                },
                "sender_channel": self.channel_name,
            }
            await self.channel_layer.group_send(self.room_group, payload)

    async def call_event(self, event):
        """Send event to WebSocket client; skip if this consumer is the sender."""
        if event.get("sender_channel") == self.channel_name:
            return
        await self.send(text_data=json.dumps(event["data"]))
