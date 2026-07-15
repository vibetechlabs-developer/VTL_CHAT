from django.conf import settings

REFRESH_COOKIE_NAME = "vtl_refresh"
REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24  # 1 day, matches refresh token lifetime


def _cookie_secure():
    """Use secure cookies only in production over HTTPS."""
    if settings.DEBUG or getattr(settings, "LOCAL_DEV", False):
        return False
    return True


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=_cookie_secure(),
        samesite="Lax",
        path="/",
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/")
    return response
