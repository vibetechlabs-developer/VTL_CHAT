import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from teams.models import Channel


class ChatConsumer(AsyncWebsocketConsumer):

    @database_sync_to_async
    def user_can_access_channel(self, user, channel_id):
        return Channel.objects.filter(
            pk=channel_id,
            team__members__user=user,
        ).exists()

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

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group"):
            await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def chat_event(self, event):
        await self.send(text_data=json.dumps(event["data"]))
