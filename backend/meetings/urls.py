from django.urls import path
from .views import (
    MeetingListCreateView,
    MeetingDetailView,
    MeetingParticipantListCreateView,
    MeetingParticipantDetailView,
)

urlpatterns = [
    path("", MeetingListCreateView.as_view()),
    path("<int:meeting_id>/", MeetingDetailView.as_view()),
    path("<int:meeting_id>/participants/", MeetingParticipantListCreateView.as_view()),
    path(
        "<int:meeting_id>/participants/<int:participant_id>/",
        MeetingParticipantDetailView.as_view(),
    ),
]
