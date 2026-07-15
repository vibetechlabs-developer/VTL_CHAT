from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import TeamMember
from notifications.models import Notification


@receiver(post_save, sender=TeamMember)
def create_team_member_notification(sender, instance, created, **kwargs):
    if created:
        # Existing notification for the added user
        Notification.objects.create(
            recipient=instance.user,
            title="Added to team",
            message=f"You have been added to the team '{instance.team.name}' as a {instance.role.title()}.",
            notification_type="TEAM",
        )
        # Create a system message visible to the team's channel(s)
        from chat.models import Message

        # Find a channel associated with the team (fallback to first channel)
        channel = instance.team.channels.first()
        if channel:
            msg = Message.objects.create(
                sender=instance.user,  # could be the added user or a system user
                channel=channel,
                content=f"{instance.user.username} was added to the team '{instance.team.name}'.",
                is_system=True,
            )
            
            # Broadcast the system message to the channel via WebSocket
            try:
                from chat.utils import broadcast_to_channel
                from chat.serializers import MessageSerializer
                import logging
                
                logger = logging.getLogger(__name__)
                broadcast_to_channel(
                    channel.id,
                    {"type": "message", "payload": MessageSerializer(msg).data},
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error("Failed to broadcast team member add message to channel %s: %s", channel.id, e)
