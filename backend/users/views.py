from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import UserSerializer
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.exceptions import TokenError
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import requests
from rest_framework.throttling import ScopedRateThrottle

from .models import User, PasswordResetToken


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def send_password_reset_email(user, token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your VTL Chat password"
    message = (
        f"Use this link to reset your password (valid for 1 hour):\n\n"
        f"{reset_url}\n\n"
        f"If you did not request this, you can ignore this email."
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=not settings.DEBUG,
    )
    return reset_url


def get_or_create_google_user(email, name=''):
    username_base = email.split('@')[0][:30] or 'user'
    username = username_base
    suffix = 1
    while User.objects.filter(username=username).exclude(email=email).exists():
        username = f"{username_base}{suffix}"[:30]
        suffix += 1

    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'username': username,
            'first_name': (name or '').split(' ')[0][:150],
        },
    )
    if created:
        user.set_unusable_password()
        user.save()
    return user


class SignupView(APIView):

    permission_classes = [AllowAny]
    throttle_scope = "signup"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        serializer = UserSerializer(data=request.data)

        if serializer.is_valid():

            serializer.save()

            return Response(
                {
                    "message": "User created successfully",
                    "data": serializer.data
                },
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

class LoginView(APIView):

    permission_classes = [AllowAny]
    throttle_scope = "login"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(
            request,
            email=email,
            password=password
        )

        if user is not None:

            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "message": "Login successful",
                    "refresh": str(refresh),
                    "access": str(refresh.access_token)
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {
                "error": "Invalid email or password"
            },
            status=status.HTTP_401_UNAUTHORIZED
        )


class ProfileView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        user = request.user

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "username": user.username
            },
            status=status.HTTP_200_OK
        )

class RefreshTokenView(APIView):

    permission_classes = [AllowAny]
    def post(self, request):

        refresh_token = request.data.get("refresh")

        try:

            refresh = RefreshToken(refresh_token)

            return Response(
                {
                    "access": str(refresh.access_token)
                },
                status=status.HTTP_200_OK
            )

        except TokenError:

            return Response(
                {
                    "error": "Invalid refresh token"
                },
                status=status.HTTP_401_UNAUTHORIZED
            )   

class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        try:

            refresh_token = request.data.get("refresh")

            token = RefreshToken(refresh_token)

            token.blacklist()

            return Response(
                {
                    "message": "Logout successful"
                },
                status=status.HTTP_200_OK
            )

        except TokenError:

            return Response(
                {
                    "error": "Invalid refresh token"
                },
                status=status.HTTP_401_UNAUTHORIZED
            )


class UserListView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.exclude(
            id=request.user.id
        )
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)



class UserDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self.get_object(pk)
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = UserSerializer(user)
        return Response(serializer.data)

    def put(self, request, pk):
        user = self.get_object(pk)
        if request.user.id != int(pk):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        user = self.get_object(pk)
        if request.user.id != int(pk):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )
        if user is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ForgotPasswordView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        response_data = {
            'message': 'If an account exists with that email, reset instructions were sent.',
        }

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(response_data, status=status.HTTP_200_OK)

        reset_token = PasswordResetToken.create_for_user(user)
        reset_url = send_password_reset_email(user, reset_token.token)

        if settings.DEBUG:
            response_data['reset_url'] = reset_url

        return Response(response_data, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        new_password = request.data.get('new_password') or request.data.get('password')

        if not token or not new_password:
            return Response(
                {'error': 'Token and new password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reset_token = PasswordResetToken.objects.select_related('user').get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired reset link'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reset_token.is_valid():
            return Response(
                {'error': 'Invalid or expired reset link'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = reset_token.user
        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            return Response(
                {'error': exc.messages[0]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        reset_token.used = True
        reset_token.save(update_fields=['used'])

        return Response(
            {'message': 'Password reset successfully. You can sign in now.'},
            status=status.HTTP_200_OK,
        )


class GoogleAuthView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {'error': 'Google sign-in is not configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        credential = request.data.get('credential')
        access_token = request.data.get('access_token')

        if not credential and not access_token:
            return Response(
                {'error': 'Google credential or access token is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if credential:
                idinfo = google_id_token.verify_oauth2_token(
                    credential,
                    google_requests.Request(),
                    settings.GOOGLE_CLIENT_ID,
                )
                email = idinfo.get('email')
                name = idinfo.get('name', '')
            else:
                profile_response = requests.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {access_token}'},
                    timeout=10,
                )
                profile_response.raise_for_status()
                profile = profile_response.json()
                email = profile.get('email')
                name = profile.get('name', '')

            if not email:
                return Response(
                    {'error': 'Google account email is unavailable'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = get_or_create_google_user(email, name)
            tokens = get_tokens_for_user(user)

            return Response(
                {
                    'message': 'Login successful',
                    **tokens,
                },
                status=status.HTTP_200_OK,
            )
        except ValueError:
            return Response(
                {'error': 'Invalid Google token'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except requests.RequestException:
            return Response(
                {'error': 'Could not verify Google account'},
                status=status.HTTP_502_BAD_GATEWAY,
            )