from django.apps import AppConfig


class ApiConfig(AppConfig):

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):

        print("🚀 SCHEDULER STARTING")

        try:
            from .scheduler import start

            start()

            print("✅ SCHEDULER STARTED")

        except Exception as e:

            print("❌ SCHEDULER ERROR:", e)