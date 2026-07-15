from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase
from django.contrib.auth import get_user_model
import threading
from teams.models import Organization, Team, TeamMember, Channel
from chat.models import Message, Reaction

User = get_user_model()


class ChatTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="chatuser", email="chatuser@example.com", password="password123"
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

        self.messages_url = "/api/messages/"

    def test_create_message_success(self):
        data = {"channel": self.channel.id, "content": "Hello, World!"}
        response = self.client.post(self.messages_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["content"], "Hello, World!")
        self.assertTrue(Message.objects.filter(content="Hello, World!").exists())

    def test_list_messages_success(self):
        Message.objects.create(sender=self.user, channel=self.channel, content="Message 1")
        Message.objects.create(sender=self.user, channel=self.channel, content="Message 2")

        response = self.client.get(self.messages_url, {"channel": self.channel.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertEqual(response.data["results"][0]["content"], "Message 2")

    def test_list_messages_cursor_pagination(self):
        for i in range(55):
            Message.objects.create(
                sender=self.user, channel=self.channel, content=f"Message {i + 1}"
            )

        first = self.client.get(self.messages_url, {"channel": self.channel.id})
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first.data["results"]), 50)
        self.assertIsNotNone(first.data["next"])
        self.assertIsNone(first.data["previous"])

        second = self.client.get(first.data["next"])
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second.data["results"]), 5)
        self.assertIsNone(second.data["next"])

        first_ids = {m["id"] for m in first.data["results"]}
        second_ids = {m["id"] for m in second.data["results"]}
        self.assertFalse(first_ids & second_ids)

    def test_edit_message_success(self):
        msg = Message.objects.create(
            sender=self.user, channel=self.channel, content="Original content"
        )
        detail_url = f"/api/messages/{msg.id}/"

        response = self.client.put(detail_url, {"content": "Updated content"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        msg.refresh_from_db()
        self.assertEqual(msg.content, "Updated content")

    def test_delete_message_success(self):
        msg = Message.objects.create(
            sender=self.user, channel=self.channel, content="To be deleted"
        )
        detail_url = f"/api/messages/{msg.id}/"

        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Message.objects.filter(id=msg.id).exists())

    def test_add_reaction_success(self):
        msg = Message.objects.create(sender=self.user, channel=self.channel, content="React to me")
        reactions_url = "/api/messages/reactions/"
        data = {"message": msg.id, "reaction_type": "LIKE"}
        response = self.client.post(reactions_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Reaction.objects.filter(message=msg, reaction_type="LIKE").exists())

    def test_pagination_tie_breaker_determinism(self):
        """GAP 3: Create multiple Message records with an IDENTICAL created_at timestamp

        and assert that they pagination-traverse uniquely without duplicates or skips.
        """
        from django.utils import timezone
        now = timezone.now()
        
        # Create 10 messages with identical created_at timestamps.
        # Django bulk_create allows passing an explicit created_at timestamp even if auto_now_add=True.
        messages = []
        for i in range(10):
            msg = Message(
                sender=self.user,
                channel=self.channel,
                content=f"Race Msg {i}",
                created_at=now
            )
            messages.append(msg)
        Message.objects.bulk_create(messages)

        # Retrieve the messages across paginated pages. We override page_size to 3.
        collected_ids = []
        next_url = f"{self.messages_url}?channel={self.channel.id}&page_size=3"
        
        while next_url:
            response = self.client.get(next_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            results = response.data["results"]
            for r in results:
                collected_ids.append(r["id"])
            next_url = response.data.get("next")
            
        # Verify that we retrieved all 10 messages, and each one appeared exactly once.
        self.assertEqual(len(collected_ids), 10)
        self.assertEqual(len(set(collected_ids)), 10)


class ReactionRaceConditionTests(APITransactionTestCase):
    """GAP 1: Simulates near-simultaneous concurrent POST requests to add the same reaction

    (same user, same message, same emoji/type) and checks for non-500 response (Conflict or OK/Created).
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="raceuser", email="raceuser@example.com", password="password123"
        )
        self.org = Organization.objects.create(name="Race Org", created_by=self.user)
        self.team = Team.objects.create(
            name="Race Team", organization=self.org, created_by=self.user
        )
        self.teammember = TeamMember.objects.create(user=self.user, team=self.team, role="MEMBER")
        self.channel = Channel.objects.create(
            name="race-channel", team=self.team, created_by=self.user, channel_type="PUBLIC"
        )
        self.msg = Message.objects.create(sender=self.user, channel=self.channel, content="Race target")
        self.reactions_url = "/api/messages/reactions/"
        self.client.force_authenticate(user=self.user)

    def test_concurrent_reaction_race_condition_handles_conflict(self):
        """Simulate IntegrityError on save (e.g. concurrent unique constraint violation)

        when the reaction is successfully saved by a concurrent thread (exists in DB).
        It should catch the exception, update/find the existing one and return 200 OK.
        """
        from unittest.mock import patch
        from django.db import IntegrityError
        from chat.serializers import ReactionSerializer

        # First, pre-create the reaction in DB (as if the concurrent thread succeeded first)
        Reaction.objects.create(user=self.user, message=self.msg, reaction_type="LIKE")

        # Now trigger the post, but mock save() to raise IntegrityError (mimicking the unique constraint failure)
        with patch.object(ReactionSerializer, "save", side_effect=IntegrityError("Mock Unique Constraint Failure")):
            response = self.client.post(self.reactions_url, {"message": self.msg.id, "reaction_type": "LOVE"})
            
            # The view should catch the IntegrityError, find the existing reaction,
            # update the reaction_type to 'LOVE', and return 200 OK (no 500 error)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["reaction_type"], "LOVE")

    def test_concurrent_reaction_race_condition_returns_409_if_not_found(self):
        """Simulate IntegrityError on save, but the reaction is not found in the DB.

        It should return 409 Conflict instead of crashing with a 500 error.
        """
        from unittest.mock import patch
        from django.db import IntegrityError
        from chat.serializers import ReactionSerializer

        # Trigger post, mock save to raise IntegrityError, but DB doesn't have the row.
        # This checks the fallback path of the IntegrityError handler.
        with patch.object(ReactionSerializer, "save", side_effect=IntegrityError("Mock Unique Constraint Failure")):
            response = self.client.post(self.reactions_url, {"message": self.msg.id, "reaction_type": "LIKE"})
            
            # The view should catch the IntegrityError, fail to find the existing reaction,
            # and return a 409 Conflict response.
            self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
            self.assertEqual(response.data["error"], "Duplicate reaction")

