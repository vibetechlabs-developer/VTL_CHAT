from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.db import transaction
from users.models import User

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Channel, Organization, Team, TeamMember, OrganizationMember, Group, GroupMember
from .serializers import (
    ChannelSerializer,
    OrganizationSerializer,
    TeamMemberSerializer,
    TeamSerializer,
    GroupSerializer,
    GroupMemberSerializer,
)
from chat.access import get_accessible_channel as _get_accessible_channel


class OrganizationListCreateView(APIView):
    def get(self, request):
        organizations = Organization.objects.filter(created_by=request.user)
        serializer = OrganizationSerializer(organizations, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OrganizationSerializer(data=request.data)
        if serializer.is_valid():
            organization = serializer.save(created_by=request.user)
            OrganizationMember.objects.create(
                user=request.user,
                organization=organization,
                role="OWNER",
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrganizationDetailView(APIView):
    def get_object(self, pk):
        try:
            return Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return None

    def get(self, request, pk):
        organization = Organization.objects.filter(pk=pk, created_by=request.user).first()
        if organization is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(organization)
        return Response(serializer.data)

    def put(self, request, pk):
        organization = Organization.objects.filter(pk=pk, created_by=request.user).first()
        if organization is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(organization, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        organization = Organization.objects.filter(pk=pk, created_by=request.user).first()
        if organization is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        organization.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamListCreateView(APIView):
    def get(self, request):
        user_orgs = Organization.objects.filter(
            Q(created_by=request.user) | Q(teams__members__user=request.user)
        ).distinct()
        teams = Team.objects.filter(
            Q(members__user=request.user) | Q(team_type="PUBLIC", organization__in=user_orgs)
        ).distinct()
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)

    def post(self, request):
        organization_id = request.data.get("organization")
        org = Organization.objects.filter(id=organization_id, created_by=request.user).first()
        if not org:
            return Response(
                {"error": "Organization not found or you do not have permission to use it."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TeamSerializer(data=request.data)
        if serializer.is_valid():
            # Use atomic transaction to ensure team creation and admin membership are both persisted
            with transaction.atomic():
                team = serializer.save(created_by=request.user)
                TeamMember.objects.create(team=team, user=request.user, role="ADMIN")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TeamDetailView(APIView):
    def get_object(self, pk):
        try:
            return Team.objects.get(pk=pk)
        except Team.DoesNotExist:
            return None

    def get(self, request, pk):
        user_orgs = Organization.objects.filter(
            Q(created_by=request.user) | Q(teams__members__user=request.user)
        ).distinct()
        team = (
            Team.objects.filter(pk=pk)
            .filter(
                Q(members__user=request.user) | Q(team_type="PUBLIC", organization__in=user_orgs)
            )
            .distinct()
            .first()
        )
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TeamSerializer(team)
        return Response(serializer.data)

    def put(self, request, pk):
        team = Team.objects.filter(pk=pk).first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        is_admin = TeamMember.objects.filter(team=team, user=request.user, role="ADMIN").exists()
        if not is_admin and team.created_by != request.user:
            return Response(
                {"error": "Permission denied. Only team admins can edit the team."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TeamSerializer(team, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        team = Team.objects.filter(pk=pk).first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        is_admin = TeamMember.objects.filter(team=team, user=request.user, role="ADMIN").exists()
        if not is_admin and team.created_by != request.user:
            return Response(
                {"error": "Permission denied. Only team admins can delete the team."},
                status=status.HTTP_403_FORBIDDEN,
            )

        team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamMemberListCreateView(APIView):

    def get(self, request):
        team_id = request.query_params.get("team")
        if team_id:
            # User must be a member of the team to see its member list
            if not TeamMember.objects.filter(team_id=team_id, user=request.user).exists():
                return Response(
                    {"error": "You do not have access to this team's members."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            members = TeamMember.objects.filter(team_id=team_id)
        else:
            user_team_ids = TeamMember.objects.filter(user=request.user).values_list(
                "team_id", flat=True
            )
            members = TeamMember.objects.filter(team_id__in=user_team_ids)

        serializer = TeamMemberSerializer(members, many=True)

        return Response(serializer.data)

    def post(self, request):
        team_id = request.data.get("team")
        team = get_object_or_404(Team, id=team_id)

        user_id = request.data.get("user")
        if user_id:
            is_admin = TeamMember.objects.filter(
                team=team, user=request.user, role="ADMIN"
            ).exists()
            if not is_admin and team.created_by != request.user:
                return Response(
                    {"error": "Only team admins can add other users to this team."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            target_user = get_object_or_404(User, id=user_id)
        else:
            target_user = request.user

        if team.team_type == "PRIVATE":
            is_admin = TeamMember.objects.filter(
                team=team, user=request.user, role="ADMIN"
            ).exists()
            if not is_admin and team.created_by != request.user:
                return Response(
                    {"error": "Only team admins can add members to a private team."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if TeamMember.objects.filter(team=team, user=target_user).exists():
            return Response(
                {"error": "User is already a member of this team."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TeamMemberSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=target_user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TeamMemberDetailView(APIView):

    def delete(self, request, team_pk, user_pk):
        membership = get_object_or_404(TeamMember, team_id=team_pk, user_id=user_pk)

        is_admin = TeamMember.objects.filter(
            team=membership.team, user=request.user, role="ADMIN"
        ).exists()
        is_creator = membership.team.created_by == request.user

        if membership.user != request.user and not is_admin and not is_creator:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        if membership.role == "ADMIN":
            admin_count = TeamMember.objects.filter(
                team=membership.team, role="ADMIN"
            ).count()
            has_other_members = (
                TeamMember.objects.filter(team=membership.team)
                .exclude(user=membership.user)
                .exists()
            )
            if admin_count <= 1 and has_other_members:
                return Response(
                    {
                        "error": "You are the only admin. Promote another member to admin before leaving."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelListCreateView(APIView):
    def get(self, request):
        public_team_channels = Channel.objects.filter(
            team__members__user=request.user,
            channel_type="PUBLIC",
        )
        private_team_channels = Channel.objects.filter(
            team__members__user=request.user,
            channel_type="PRIVATE",
            members=request.user,
        )
        dm_channels = Channel.objects.filter(
            channel_type="DIRECT",
            members=request.user,
        )
        channels = (public_team_channels | private_team_channels | dm_channels).distinct()
        serializer = ChannelSerializer(channels, many=True)
        return Response(serializer.data)

    def post(self, request):
        team_id = request.data.get("team")
        if not TeamMember.objects.filter(team_id=team_id, user=request.user).exists():
            return Response(
                {"error": "You must be a team member to create a channel."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ChannelSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                channel = serializer.save(created_by=request.user)
                if channel.channel_type in ["PRIVATE", "DIRECT"]:
                    channel.members.add(request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _can_delete_channel(user, channel):
    is_admin = False
    if channel.team:
        is_admin = TeamMember.objects.filter(team=channel.team, user=user, role="ADMIN").exists()
    return is_admin or channel.created_by == user


class ChannelDetailView(APIView):
    def get_object(self, pk):
        try:
            return Channel.objects.get(pk=pk)
        except Channel.DoesNotExist:
            return None

    def get(self, request, pk):
        channel = _get_accessible_channel(request.user, pk)
        if channel is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ChannelSerializer(channel)
        return Response(serializer.data)

    def put(self, request, pk):
        channel = _get_accessible_channel(request.user, pk)
        if channel is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ChannelSerializer(channel, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        channel = _get_accessible_channel(request.user, pk)
        if channel is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if channel.channel_type == "DIRECT":
            return Response(
                {"error": "Direct message channels cannot be deleted."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not _can_delete_channel(request.user, channel):
            return Response(
                {
                    "error": "Permission denied. Only channel creators or team admins can delete channels."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        channel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DirectChannelCreateView(APIView):
    """Get or create a Direct Message channel between the current user and another user."""

    def post(self, request):
        target_user_id = request.data.get("user_id")
        if not target_user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user = get_object_or_404(User, id=target_user_id)

        if target_user == request.user:
            return Response(
                {"error": "You cannot start a DM with yourself"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if a DM channel already exists with exactly these two members
        existing = (
            Channel.objects.filter(
                channel_type="DIRECT",
                members=request.user,
            )
            .filter(
                members=target_user,
            )
            .first()
        )

        if existing:
            serializer = ChannelSerializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Create a new DM channel
        dm_name = (
            f"dm-{min(request.user.id, target_user.id)}-{max(request.user.id, target_user.id)}"
        )
        channel = Channel.objects.create(
            name=dm_name,
            channel_type="DIRECT",
            created_by=request.user,
            team=None,
        )
        channel.members.add(request.user, target_user)
        serializer = ChannelSerializer(channel)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GroupListCreateView(APIView):
    def get(self, request):
        team_id = request.query_params.get("team")
        if team_id:
            if not TeamMember.objects.filter(team_id=team_id, user=request.user).exists():
                return Response(
                    {"error": "You must be a team member to view its groups."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            groups = Group.objects.filter(team_id=team_id)
        else:
            user_team_ids = TeamMember.objects.filter(user=request.user).values_list(
                "team_id", flat=True
            )
            groups = Group.objects.filter(team_id__in=user_team_ids)

        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request):
        team_id = request.data.get("team")
        if not TeamMember.objects.filter(team_id=team_id, user=request.user).exists():
            return Response(
                {"error": "You must be a team member to create a group."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GroupSerializer(data=request.data)
        if serializer.is_valid():
            group = serializer.save(created_by=request.user)
            GroupMember.objects.create(group=group, user=request.user, role="ADMIN")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupDetailView(APIView):
    def get_object(self, pk):
        try:
            return Group.objects.get(pk=pk)
        except Group.DoesNotExist:
            return None

    def get(self, request, pk):
        group = self.get_object(pk)
        if group is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not TeamMember.objects.filter(team=group.team, user=request.user).exists():
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = GroupSerializer(group)
        return Response(serializer.data)

    def put(self, request, pk):
        group = self.get_object(pk)
        if group is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        is_admin = GroupMember.objects.filter(group=group, user=request.user, role="ADMIN").exists()
        if not is_admin and group.created_by != request.user:
            return Response(
                {"error": "Permission denied. Only group admins can edit the group."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GroupSerializer(group, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        group = self.get_object(pk)
        if group is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        is_admin = GroupMember.objects.filter(group=group, user=request.user, role="ADMIN").exists()
        if not is_admin and group.created_by != request.user:
            return Response(
                {"error": "Permission denied. Only group admins can delete groups."},
                status=status.HTTP_403_FORBIDDEN,
            )

        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupMemberListCreateView(APIView):
    def get(self, request):
        group_id = request.query_params.get("group")
        if group_id:
            if not GroupMember.objects.filter(group_id=group_id, user=request.user).exists():
                return Response(
                    {"error": "You do not have access to this group's members."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            members = GroupMember.objects.filter(group_id=group_id)
        else:
            user_group_ids = GroupMember.objects.filter(user=request.user).values_list(
                "group_id", flat=True
            )
            members = GroupMember.objects.filter(group_id__in=user_group_ids)

        serializer = GroupMemberSerializer(members, many=True)
        return Response(serializer.data)

    def post(self, request):
        group_id = request.data.get("group")
        group = get_object_or_404(Group, id=group_id)

        user_id = request.data.get("user")
        if user_id:
            is_admin = GroupMember.objects.filter(
                group=group, user=request.user, role="ADMIN"
            ).exists()
            if not is_admin and group.created_by != request.user:
                return Response(
                    {"error": "Only group admins can add other users to this group."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            target_user = get_object_or_404(User, id=user_id)
        else:
            target_user = request.user

        if not TeamMember.objects.filter(team=group.team, user=target_user).exists():
            return Response(
                {"error": "User must be a member of the team to join a group."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if GroupMember.objects.filter(group=group, user=target_user).exists():
            return Response(
                {"error": "User is already a member of this group."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = GroupMemberSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=target_user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupMemberDetailView(APIView):
    def delete(self, request, group_pk, user_pk):
        membership = get_object_or_404(GroupMember, group_id=group_pk, user_id=user_pk)

        is_admin = GroupMember.objects.filter(
            group=membership.group, user=request.user, role="ADMIN"
        ).exists()
        is_creator = membership.group.created_by == request.user

        if membership.user != request.user and not is_admin and not is_creator:
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
