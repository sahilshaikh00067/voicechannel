from apscheduler.schedulers.background import BackgroundScheduler
from django.utils import timezone

from .models import VoiceCampaign
from .views import make_twilio_call


def run_scheduled_campaigns():

    print("⏰ CHECKING SCHEDULED CAMPAIGNS")

    campaigns = VoiceCampaign.objects.filter(
        status="scheduled"
    )

    print("FOUND =", campaigns.count())

    now = timezone.now()

    for campaign in campaigns:

        print(
            "CAMPAIGN:",
            campaign.id,
            campaign.status,
            campaign.scheduled_at
        )

        if (
            campaign.scheduled_at and
            campaign.scheduled_at <= now
        ):

            print(
                f"🚀 STARTING CAMPAIGN {campaign.id}"
            )

            for item in campaign.results:

                if item["status"] == "pending":

                    make_twilio_call(
                        number=item["number"],
                        media_url=campaign.voice_file_id,
                        campaign_id=campaign.id
                    )

            campaign.status = "running"
            campaign.save()


def start():

    scheduler = BackgroundScheduler()

    scheduler.add_job(
        run_scheduled_campaigns,
        "interval",
        seconds=30
    )

    scheduler.start()