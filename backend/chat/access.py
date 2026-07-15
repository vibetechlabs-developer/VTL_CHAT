"""Shared channel access checks used by REST views and WebSocket consumers."""

from teams.models import Channel


def user_can_access_channel(user, channel_id):
    """Return True if user may access the channel."""
    try:
        channel = Channel.objects.get(pk=channel_id)
    except Channel.DoesNotExist:
        return False

    if channel.channel_type == "PUBLIC":
        return channel.team and channel.team.members.filter(user=user).exists()
    if channel.channel_type == "PRIVATE":
        return (
            channel.team
            and channel.team.members.filter(user=user).exists()
            and channel.members.filter(id=user.id).exists()
        )
    if channel.channel_type == "DIRECT":
        return channel.members.filter(id=user.id).exists()

    return False


def get_accessible_channel(user, pk):
    """Return the Channel instance if accessible, else None."""
    try:
        channel = Channel.objects.get(pk=pk)
    except Channel.DoesNotExist:
        return None

    if user_can_access_channel(user, channel.pk):
        return channel
    return None
