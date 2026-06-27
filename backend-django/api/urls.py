from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    SignupView,
    UserProfileView,
    RoomCreateView,
    RoomVerifyView,
    FileUploadView,
    FileListView,
    FileDownloadView,
)

urlpatterns = [
    # Auth endpoints
    path('auth/signup/', SignupView.as_view(), name='signup'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', UserProfileView.as_view(), name='user_profile'),

    # Room endpoints
    path('rooms/create/', RoomCreateView.as_view(), name='room_create'),
    path('rooms/verify/<str:room_id>/', RoomVerifyView.as_view(), name='room_verify'),

    # File endpoints
    path('rooms/<str:room_id>/files/', FileListView.as_view(), name='file_list'),
    path('rooms/<str:room_id>/files/upload/', FileUploadView.as_view(), name='file_upload'),
    path('files/download/<uuid:file_id>/', FileDownloadView.as_view(), name='file_download'),
]
