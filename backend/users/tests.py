from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

User = get_user_model()


class UserAuthTests(APITestCase):

    def setUp(self):
        self.signup_url = "/api/users/signup/"
        self.login_url = "/api/users/login/"
        self.profile_url = "/api/users/profile/"
        self.user_data = {
            "username": "testuser",
            "email": "testuser@example.com",
            "password": "testpassword123",
        }
        self.existing_user = User.objects.create_user(
            username="existing", email="existing@example.com", password="existingpassword123"
        )

    def test_user_signup_success(self):
        response = self.client.post(self.signup_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "User created successfully")
        self.assertTrue(User.objects.filter(email="testuser@example.com").exists())

    def test_user_signup_duplicate_email(self):
        duplicate_data = {
            "username": "anotheruser",
            "email": "existing@example.com",
            "password": "password12345",
        }
        response = self.client.post(self.signup_url, duplicate_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_success(self):
        login_data = {"email": "existing@example.com", "password": "existingpassword123"}
        response = self.client.post(self.login_url, login_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("vtl_refresh", response.cookies)

    def test_user_login_invalid_credentials(self):
        login_data = {"email": "existing@example.com", "password": "wrongpassword"}
        response = self.client.post(self.login_url, login_data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_unauthenticated(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_authenticated(self):
        self.client.force_authenticate(user=self.existing_user)
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "existing@example.com")

    def test_ws_ticket_requires_auth(self):
        response = self.client.post("/api/users/ws-ticket/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ws_ticket_created_for_authenticated_user(self):
        self.client.force_authenticate(user=self.existing_user)
        response = self.client.post("/api/users/ws-ticket/")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("ticket", response.data)

    def test_profile_stats(self):
        self.client.force_authenticate(user=self.existing_user)
        response = self.client.get("/api/users/profile/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("teams_count", response.data)
