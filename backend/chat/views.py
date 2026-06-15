from rest_framework.views import APIView
from teams.models import Channel
from .models import Message, Attachment, Reaction
from .serializers import MessageSerializer, AttachmentSerializer, ReactionSerializer
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404

class MessageListCreateView(APIView):
    
    def get(self,request):
        messages = Message.objects.filter(sender=request.user)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request):
        channel_id = request.data.get("channel")
        channel = Channel.objects.filter(
            pk=channel_id,
            team__members__user=request.user
        ).first()

        if not channel:
            return Response(
                {"error": "Channel not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(sender=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MessageDetailView(APIView):
    def get_object(self, pk):
        try:
            return Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            raise Http404

    def get(self,request,pk):
        try:
            message = Message.objects.filter(
                        pk=pk,
                        sender=request.user
                       ).first()

            if message is None:
                return Response(
                    {"error": "Message not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = MessageSerializer(message)
        return Response(serializer.data)

    def put(self,request,pk):
        try:
            message = Message.objects.filter(
                pk=pk,
                sender=request.user
            ).first()
            if message is None:
                return Response(
                    {"error": "Message not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = MessageSerializer(message, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self,request,pk):
        try:
            message = Message.objects.filter(
                    pk=pk,
                    sender=request.user
                ).first()
            if message is None:
                return Response(
                    {"error": "Message not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    
    

class AttachmentListCreateView(APIView):
   def get(self, request):
        attachments = Attachment.objects.filter(
           message__sender=request.user
         ).distinct()
        serializer = AttachmentSerializer(attachments, many=True)
        return Response(serializer.data)

   def post(self, request):
        message = Message.objects.filter(
            id=request.data.get("message"),
            sender=request.user
        ).first()

        if not message:
            return Response(
                {"error": "Message not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AttachmentSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AttachmentDetailView(APIView):
    def get_object(self, pk):
        try:
            return Attachment.objects.get(pk=pk)
        except Attachment.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        try:
            attachment = Attachment.objects.filter(
                            pk=pk,
                            message__sender=request.user
                        ).first()

            if attachment is None:
                return Response(
                    {"error": "Attachment not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
        except Attachment.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = AttachmentSerializer(attachment)
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            attachment = Attachment.objects.filter(
                pk=pk,
                message__sender=request.user
            ).first()

            if attachment is None:
                return Response(
                    {"error": "Attachment not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        except Attachment.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def put(self, request, pk):
        try:
            attachment = Attachment.objects.filter(
                pk=pk,
                message__sender=request.user
            ).first()

            if attachment is None:
                return Response(
                    {"error": "Attachment not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Attachment.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = AttachmentSerializer(attachment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReactionListCreateView(APIView):
    def get(self, request):
        reactions = Reaction.objects.filter(
            user=request.user
        )
        serializer = ReactionSerializer(reactions, many=True)
        return Response(serializer.data)

    def post(self, request):
        
        message_id = request.data.get("message")
        message = Message.objects.filter(
            pk=message_id,
            channel__team__members__user=request.user
        ).first()
        if not message:
            return Response(
                {"error": "Message not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = ReactionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ReactionDetailView(APIView):
    def get_object(self, pk):
        try:
            return Reaction.objects.get(pk=pk)
        except Reaction.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        try:
            reaction = Reaction.objects.filter(
                pk=pk,
                user=request.user
            ).first()

            if reaction is None:
                return Response(
                    {"error": "Reaction not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Reaction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ReactionSerializer(reaction)
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            reaction = Reaction.objects.filter(
                pk=pk,
                user=request.user
            ).first()

            if reaction is None:
                return Response(
                    {"error": "Reaction not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Reaction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        reaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def put(self, request, pk):
        try:
            reaction = Reaction.objects.filter(
                pk=pk,
                user=request.user
            ).first()
            if reaction is None:
                    return Response(
                        {"error": "Reaction not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )
        except Reaction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ReactionSerializer(reaction, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)