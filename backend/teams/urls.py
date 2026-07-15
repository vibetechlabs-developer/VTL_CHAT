from django.urls import path
from .views import (
    TeamListCreateView,
    TeamDetailView,
    OrganizationListCreateView,
    OrganizationDetailView,
    ChannelListCreateView,
    ChannelDetailView,
    TeamMemberListCreateView,
    TeamMemberDetailView,
    DirectChannelCreateView,
    GroupListCreateView,
    GroupDetailView,
    GroupMemberListCreateView,
    GroupMemberDetailView,
)

urlpatterns = [
    path("organizations/", OrganizationListCreateView.as_view()),
    path("organizations/<int:pk>/", OrganizationDetailView.as_view()),
    path("channels/", ChannelListCreateView.as_view()),
    path("channels/<int:pk>/", ChannelDetailView.as_view()),
    path("channels/direct/", DirectChannelCreateView.as_view()),
    path("team-members/", TeamMemberListCreateView.as_view()),
    path("team-members/<int:team_pk>/<int:user_pk>/", TeamMemberDetailView.as_view()),
    path("groups/", GroupListCreateView.as_view()),
    path("groups/<int:pk>/", GroupDetailView.as_view()),
    path("group-members/", GroupMemberListCreateView.as_view()),
    path("group-members/<int:group_pk>/<int:user_pk>/", GroupMemberDetailView.as_view()),
    path("", TeamListCreateView.as_view()),
    path("<int:pk>/", TeamDetailView.as_view()),
]
