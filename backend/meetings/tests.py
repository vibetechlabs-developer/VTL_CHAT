from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from teams.models import Organization, Team, TeamMember, Channel
from meetings.models import Meeting, MeetingParticipant

User = get_user_model()


class MeetingTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="meetinguser", email="meetinguser@example.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        self.org = Organization.objects.create(name="Test Org", created_by=self.user)
        self.team = Team.objects.create(
            name="Test Team", organization=self.org, created_by=self.user
        )
        self.teammember = TeamMember.objects.create(user=self.user, team=self.team, role="MEMBER")
        self.channel = Channel.objects.create(
            name="general", team=self.team, created_by=self.user, channel_type="PUBLIC"
        )

        self.meetings_url = "/api/meetings/"

    def test_create_meeting_success(self):
        start = timezone.now() + timedelta(hours=1)
        end = start + timedelta(hours=1)
        data = {
            "title": "Test Sync",
            "description": "Discussion on project tasks",
            "channel": self.channel.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        }
        response = self.client.post(self.meetings_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test Sync")
        self.assertTrue(Meeting.objects.filter(title="Test Sync").exists())

    def test_create_meeting_invalid_times(self):
        start = timezone.now() + timedelta(hours=1)
        end = start - timedelta(minutes=30)
        data = {
            "title": "Invalid Sync",
            "channel": self.channel.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        }
        response = self.client.post(self.meetings_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_meetings(self):
        start = timezone.now() + timedelta(hours=1)
        end = start + timedelta(hours=1)
        Meeting.objects.create(
            title="Meeting 1", host=self.user, channel=self.channel, start_time=start, end_time=end
        )
        response = self.client.get(self.meetings_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Meeting 1")

    def test_join_meeting(self):
        start = timezone.now() + timedelta(hours=1)
        end = start + timedelta(hours=1)
        meeting = Meeting.objects.create(
            title="Join Test", host=self.user, channel=self.channel, start_time=start, end_time=end
        )
        join_url = f"/api/meetings/{meeting.id}/participants/"
        response = self.client.post(join_url, {})
        # Expect 201 Created for a new participant entry
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(MeetingParticipant.objects.filter(meeting=meeting, user=self.user).exists())
