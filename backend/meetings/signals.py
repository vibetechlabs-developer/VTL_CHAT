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
        
        # Get all other team members
        other_members = team.members.exclude(user=host)
        for member in other_members:
            Notification.objects.create(
                recipient=member.user,
                title="New meeting scheduled",
                message=f"Meeting '{instance.title}' has been scheduled in #{channel.name} by {host.username}.",
                notification_type="MEETING"
            )
