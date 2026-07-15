import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_to_channel(channel_id, data):
    """Broadcast data to a channel group.
    Errors during Redis/channel layer communication are logged but do not
    interrupt the calling view – message persistence already succeeded.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            f"chat_{channel_id}",
            {
                "type": "chat.event",
                "data": data,
            },
        )
    except Exception as exc:
        logging.error(f"Failed to broadcast to channel {channel_id}: {exc}")
        # Continue silently; message already saved
