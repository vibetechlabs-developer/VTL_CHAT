from django.db import models
from users.models import User
from teams.models import Channel


class Meeting(models.Model):

    title = models.CharField(max_length=255)

    description = models.TextField(blank=True)

    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_meetings")

    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="meetings")

    start_time = models.DateTimeField()

    end_time = models.DateTimeField()

    ended_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class MeetingParticipant(models.Model):

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["meeting", "user"], name="unique_meeting_participant")
        ]

    ROLE_CHOICES = (
        ("HOST", "Host"),
        ("CO_HOST", "Co Host"),
        ("PARTICIPANT", "Participant"),
    )

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="participants")

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="meeting_participations")

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="PARTICIPANT")

    joined_at = models.DateTimeField(null=True, blank=True)

    left_at = models.DateTimeField(null=True, blank=True)

    last_seen_at = models.DateTimeField(null=True, blank=True)

    is_present = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.meeting.title}"

