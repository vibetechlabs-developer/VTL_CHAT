from django.shortcuts import get_object_or_404
from django.db.models import Q
from users.models import User

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Channel, Organization, Team, TeamMember
from .serializers import ChannelSerializer, OrganizationSerializer, TeamMemberSerializer, TeamSerializer


class OrganizationListCreateView(APIView):
    def get(self, request):  
        organizations = Organization.objects.filter(created_by=request.user)
        serializer = OrganizationSerializer(organizations, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OrganizationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OrganizationDetailView(APIView):
    def get_object(self, pk):
        try:
            return Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return None

    def get(self, request, pk):
        organization = Organization.objects.filter(
            pk=pk,
            created_by=request.user
        ).first()
        if organization is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(organization)
        return Response(serializer.data)

    def put(self, request, pk):
        organization = Organization.objects.filter(
            pk=pk,
            created_by=request.user
        ).first()
        if organization is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(organization, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        # organization = self.get_object(pk)
        organization = Organization.objects.filter(
            pk=pk,
            created_by=request.user
        ).first()
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
            Q(members__user=request.user) |
            Q(team_type='PUBLIC', organization__in=user_orgs)
        ).distinct()
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)

    def post(self, request):
        organization_id = request.data.get("organization")
        org = Organization.objects.filter(id=organization_id, created_by=request.user).first()
        if not org:
            return Response(
                {"error": "Organization not found or you do not have permission to use it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TeamSerializer(data=request.data)
        if serializer.is_valid():
            team = serializer.save(created_by=request.user)
            TeamMember.objects.create(team=team, user=request.user, role='ADMIN')
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
        team = Team.objects.filter(pk=pk).filter(
            Q(members__user=request.user) |
            Q(team_type='PUBLIC', organization__in=user_orgs)
        ).distinct().first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TeamSerializer(team)
        return Response(serializer.data)

    def put(self, request, pk):
        team = Team.objects.filter(pk=pk).first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        is_admin = TeamMember.objects.filter(team=team, user=request.user, role='ADMIN').exists()
        if not is_admin and team.created_by != request.user:
            return Response(
                {"error": "Permission denied. Only team admins can edit the team."},
                status=status.HTTP_403_FORBIDDEN
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

        is_admin = TeamMember.objects.filter(team=team, user=request.user, role='ADMIN').exists()
        if not is_admin and team.created_by != request.user:
            return Response(
                {"error": "Permission denied. Only team admins can delete the team."},
                status=status.HTTP_403_FORBIDDEN
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
                    status=status.HTTP_403_FORBIDDEN
                )
            members = TeamMember.objects.filter(team_id=team_id)
        else:
            user_team_ids = TeamMember.objects.filter(
                user=request.user
            ).values_list("team_id", flat=True)
            members = TeamMember.objects.filter(team_id__in=user_team_ids)

        serializer = TeamMemberSerializer(
            members,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):
        team_id = request.data.get("team")
        team = get_object_or_404(Team, id=team_id)

        user_id = request.data.get("user")
        if user_id:
            is_admin = TeamMember.objects.filter(team=team, user=request.user, role='ADMIN').exists()
            if not is_admin and team.created_by != request.user:
                return Response(
                    {"error": "Only team admins can add other users to this team."},
                    status=status.HTTP_403_FORBIDDEN
                )
            target_user = get_object_or_404(User, id=user_id)
        else:
            target_user = request.user

        if team.team_type == 'PRIVATE':
            is_admin = TeamMember.objects.filter(team=team, user=request.user, role='ADMIN').exists()
            if not is_admin and team.created_by != request.user:
                return Response(
                    {"error": "Only team admins can add members to a private team."},
                    status=status.HTTP_403_FORBIDDEN
                )

        if TeamMember.objects.filter(team=team, user=target_user).exists():
            return Response(
                {"error": "User is already a member of this team."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TeamMemberSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=target_user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TeamMemberDetailView(APIView):
     def delete(self, request, team_pk, user_pk):

        membership = get_object_or_404(
            TeamMember,
            team_id=team_pk,
            user_id=user_pk
        )

        if membership.user != request.user:
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )
        

        membership.delete()

        

        return Response(status=status.HTTP_204_NO_CONTENT)

class ChannelListCreateView(APIView):
    def get(self, request):
        channels = Channel.objects.filter(
          team__members__user=request.user
        ).distinct()
        serializer = ChannelSerializer(channels, many=True)
        return Response(serializer.data)

    def post(self, request):
        team_id = request.data.get("team")
        if not TeamMember.objects.filter(team_id=team_id, user=request.user).exists():
            return Response(
                {"error": "You must be a team member to create a channel."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ChannelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChannelDetailView(APIView):
    def get_object(self, pk):
        try:
            return Channel.objects.get(pk=pk)
        except Channel.DoesNotExist:
            return None

    def get(self, request, pk):
        # channel = self.get_object(pk)
        channel = Channel.objects.filter(
            pk=pk,
            team__members__user=request.user
        ).first()
        if channel is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ChannelSerializer(channel)
        return Response(serializer.data)

    def put(self, request, pk):
        # channel = self.get_object(pk)
        channel = Channel.objects.filter(
            pk=pk,
            team__members__user=request.user
        ).first()
        if channel is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ChannelSerializer(channel, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        # channel = self.get_object(pk)
        channel = Channel.objects.filter(
            pk=pk,
            team__members__user=request.user
        ).first()
        if channel is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        channel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
