from rest_framework import serializers
from .models import Message, Attachment, Reaction
import os
import logging


class MessageSerializer(serializers.ModelSerializer):
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "sender",
            "channel",
            "content",
            "parent",
            "is_pinned",
            "is_system",
            "created_at",
            "updated_at",
            "reply_count",
            # client_uuid: browser-generated UUID included in POST payload and echoed
            # back in both the REST response and WS broadcast so the sender can match
            # incoming WS messages to their local optimistic placeholder by UUID
            # instead of integer id (which doesn't exist until the DB write).
            "client_uuid",
        ]
        read_only_fields = ["sender", "created_at", "updated_at", "reply_count"]

    def get_reply_count(self, obj):
        return obj.replies.count()

    def validate_content(self, value):
        """Validate that message content does not exceed 10,000 characters.
        Prevents oversized payloads from overloading DB and client.
        """
        if len(value) > 10000:
            raise serializers.ValidationError(
                "Message content exceeds maximum length of 10,000 characters."
            )
        return value


class AttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment

        fields = ["id", "message", "file", "file_url", "uploaded_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        if obj.file:
            return obj.file.url
        return None

    def validate_file(self, value):
        allowed = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".zip"]
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed:
            raise serializers.ValidationError(
                f'File type "{ext or "unknown"}" is not allowed. '
                f"Allowed: {', '.join(allowed)}"
            )

        max_bytes = 10 * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError(
                f"File is too large ({value.size / (1024 * 1024):.1f} MB). Maximum size is 10 MB."
            )

        return value


class ReactionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Reaction

        fields = ["id", "user", "message", "reaction_type", "created_at"]

        read_only_fields = ["user"]
