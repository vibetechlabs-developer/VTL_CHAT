from rest_framework import serializers
from .models import Team, Organization, TeamMember, Channel

class TeamSerializer(serializers.ModelSerializer):

    class Meta:
        model = Team

        fields = [
            "id",
            "name",
            "description",
            "organization",
            "created_by",
            "created_at"
        ]

        read_only_fields = [
            "created_by",
        ]

    def validate_name(self, value):

        if len(value.strip()) < 3:
            raise serializers.ValidationError(
                "Team name too short"
            )

        return value

class OrganizationSerializer(serializers.ModelSerializer):

    class Meta:
        model = Organization

        fields = [
            "id",
            "name",
            "description",
            "created_by",
            "created_at"
        ]

        read_only_fields = [
            "created_by",
        ]

    def validate_name(self, value):

        if len(value.strip()) < 3:
            raise serializers.ValidationError(
                "Organization name too short"
            )

        return value

class TeamMemberSerializer(serializers.ModelSerializer):
        
    class Meta:
        model = TeamMember

        fields = [
            "id",
            "user",
            "team",
            "role",
            "joined_at"
        ]
        read_only_fields = [
            "user",
        ]

class ChannelSerializer(serializers.ModelSerializer):

    class Meta:
        model = Channel

        fields = [
            "id",
            "name",
            "description",
            "team",
            "created_by",
            "created_at",
            "channel_type"
        ]

        read_only_fields = [
            "created_by",
        ]
        
    def validate_name(self, value):

        if len(value.strip()) < 3:
            raise serializers.ValidationError(
                "Channel name too short"
            )

        return value