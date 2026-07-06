import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone


class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

    def delete_avatar(self):
        """Delete avatar file from storage."""
        if self.avatar:
            try:
                self.avatar.delete(save=False)
            except Exception:
                pass


@receiver(pre_save, sender=User)
def cleanup_old_avatar(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old_user = User.objects.get(pk=instance.pk)
        if old_user.avatar and old_user.avatar != instance.avatar:
            old_user.delete_avatar()
    except User.DoesNotExist:
        pass


class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user, used=False).update(used=True)
        return cls.objects.create(
            user=user,
            token=secrets.token_urlsafe(32),
        )

    def is_valid(self):
        expiry = self.created_at + timedelta(hours=1)
        return not self.used and timezone.now() < expiry