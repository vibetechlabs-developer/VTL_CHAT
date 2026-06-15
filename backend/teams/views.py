from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Team, Organization, Channel
from .serializers import TeamSerializer, OrganizationSerializer, ChannelSerializer, TeamMemberSerializer
from users.models import User
from .models import TeamMember
from django.shortcuts import get_object_or_404


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
        # organization = self.get_object(pk)
        organization = Organization.objects.filter(
            pk=pk,
            created_by=request.user
        ).first()
        if organization is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = OrganizationSerializer(organization)
        return Response(serializer.data)

    def put(self, request, pk):
        # organization = self.get_object(pk)
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
        teams = Team.objects.filter(
           members__user=request.user
        ).distinct()
        serializer = TeamSerializer(teams, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TeamSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TeamDetailView(APIView):
    def get_object(self, pk):
        try:
            return Team.objects.get(pk=pk)
        except Team.DoesNotExist:
            return None

    def get(self, request, pk):
        # team = self.get_object(pk)
        team = Team.objects.filter(
            pk=pk,
            members__user=request.user
        ).first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TeamSerializer(team)
        return Response(serializer.data)

    def put(self, request, pk):
        # team = self.get_object(pk)
        team = Team.objects.filter(
            pk=pk,
            members__user=request.user
        ).first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TeamSerializer(team, data=request.data,partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        # team = self.get_object(pk)
        team = Team.objects.filter(
            pk=pk,
            members__user=request.user
        ).first()
        if team is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        team.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class TeamMemberListCreateView(APIView):

    def get(self, request):

        members = TeamMember.objects.filter(user=request.user)

        serializer = TeamMemberSerializer(
            members,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        serializer = TeamMemberSerializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save(user=request.user)

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

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
