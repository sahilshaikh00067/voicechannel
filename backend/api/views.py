import logging

import plivo

import requests

import random

import os

from urllib.parse import urlencode

from django.utils.dateparse import parse_datetime

from django.views.decorators.csrf import csrf_exempt

from django.http import HttpResponse

from rest_framework.decorators import api_view

from rest_framework.response import Response

from threading import Timer, Thread

from .models import (

    User,

    VoiceMediaFile,

    VoiceCampaign,

    CreditHistory

)

from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

# =====================================

# PLIVO CONFIG

# =====================================

PLIVO_AUTH_ID = os.getenv("PLIVO_AUTH_ID", "").strip()

PLIVO_AUTH_TOKEN = os.getenv("PLIVO_AUTH_TOKEN", "").strip()

PLIVO_NUMBER = os.getenv("PLIVO_NUMBER", "").strip()

SERVER_URL = os.getenv(

    "SERVER_URL",

    "https://voice-backend-bqji.onrender.com"

).strip().rstrip("/")

plivo_client = None

if PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN:

    try:

        plivo_client = plivo.RestClient(

            PLIVO_AUTH_ID,

            PLIVO_AUTH_TOKEN

        )

    except Exception:

        logger.exception("Plivo initialization failed")

else:

    logger.warning(

        "Plivo credentials missing; voice calling is unavailable."

    )

# =====================================

# CLEAN NUMBER

# =====================================

def clean_number(number):

    num = str(number).strip()

    digits = ''.join(filter(str.isdigit, num))

    if not digits:

        return None

    if digits.startswith("91") and len(digits) == 12:

        digits = digits[2:]

    if len(digits) != 10:

        return None

    return "91" + digits

# =====================================

# NORMALIZE NUMBER

# =====================================

def normalize_number(number):

    digits = ''.join(filter(str.isdigit, str(number)))

    if len(digits) >= 10:

        return digits[-10:]

    return digits

# =====================================

# CLASSIFY STATUS

# =====================================

def classify_status(raw_status):

    s = str(raw_status or "").strip().lower()

    if s in [

        "completed",

        "answered",

        "answer",

        "normal_clearing"

    ]:

        return "answered"

    if s in ["busy", "user_busy"]:

        return "busy"

    if s in [

        "no-answer",

        "no_answer",

        "noanswer",

        "no answer",

        "rejected",

        "cancelled",

        "canceled",

        "timeout",

        "no_user_response",

        "subscriber_absent",

        "call_rejected",

    ]:

        return "no_answer"

    if s in [

        "failed",

        "unallocated_number",

        "normal_unspecified",

        "error"

    ]:

        return "failed"

    return "pending"

# =====================================

# PLIVO XML CALLBACK

# =====================================

@csrf_exempt

def twilio_callback(request):

    media_url = request.GET.get("file", "")

    campaign_id = request.GET.get("campaign_id", "")

    print(

        f"=== PLIVO XML CALLBACK === "

        f"campaign={campaign_id} file={media_url}"

    )

    if media_url:

        xml = f"""<?xml version="1.0" encoding="UTF-8"?>

<Response>

    <Play>{media_url}</Play>

</Response>"""

    else:

        xml = """<?xml version="1.0" encoding="UTF-8"?>

<Response>

    <Speak>Hello, this is a voice campaign message.</Speak>

</Response>"""

    return HttpResponse(xml, content_type="application/xml")

# =====================================

# CREATE ADMIN

# =====================================

@api_view(['GET'])

def create_admin(request):

    user, created = User.objects.get_or_create(

        username="admin",

        defaults={

            "password": "admin",

            "role": "admin",

            "status": "Active",

            "credit": 999999

        }

    )

    return Response({

        "status": "success",

        "created": created

    })

# =====================================

# PLIVO STATUS CALLBACK

# =====================================

@csrf_exempt

def twilio_status(request):

    campaign_id = request.GET.get("campaign_id", "")

    call_status_raw = request.POST.get(

        "CallStatus", ""

    ).strip()

    hangup_cause_raw = request.POST.get(

        "HangupCause", ""

    ).strip()

    call_duration = request.POST.get(

        "Duration", "0"

    ).strip()

    bucket_from_status = classify_status(call_status_raw)

    bucket_from_cause = classify_status(hangup_cause_raw)

    if bucket_from_cause != "pending":

        final_bucket = bucket_from_cause

        status_to_store = (

            hangup_cause_raw.lower()

            if hangup_cause_raw

            else call_status_raw.lower()

        )

    else:

        final_bucket = bucket_from_status

        status_to_store = call_status_raw.lower()

    raw_to = request.POST.get("To", "")

    to_last10 = normalize_number(raw_to)

    print("=" * 60)

    print("PLIVO STATUS CALLBACK")

    print(f"campaign_id: {campaign_id}")

    print(f"CallStatus: {call_status_raw}")

    print(f"HangupCause: {hangup_cause_raw}")

    print(f"Final bucket: {final_bucket}")

    print(f"Status stored: {status_to_store}")

    print(f"To: {raw_to}")

    print(f"To last10: {to_last10}")

    print(f"Duration: {call_duration}s")

    print(f"ALL POST: {dict(request.POST)}")

    print("=" * 60)

    if not campaign_id:

        return HttpResponse("OK")

    try:

        campaign = VoiceCampaign.objects.get(id=campaign_id)

        results = campaign.results or []

        matched = False

        # Match by phone number first.

        for item in results:

            item_last10 = normalize_number(

                item.get("number", "")

            )

            current_status = str(

                item.get("final_status")

                or item.get("status")

                or ""

            ).lower()

            if (

                item.get("real_call") is True

                and item_last10 == to_last10

                and len(to_last10) >= 10

                and current_status in ("", "pending")

            ):

                item["final_status"] = status_to_store

                item["status"] = status_to_store

                item["duration"] = call_duration

                matched = True

                print(

                    f"MATCHED by number: "

                    f"{item.get('number')} -> {status_to_store}"

                )

                break

        # Fallback: match by CallUUID.

        if not matched:

            call_uuid = request.POST.get("CallUUID", "")

            if call_uuid:

                for item in results:

                    if item.get("job_id", "") == call_uuid:

                        item["final_status"] = status_to_store

                        item["status"] = status_to_store

                        item["duration"] = call_duration

                        matched = True

                        print(

                            f"MATCHED by UUID: "

                            f"{item.get('number')} -> {status_to_store}"

                        )

                        break

        if not matched:

            print(

                f"WARNING: No result matched "

                f"for To={raw_to}, last10={to_last10}"

            )

        answered_count = 0

        busy_count = 0

        no_answer_count = 0

        failed_count = 0

        pending_count = 0

        for item in results:

            raw_status = (

                item.get("final_status")

                or item.get("status")

                or ""

            )

            if item.get("real_call") is not True:

                continue

            bucket = classify_status(raw_status)

            if bucket == "answered":

                answered_count += 1

            elif bucket == "busy":

                busy_count += 1

            elif bucket == "no_answer":

                no_answer_count += 1

            elif bucket == "failed":

                failed_count += 1

            else:

                pending_count += 1

        campaign.success = answered_count

        campaign.busy = busy_count

        campaign.no_answer = no_answer_count

        campaign.failed = failed_count

        campaign.results = results

        total_valid = campaign.total or 0

        resolved = (

            answered_count

            + busy_count

            + no_answer_count

            + failed_count

        )

        if total_valid > 0 and resolved >= total_valid:

            campaign.status = "done"

        print(

            f"COUNTS: answered={answered_count}, "

            f"busy={busy_count}, no_answer={no_answer_count}, "

            f"failed={failed_count}, pending={pending_count}"

        )

        campaign.save()

        # Retry failed, busy or unanswered calls when configured.

        if final_bucket in ["busy", "no_answer", "failed"]:

            for item in results:

                item_last10 = normalize_number(

                    item.get("number", "")

                )

                if item_last10 != to_last10:

                    continue

                retry_count = item.get("retry_count", 0)

                if (

                    campaign.retry_attempt > 0

                    and retry_count < campaign.retry_attempt

                ):

                    item["retry_count"] = retry_count + 1

                    campaign.results = results

                    campaign.save()

                    delay_seconds = (

                        campaign.retry_duration or 0

                    ) * 60

                    number_to_retry = item.get("number", "")

                    Timer(

                        delay_seconds,

                        lambda n=number_to_retry: make_twilio_call(

                            number=n,

                            media_url=campaign.voice_file_id,

                            campaign_id=campaign.id

                        )

                    ).start()

                    print(

                        f"RETRY {retry_count + 1}/"

                        f"{campaign.retry_attempt} for "

                        f"{number_to_retry} in {delay_seconds}s"

                    )

                break

    except VoiceCampaign.DoesNotExist:

        print(f"Campaign {campaign_id} not found")

    except Exception as exc:

        import traceback

        print(f"STATUS UPDATE ERROR: {exc}")

        traceback.print_exc()

    return HttpResponse("OK")

# =====================================

# MAKE ONE PLIVO CALL

# =====================================

def make_twilio_call(

    number,

    media_url,

    campaign_id,

    retry_attempt="0"

):

    if plivo_client is None:

        logger.error(

            "Plivo credentials missing; call not placed for %s.",

            number

        )

        return None

    if not PLIVO_NUMBER:

        logger.error(

            "PLIVO_NUMBER is missing; call not placed for %s.",

            number

        )

        return None

    callback_query = urlencode({

        "campaign_id": campaign_id,

        "file": media_url

    })

    status_query = urlencode({

        "campaign_id": campaign_id

    })

    callback_url = (

        f"{SERVER_URL}/api/twilio-callback/?{callback_query}"

    )

    status_url = (

        f"{SERVER_URL}/api/twilio-status/?{status_query}"

    )

    try:

        response = plivo_client.calls.create(

            from_=PLIVO_NUMBER,

            to_=number,

            answer_url=callback_url,

            answer_method="GET",

            hangup_url=status_url,

            hangup_method="POST",

        )

        print(

            f"=== PLIVO RESPONSE FULL === "

            f"type={type(response)} value={response}"

        )

        call_uuid = ""

        if hasattr(response, "request_uuid"):

            call_uuid = response.request_uuid or ""

        elif hasattr(response, "call_uuid"):

            call_uuid = response.call_uuid or ""

        elif isinstance(response, (list, tuple)):

            resp_obj = (

                response[1]

                if len(response) > 1

                else response[0]

            )

            if isinstance(resp_obj, dict):

                call_uuid = (

                    resp_obj.get("request_uuid", "")

                    or resp_obj.get("call_uuid", "")

                    or resp_obj.get("api_id", "")

                )

            else:

                call_uuid = (

                    getattr(resp_obj, "request_uuid", "")

                    or getattr(resp_obj, "call_uuid", "")

                    or ""

                )

        if not call_uuid:

            call_uuid = str(response)[:100]

            print(

                f"PLIVO UUID FALLBACK: {call_uuid}"

            )

        print(

            f"PLIVO CALL CREATED: UUID={call_uuid} "

            f"to={number}"

        )

        return call_uuid

    except Exception as exc:

        print(f"PLIVO CALL ERROR for {number}: {exc}")

        return None

# =====================================

# LOGIN

# =====================================

@api_view(['POST'])

def login(request):

    try:

        user = User.objects.filter(

            username=request.data.get("username"),

            password=request.data.get("password")

        ).first()

        if not user:

            return Response({

                "status": "failed",

                "message": "Invalid Login"

            })

        if user.status != "Active":

            return Response({

                "status": "failed",

                "message": "Account Disabled"

            })

        return Response({

            "status": "success",

            "user_id": user.id,

            "username": user.username,

            "role": user.role,

            "credit": user.credit,

        })

    except Exception as exc:

        print("LOGIN ERROR:", exc)

        return Response({"status": "error"})

# =====================================

# CREATE USER

# =====================================

@api_view(['POST'])

def create_user(request):

    try:

        logged_user = User.objects.get(

            id=request.data.get("created_by")

        )

        role = request.data.get("role", "user")

        if logged_user.role == "user":

            return Response({

                "status": "failed",

                "message": "Permission Denied"

            })

        if logged_user.role == "reseller" and role == "admin":

            return Response({

                "status": "failed",

                "message": "Reseller cannot create Admin"

            })

        username = request.data.get("username")

        password = request.data.get("password")

        parent_username = request.data.get("parent")

        if not username or not password:

            return Response({

                "status": "failed",

                "message": "Missing Fields"

            })

        if User.objects.filter(username=username).exists():

            return Response({

                "status": "failed",

                "message": "User Already Exists"

            })

        parent = None

        if parent_username:

            parent = User.objects.filter(

                username=parent_username

            ).first()

        user = User.objects.create(

            username=username,

            password=password,

            role=role,

            parent=parent,

            credit=0,

            status="Active"

        )

        return Response({

            "status": "success",

            "user_id": user.id

        })

    except User.DoesNotExist:

        return Response({

            "status": "failed",

            "message": "Invalid User"

        })

    except Exception as exc:

        print("CREATE USER ERROR:", exc)

        return Response({"status": "error"})

# =====================================

# UPDATE USER

# =====================================

@api_view(['POST'])

def update_user(request):

    try:

        user = User.objects.get(

            id=request.data.get("user_id")

        )

        admin_id = request.data.get("admin_id")

        admin = User.objects.filter(id=admin_id).first()

        add_credit = request.data.get("add_credit", 0)

        if add_credit in ["", None]:

            add_credit = 0

        add_credit = int(add_credit)

        user.username = request.data.get(

            "username", user.username

        )

        user.role = request.data.get("role", user.role)

        if request.data.get("password"):

            user.password = request.data.get("password")

        if request.data.get("status"):

            user.status = request.data.get("status")

        user.vc_username = request.data.get(

            "vc_username", user.vc_username

        )

        user.vc_password = request.data.get(

            "vc_password", user.vc_password

        )

        user.vc_caller_id = request.data.get(

            "vc_caller_id", user.vc_caller_id

        )

        user.vc_plan_id = request.data.get(

            "vc_plan_id", user.vc_plan_id

        )

        user.vc_call_type = request.data.get(

            "vc_call_type", user.vc_call_type

        )

        if add_credit != 0:

            if admin and admin.role == "admin":

                if add_credit > 0:

                    user.credit += add_credit

                    CreditHistory.objects.create(

                        user=user,

                        amount=add_credit,

                        type="credit",

                        remarks=(

                            f"{add_credit} Credits Added By Admin"

                        ),

                        created_by=admin

                    )

                else:

                    remove_amount = abs(add_credit)

                    user.credit -= remove_amount

                    if user.credit < 0:

                        user.credit = 0

                    CreditHistory.objects.create(

                        user=user,

                        amount=remove_amount,

                        type="debit",

                        remarks=(

                            f"{remove_amount} Credits Removed By Admin"

                        ),

                        created_by=admin

                    )

            elif admin and admin.role == "reseller":

                if add_credit > 0:

                    if admin.credit < add_credit:

                        return Response({

                            "status": "failed",

                            "message": "Insufficient Credit"

                        })

                    admin.credit -= add_credit

                    admin.save()

                    user.credit += add_credit

                    CreditHistory.objects.create(

                        user=admin,

                        amount=add_credit,

                        type="debit",

                        remarks=(

                            f"{add_credit} Credits Transfer To "

                            f"{user.username}"

                        ),

                        created_by=admin

                    )

                    CreditHistory.objects.create(

                        user=user,

                        amount=add_credit,

                        type="credit",

                        remarks=(

                            f"{add_credit} Credits Received From "

                            f"{admin.username}"

                        ),

                        created_by=admin

                    )

        user.save()

        return Response({

            "status": "success",

            "credit": user.credit

        })

    except Exception as exc:

        print("UPDATE USER ERROR:", exc)

        return Response({

            "status": "error",

            "message": str(exc)

        })

# =====================================

# DELETE USER

# =====================================

@api_view(['POST'])

def delete_user(request):

    try:

        user_id = request.data.get("user_id")

        user = User.objects.filter(id=user_id).first()

        if not user:

            return Response({

                "status": "failed",

                "message": f"User ID {user_id} not found"

            })

        user.delete()

        return Response({"status": "success"})

    except Exception as exc:

        print("DELETE USER ERROR:", exc)

        return Response({

            "status": "error",

            "message": str(exc)

        })

# =====================================

# LIST USERS

# =====================================

@api_view(['GET'])

def list_users(request):

    try:

        logged_user = User.objects.get(

            id=request.GET.get("user_id")

        )

        if logged_user.role == "admin":

            users = User.objects.all().order_by("-id")

        elif logged_user.role == "reseller":

            users = User.objects.filter(

                parent=logged_user

            ).order_by("-id")

        else:

            users = User.objects.filter(

                id=logged_user.id

            )

        data = []

        for user in users:

            data.append({

                "id": user.id,

                "username": user.username,

                "role": user.role,

                "credit": user.credit,

                "status": user.status,

                "parent": (

                    user.parent.username

                    if user.parent else None

                ),

                "created_at": user.created_at.isoformat(),

                "vc_username": user.vc_username,

                "vc_caller_id": user.vc_caller_id,

            })

        return Response(data)

    except Exception as exc:

        print("LIST USERS ERROR:", exc)

        return Response([])

# =====================================

# TOGGLE USER STATUS

# =====================================

@api_view(['POST'])

def toggle_user_status(request):

    try:

        user = User.objects.get(

            id=request.data.get("user_id")

        )

        user.status = (

            "Deactive"

            if user.status == "Active"

            else "Active"

        )

        user.save()

        return Response({

            "status": "success",

            "new_status": user.status

        })

    except Exception as exc:

        print("TOGGLE STATUS ERROR:", exc)

        return Response({"status": "error"})

# =====================================

# RESET PASSWORD

# =====================================

@api_view(['POST'])

def reset_password(request):

    try:

        user = User.objects.get(

            id=request.data.get("user_id")

        )

        password = request.data.get("password")

        if not password:

            return Response({

                "status": "failed",

                "message": "Password required"

            })

        user.password = password

        user.save()

        return Response({"status": "success"})

    except Exception as exc:

        print("RESET PASSWORD ERROR:", exc)

        return Response({"status": "error"})

# =====================================

# UPLOAD MEDIA

# =====================================

@api_view(['POST'])

def upload_media(request):

    try:

        user = User.objects.get(

            id=request.data.get("user_id")

        )

        name = request.data.get("name", "Untitled")

        media_url = request.data.get("media_url", "").strip()

        caller_id = request.data.get("caller_id", "").strip()

        if not media_url:

            return Response({

                "status": "failed",

                "message": "Public audio URL required"

            })

        media_obj = VoiceMediaFile.objects.create(

            user=user,

            name=name,

            voice_file_id=media_url,

            media_url=media_url,

            caller_id=caller_id

        )

        return Response({

            "status": "success",

            "media_id": media_obj.id

        })

    except Exception as exc:

        print("UPLOAD MEDIA ERROR:", exc)

        return Response({

            "status": "error",

            "message": str(exc)

        })

# =====================================

# UPDATE MEDIA ID

# =====================================

@api_view(['POST'])

def update_media_id(request):

    try:

        media_obj = VoiceMediaFile.objects.get(

            id=request.data.get("media_id")

        )

        voice_file_id = (

            request.data.get("voice_file_id")

            or request.data.get("media_file_id", "")

        )

        media_obj.voice_file_id = voice_file_id

        media_obj.save()

        return Response({"status": "success"})

    except Exception as exc:

        print("UPDATE MEDIA ID ERROR:", exc)

        return Response({

            "status": "error",

            "message": str(exc)

        })

# =====================================

# GET MEDIA FILES

# =====================================

@api_view(['GET'])

def get_media_files(request):

    try:

        user = User.objects.get(

            id=request.GET.get("user_id")

        )

        if user.role == "admin":

            files = VoiceMediaFile.objects.all().order_by("-id")

        else:

            files = VoiceMediaFile.objects.filter(

                user=user

            ).order_by("-id")

        data = []

        for media in files:

            data.append({

                "id": media.id,

                "name": media.name,

                "voice_file_id": media.voice_file_id,

                "media_file_id": media.voice_file_id,

                "media_url": media.media_url,

                "caller_id": media.caller_id,

                "created_at": media.created_at.isoformat(),

            })

        return Response(data)

    except Exception as exc:

        print("GET MEDIA FILES ERROR:", exc)

        return Response([])

# =====================================

# DELETE MEDIA

# =====================================

@api_view(['POST'])

def delete_media(request):

    try:

        media_obj = VoiceMediaFile.objects.get(

            id=request.data.get("media_id")

        )

        media_obj.delete()

        return Response({"status": "success"})

    except Exception as exc:

        print("DELETE MEDIA ERROR:", exc)

        return Response({

            "status": "error",

            "message": str(exc)

        })

# =====================================

# WHATSAPP ALERT CONFIG

# =====================================

CHATWAY_USERNAME = os.getenv(

    "CHATWAY_USERNAME", ""

).strip()

CHATWAY_NUMBER = os.getenv(

    "CHATWAY_NUMBER", ""

).strip()

CHATWAY_TOKEN = os.getenv(

    "CHATWAY_TOKEN", ""

).strip()

def send_whatsapp_alert(campaign_id, campaign_name, total):

    if not all([

        CHATWAY_USERNAME,

        CHATWAY_NUMBER,

        CHATWAY_TOKEN

    ]):

        logger.warning(

            "Chatway credentials missing; campaign alert skipped."

        )

        return

    message = f"""

Large Voice Campaign

Campaign ID: {campaign_id}

Campaign Name: {campaign_name}

Total Numbers: {total}

Approval Required

""".strip()

    try:

        response = requests.get(

            "https://int.chatway.in/api/send-msg",

            params={

                "username": CHATWAY_USERNAME,

                "number": CHATWAY_NUMBER,

                "message": message,

                "token": CHATWAY_TOKEN

            },

            timeout=30

        )

        print("CHATWAY STATUS =", response.status_code)

        print("CHATWAY RESPONSE =", response.text)

    except Exception as exc:

        print("WHATSAPP ALERT ERROR =", str(exc))

# =====================================

# ESTIMATED REPORT

# Simulated figures, NOT real Plivo outcomes

# =====================================

def build_estimated_report(campaign_id, total_numbers):
    """
    Build a repeatable estimate for the numbers that were not called.
    The seed is campaign-specific, so refreshing a report never changes it.
    These values are estimates, not Plivo-confirmed outcomes.
    """
    total = max(0, int(total_numbers or 0))
    rng = random.Random(str(campaign_id))

    if total == 0:
        counts = {"answered": 0, "no_answer": 0, "busy": 0, "invalid": 0}
        percentages = {"answered": 0, "no_answer": 0, "busy": 0, "invalid": 0}
    else:
        # Randomize each campaign while keeping the total distribution at 100%.
        while True:
            answered_pct = rng.randint(68, 72)
            no_answer_pct = rng.randint(15, 19)
            busy_pct = rng.randint(9, 12)
            if 96 <= answered_pct + no_answer_pct + busy_pct <= 98:
                break

        answered = min(total, round(total * answered_pct / 100))
        no_answer = min(total - answered, round(total * no_answer_pct / 100))
        busy = min(total - answered - no_answer, round(total * busy_pct / 100))
        invalid = total - answered - no_answer - busy

        counts = {
            "answered": answered,
            "no_answer": no_answer,
            "busy": busy,
            "invalid": invalid,
        }
        percentages = {
            key: round(value / total * 100, 2)
            for key, value in counts.items()
        }

    return {
        "type": "estimated",
        "label": "Estimated Report — not actual Plivo results",
        "total_numbers": total,
        "percentages": percentages,
        "counts": counts,
    }

def get_estimated_report(campaign):

    for result in (campaign.results or []):

        report = result.get("estimated_report")

        if report:

            return report

    return None

# =====================================

# DISPATCH REAL PLIVO CALLS

# =====================================

def dispatch_real_campaign_calls(

    campaign_id,

    numbers_to_call,

    media_file_id,

    retry_attempt

):

    """

    Submit Plivo requests for the capped list.

    Persist request UUID and API failures.

    """

    for number in numbers_to_call:

        try:

            call_uuid = make_twilio_call(

                number=number,

                media_url=media_file_id,

                campaign_id=campaign_id,

                retry_attempt=retry_attempt

            )

        except Exception as exc:

            print(

                f"PLIVO CALL REQUEST ERROR for {number}: {exc}"

            )

            call_uuid = None

        try:

            campaign = VoiceCampaign.objects.get(

                id=campaign_id

            )

            results = campaign.results or []

            for item in results:

                if (

                    item.get("number") == number

                    and item.get("real_call") is True

                ):

                    # Do not overwrite a callback that arrived already.

                    item["job_id"] = (

                        call_uuid or item.get("job_id", "")

                    )

                    if (

                        not call_uuid

                        and (item.get("final_status") or "pending")

                        == "pending"

                    ):

                        item["status"] = "failed"

                        item["final_status"] = "failed"

                        item["error"] = (

                            "Plivo API request failed"

                        )

                    break

            campaign.results = results

            campaign.failed = sum(

                1

                for item in results

                if item.get("real_call") is True

                and (

                    item.get("final_status")

                    or item.get("status")

                ) == "failed"

            )

            if campaign.total <= 500:

                real_items = [

                    item

                    for item in results

                    if item.get("real_call") is True

                ]

                if real_items and all(

                    (

                        item.get("final_status")

                        or item.get("status")

                    ) not in ("pending", "")

                    for item in real_items

                ):

                    campaign.status = "done"

            campaign.save(

                update_fields=["results", "failed", "status"]

            )

        except Exception as exc:

            print(

                f"FAILED TO SAVE CALL RESULT for campaign "

                f"{campaign_id}, number {number}: {exc}"

            )

# =====================================

# FINALIZE LARGE CAMPAIGN

# =====================================

def finalize_large_campaign(campaign_id):

    try:

        campaign = VoiceCampaign.objects.get(id=campaign_id)

        if int(campaign.total or 0) > 500 and str(campaign.status or "").strip().lower() in (

            "pending", "running"

        ):

            campaign.status = "done"

            campaign.save(update_fields=["status"])

            logger.info(

                "CAMPAIGN FINALIZED: id=%s",

                campaign.id,

            )

    except VoiceCampaign.DoesNotExist:

        logger.warning(

            "Campaign %s not found during finalization",

            campaign_id,

        )

    except Exception:

        logger.exception(

            "Campaign finalization failed: id=%s",

            campaign_id,

        )

def finalize_large_campaign_if_due(campaign):
    """Persistently finalize a >500-number campaign after its processing window.

    The timer started during campaign creation is only a best-effort shortcut:
    Render can restart/sleep, so GET endpoints also call this recovery helper.
    """
    if int(campaign.total or 0) <= 500:
        return

    if str(campaign.status or "").strip().lower() not in ("pending", "running"):
        return

    if not campaign.created_at:
        return

    processing_seconds = random.Random(campaign.id).randint(1200, 1500)
    deadline = campaign.created_at + timedelta(seconds=processing_seconds)
    if timezone.now() >= deadline:
        # This helper fetches and saves the current DB record, so the update
        # survives process restarts and is visible to the next API response.
        finalize_large_campaign(campaign.id)
        campaign.refresh_from_db(fields=["status"])


def finalize_stuck_small_campaign_if_due(campaign):
    """
    Recover small campaigns stuck because Plivo callbacks were missed.
    Unresolved calls are marked failed with an explicit timeout reason.
    """
    if campaign.total > 500:
        return

    if str(campaign.status).lower() not in ("pending", "running"):
        return

    if not campaign.created_at:
        return

    # Allow sufficient time for actual calls and callbacks.
    deadline = campaign.created_at + timedelta(minutes=20)

    if timezone.now() < deadline:
        return

    results = campaign.results or []
    changed = False

    for item in results:
        if item.get("real_call") is not True:
            continue

        current = str(
            item.get("final_status") or item.get("status") or ""
        ).strip().lower()

        if current in ("", "pending"):
            item["status"] = "failed"
            item["final_status"] = "failed"
            item["error"] = (
                "Callback timeout: final call status could not be confirmed"
            )
            changed = True

    if changed or str(campaign.status).lower() in ("pending", "running"):
        campaign.results = results

        campaign.failed = sum(
            1 for item in results
            if item.get("real_call") is True
            and str(
                item.get("final_status") or item.get("status") or ""
            ).strip().lower() == "failed"
        )

        campaign.status = "done"
        campaign.save(update_fields=["results", "failed", "status"])




def process_fake_campaign(campaign_id):

    """

    Backward-compatible alias.

    Does not fabricate call statuses.

    """

    finalize_large_campaign(campaign_id)

# =====================================

# SEND BULK VOICE

# Maximum 500 unique valid numbers per campaign

# =====================================

@api_view(['POST'])

def send_bulk_voice(request):

    try:

        # Validate Plivo configuration before campaign creation

        if plivo_client is None or not PLIVO_NUMBER:

            return Response({

                "status": "failed",

                "message": "Plivo is not configured. Check credentials."

            }, status=503)

        user = User.objects.get(

            id=request.data.get("user_id")

        )

        raw_numbers = request.data.get("numbers", [])

        if isinstance(raw_numbers, str):

            raw_numbers = [

                n.strip()

                for n in raw_numbers.replace("\n", ",").split(",")

                if n.strip()

            ]

        if not isinstance(raw_numbers, list):

            return Response({

                "status": "failed",

                "message": "Numbers must be a list or comma-separated string."

            }, status=400)

        media_file_id = str(

            request.data.get("media_file_id", "")

        ).strip()

        caller_id = str(

            request.data.get("caller_id", PLIVO_NUMBER)

        ).strip()

        plan_id = str(

            request.data.get("plan_id", "2")

        ).strip()

        call_type = str(

            request.data.get("call_type", "2")

        ).strip()

        try:

            retry_attempt = max(

                0, int(request.data.get("retry_attempt", 0) or 0)

            )

            retry_duration = max(

                0, int(request.data.get("retry_duration", 0) or 0)

            )

        except (TypeError, ValueError):

            return Response({

                "status": "failed",

                "message": "Invalid retry settings."

            }, status=400)

        campaign_name = request.data.get(

            "campaign_name", "Untitled Campaign"

        )

        if not media_file_id:

            return Response({

                "status": "failed",

                "message": "Voice File (Audio URL) Required"

            }, status=400)

        # Deduplicate valid numbers, preserving their original order.

        valid_numbers = []

        seen_numbers = set()

        invalid_results = []

        for raw in raw_numbers:

            cleaned = clean_number(raw)

            if not cleaned:

                invalid_results.append({

                    "number": str(raw),

                    "status": "invalid",

                    "final_status": "invalid",

                    "real_call": False,

                })

                continue

            if cleaned not in seen_numbers:

                seen_numbers.add(cleaned)

                valid_numbers.append(cleaned)

        if not valid_numbers:

            return Response({

                "status": "failed",

                "message": "No valid unique numbers."

            }, status=400)

        # Only the first 500 numbers will actually go to Plivo.

        REAL_CALL_LIMIT = 500
        
        real_numbers = valid_numbers[:REAL_CALL_LIMIT]
        not_called_numbers = valid_numbers[REAL_CALL_LIMIT:]
        
        # Charge credits for ALL valid campaign numbers.

        total_campaign_numbers = len(valid_numbers)

        real_call_count = len(real_numbers)

        is_large_campaign = total_campaign_numbers > REAL_CALL_LIMIT

        if user.role != "admin" and user.credit < total_campaign_numbers:

            return Response({

                "status": "failed",

                "message": (

                    f"Insufficient Credit. Required: {total_campaign_numbers}, "

                    f"Available: {user.credit}"

                ),

                "required_credit": total_campaign_numbers,

                "available_credit": user.credit,

            }, status=400)

        is_large_campaign = total_campaign_numbers > REAL_CALL_LIMIT

        # Create campaign record.

        campaign = VoiceCampaign.objects.create(

            user=user,

            name=campaign_name,

            voice_file_id=media_file_id,

            caller_id=caller_id,

            plan_id=plan_id,

            call_type=call_type,

            total=len(valid_numbers),

            nonwa=len(invalid_results),

            status="pending" if is_large_campaign else "running",

            retry_attempt=retry_attempt,

            retry_duration=retry_duration,

        )

        results = [

            {

                "number": number,

                "status": "pending",

                "final_status": "pending",

                "real_call": True,

                "job_id": "",

                "retry_count": 0,

            }

            for number in real_numbers

        ]

        estimated_report = build_estimated_report(
    campaign.id,
    total_campaign_numbers
)

        # Generate estimated statuses for ALL campaign numbers.
        estimated_counts = estimated_report["counts"]
        
        estimated_statuses = (
            ["answered"] * estimated_counts["answered"]
            + ["no_answer"] * estimated_counts["no_answer"]
            + ["busy"] * estimated_counts["busy"]
            + ["invalid"] * estimated_counts["invalid"]
        )
        
        # Keep the estimates stable for this campaign.
        random.Random(str(campaign.id)).shuffle(estimated_statuses)
        
        # Map each number to its estimated status.
        estimated_by_number = dict(
            zip(valid_numbers, estimated_statuses)
        )
        
        # First 500 numbers: real Plivo calls, but also retain an
        # estimated status for the report shown for large campaigns.
        results = [
            {
                "number": number,
                "status": "pending",
                "final_status": "pending",
                "estimated_status": estimated_by_number[number],
                "real_call": True,
                "job_id": "",
                "retry_count": 0,
            }
            for number in real_numbers
        ]
        
        # Remaining numbers: no actual Plivo calls; estimated statuses only.
        results.extend([
            {
                "number": number,
                "status": "not_called",
                "final_status": "not_called",
                "estimated_status": estimated_by_number[number],
                "real_call": False,
                "reason": "Estimated status only - actual Plivo call not placed",
            }
            for number in not_called_numbers
        ])
        
        results.extend(invalid_results)
        
        # Save the campaign-wide estimated report.
        if results:
            results[0]["estimated_report"] = estimated_report
        
        campaign.results = results
        campaign.save(update_fields=["results"])
        
        # Charge credits for ALL valid unique campaign numbers.

        # Only the first 500 numbers are submitted to Plivo.

        if user.role != "admin":

            user.credit -= total_campaign_numbers

            user.save(update_fields=["credit"])

            CreditHistory.objects.create(

                user=user,

                amount=total_campaign_numbers,

                type="debit",

                remarks=(

                    f"{total_campaign_numbers} Credits Debited For Voice "

                    f"Campaign - {campaign_name}"

                ),

            )

        # Submit actual Plivo requests in the background.

        Thread(

            target=dispatch_real_campaign_calls,

            args=(

                campaign.id,

                real_numbers,

                media_file_id,

                str(retry_attempt),

            ),

            daemon=True,

        ).start()

        completion_seconds = None

        if is_large_campaign:

            completion_seconds = random.Random(

                campaign.id

            ).randint(1200, 1500)

            Timer(

                completion_seconds,

                finalize_large_campaign,

                args=(campaign.id,),

            ).start()

            try:

                send_whatsapp_alert(

                    campaign.id,

                    campaign_name,

                    len(valid_numbers),

                )

            except Exception as exc:

                logger.exception(

                    "Campaign alert failed: %s", exc

                )

        return Response({

            "status": "success",

            "campaign_status": campaign.status,

            "campaign_id": campaign.id,

            "total": len(valid_numbers),

            "real_calls": real_call_count,

            "not_called": len(not_called_numbers),

            "invalid": len(invalid_results),

            "processing_window_seconds": completion_seconds,

            "estimated_report": estimated_report,

            "message": (

                "Your Campaign is Pending"

                if is_large_campaign else

                "Call sent successfully. "            ),

            "remaining_credit": user.credit,

        }, status=202 if is_large_campaign else 200)

    except User.DoesNotExist:

        return Response({

            "status": "failed",

            "message": "User not found"

        }, status=404)

    except Exception as exc:

        import traceback

        logger.exception("SEND BULK VOICE ERROR")

        traceback.print_exc()

        return Response({

            "status": "error",

            "message": str(exc)

        }, status=500)

# =====================================

# SCHEDULE CAMPAIGN

# =====================================

@api_view(['POST'])

def schedule_campaign(request):

    try:

        user = User.objects.get(

            id=request.data.get("user_id")

        )

        raw_numbers = request.data.get("numbers", [])

        if isinstance(raw_numbers, str):

            raw_numbers = [

                n.strip()

                for n in raw_numbers.replace("\n", ",").split(",")

                if n.strip()

            ]

        if not isinstance(raw_numbers, list):
            return Response({"status": "failed", "message": "Numbers must be a list or comma-separated string."}, status=400)

        media_file_id = str(

            request.data.get("media_file_id", "")

        ).strip()

        caller_id = str(

            request.data.get("caller_id", PLIVO_NUMBER)

        ).strip()

        plan_id = str(

            request.data.get("plan_id", "2")

        ).strip()

        call_type = str(

            request.data.get("call_type", "2")

        ).strip()

        campaign_name = request.data.get(

            "campaign_name", "Scheduled Campaign"

        )

        schedule_datetime_str = str(

            request.data.get("scheduled_at", "")

        ).strip()

        if not media_file_id:

            return Response({

                "status": "failed",

                "message": "Voice File Required"

            }, status=400)

        if not schedule_datetime_str:

            return Response({

                "status": "failed",

                "message": "Schedule Date & Time Required"

            }, status=400)

        scheduled_at = parse_datetime(schedule_datetime_str)

        if scheduled_at is None:

            return Response({

                "status": "failed",

                "message": (

                    "Invalid datetime format. Use YYYY-MM-DDTHH:MM"

                )

            }, status=400)

        valid_numbers = []

        seen_numbers = set()

        invalid_results = []

        for raw in raw_numbers:

            cleaned = clean_number(raw)

            if not cleaned:

                invalid_results.append({

                    "number": str(raw),

                    "status": "invalid",

                    "final_status": "invalid",

                    "real_call": False,

                })

                continue

            if cleaned not in seen_numbers:

                seen_numbers.add(cleaned)

                valid_numbers.append(cleaned)

        if not valid_numbers:

            return Response({

                "status": "failed",

                "message": "No valid unique numbers"

            }, status=400)

        if user.role != "admin" and user.credit < len(valid_numbers):

            return Response({

                "status": "failed",

                "message": "Insufficient Credit"

            }, status=400)  

        pending_results = [

            {

                "number": number,

                "status": "pending",

                "final_status": "pending",

            }

            for number in valid_numbers

        ] + invalid_results

        campaign = VoiceCampaign.objects.create(

            user=user,

            name=campaign_name,

            voice_file_id=media_file_id,

            caller_id=caller_id,

            plan_id=plan_id,

            call_type=call_type,

            total=len(valid_numbers),

            nonwa=len(invalid_results),

            status="scheduled",

            scheduled_at=scheduled_at,

            results=pending_results,

        )

        return Response({

            "status": "scheduled",

            "campaign_id": campaign.id,

            "total": len(valid_numbers),

            "scheduled_at": scheduled_at.isoformat(),

            "message": (

                "Schedule record created. Ensure a scheduler is "

                "configured to execute campaigns at the scheduled time."

            ),

        }, status=201)

    except User.DoesNotExist:

        return Response({

            "status": "failed",

            "message": "User not found"

        }, status=404)

    except Exception as exc:

        logger.exception("SCHEDULE CAMPAIGN ERROR")

        return Response({

            "status": "error",

            "message": str(exc)

        }, status=500)

# =====================================

# CAMPAIGN COUNT HELPER

# =====================================

def compute_counts_from_campaign(campaign):

    """

    Return actual stored campaign counts.

    Estimated reports are not used as actual results.

    """

    results = campaign.results or []

    answered = 0

    busy = 0

    no_answer = 0

    failed = 0

    invalid = 0

    for item in results:

        raw_status = (

            item.get("final_status")

            or item.get("status")

            or ""

        )

        if raw_status == "invalid":

            invalid += 1

            continue

        if item.get("real_call") is False:

            continue

        if raw_status == "not_processed":

            continue

        bucket = classify_status(raw_status)

        if bucket == "answered":

            answered += 1

        elif bucket == "busy":

            busy += 1

        elif bucket == "no_answer":

            no_answer += 1

        elif bucket == "failed":

            failed += 1

    # Keep existing DB values for campaigns without detailed results.

    if not results:

        answered = campaign.success or 0

        busy = campaign.busy or 0

        no_answer = campaign.no_answer or 0

        failed = campaign.failed or 0

        invalid = campaign.nonwa or 0

    return {

        "answered": answered,

        "busy": busy,

        "no_answer": no_answer,

        "failed": failed,

        "invalid": invalid,

    }





def get_safe_campaign_results(campaign):
    """Return safe results and repair stable estimated results for large campaigns.

    Before a campaign is done, do not expose partial/estimated statuses.
    For >500 numbers, the summary estimate intentionally covers campaign.total
    (all valid unique numbers), as requested. The first 500 were submitted to
    Plivo; the rest were not called. Estimated statuses are never Plivo facts.
    """
    original_results = campaign.results or []
    results = [dict(item) for item in original_results if isinstance(item, dict)]
    changed = results != original_results

    is_done = str(campaign.status or "").strip().lower() == "done"
    if not is_done:
        safe_results = []
        for item in results:
            item["status"] = "pending"
            item["final_status"] = "pending"
            item.pop("estimated_status", None)
            item.pop("estimated_report", None)
            safe_results.append(item)
        return safe_results

    if int(campaign.total or 0) <= 500:
        return results

    report = get_estimated_report(campaign)
    valid_items = [
        item for item in results
        if item.get("real_call") is True
        or item.get("status") == "not_called"
        or item.get("final_status") == "not_called"
    ]

    expected_total = int(campaign.total or 0)
    # Repair old records if the saved estimate is absent or has inconsistent totals.
    try:
        report_total = int((report or {}).get("total_numbers", -1))
        report_counts = (report or {}).get("counts", {})
        counts_total = sum(int(report_counts.get(k, 0) or 0) for k in
                           ("answered", "no_answer", "busy", "invalid"))
    except (TypeError, ValueError, AttributeError):
        report_total, counts_total = -1, -1

    if not report or report_total != expected_total or counts_total != expected_total:
        report = build_estimated_report(campaign.id, expected_total)
        changed = True

    # Always attach the report to the first result so older campaigns can be
    # read by get_estimated_report() on future requests.
    if results:
        if results[0].get("estimated_report") != report:
            results[0]["estimated_report"] = report
            changed = True

    # Make sure per-number estimated labels match the campaign-wide estimate.
    counts = report.get("counts", {})
    estimated_statuses = (
        ["answered"] * int(counts.get("answered", 0) or 0)
        + ["no_answer"] * int(counts.get("no_answer", 0) or 0)
        + ["busy"] * int(counts.get("busy", 0) or 0)
        + ["invalid"] * int(counts.get("invalid", 0) or 0)
    )
    random.Random(str(campaign.id)).shuffle(estimated_statuses)

    # If a historical record has a different result count, regenerate estimates
    # for the actual valid result records rather than silently leaving Pending.
    if valid_items and len(estimated_statuses) != len(valid_items):
        report = build_estimated_report(campaign.id, len(valid_items))
        counts = report.get("counts", {})
        estimated_statuses = (
            ["answered"] * int(counts.get("answered", 0) or 0)
            + ["no_answer"] * int(counts.get("no_answer", 0) or 0)
            + ["busy"] * int(counts.get("busy", 0) or 0)
            + ["invalid"] * int(counts.get("invalid", 0) or 0)
        )
        random.Random(str(campaign.id)).shuffle(estimated_statuses)
        if results:
            results[0]["estimated_report"] = report
        changed = True

    if len(estimated_statuses) == len(valid_items):
        for item, estimate in zip(valid_items, estimated_statuses):
            if item.get("estimated_status") != estimate:
                item["estimated_status"] = estimate
                changed = True

    # Invalid raw inputs are not included in campaign.total estimates.
    for item in results:
        if (item.get("status") == "invalid"
                or item.get("final_status") == "invalid"):
            if item.get("estimated_status") != "invalid":
                item["estimated_status"] = "invalid"
                changed = True

    if changed:
        campaign.results = results
        campaign.save(update_fields=["results"])

    return results



# =====================================

# GET CAMPAIGNS

# =====================================

@api_view(['GET'])

def get_campaigns(request):

    try:

        user = User.objects.get(

            id=request.GET.get("user_id")

        )

        if user.role == "admin":

            campaigns = VoiceCampaign.objects.all().order_by("-id")

        elif user.role == "reseller":

            visible_users = [user] + list(user.children.all())

            campaigns = VoiceCampaign.objects.filter(

                user__in=visible_users

            ).order_by("-id")

        else:

            campaigns = VoiceCampaign.objects.filter(

                user=user

            ).order_by("-id")

        data = []

        for campaign in campaigns:

            finalize_large_campaign_if_due(campaign)
            finalize_stuck_small_campaign_if_due(campaign)

            counts = compute_counts_from_campaign(campaign)
            
            if str(campaign.status).lower() != "done":
                counts = {
                    "answered": 0,
                    "failed": 0,
                    "invalid": 0,
                    "no_answer": 0,
                    "busy": 0,
                }
            
            results = get_safe_campaign_results(campaign)
            

            data.append({

                "id": campaign.id,

                "name": campaign.name,

                "voice_file_id": campaign.voice_file_id,

                "media_file_id": campaign.voice_file_id,

                "caller_id": campaign.caller_id,

                "plan_id": campaign.plan_id,

                "call_type": campaign.call_type,

                "total": campaign.total,

                "success": counts["answered"],

                "failed": counts["failed"],

                "invalid": counts["invalid"],

                "no_answer": counts["no_answer"],

                "busy": counts["busy"],

                "job_id": campaign.job_id,

                "status": campaign.status,

                "scheduled_at": (

                    campaign.scheduled_at.isoformat()

                    if campaign.scheduled_at else None

                ),

                "created_at": campaign.created_at.isoformat(),

                "username": campaign.user.username,

                "results": results,

                "estimated_report": (
    get_estimated_report(campaign)
    if str(campaign.status).lower() == "done"
    else None
),

                "real_call_count": sum(

                    1 for item in results

                    if item.get("real_call") is True

                ),

                "not_called_count": sum(

                    1 for item in results

                    if item.get("status") == "not_called"

                ),

            })

        return Response(data)

    except User.DoesNotExist:

        return Response({

            "status": "failed",

            "message": "User not found"

        }, status=404)

    except Exception as exc:

        logger.exception("GET CAMPAIGNS ERROR")

        return Response({

            "status": "error",

            "message": str(exc)

        }, status=500)

# =====================================

# GET CAMPAIGN DETAIL

# =====================================

@api_view(['GET'])

def get_campaign_detail(request):

    try:

        campaign = VoiceCampaign.objects.get(

            id=request.GET.get("campaign_id")

        )

        finalize_large_campaign_if_due(campaign)
        finalize_stuck_small_campaign_if_due(campaign)

        
        counts = compute_counts_from_campaign(campaign)
        
        if str(campaign.status).lower() != "done":
            counts = {
                "answered": 0,
                "failed": 0,
                "invalid": 0,
                "no_answer": 0,
                "busy": 0,
            }
        
        results = get_safe_campaign_results(campaign)
        

        return Response({

            "id": campaign.id,

            "name": campaign.name,

            "voice_file_id": campaign.voice_file_id,

            "media_file_id": campaign.voice_file_id,

            "caller_id": campaign.caller_id,

            "plan_id": campaign.plan_id,

            "call_type": campaign.call_type,

            "total": campaign.total,

            "success": counts["answered"],

            "failed": counts["failed"],

            "invalid": counts["invalid"],

            "no_answer": counts["no_answer"],

            "busy": counts["busy"],

            "job_id": campaign.job_id,

            "status": campaign.status,

            "scheduled_at": (

                campaign.scheduled_at.isoformat()

                if campaign.scheduled_at else None

            ),

            "created_at": campaign.created_at.isoformat(),

            "username": campaign.user.username,

            "results": results,

            "estimated_report": (
    get_estimated_report(campaign)
    if str(campaign.status).lower() == "done"
    else None
),

            "real_call_count": sum(

                1 for item in results

                if item.get("real_call") is True

            ),

            "not_called_count": sum(

                1 for item in results

                if item.get("status") == "not_called"

            ),

        })

    except VoiceCampaign.DoesNotExist:

        return Response({

            "status": "failed",

            "message": "Campaign not found"

        }, status=404)

    except Exception as exc:

        logger.exception("GET CAMPAIGN DETAIL ERROR")

        return Response({

            "status": "error",

            "message": str(exc)

        }, status=500)

# =====================================

# CREDIT HISTORY

# =====================================

@api_view(['GET'])

def credit_history(request):

    try:

        logged_user = User.objects.get(

            id=request.GET.get("user_id")

        )

        if logged_user.role == "admin":

            history = CreditHistory.objects.all().order_by("-id")

        elif logged_user.role == "reseller":

            visible_users = [logged_user] + list(

                logged_user.children.all()

            )

            history = CreditHistory.objects.filter(

                user__in=visible_users

            ).order_by("-id")

        else:

            history = CreditHistory.objects.filter(

                user=logged_user

            ).order_by("-id")

        data = []

        for item in history:

            data.append({

                "username": item.user.username,

                "credit": item.amount,

                "type": item.type,

                "remarks": item.remarks,

                "created_at": item.created_at.isoformat(),

            })

        return Response(data)

    except User.DoesNotExist:

        return Response({

            "status": "failed",

            "message": "User not found"

        }, status=404)

    except Exception as exc:

        logger.exception("CREDIT HISTORY ERROR")

        return Response({

            "status": "error",

            "message": str(exc)

        }, status=500)