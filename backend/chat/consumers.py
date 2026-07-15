import json
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from chat.access import user_can_access_channel


class ChatConsumer(AsyncWebsocketConsumer):

    @database_sync_to_async
    def check_channel_access(self, user, channel_id):
        return user_can_access_channel(user, channel_id)

    async def connect(self):
        self.channel_id = self.scope["url_route"]["kwargs"]["channel_id"]
        self.room_group = f"chat_{self.channel_id}"
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        if not await self.check_channel_access(user, self.channel_id):
            await self.close(code=4003)
            return

        self.user = user
        self._last_typing_sent = 0
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group"):
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
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        action = data.get("action")

        if action == "typing":
            user = getattr(self, "user", None)
            if not user or not user.is_authenticated:
                return

            is_typing = data.get("is_typing", True)
            now = time.monotonic()
            if is_typing and now - getattr(self, "_last_typing_sent", 0) < 2.0:
                return
            self._last_typing_sent = now

            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "chat.event",
                    "data": {
                        "type": "typing",
                        "user_id": user.id,
                        "username": user.username,
                        "is_typing": is_typing,
                    },
                },
            )

    async def chat_event(self, event):
        await self.send(text_data=json.dumps(event["data"]))
