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

    def validate(self, data):
        start = data.get("start_time", getattr(self.instance, "start_time", None))
        end = data.get("end_time", getattr(self.instance, "end_time", None))

        if start and end and end <= start:
            raise serializers.ValidationError(
                "End time must be after start time"
            )

        return data

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
            "is_present"
        ]