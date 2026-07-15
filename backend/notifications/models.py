from django.db import models
from users.models import User


class Notification(models.Model):

    NOTIFICATION_TYPES = (
        ("MESSAGE", "Message"),
        ("MEETING", "Meeting"),
        ("MENTION", "Mention"),
        ("TEAM", "Team"),
        ("CHANNEL", "Channel"),
        ("SYSTEM", "System"),
    )

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")

    title = models.CharField(max_length=255)

    message = models.TextField()

    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
        ]

    def __str__(self):
        return self.title
