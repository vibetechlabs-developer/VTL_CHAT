"""
WebRTC signaling consumer for video/audio call rooms.

Route: ws/call/{meeting_id}/
Protocol:
  - On connect: user joins meeting group, existing peers are notified.
  - Clients exchange SDP offers/answers and ICE candidates via JSON messages.
  - On disconnect: other peers are notified so they can clean up the connection.
"""

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from meetings.models import Meeting


class CallConsumer(AsyncWebsocketConsumer):

    @database_sync_to_async
    def user_can_join(self, user, meeting_id):
        """Check that the meeting exists and the user is a team member."""
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

    async def connect(self):
        self.meeting_id = self.scope["url_route"]["kwargs"]["meeting_id"]
        self.room_group = f"call_{self.meeting_id}"
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            await self.close()
            return

        if not await self.user_can_join(user, self.meeting_id):
            await self.close()
            return

        self.user = user
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        # Notify existing peers that a new user joined
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
        if hasattr(self, "room_group"):
            # Notify peers that user left
            if hasattr(self, "user") and self.user.is_authenticated:
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

    async def receive(self, text_data):
        """Relay signaling messages between peers."""
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = data.get("type")

        if msg_type in ("offer", "answer", "ice_candidate"):
            # These are targeted to a specific peer
            target_user_id = data.get("target")
            payload = {
                "type": "call.event",
                "data": {
                    "type": msg_type,
                    "sender_id": self.user.id,
                    "sender_username": self.user.username,
                    **{k: v for k, v in data.items() if k not in ("type", "target")},
                },
                "sender_channel": self.channel_name,
            }
            # Broadcast to group; client-side filtering by target_user_id
            payload["data"]["target"] = target_user_id
            await self.channel_layer.group_send(self.room_group, payload)

    async def call_event(self, event):
        """Send event to WebSocket client, skip if sender is self."""
        if event.get("sender_channel") == self.channel_name:
            return
        await self.send(text_data=json.dumps(event["data"]))
