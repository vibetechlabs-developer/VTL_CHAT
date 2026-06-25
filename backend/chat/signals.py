import re
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Message
from notifications.models import Notification
from users.models import User

@receiver(post_save, sender=Message)
def create_message_notification(sender, instance, created, **kwargs):
    if created:
        channel = instance.channel
        sender_user = instance.sender
        
        # 1. Handle Direct Message notifications
        if channel.channel_type == 'DIRECT':
            other_members = channel.members.exclude(id=sender_user.id)
            for member in other_members:
                Notification.objects.create(
                    recipient=member,
                    title=f"New message from {sender_user.username}",
                    message=f"{instance.content[:50]}",
                    notification_type="MESSAGE"
                )
                
        # 2. Handle Team Channel notifications & Mentions
        elif channel.team:
            # Detect @mentions
            mentioned_usernames = re.findall(r'@(\w+)', instance.content)
            mentioned_users = []
            if mentioned_usernames:
                mentioned_users = list(User.objects.filter(username__in=mentioned_usernames))
                
            for user in mentioned_users:
                if user != sender_user:
                    Notification.objects.create(
                        recipient=user,
                        title=f"You were mentioned in #{channel.name}",
                        message=f"{sender_user.username}: {instance.content[:50]}",
                        notification_type="MENTION"
                    )
            
            # Send standard channel notifications (excluding mentioned users to avoid duplicates)
            mentioned_user_ids = [u.id for u in mentioned_users]
            other_members = channel.team.members.exclude(user=sender_user).exclude(user_id__in=mentioned_user_ids)
            for member in other_members:
                Notification.objects.create(
                    recipient=member.user,
                    title=f"New message in #{channel.name}",
                    message=f"{sender_user.username}: {instance.content[:50]}",
                    notification_type="MESSAGE"
                )
