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


@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        channel = instance.channel
        sender_user = instance.sender
        
        # 1. Handle Direct Message notifications
        if channel.channel_type == 'DIRECT':
            other_members = channel.members.exclude(id=sender_user.id)
            for member in other_members:
                notif = Notification.objects.create(
                    recipient=member,
                    title=f"New message from {sender_user.username}",
                    message=f"{instance.content[:50]}",
                    notification_type="MESSAGE"
                )
                _push_notification_to_user(notif)
                
        # 2. Handle Team Channel notifications & Mentions
        elif channel.team:
            # Detect @mentions
            mentioned_usernames = re.findall(r'@(\w+)', instance.content)
            mentioned_users = []
            if mentioned_usernames:
                mentioned_users = list(User.objects.filter(username__in=mentioned_usernames))
                
            for user in mentioned_users:
                if user != sender_user:
                    notif = Notification.objects.create(
                        recipient=user,
                        title=f"You were mentioned in #{channel.name}",
                        message=f"{sender_user.username}: {instance.content[:50]}",
                        notification_type="MENTION"
                    )
                    _push_notification_to_user(notif)
            
            # Send standard channel notifications (excluding mentioned users to avoid duplicates)
            mentioned_user_ids = [u.id for u in mentioned_users]
            other_members = channel.team.members.exclude(user=sender_user).exclude(user_id__in=mentioned_user_ids)
            for member in other_members:
                notif = Notification.objects.create(
                    recipient=member.user,
                    title=f"New message in #{channel.name}",
                    message=f"{sender_user.username}: {instance.content[:50]}",
                    notification_type="MESSAGE"
                )
                _push_notification_to_user(notif)


@receiver(post_save, sender=Notification)
def push_any_notification(sender, instance, created, **kwargs):
    """Catch-all: push any newly created notification (e.g. meeting notifications)."""
    if created:
        _push_notification_to_user(instance)


@receiver(post_delete, sender=Attachment)
def delete_attachment_file_on_delete(sender, instance, **kwargs):
    """Delete the physical file from storage when an Attachment record is deleted."""
    if instance.file:
        try:
            instance.file.delete(save=False)
        except Exception:
            pass


@receiver(pre_save, sender=Attachment)
def delete_old_attachment_file_on_change(sender, instance, **kwargs):
    """If an Attachment's file field is replaced, delete the old file from storage."""
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
