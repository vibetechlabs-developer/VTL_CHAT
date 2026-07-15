from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Meeting
from notifications.models import Notification
from chat.signals import _push_notification_to_user


@receiver(post_save, sender=Meeting)
def create_meeting_notification(sender, instance, created, **kwargs):
    if not created:
        return

    channel = (
        instance.channel.__class__.objects.select_related("team")
        .prefetch_related("members")
        .get(pk=instance.channel_id)
    )
    host = instance.host
    notifications_to_create = []

    if channel.team:
        for member in channel.team.members.select_related("user").exclude(user=host):
            notifications_to_create.append(
                Notification(
                    recipient=member.user,
                    title="New meeting scheduled",
                    message=(
                        f"Meeting '{instance.title}' has been scheduled in "
                        f"#{channel.name} by {host.username}."
                    ),
                    notification_type="MEETING",
                )
            )
    else:
        for recipient in channel.members.exclude(id=host.id):
            notifications_to_create.append(
                Notification(
                    recipient=recipient,
                    title="New meeting scheduled",
                    message=(
                        f"Meeting '{instance.title}' has been scheduled in "
                        f"#{channel.name} by {host.username}."
                    ),
                    notification_type="MEETING",
                )
            )

    if notifications_to_create:
        created_notifications = Notification.objects.bulk_create(notifications_to_create)
        for notif in created_notifications:
            _push_notification_to_user(notif)
