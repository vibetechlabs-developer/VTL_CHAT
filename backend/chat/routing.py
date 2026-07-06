from django.urls import re_path

from .consumers import ChatConsumer
from .global_consumer import GlobalEventsConsumer
from .call_consumer import CallConsumer

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<channel_id>\d+)/$", ChatConsumer.as_asgi()),
    re_path(r"ws/events/$", GlobalEventsConsumer.as_asgi()),
    re_path(r"ws/call/(?P<meeting_id>\d+)/$", CallConsumer.as_asgi()),
]
