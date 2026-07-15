from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from users.models import WebSocketTicket


@database_sync_to_async
def get_user_from_ticket(ticket_str):
    try:
        t = WebSocketTicket.objects.select_related("user").get(ticket=ticket_str)
        if t.is_valid():
            user = t.user
            t.delete()  # consume ticket immediately
            return user
        else:
            t.delete()
    except WebSocketTicket.DoesNotExist:
        pass
    return AnonymousUser()


class TicketAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        ticket = params.get("ticket", [None])[0]
        scope["user"] = await get_user_from_ticket(ticket) if ticket else AnonymousUser()
        return await self.inner(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return TicketAuthMiddleware(inner)
