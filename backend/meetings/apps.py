from django.apps import AppConfig


class MeetingsConfig(AppConfig):
    name = 'meetings'

    def ready(self):
        import meetings.signals
