from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import UserSerializer
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.exceptions import TokenError
from .models import User


class SignupView(APIView):

    permission_classes = [AllowAny]

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