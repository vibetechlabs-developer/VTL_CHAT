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
            # ended_at is set automatically by the server (WS disconnect or REST leave);
            # exposing it lets the frontend know a call truly ended vs just being scheduled.
            "ended_at",
            "created_at",
        ]

        read_only_fields = ["host", "created_at", "ended_at"]

    def validate(self, data):
        start = data.get("start_time", getattr(self.instance, "start_time", None))
        end = data.get("end_time", getattr(self.instance, "end_time", None))

        if start and end and end <= start:
            raise serializers.ValidationError("End time must be after start time")

        return data


class MeetingParticipantSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = MeetingParticipant

        fields = [
            "id",
            "meeting",
            "user",
            "role",
            "joined_at",
            "left_at",
            # last_seen_at is updated on every WS connect/heartbeat so ops tooling
            # can distinguish "just connected" from "connected 20 min ago with no heartbeat".
            "last_seen_at",
            "is_present",
        ]

        read_only_fields = ["last_seen_at"]

    def get_user(self, obj):
        from users.serializers import UserSerializer
        return UserSerializer(obj.user).data
