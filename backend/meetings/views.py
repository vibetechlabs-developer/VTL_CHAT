from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Meeting, MeetingParticipant
from .serializers import (
    MeetingSerializer,
    MeetingParticipantSerializer
)

class MeetingListCreateView(APIView):

    def get(self, request):

        meetings = Meeting.objects.filter(host=request.user)

        serializer = MeetingSerializer(
            meetings,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        serializer = MeetingSerializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save(host=request.user)

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
class MeetingDetailView(APIView):

    def get(self, request, meeting_id):

        meeting = Meeting.objects.filter(
            id=meeting_id,
            host=request.user
        ).first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = MeetingSerializer(meeting)
        return Response(serializer.data)

    def put(self, request, meeting_id):

        meeting = Meeting.objects.filter(
            id=meeting_id,
            host=request.user
        ).first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = MeetingSerializer(
            meeting,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, meeting_id):

        meeting = Meeting.objects.filter(
            id=meeting_id,
            host=request.user
        ).first()

        if not meeting:
            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        meeting.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
class MeetingParticipantListCreateView(APIView):

    def get(self, request, meeting_id):

        participants = MeetingParticipant.objects.filter(
            meeting_id=meeting_id,
            user=request.user
        )

        serializer = MeetingParticipantSerializer(
            participants,
            many=True
        )

        return Response(serializer.data)

    def post(self, request, meeting_id):

        meeting = Meeting.objects.filter(
                id=meeting_id,
                host=request.user
            ).first()

        if not meeting:

            return Response(
                {"error": "Meeting not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        user_id = request.user.id

        role = request.data.get(
            "role",
            "PARTICIPANT"
        )

        

        existing_participant = MeetingParticipant.objects.filter(
            meeting=meeting,
            user_id=user_id
        ).first()

        if existing_participant:

            return Response(
                {
                    "error":
                    "User is already a participant of this meeting"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        participant = MeetingParticipant.objects.create(
            meeting=meeting,
            user_id=user_id,
            role=role
        )

        serializer = MeetingParticipantSerializer(
            participant
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )
class MeetingParticipantDetailView(APIView):

    def get(
        self,
        request,
        meeting_id,
        participant_id
    ):

        participant = MeetingParticipant.objects.filter(
            id=participant_id,
            meeting_id=meeting_id
        ).first()

        
        if not participant:
            return Response(
                {"error": "Participant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if (
            participant.user != request.user
            and participant.meeting.host != request.user
        ):
            return Response(
                {"error": "Permission denied"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = MeetingParticipantSerializer(participant)
        return Response(serializer.data)

    def put(
        self,
        request,
        meeting_id,
        participant_id
    ):

        participant = MeetingParticipant.objects.filter(
            id=participant_id,
            meeting_id=meeting_id
        ).first()

        if not participant:

            return Response(
                {"error": "Participant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if (
                participant.user != request.user
                and participant.meeting.host != request.user
            ):
                return Response(
                    {"error": "Permission denied"},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = MeetingParticipantSerializer(
            participant,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(
        self,
        request,
        meeting_id,
        participant_id
    ):

        participant = MeetingParticipant.objects.filter(
            id=participant_id,
            meeting_id=meeting_id
        ).first()



        if not participant:

            return Response(
                {"error": "Participant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if (
                participant.user != request.user
                and participant.meeting.host != request.user
            ):
                return Response(
                    {"error": "Permission denied"},
                    status=status.HTTP_403_FORBIDDEN
                )

        participant.delete()

        return Response(
            {
                "message":
                "Participant removed successfully"
            },
            status=status.HTTP_200_OK
        )