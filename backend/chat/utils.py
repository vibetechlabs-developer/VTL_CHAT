from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_to_channel(channel_id, data):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"chat_{channel_id}",
        {
            "type": "chat.event",
            "data": data,
        },
    )
