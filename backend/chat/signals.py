from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Message
from notifications.models import Notification

@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        channel = instance.channel
        team = channel.team
        sender_user = instance.sender
        
        # Find all other team members
        other_members = team.members.exclude(user=sender_user)
        for member in other_members:
            Notification.objects.create(
                recipient=member.user,
                title=f"New message in #{channel.name}",
                message=f"{sender_user.username}: {instance.content[:50]}",
                notification_type="MESSAGE"
            )
