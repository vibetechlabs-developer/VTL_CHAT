from rest_framework import serializers
from .models import Meeting, MeetingParticipant

class MeetingSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Meeting

        fields = [
            "id",
            "title",
            "description",
            "host",
            "channel",
            "start_time",
            "end_time",
            "created_at"
        ]

        read_only_fields = [
            "host",
            "created_at"
        ]

class MeetingParticipantSerializer(serializers.ModelSerializer):

    class Meta:
        model = MeetingParticipant

        fields = [
            "id",
            "meeting",
            "user",
            "role",
            "joined_at",
            "left_at",
        ]