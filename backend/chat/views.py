from django.shortcuts import render
# Create your views here.
# from rest_framework import viewsets
from rest_framework.views import APIView
from .models import Message, Attachment, Reaction
from .serializers import MessageSerializer, AttachmentSerializer, ReactionSerializer
from rest_framework.response import Response
from rest_framework import status

class MessageListCreateView(APIView):
    
    def get(self,request):
        messages = Message.objects.all()
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self,request):
        serializer = MessageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
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
            message = Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = MessageSerializer(message)
        return Response(serializer.data)

    def put(self,request,pk):
        try:
            message = Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = MessageSerializer(message, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self,request,pk):
        try:
            message = Message.objects.get(pk=pk)
        except Message.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    
    

class AttachmentListCreateView(APIView):
   def get(self, request):
        attachments = Attachment.objects.all()
        serializer = AttachmentSerializer(attachments, many=True)
        return Response(serializer.data)

   def post(self, request):
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
            attachment = Attachment.objects.get(pk=pk)
        except Attachment.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = AttachmentSerializer(attachment)
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            attachment = Attachment.objects.get(pk=pk)
        except Attachment.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def put(self, request, pk):
        try:
            attachment = Attachment.objects.get(pk=pk)
        except Attachment.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = AttachmentSerializer(attachment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReactionListCreateView(APIView):
    def get(self, request):
        reactions = Reaction.objects.all()
        serializer = ReactionSerializer(reactions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ReactionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
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
            reaction = Reaction.objects.get(pk=pk)
        except Reaction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ReactionSerializer(reaction)
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            reaction = Reaction.objects.get(pk=pk)
        except Reaction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        reaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def put(self, request, pk):
        try:
            reaction = Reaction.objects.get(pk=pk)
        except Reaction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = ReactionSerializer(reaction, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)