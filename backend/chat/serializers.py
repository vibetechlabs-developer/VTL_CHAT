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

class ReactionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Reaction

        fields = [
            "id",
            "user",
            "message",
            "reaction_type"
        ]

        read_only_fields = [
            "user"
        ]