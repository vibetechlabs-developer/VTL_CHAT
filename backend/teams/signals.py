from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import TeamMember
from notifications.models import Notification

@receiver(post_save, sender=TeamMember)
def create_team_member_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            recipient=instance.user,
            title="Added to team",
            message=f"You have been added to the team '{instance.team.name}' as a {instance.role.title()}.",
            notification_type="TEAM"
        )
