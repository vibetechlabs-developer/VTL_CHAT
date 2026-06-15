from rest_framework import serializers
from .models import Message, Attachment, Reaction

class MessageSerializer(serializers.ModelSerializer):

    class Meta:
        model = Message
        fields = "__all__"
        read_only_fields = [
            "sender"
        ]

class AttachmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Attachment

        fields = [
            "id",
            "message",
            "file",
            "uploaded_at"
        ]

    def validate_file(self, value):

        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError(
                "File too large"
            )

        return value

class ReactionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Reaction

        fields = [
            "id",
            "user",
            "message",
            "reaction_type",
            "created_at"
        ]

        read_only_fields = [
            "user"
        ]