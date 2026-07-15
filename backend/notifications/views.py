from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListCreateView(APIView):

    def get(self, request):

        notifications = Notification.objects.filter(recipient=request.user)

        serializer = NotificationSerializer(notifications, many=True)

        return Response(serializer.data)

    def post(self, request):

        serializer = NotificationSerializer(data=request.data)

        if serializer.is_valid():

            # serializer.save()
            serializer.save(recipient=request.user)

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationDetailView(APIView):

    def get(self, request, notification_id):

        # notification = Notification.objects.filter(
        #     id=notification_id
        # ).first()
        notification = Notification.objects.filter(
            id=notification_id, recipient=request.user
        ).first()

        if not notification:

            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = NotificationSerializer(notification)

        return Response(serializer.data)

    def put(self, request, notification_id):

        # notification = Notification.objects.filter(
        #     id=notification_id
        # ).first()
        notification = Notification.objects.filter(
            id=notification_id, recipient=request.user
        ).first()

        if not notification:

            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = NotificationSerializer(notification, data=request.data, partial=True)

        if serializer.is_valid():

            # serializer.save()
            serializer.save(recipient=request.user)

            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, notification_id):

        notification = Notification.objects.filter(
            id=notification_id, recipient=request.user
        ).first()

        if not notification:

            return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)

        notification.delete()

        return Response({"message": "Notification deleted successfully"}, status=status.HTTP_200_OK)
