from django.urls import path
from .views import NotificationListCreateView, NotificationDetailView

urlpatterns = [
    path("", NotificationListCreateView.as_view()),
    path("<int:notification_id>/", NotificationDetailView.as_view()),
]
