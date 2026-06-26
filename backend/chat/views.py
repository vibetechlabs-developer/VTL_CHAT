from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.db.models import Q
from teams.models import Channel

from .models import Message, Attachment, Reaction, ChannelReadReceipt
from .serializers import MessageSerializer, AttachmentSerializer, ReactionSerializer
from .utils import broadcast_to_channel


def _broadcast_reaction(channel_id, action, payload):
    broadcast_to_channel(
        channel_id,
        {"type": "reaction", "action": action, "payload": payload},
    )


def _user_can_access_channel(user, channel_id):
    """Check if a user can access a channel (team member or DM participant)."""
    return Channel.objects.filter(
        Q(pk=channel_id, team__members__user=user) |
        Q(pk=channel_id, channel_type='DIRECT', members=user)
    ).distinct().exists()


class MessageListCreateView(APIView):

    def get(self, request):
        channel_id = request.query_params.get("channel")
        parent_id = request.query_params.get("parent")
        
        if parent_id:
            messages = Message.objects.filter(parent_id=parent_id).order_by("created_at")
        elif channel_id:
            if not _user_can_access_channel(request.user, channel_id):
                return Response(
                    {"error": "Channel not found or you do not have permission"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            messages = Message.objects.filter(channel_id=channel_id, parent__isnull=True).order_by("created_at")
        else:
            messages = Message.objects.filter(
                Q(channel__team__members__user=request.user) |
                Q(channel__channel_type='DIRECT', channel__members=request.user),
                parent__isnull=True
            ).distinct().order_by("-created_at")

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(messages, request, view=self)
        if page is not None:
            serializer = MessageSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request):
        channel_id = request.data.get("channel")
        if not _user_can_access_channel(request.user, channel_id):
            return Response(
                {"error": "Channel not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(sender=request.user)
            broadcast_to_channel(
                int(channel_id),
                {"type": "message", "payload": serializer.data},
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MessageDetailView(APIView):

    def get_object(self, pk):
        try:
            return Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        message = Message.objects.filter(
            Q(pk=pk, channel__team__members__user=request.user) |
            Q(pk=pk, channel__channel_type='DIRECT', channel__members=request.user)
        ).distinct().first()

        if message is None:
            return Response(
                {"error": "Message not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MessageSerializer(message)
        return Response(serializer.data)

    def put(self, request, pk):
        message = Message.objects.filter(
            pk=pk,
            sender=request.user,
        ).first()
        if message is None:
            return Response(
                {"error": "Message not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = MessageSerializer(message, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            broadcast_to_channel(
                message.channel_id,
                {"type": "message_updated", "payload": serializer.data},
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        message = Message.objects.filter(
            pk=pk,
            sender=request.user,
        ).first()
        if message is None:
            return Response(
                {"error": "Message not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        channel_id = message.channel_id
        message_id = message.id
        message.delete()
        broadcast_to_channel(
            channel_id,
            {"type": "message_deleted", "payload": {"id": message_id, "channel": channel_id}},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessagePinView(APIView):
    """Toggle pin/unpin on a message."""

    def post(self, request, pk):
        message = Message.objects.filter(pk=pk).first()
        if message is None:
            return Response({"error": "Message not found"}, status=status.HTTP_404_NOT_FOUND)

        if not _user_can_access_channel(request.user, message.channel_id):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        message.is_pinned = not message.is_pinned
        message.save(update_fields=["is_pinned"])
        serializer = MessageSerializer(message)
        broadcast_to_channel(
            message.channel_id,
            {"type": "message_updated", "payload": serializer.data},
        )
        return Response(serializer.data)


class AttachmentListCreateView(APIView):

    def get(self, request):
        channel_id = request.query_params.get("channel")
        qs = Attachment.objects.filter(
            Q(message__channel__team__members__user=request.user) |
            Q(message__channel__channel_type='DIRECT', message__channel__members=request.user)
        ).distinct()
        if channel_id:
            qs = qs.filter(message__channel_id=channel_id)
        serializer = AttachmentSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        message_id = request.data.get("message")
        message = Message.objects.filter(id=message_id, sender=request.user).first()
        if not message or not _user_can_access_channel(request.user, message.channel_id):
            return Response(
                {"error": "Message not found or you do not have permission"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AttachmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            instance = serializer.save()
            full_serializer = AttachmentSerializer(instance, context={'request': request})
            broadcast_to_channel(
                message.channel_id,
                {"type": "attachment", "payload": full_serializer.data},
            )
            return Response(full_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AttachmentDetailView(APIView):

    def get_object(self, pk):
        try:
            return Attachment.objects.get(pk=pk)
        except Attachment.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        attachment = Attachment.objects.filter(
            Q(pk=pk, message__channel__team__members__user=request.user) |
            Q(pk=pk, message__channel__channel_type='DIRECT', message__channel__members=request.user)
        ).distinct().first()

        if attachment is None:
            return Response(
                {"error": "Attachment not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        attachment = Attachment.objects.filter(
            pk=pk,
            message__sender=request.user,
        ).first()

        if attachment is None:
            return Response(
                {"error": "Attachment not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def put(self, request, pk):
        attachment = Attachment.objects.filter(
            pk=pk,
            message__sender=request.user,
        ).first()

        if attachment is None:
            return Response(
                {"error": "Attachment not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = AttachmentSerializer(attachment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReactionListCreateView(APIView):

    def get(self, request):
        channel_id = request.query_params.get("channel")
        qs = Reaction.objects.filter(
            Q(message__channel__team__members__user=request.user) |
            Q(message__channel__channel_type='DIRECT', message__channel__members=request.user)
        ).distinct()
        if channel_id:
            qs = qs.filter(message__channel_id=channel_id)
        serializer = ReactionSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        message_id = request.data.get("message")
        message = Message.objects.filter(pk=message_id).first()
        if not message or not _user_can_access_channel(request.user, message.channel_id):
            return Response(
                {"error": "Message not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        reaction_type = request.data.get("reaction_type")
        if not reaction_type:
            return Response(
                {"error": "reaction_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = Reaction.objects.filter(user=request.user, message=message).first()
        if existing:
            existing.reaction_type = reaction_type
            existing.save()
            serializer = ReactionSerializer(existing)
            _broadcast_reaction(message.channel_id, "upsert", serializer.data)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = ReactionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            _broadcast_reaction(message.channel_id, "upsert", serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReactionDetailView(APIView):

    def get_object(self, pk):
        try:
            return Reaction.objects.get(pk=pk)
        except Reaction.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        reaction = Reaction.objects.filter(
            Q(pk=pk, message__channel__team__members__user=request.user) |
            Q(pk=pk, message__channel__channel_type='DIRECT', message__channel__members=request.user)
        ).distinct().first()

        if reaction is None:
            return Response(
                {"error": "Reaction not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ReactionSerializer(reaction)
        return Response(serializer.data)

    def delete(self, request, pk):
        reaction = Reaction.objects.filter(
            pk=pk,
            user=request.user,
        ).first()

        if reaction is None:
            return Response(
                {"error": "Reaction not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        channel_id = reaction.message.channel_id
        payload = {"id": reaction.id, "message": reaction.message_id}
        reaction.delete()
        _broadcast_reaction(channel_id, "delete", payload)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def put(self, request, pk):
        reaction = Reaction.objects.filter(
            pk=pk,
            user=request.user,
        ).first()
        if reaction is None:
            return Response(
                {"error": "Reaction not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ReactionSerializer(reaction, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            _broadcast_reaction(reaction.message.channel_id, "upsert", serializer.data)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ReadReceiptView(APIView):
    def post(self, request):
        channel_id = request.data.get("channel")
        message_id = request.data.get("message")
        if not channel_id or not message_id:
            return Response({"error": "Missing channel or message"}, status=status.HTTP_400_BAD_REQUEST)
        
        ChannelReadReceipt.objects.update_or_create(
            user=request.user,
            channel_id=channel_id,
            defaults={'last_read_message_id': message_id}
        )
        return Response({"status": "success"}, status=status.HTTP_200_OK)
