import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from teams.models import Channel


class ChatConsumer(AsyncWebsocketConsumer):

    @database_sync_to_async
    def user_can_access_channel(self, user, channel_id):
        try:
            channel = Channel.objects.get(pk=channel_id)
        except Channel.DoesNotExist:
            return False

        if channel.channel_type == 'PUBLIC':
            return channel.team and channel.team.members.filter(user=user).exists()
        elif channel.channel_type == 'PRIVATE':
            return channel.team and channel.team.members.filter(user=user).exists() and channel.members.filter(id=user.id).exists()
        elif channel.channel_type == 'DIRECT':
            return channel.members.filter(id=user.id).exists()

        return False

    async def connect(self):
        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]
        self.room_group = f"chat_{self.channel_id}"
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            await self.close()
            return

        if not await self.user_can_access_channel(user, self.channel_id):
            await self.close()
            return

        self.user = user
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group"):
            # Broadcast that user stopped typing on disconnect
            if hasattr(self, "user") and self.user.is_authenticated:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        "type": "chat.event",
                        "data": {
                            "type": "typing",
                            "user_id": self.user.id,
                            "username": self.user.username,
                            "is_typing": False,
                        },
                    },
                )
            await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages from clients."""
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        action = data.get("action")

        if action == "typing":
            # Broadcast typing indicator to the channel group (excluding sender)
            user = getattr(self, "user", None)
            if user and user.is_authenticated:
                await self.channel_layer.group_send(
                    self.room_group,
                    {
                        "type": "chat.event",
                        "data": {
                            "type": "typing",
                            "user_id": user.id,
                            "username": user.username,
                            "is_typing": data.get("is_typing", True),
                        },
                    },
                )

    async def chat_event(self, event):
        await self.send(text_data=json.dumps(event["data"]))
