from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle
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
    try:
        channel = Channel.objects.get(pk=channel_id)
    except Channel.DoesNotExist:
        return False

    if channel.channel_type == 'PUBLIC':
        return channel.team and channel.team.members.filter(user=user).exists()
    elif channel.channel_type == 'PRIVATE':
        return channel.team and channel.team.members.filter(user=user).exists() and channel.members.filter(id=user.id).exists()
    elif channel.channel_type == 'DIRECT':
        return channel.members.filter(id=user.id).exists()

    return False


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
            public_channels = Channel.objects.filter(
                team__members__user=request.user,
                channel_type='PUBLIC'
            )
            private_channels = Channel.objects.filter(
                team__members__user=request.user,
                channel_type='PRIVATE',
                members=request.user
            )
            dm_channels = Channel.objects.filter(
                channel_type='DIRECT',
                members=request.user
            )
            accessible_channels = (public_channels | private_channels | dm_channels).distinct()
            messages = Message.objects.filter(
                channel__in=accessible_channels,
                parent__isnull=True
            ).distinct().order_by("-created_at")
        messages = messages.select_related('sender', 'channel').prefetch_related('attachments', 'reactions')
        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(messages, request, view=self)
        if page is not None:
            serializer = MessageSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    throttle_scope = 'message'
    throttle_classes = [ScopedRateThrottle]

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
        message = Message.objects.filter(pk=pk).first()

        if message is None or not _user_can_access_channel(request.user, message.channel_id):
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
        if not _user_can_access_channel(request.user, message.channel_id):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN,
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
        if not _user_can_access_channel(request.user, message.channel_id):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN,
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
class MessageSearchView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'message'

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"error": "Search query required"}, status=status.HTTP_400_BAD_REQUEST)
        channel_id = request.query_params.get('channel')
        # Base queryset limited to channels the user can access
        if channel_id:
            if not _user_can_access_channel(request.user, channel_id):
                return Response({"error": "Channel access denied"}, status=status.HTTP_403_FORBIDDEN)
            qs = Message.objects.filter(channel_id=channel_id, content__icontains=query)
        else:
            # All accessible channels
            # Get channel ids the user can access (public + private where member + direct)
            public_qs = Channel.objects.filter(team__members__user=request.user, channel_type='PUBLIC')
            private_qs = Channel.objects.filter(team__members__user=request.user, channel_type='PRIVATE', members=request.user)
            direct_qs = Channel.objects.filter(channel_type='DIRECT', members=request.user)
            allowed_channels = public_qs | private_qs | direct_qs
            qs = Message.objects.filter(channel__in=allowed_channels, content__icontains=query)

        qs = qs.select_related('sender').order_by('-created_at')
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = MessageSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ClearChatView(APIView):
    def post(self, request):
        channel_id = request.data.get("channel")
        if not channel_id:
            return Response({"error": "Channel ID is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if not _user_can_access_channel(request.user, channel_id):
            return Response(
                {"error": "Channel not found or permission denied"},
                status=status.HTTP_403_FORBIDDEN,
            )
            
        Message.objects.filter(channel_id=channel_id).delete()
        broadcast_to_channel(
            int(channel_id),
            {"type": "chat_cleared", "payload": {"channel": int(channel_id)}},
        )
        return Response({"status": "success"}, status=status.HTTP_200_OK)

