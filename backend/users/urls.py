from django.urls import path
from .views import (
    SignupView,
    LoginView,
    ProfileView,
    RefreshTokenView,
    LogoutView,
    UserDetailView,
    UserListView,
    ForgotPasswordView,
    ResetPasswordView,
    GoogleAuthView,
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('google/', GoogleAuthView.as_view(), name='google-auth'),
    path('profile/', ProfileView.as_view()),
    path('refresh/', RefreshTokenView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]