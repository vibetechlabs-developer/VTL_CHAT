"""
Global per-user WebSocket consumer.
Connects authenticated users to their personal Channel Layer group
so they can receive real-time events (notifications, DM alerts, etc.)
without polling the REST API.

Group naming convention:  user_events_{user_id}
"""

import json

from channels.generic.websocket import AsyncWebsocketConsumer


class GlobalEventsConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            await self.close()
            return

        self.user = user
        self.user_group = f"user_events_{user.id}"

        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "user_group"):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

    # -------------------------------------------------------------------
    # Handlers for messages pushed FROM the backend (via group_send)
    # -------------------------------------------------------------------

    async def user_notification(self, event):
        """Deliver a new notification payload to the connected client."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "notification",
                    "payload": event["data"],
                }
            )
        )
