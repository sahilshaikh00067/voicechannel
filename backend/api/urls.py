from django.urls import path
from . import views

urlpatterns = [

    # ==============================
    # 🔐 AUTH
    # ==============================
    path("login/", views.login),

    # ==============================
    # 👤 USER MANAGEMENT
    # ==============================
    path("create-user/",    views.create_user),
    path("update-user/",    views.update_user),
    path("delete-user/",    views.delete_user),
    path("toggle-status/",  views.toggle_user_status),
    path("reset-password/", views.reset_password),

    # ==============================
    # 🎙️ MEDIA FILES
    # ==============================
    path("upload-media/",    views.upload_media),
    path("update-media-id/", views.update_media_id),
    path("get-media-files/", views.get_media_files),
    path("delete-media/",    views.delete_media),
    path("list-users/", views.list_users),
    path("create-admin/", views.create_admin),

    # ==============================
    # 📞 VOICE CAMPAIGNS (Twilio)
    # ==============================
    path("send-bulk-voice/",     views.send_bulk_voice),
    path("schedule-campaign/",   views.schedule_campaign),
    path("get-campaigns/",       views.get_campaigns),
    path("get-campaign-detail/", views.get_campaign_detail),
    

    # ==============================
    # 🔁 TWILIO CALLBACKS
    # Twilio hits these automatically
    # ==============================
path("twilio-callback/", views.twilio_callback),
path("twilio-status/",   views.twilio_status),
path("dtmf-input/", views.dtmf_input),

    # ==============================
    # 💰 CREDIT
    # ==============================
    path("credit-history/", views.credit_history),

]   