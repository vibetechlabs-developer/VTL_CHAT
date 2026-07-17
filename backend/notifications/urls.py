from django.urls import path
from .views import (
    NotificationListCreateView,
    NotificationDetailView,
    NotificationMarkAllReadView,
)

urlpatterns = [
    path("", NotificationListCreateView.as_view()),
    path("mark-all-read/", NotificationMarkAllReadView.as_view()),
    path("<int:notification_id>/", NotificationDetailView.as_view()),
]
