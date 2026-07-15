from django.contrib import admin
from .models import Message, Attachment, Reaction, ChannelReadReceipt


class AttachmentAdmin(admin.ModelAdmin):
    def delete_queryset(self, request, queryset):
        for obj in queryset:
            if obj.file:
                storage = obj.file.storage
                path = obj.file.path
                if storage.exists(path):
                    storage.delete(path)
        super().delete_queryset(request, queryset)


admin.site.register(Message)
admin.site.register(Attachment, AttachmentAdmin)
admin.site.register(Reaction)
admin.site.register(ChannelReadReceipt)
