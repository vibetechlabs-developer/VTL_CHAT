from django.conf import settings
from rest_framework.pagination import CursorPagination


class StandardCursorPagination(CursorPagination):
    page_size = settings.REST_FRAMEWORK.get("PAGE_SIZE", 50)
    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = ("-created_at", "-id")


class CreatedAtAscendingCursorPagination(CursorPagination):
    page_size = settings.REST_FRAMEWORK.get("PAGE_SIZE", 50)
    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = ("created_at", "id")


class UploadedAtCursorPagination(CursorPagination):
    page_size = settings.REST_FRAMEWORK.get("PAGE_SIZE", 50)
    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = ("-uploaded_at", "-id")
