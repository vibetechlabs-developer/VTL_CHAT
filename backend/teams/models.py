from django.db import models
from users.models import User


class Organization(models.Model):

    name = models.CharField(max_length=255)

    description = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='organizations_created'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Team(models.Model):

    TEAM_TYPES = (
        ('PUBLIC', 'Public'),
        ('PRIVATE', 'Private'),
    )

    name = models.CharField(max_length=100)

    description = models.TextField(blank=True)

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='teams'
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_teams'
    )

    team_type = models.CharField(
        max_length=20,
        choices=TEAM_TYPES,
        default='PUBLIC'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class TeamMember(models.Model):

    
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='team_memberships'
    )

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='members'
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='MEMBER'
    )

    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.team.name}"
  
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "team"],
                name="unique_team_member"
            )
        ]

        


class Channel(models.Model):

    CHANNEL_TYPES = (
        ('PUBLIC', 'Public'),
        ('PRIVATE', 'Private'),
    )

    name = models.CharField(max_length=100)

    description = models.TextField(blank=True)

    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name='channels'
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_channels'
    )

    channel_type = models.CharField(
        max_length=20,
        choices=CHANNEL_TYPES,
        default='PUBLIC'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
        