from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from teams.models import Organization, Team, TeamMember, Channel

User = get_user_model()


class TeamSecurityTests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin", email="admin@example.com", password="password123"
        )
        self.member = User.objects.create_user(
            username="member", email="member@example.com", password="password123"
        )
        self.outsider = User.objects.create_user(
            username="outsider", email="outsider@example.com", password="password123"
        )
        self.org = Organization.objects.create(name="Org", created_by=self.admin)
        self.team = Team.objects.create(name="Team", organization=self.org, created_by=self.admin)
        TeamMember.objects.create(team=self.team, user=self.admin, role="ADMIN")
        TeamMember.objects.create(team=self.team, user=self.member, role="MEMBER")
        self.channel = Channel.objects.create(
            name="general",
            team=self.team,
            created_by=self.admin,
            channel_type="PUBLIC",
        )

    def test_member_cannot_delete_channel(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.delete(f"/api/teams/channels/{self.channel.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Channel.objects.filter(id=self.channel.id).exists())

    def test_admin_can_delete_channel(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/teams/channels/{self.channel.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Channel.objects.filter(id=self.channel.id).exists())

    def test_outsider_cannot_list_team_members(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get("/api/teams/team-members/", {"team": self.team.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
