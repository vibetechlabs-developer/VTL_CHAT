from django.urls import path
from .views import MessageListCreateView, MessageDetailView, MessagePinView, AttachmentListCreateView, ReactionListCreateView, ReactionDetailView, AttachmentDetailView, ReadReceiptView
urlpatterns = [

    path(
        "",
        MessageListCreateView.as_view()
    ),

    path(
        "<int:pk>/",
        MessageDetailView.as_view()
    ),

    path(
        "<int:pk>/pin/",
        MessagePinView.as_view()
    ),

    path(
        "attachments/",
        AttachmentListCreateView.as_view()
    ),  
    path(
        "attachments/<int:pk>/",    
        AttachmentDetailView.as_view()
    ),

    path(
        "reactions/",
        ReactionListCreateView.as_view()
    ),

    path(
        "reactions/<int:pk>/",
        ReactionDetailView.as_view()
    ),

    path(
        "read-receipt/",
        ReadReceiptView.as_view()
    ),

]