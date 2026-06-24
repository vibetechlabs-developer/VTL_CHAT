from django.contrib import admin
from .models import Organization, Team, TeamMember, Channel 

# Register your models here.
admin.site.register(Organization)
admin.site.register(Team)
admin.site.register(TeamMember)
admin.site.register(Channel)
