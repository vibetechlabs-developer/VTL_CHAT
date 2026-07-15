import re

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver

from .models import Message, Attachment
from notifications.models import Notification
from users.models import User


def _push_notification_to_user(notification):
    """Push a notification to the user's global WebSocket group in real-time."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            f"user_events_{notification.recipient_id}",
            {
                "type": "user.notification",
                "data": {
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
                    "notification_type": notification.notification_type,
                    "is_read": notification.is_read,
                    "created_at": notification.created_at.isoformat(),
                },
            },
        )
    except Exception:
        pass


def _user_wants_notification(user, notification_type):
    prefs = getattr(user, "notification_preferences", None)
    if prefs is None:
        return True
    mapping = {
        "MESSAGE": prefs.message_notifications,
        "MENTION": prefs.mention_notifications,
        "MEETING": prefs.meeting_notifications,
        "TEAM": prefs.message_notifications,
    }
    return mapping.get(notification_type, True)


@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if not created:
        return

    channel = (
        instance.channel.__class__.objects.select_related("team")
        .prefetch_related("members")
        .get(pk=instance.channel_id)
    )
    sender_user = instance.sender
    notifications_to_create = []

    if channel.channel_type == "DIRECT":
        for member in channel.members.exclude(id=sender_user.id):
            if not _user_wants_notification(member, "MESSAGE"):
                continue
            notifications_to_create.append(
                Notification(
                    recipient=member,
                    title=f"New message from {sender_user.username}",
                    message=f"{instance.content[:50]}",
                    notification_type="MESSAGE",
                )
            )
    elif channel.team:
        mentioned_usernames = re.findall(r"@(\w+)", instance.content)
        mentioned_users = []
        if mentioned_usernames:
            mentioned_users = list(User.objects.filter(username__in=mentioned_usernames))

        mentioned_user_ids = set()
        for user in mentioned_users:
            if user == sender_user:
                continue
            if not _user_wants_notification(user, "MENTION"):
                continue
            mentioned_user_ids.add(user.id)
            notifications_to_create.append(
                Notification(
                    recipient=user,
                    title=f"You were mentioned in #{channel.name}",
                    message=f"{sender_user.username}: {instance.content[:50]}",
                    notification_type="MENTION",
                )
            )

        team_members = (
            channel.team.members.select_related("user")
            .exclude(user=sender_user)
            .exclude(user_id__in=mentioned_user_ids)
        )
        for member in team_members:
            if not _user_wants_notification(member.user, "MESSAGE"):
                continue
            notifications_to_create.append(
                Notification(
                    recipient=member.user,
                    title=f"New message in #{channel.name}",
                    message=f"{sender_user.username}: {instance.content[:50]}",
                    notification_type="MESSAGE",
                )
            )

    if notifications_to_create:
        created_notifications = Notification.objects.bulk_create(notifications_to_create)
        for notif in created_notifications:
            _push_notification_to_user(notif)


@receiver(post_save, sender=Notification)
def push_any_notification(sender, instance, created, **kwargs):
    """Push notifications created outside the message signal (e.g. meetings, teams)."""
    if created:
        _push_notification_to_user(instance)


@receiver(post_delete, sender=Attachment)
def delete_attachment_file_on_delete(sender, instance, **kwargs):
    if instance.file:
        try:
            instance.file.delete(save=False)
        except Exception:
            pass


@receiver(pre_save, sender=Attachment)
def delete_old_attachment_file_on_change(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old_instance = Attachment.objects.get(pk=instance.pk)
    except Attachment.DoesNotExist:
        return
    if old_instance.file and old_instance.file != instance.file:
        try:
            old_instance.file.delete(save=False)
        except Exception:
            pass
