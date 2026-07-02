from django.db import models
from users.models import User
from teams.models import Channel


class Message(models.Model):

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='messages_sent'
    )

    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    content = models.TextField(blank=True, default="")

    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies'
    )

    is_pinned = models.BooleanField(default=False)

    is_system = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['channel', 'created_at']),
        ]

    def __str__(self):
        return f"{self.sender.username}: {self.content[:30]}"


class Attachment(models.Model):

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='attachments'
    )



    file = models.FileField(
        upload_to='attachments/'
    )

    uploaded_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.file.name



class Reaction(models.Model):

    REACTION_CHOICES = (
        ('LIKE', '👍'),
        ('LOVE', '❤️'),
        ('LAUGH', '😂'),
        ('CELEBRATE', '🎉'),
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "message"],
                name="unique_reaction_per_user_message"
            )
        ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='reactions'
    )

    reaction_type = models.CharField(
        max_length=20,
        choices=REACTION_CHOICES
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.user.username} - {self.reaction_type}"


class ChannelReadReceipt(models.Model):

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name='read_receipts'
    )

    last_read_message = models.ForeignKey(
        Message,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "channel"],
                name="unique_read_receipt_per_user_channel"
            )
        ]

    def __str__(self):
        return f"{self.user.username} read {self.channel.name} at {self.read_at}"