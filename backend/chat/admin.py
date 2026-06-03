from django.contrib import admin
from .models import Message

admin.site.register(Message)
admin.site.register(Attachment)
admin.site.register(Reaction)