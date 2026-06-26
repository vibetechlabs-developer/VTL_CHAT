from rest_framework import serializers
from .models import Message, Attachment, Reaction
import os

class MessageSerializer(serializers.ModelSerializer):
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = "__all__"
        read_only_fields = [
            "sender"
        ]   

    def get_reply_count(self, obj):
        return obj.replies.count()

class AttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment

        fields = [
            "id",
            "message",
            "file",
            "file_url",
            "uploaded_at"
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        if obj.file:
            return obj.file.url
        return None

    def validate_file(self, value):
        allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed:
            raise serializers.ValidationError("File type not allowed")    

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