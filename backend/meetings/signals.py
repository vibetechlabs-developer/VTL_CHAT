from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Meeting
from notifications.models import Notification

@receiver(post_save, sender=Meeting)
def create_meeting_notification(sender, instance, created, **kwargs):
    if created:
        channel = instance.channel
        team = channel.team
        host = instance.host
        
        # Get other users to notify
        if team:
            other_recipients = [m.user for m in team.members.exclude(user=host)]
        else:
            other_recipients = list(channel.members.exclude(id=host.id))
            
        for recipient in other_recipients:
            Notification.objects.create(
                recipient=recipient,
                title="New meeting scheduled",
                message=f"Meeting '{instance.title}' has been scheduled in #{channel.name} by {host.username}.",
                notification_type="MEETING"
            )
