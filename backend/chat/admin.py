from django.contrib import admin
from .models import Message,Attachment,Reaction

admin.site.register(Message)
admin.site.register(Attachment)
admin.site.register(Reaction) 