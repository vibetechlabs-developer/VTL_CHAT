from django.urls import path
from .views import SignupView,LoginView,ProfileView,RefreshTokenView,LogoutView,UserDetailView,UserListView

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view()),
    path('refresh/', RefreshTokenView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
]