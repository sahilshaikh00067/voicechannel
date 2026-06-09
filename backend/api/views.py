import plivo
import requests

from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import (
    User,
    VoiceMediaFile,
    VoiceCampaign,
    CreditHistory
)


# =====================================
# ⚙️  PLIVO CONFIG
# =====================================

PLIVO_AUTH_ID    = "MAMWNINZA2NGETMWNLYY"
PLIVO_AUTH_TOKEN = "NWI3OTQ5MGEtMmU2Yy00ZDk2LTUzNmEtZmUxNjFl"
PLIVO_NUMBER     = "918035017649"

SERVER_URL = "https://voice-backend-bqji.onrender.com"

plivo_client = plivo.RestClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN)


# =====================================
# CLEAN NUMBER
# =====================================

def clean_number(number):
    num    = str(number).strip()
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
# CLASSIFY STATUS — SINGLE SOURCE OF TRUTH
# Plivo ke saare possible values cover kiye hain
# =====================================

def classify_status(raw_status):
    """
    Plivo se aane wale har status ko standard bucket mein daalte hain.
    Returns: 'answered' | 'busy' | 'no_answer' | 'failed' | 'pending'

    Plivo ke known CallStatus values:
      - answer       → answered
      - completed    → answered  (call connect hua aur khatam hua)
      - busy         → busy
      - no-answer    → no_answer
      - failed       → failed
      - rejected     → no_answer
      - cancelled    → no_answer
      - timeout      → no_answer

    Plivo ke known HangupCause values:
      - NORMAL_CLEARING      → answered
      - USER_BUSY            → busy
      - NO_ANSWER            → no_answer
      - NO_USER_RESPONSE     → no_answer
      - SUBSCRIBER_ABSENT    → no_answer
      - CALL_REJECTED        → no_answer
      - UNALLOCATED_NUMBER   → failed
      - NORMAL_UNSPECIFIED   → failed
    """
    s = str(raw_status or "").strip().lower()

    # ---- ANSWERED ----
    if s in ["completed", "answered", "answer", "normal_clearing"]:
        return "answered"

    # ---- BUSY ----
    if s in ["busy", "user_busy"]:
        return "busy"

    # ---- NO ANSWER ----
    if s in [
        "no-answer", "no_answer", "noanswer", "no answer",
        "rejected", "cancelled", "canceled",
        "timeout", "no_user_response",
        "subscriber_absent", "call_rejected",
    ]:
        return "no_answer"

    # ---- FAILED ----
    if s in ["failed", "unallocated_number", "normal_unspecified", "error"]:
        return "failed"

    # ---- PENDING / UNKNOWN ----
    return "pending"


# =====================================
# PLIVO XML CALLBACK
# =====================================

@csrf_exempt
def twilio_callback(request):

    media_url = request.GET.get("file", "")
    campaign_id = request.GET.get("campaign_id", "")

    action_url = f"{SERVER_URL}/api/dtmf-input/?campaign_id={campaign_id}"

    xml = f"""
<Response>

<Speak>
Press 1 now
</Speak>

<GetDigits
action="{action_url}"
method="POST"
numDigits="1"
timeout="15">

<Play>{media_url}</Play>

</GetDigits>

<Speak>No input received</Speak>

</Response>
"""

    print(xml)

    return HttpResponse(xml, content_type="application/xml")


@csrf_exempt
def dtmf_input(request):

    print("################################")
    print("DTMF CALLBACK HIT")
    print("GET =", dict(request.GET))
    print("POST =", dict(request.POST))
    print("################################")

    campaign_id = request.GET.get("campaign_id")

    digit = (
        request.POST.get("Digits")
        or request.POST.get("digits")
        or request.POST.get("Digit")
        or ""
    )

    call_uuid = (
        request.POST.get("CallUUID")
        or request.POST.get("ALegUUID")
        or request.POST.get("RequestUUID")
        or ""
    )

    print("DIGIT =", digit)
    print("UUID =", call_uuid)

    try:
        campaign = VoiceCampaign.objects.get(id=campaign_id)

        results = campaign.results or []

        for r in results:
            if (
                r.get("job_id") == call_uuid
                or call_uuid in str(r.get("job_id", ""))
            ):
                r["pressed_button"] = digit
                print("BUTTON SAVED =", digit)
                break

        campaign.results = results
        campaign.save()

    except Exception as e:
        print("DTMF SAVE ERROR =", e)

    return HttpResponse("OK")

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
    return Response({"status": "success", "created": created})


# =====================================
# PLIVO STATUS CALLBACK
# =====================================

@csrf_exempt
def twilio_status(request):
    print(dict(request.POST))

    campaign_id = request.GET.get("campaign_id", "")

    # ------------------------------------------------------------------
    # Plivo dono field bhej sakta hai: CallStatus ya HangupCause
    # Dono ko try karo — jo bhi informative mile woh use karo
    # ------------------------------------------------------------------
    call_status_raw  = request.POST.get("CallStatus",  "").strip()
    hangup_cause_raw = request.POST.get("HangupCause", "").strip()
    call_duration    = request.POST.get("Duration",    "0").strip()

    # HangupCause zyada accurate hoti hai (NORMAL_CLEARING, USER_BUSY, etc.)
    # Agar dono available hain, toh classify karke decide karo
    bucket_from_status = classify_status(call_status_raw)
    bucket_from_cause  = classify_status(hangup_cause_raw)

    # Priority: agar HangupCause se kuch specific mila (not pending) toh wahi use karo
    # Otherwise CallStatus use karo
    if bucket_from_cause != "pending":
      final_bucket = bucket_from_cause
    else:
       final_bucket = bucket_from_status
       status_to_store = final_bucket

    # Plivo To field
    raw_to    = request.POST.get("To", "")
    to_last10 = normalize_number(raw_to)

    print("=" * 60)
    print(f"PLIVO STATUS CALLBACK")
    print(f"  campaign_id    : {campaign_id}")
    print(f"  CallStatus     : {call_status_raw}")
    print(f"  HangupCause    : {hangup_cause_raw}")
    print(f"  Final bucket   : {final_bucket}")
    print(f"  Status stored  : {status_to_store}")
    print(f"  To (raw)       : {raw_to}")
    print(f"  To (last10)    : {to_last10}")
    print(f"  Duration       : {call_duration}s")
    print(f"  ALL POST       : {dict(request.POST)}")
    print("=" * 60)

    if not campaign_id:
        return HttpResponse("OK")

    try:
        campaign = VoiceCampaign.objects.get(id=campaign_id)
        results  = campaign.results or []

        # ------------------------------------------------------------------
        # FIND & UPDATE THE RESULT
        # ------------------------------------------------------------------
        matched = False

        # Pass 1: number se match karo
        for r in results:
            r_last10 = normalize_number(r.get("number", ""))
            if r_last10 == to_last10 and len(to_last10) >= 10:
                r["final_status"] = status_to_store
                r["status"]       = status_to_store
                r["duration"]     = call_duration
                matched           = True
                print(f"  MATCHED by number → {r.get('number')} → {status_to_store} ({final_bucket})")
                break

        # Pass 2: CallUUID se match karo
        if not matched:
            call_uuid = request.POST.get("CallUUID", "")
            if call_uuid:
                for r in results:
                    if r.get("job_id", "") == call_uuid:
                        r["final_status"] = status_to_store
                        r["status"]       = status_to_store
                        r["duration"]     = call_duration
                        matched           = True
                        print(f"  MATCHED by UUID → {r.get('number')} → {status_to_store} ({final_bucket})")
                        break

        if not matched:
            print(f"  WARNING: No match — To={raw_to} last10={to_last10}")
            print(f"  Numbers in results: {[r.get('number') for r in results]}")

        # ------------------------------------------------------------------
        # RECOUNT ALL STATS from results
        # ------------------------------------------------------------------
        answered_count  = 0
        busy_count      = 0
        no_answer_count = 0
        failed_count    = 0
        pending_count   = 0

        for item in results:
            raw_s  = item.get("final_status") or item.get("status") or ""
            bucket = classify_status(raw_s)

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

        campaign.success   = answered_count
        campaign.busy      = busy_count
        campaign.no_answer = no_answer_count
        campaign.failed    = failed_count
        campaign.results   = results

        # Campaign done check
        total_valid = campaign.total or 0
        resolved    = answered_count + busy_count + no_answer_count + failed_count
        if total_valid > 0 and resolved >= total_valid:
            campaign.status = "done"

        print(f"  COUNTS → answered={answered_count} busy={busy_count} no_answer={no_answer_count} failed={failed_count} pending={pending_count}")
        campaign.save()

        # ------------------------------------------------------------------
        # RETRY LOGIC
        # ------------------------------------------------------------------
        if final_bucket in ["busy", "no_answer", "failed"]:
            for r in results:
                r_last10 = normalize_number(r.get("number", ""))
                if r_last10 == to_last10:
                    retry_count = r.get("retry_count", 0)
                    if (
                        campaign.retry_attempt > 0
                        and retry_count < campaign.retry_attempt
                    ):
                        r["retry_count"]  = retry_count + 1
                        campaign.results  = results
                        campaign.save()

                        from threading import Timer
                        delay_seconds    = (campaign.retry_duration or 0) * 60
                        number_to_retry  = r.get("number", "")

                        Timer(
                            delay_seconds,
                            lambda n=number_to_retry: make_twilio_call(
                                number=n,
                                media_url=campaign.voice_file_id,
                                campaign_id=campaign.id
                            )
                        ).start()

                        print(f"  RETRY {retry_count+1}/{campaign.retry_attempt} for {number_to_retry} in {delay_seconds}s")
                    break

    except VoiceCampaign.DoesNotExist:
        print(f"  Campaign {campaign_id} not found")
    except Exception as e:
        import traceback
        print(f"  STATUS UPDATE ERROR: {e}")
        traceback.print_exc()

    return HttpResponse("OK")


# =====================================
# MAKE ONE PLIVO CALL
# =====================================

def make_twilio_call(number, media_url, campaign_id, retry_attempt="0"):

    callback_url = (
        f"{SERVER_URL}/api/twilio-callback/"
        f"?campaign_id={campaign_id}&file={media_url}"
    )
    status_url = (
        f"{SERVER_URL}/api/twilio-status/"
        f"?campaign_id={campaign_id}"
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

        print(f"=== PLIVO RESPONSE FULL === type={type(response)} value={response}")

        call_uuid = ""

        if hasattr(response, "request_uuid"):
            call_uuid = response.request_uuid or ""
        elif hasattr(response, "call_uuid"):
            call_uuid = response.call_uuid or ""
        elif isinstance(response, (list, tuple)):
            resp_obj = response[1] if len(response) > 1 else response[0]
            if isinstance(resp_obj, dict):
                call_uuid = (
                    resp_obj.get("request_uuid", "") or
                    resp_obj.get("call_uuid", "")    or
                    resp_obj.get("api_id", "")
                )
            else:
                call_uuid = (
                    getattr(resp_obj, "request_uuid", "") or
                    getattr(resp_obj, "call_uuid", "")    or
                    ""
                )

        if not call_uuid:
            call_uuid = str(response)[:100]
            print(f"=== PLIVO UUID FALLBACK === using str: {call_uuid}")

        print(f"=== PLIVO CALL CREATED === UUID={call_uuid} to={number}")
        return call_uuid

    except Exception as e:
        print(f"PLIVO CALL ERROR for {number}: {e}")
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
            return Response({"status": "failed", "message": "Invalid Login"})

        if user.status != "Active":
            return Response({"status": "failed", "message": "Account Disabled"})

        return Response({
            "status"  : "success",
            "user_id" : user.id,
            "username": user.username,
            "role"    : user.role,
            "credit"  : user.credit,
        })

    except Exception as e:
        print("LOGIN ERROR:", e)
        return Response({"status": "error"})


# =====================================
# CREATE USER
# =====================================

@api_view(['POST'])
def create_user(request):
    try:
        logged_user = User.objects.get(id=request.data.get("created_by"))
        role        = request.data.get("role", "user")

        if logged_user.role == "user":
            return Response({"status": "failed", "message": "Permission Denied"})

        if logged_user.role == "reseller" and role == "admin":
            return Response({"status": "failed", "message": "Reseller cannot create Admin"})

        username        = request.data.get("username")
        password        = request.data.get("password")
        parent_username = request.data.get("parent")

        if not username or not password:
            return Response({"status": "failed", "message": "Missing Fields"})

        if User.objects.filter(username=username).exists():
            return Response({"status": "failed", "message": "User Already Exists"})

        parent = None
        if parent_username:
            parent = User.objects.filter(username=parent_username).first()

        user = User.objects.create(
            username=username,
            password=password,
            role=role,
            parent=parent,
            credit=0,
            status="Active"
        )

        return Response({"status": "success", "user_id": user.id})

    except User.DoesNotExist:
        return Response({"status": "failed", "message": "Invalid User"})
    except Exception as e:
        print("CREATE USER ERROR:", e)
        return Response({"status": "error"})


# =====================================
# UPDATE USER
# =====================================

@api_view(['POST'])
def update_user(request):
    try:
        user       = User.objects.get(id=request.data.get("user_id"))
        admin_id   = request.data.get("admin_id")
        admin      = User.objects.filter(id=admin_id).first()

        add_credit = request.data.get("add_credit", 0)
        if add_credit in ["", None]:
            add_credit = 0
        add_credit = int(add_credit)

        user.username = request.data.get("username", user.username)
        user.role     = request.data.get("role", user.role)

        if request.data.get("password"):
            user.password = request.data.get("password")

        if request.data.get("status"):
            user.status = request.data.get("status")

        user.vc_username  = request.data.get("vc_username",  user.vc_username)
        user.vc_password  = request.data.get("vc_password",  user.vc_password)
        user.vc_caller_id = request.data.get("vc_caller_id", user.vc_caller_id)
        user.vc_plan_id   = request.data.get("vc_plan_id",   user.vc_plan_id)
        user.vc_call_type = request.data.get("vc_call_type", user.vc_call_type)

        if add_credit != 0:
            if admin and admin.role == "admin":
                if add_credit > 0:
                    user.credit += add_credit
                    CreditHistory.objects.create(
                        user=user, amount=add_credit, type="credit",
                        remarks=f"{add_credit} Credits Added By Admin", created_by=admin
                    )
                else:
                    remove_amount = abs(add_credit)
                    user.credit  -= remove_amount
                    if user.credit < 0:
                        user.credit = 0
                    CreditHistory.objects.create(
                        user=user, amount=remove_amount, type="debit",
                        remarks=f"{remove_amount} Credits Removed By Admin", created_by=admin
                    )

            elif admin and admin.role == "reseller":
                if add_credit > 0:
                    if admin.credit < add_credit:
                        return Response({"status": "failed", "message": "Insufficient Credit"})
                    admin.credit -= add_credit
                    admin.save()
                    user.credit  += add_credit
                    CreditHistory.objects.create(
                        user=admin, amount=add_credit, type="debit",
                        remarks=f"{add_credit} Credits Transfer To {user.username}", created_by=admin
                    )
                    CreditHistory.objects.create(
                        user=user, amount=add_credit, type="credit",
                        remarks=f"{add_credit} Credits Received From {admin.username}", created_by=admin
                    )

        user.save()
        return Response({"status": "success", "credit": user.credit})

    except Exception as e:
        print("UPDATE USER ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# DELETE USER
# =====================================

@api_view(['POST'])
def delete_user(request):
    try:
        user_id = request.data.get("user_id")
        user    = User.objects.filter(id=user_id).first()

        if not user:
            return Response({"status": "failed", "message": f"User ID {user_id} not found"})

        user.delete()
        return Response({"status": "success"})

    except Exception as e:
        print("DELETE USER ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# LIST USERS
# =====================================

@api_view(['GET'])
def list_users(request):
    try:
        logged_user = User.objects.get(id=request.GET.get("user_id"))

        if logged_user.role == "admin":
            users = User.objects.all().order_by("-id")
        elif logged_user.role == "reseller":
            users = User.objects.filter(parent=logged_user).order_by("-id")
        else:
            users = User.objects.filter(id=logged_user.id)

        data = []
        for u in users:
            data.append({
                "id"          : u.id,
                "username"    : u.username,
                "role"        : u.role,
                "credit"      : u.credit,
                "status"      : u.status,
                "parent"      : u.parent.username if u.parent else None,
                "created_at"  : u.created_at.isoformat(),
                "vc_username" : u.vc_username,
                "vc_caller_id": u.vc_caller_id,
            })

        return Response(data)

    except Exception as e:
        print("LIST USERS ERROR:", e)
        return Response([])


# =====================================
# TOGGLE STATUS
# =====================================

@api_view(['POST'])
def toggle_user_status(request):
    try:
        user        = User.objects.get(id=request.data.get("user_id"))
        user.status = "Deactive" if user.status == "Active" else "Active"
        user.save()
        return Response({"status": "success", "new_status": user.status})
    except Exception as e:
        print("TOGGLE STATUS ERROR:", e)
        return Response({"status": "error"})


# =====================================
# RESET PASSWORD
# =====================================

@api_view(['POST'])
def reset_password(request):
    try:
        user          = User.objects.get(id=request.data.get("user_id"))
        user.password = request.data.get("password")
        user.save()
        return Response({"status": "success"})
    except Exception as e:
        print("RESET PASSWORD ERROR:", e)
        return Response({"status": "error"})


# =====================================
# UPLOAD MEDIA
# =====================================

@api_view(['POST'])
def upload_media(request):
    try:
        user      = User.objects.get(id=request.data.get("user_id"))
        name      = request.data.get("name", "Untitled")
        media_url = request.data.get("media_url", "").strip()
        caller_id = request.data.get("caller_id", "").strip()

        if not media_url:
            return Response({"status": "failed", "message": "Public audio URL required"})

        media_obj = VoiceMediaFile.objects.create(
            user=user,
            name=name,
            voice_file_id=media_url,
            media_url=media_url,
            caller_id=caller_id
        )

        return Response({"status": "success", "media_id": media_obj.id})

    except Exception as e:
        print("UPLOAD MEDIA ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# UPDATE MEDIA ID
# =====================================

@api_view(['POST'])
def update_media_id(request):
    try:
        media_obj     = VoiceMediaFile.objects.get(id=request.data.get("media_id"))
        voice_file_id = request.data.get("voice_file_id") or request.data.get("media_file_id", "")
        media_obj.voice_file_id = voice_file_id
        media_obj.save()
        return Response({"status": "success"})
    except Exception as e:
        print("UPDATE MEDIA ID ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# GET MEDIA FILES
# =====================================

@api_view(['GET'])
def get_media_files(request):
    try:
        user = User.objects.get(id=request.GET.get("user_id"))

        if user.role == "admin":
            files = VoiceMediaFile.objects.all().order_by("-id")
        else:
            files = VoiceMediaFile.objects.filter(user=user).order_by("-id")

        data = []
        for f in files:
            data.append({
                "id"           : f.id,
                "name"         : f.name,
                "voice_file_id": f.voice_file_id,
                "media_file_id": f.voice_file_id,
                "media_url"    : f.media_url,
                "caller_id"    : f.caller_id,
                "created_at"   : f.created_at.isoformat(),
            })

        return Response(data)

    except Exception as e:
        print("GET MEDIA FILES ERROR:", e)
        return Response([])


# =====================================
# DELETE MEDIA
# =====================================

@api_view(['POST'])
def delete_media(request):
    try:
        media_obj = VoiceMediaFile.objects.get(id=request.data.get("media_id"))
        media_obj.delete()
        return Response({"status": "success"})
    except Exception as e:
        print("DELETE MEDIA ERROR:", e)
        return Response({"status": "error"})


# =====================================
# SEND BULK VOICE
# =====================================

@api_view(['POST'])
def send_bulk_voice(request):
    try:
        user = User.objects.get(id=request.data.get("user_id"))

        raw_numbers = request.data.get("numbers", [])
        if isinstance(raw_numbers, str):
            raw_numbers = [n.strip() for n in raw_numbers.split(",") if n.strip()]

        media_file_id = str(request.data.get("media_file_id", "")).strip()
        caller_id     = str(request.data.get("caller_id", PLIVO_NUMBER)).strip()
        plan_id       = str(request.data.get("plan_id",    "2")).strip()
        call_type     = str(request.data.get("call_type",  "2")).strip()
        retry_attempt = str(request.data.get("retry_attempt", "0")).strip()
        campaign_name = request.data.get("campaign_name", "Untitled Campaign")

        if not media_file_id:
            return Response({"status": "failed", "message": "Voice File (Audio URL) Required"})

        valid_numbers   = []
        invalid_results = []

        for raw in raw_numbers:
            cleaned = clean_number(raw)
            if cleaned:
                valid_numbers.append(cleaned)
            else:
                invalid_results.append({"number": raw, "status": "invalid", "final_status": "invalid"})

        if not valid_numbers:
            return Response({"status": "failed", "message": "No Valid Numbers"})

        if user.role != "admin":
            if user.credit < len(valid_numbers):
                return Response({"status": "failed", "message": "Insufficient Credit"})

        campaign = VoiceCampaign.objects.create(
            user=user,
            name=campaign_name,
            voice_file_id=media_file_id,
            caller_id=caller_id,
            plan_id=plan_id,
            call_type=call_type,
            total=len(valid_numbers),
            status="running",
            retry_attempt=int(retry_attempt),
            retry_duration=int(request.data.get("retry_duration", 0)),
        )

        results     = list(invalid_results)
        all_job_ids = []

        for number in valid_numbers:
            call_uuid = make_twilio_call(
                number=number,
                media_url=media_file_id,
                campaign_id=campaign.id,
                retry_attempt=retry_attempt,
            )

            if call_uuid:
                all_job_ids.append(call_uuid)
                results.append({
    "number": number,
    "status": "pending",
    "final_status": "pending",
    "job_id": call_uuid,
    "retry_count": 0,
    "pressed_button": ""
})
            else:
                results.append({
                    "number"      : number,
                    "status"      : "failed",
                    "final_status": "failed",
                    "error"       : "Plivo API Error",
                })

        failed_count  = len([r for r in results if r["status"] == "failed"])
        invalid_count = len([r for r in results if r["status"] == "invalid"])

        campaign.success  = 0
        campaign.failed   = failed_count
        campaign.nonwa    = invalid_count
        campaign.job_id   = ",".join(all_job_ids)
        campaign.results  = results
        campaign.status   = "running"
        campaign.save()

        # CREDIT DEDUCTION
        credit_used = len(valid_numbers)
        if user.role != "admin":
            user.credit -= credit_used
            if user.credit < 0:
                user.credit = 0
            user.save()
            CreditHistory.objects.create(
                user=user,
                amount=credit_used,
                type="debit",
                remarks=f"{credit_used} Credits Debited For Voice Campaign - {campaign_name}"
            )

        return Response({
            "status"          : "done",
            "campaign_id"     : campaign.id,
            "total"           : len(valid_numbers),
            "success"         : 0,
            "failed"          : failed_count,
            "invalid"         : invalid_count,
            "job_ids"         : all_job_ids,
            "results"         : results,
            "remaining_credit": user.credit
        })

    except Exception as e:
        print("SEND BULK VOICE ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# SCHEDULE CAMPAIGN
# =====================================

@api_view(['POST'])
def schedule_campaign(request):
    try:
        user = User.objects.get(id=request.data.get("user_id"))

        raw_numbers = request.data.get("numbers", [])
        if isinstance(raw_numbers, str):
            raw_numbers = [n.strip() for n in raw_numbers.split(",") if n.strip()]

        media_file_id         = str(request.data.get("media_file_id", "")).strip()
        caller_id             = str(request.data.get("caller_id", PLIVO_NUMBER)).strip()
        plan_id               = str(request.data.get("plan_id",    "2")).strip()
        call_type             = str(request.data.get("call_type",  "2")).strip()
        campaign_name         = request.data.get("campaign_name", "Scheduled Campaign")
        schedule_datetime_str = request.data.get("scheduled_at", "").strip()

        if not media_file_id:
            return Response({"status": "failed", "message": "Voice File Required"})
        if not schedule_datetime_str:
            return Response({"status": "failed", "message": "Schedule Date & Time Required"})

        try:
            scheduled_at = parse_datetime(schedule_datetime_str)
            if scheduled_at is None:
                raise ValueError("Invalid datetime")
        except Exception:
            return Response({"status": "failed", "message": "Invalid datetime format. Use: YYYY-MM-DDTHH:MM"})

        valid_numbers   = []
        invalid_results = []

        for raw in raw_numbers:
            cleaned = clean_number(raw)
            if cleaned:
                valid_numbers.append(cleaned)
            else:
                invalid_results.append({"number": raw, "status": "invalid", "final_status": "invalid"})

        if not valid_numbers:
            return Response({"status": "failed", "message": "No Valid Numbers"})

        if user.role != "admin":
            if user.credit < len(valid_numbers):
                return Response({"status": "failed", "message": "Insufficient Credit"})

        pending_results = (
            [{"number": n, "status": "pending", "final_status": "pending"} for n in valid_numbers]
            + invalid_results
        )

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
            "status"      : "scheduled",
            "campaign_id" : campaign.id,
            "total"       : len(valid_numbers),
            "scheduled_at": scheduled_at.isoformat(),
        })

    except Exception as e:
        print("SCHEDULE CAMPAIGN ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# HELPER: Results se counts compute karo
# Campaign list aur detail dono ke liye common function
# =====================================

def compute_counts_from_campaign(campaign):
    """
    DB mein stored counts use karo.
    Agar sab zero hain lekin results hain (purane campaigns),
    tab results se live recompute karo.
    Returns dict: answered, busy, no_answer, invalid
    """
    db_answered  = campaign.success   or 0
    db_busy      = campaign.busy      or 0
    db_no_answer = campaign.no_answer or 0
    db_invalid   = campaign.nonwa     or 0

    results = campaign.results or []

    # Agar DB counts zero hain but results exist karte hain → recompute
    if results and (db_answered + db_busy + db_no_answer) == 0:
        a = b = n = inv = 0
        for r in results:
            raw_s  = r.get("final_status") or r.get("status") or ""
            bucket = classify_status(raw_s)
            if bucket == "answered":
                a += 1
            elif bucket == "busy":
                b += 1
            elif bucket == "no_answer":
                n += 1
            elif raw_s in ["invalid"]:
                inv += 1
        db_answered  = a
        db_busy      = b
        db_no_answer = n
        if inv:
            db_invalid = inv

    return {
    "answered": db_answered,
    "busy": db_busy,
    "no_answer": db_no_answer,
    "failed": campaign.failed or 0,
    "invalid": db_invalid,
}


# =====================================
# GET CAMPAIGNS
# =====================================

@api_view(['GET'])
def get_campaigns(request):
    try:
        user = User.objects.get(id=request.GET.get("user_id"))

        if user.role == "admin":
            campaigns = VoiceCampaign.objects.all().order_by("-id")
        elif user.role == "reseller":
            campaigns = VoiceCampaign.objects.filter(
                user__in=[user] + list(user.children.all())
            ).order_by("-id")
        else:
            campaigns = VoiceCampaign.objects.filter(user=user).order_by("-id")

        data = []
        for c in campaigns:
            counts = compute_counts_from_campaign(c)
            data.append({
                "id"           : c.id,
                "name"         : c.name,
                "voice_file_id": c.voice_file_id,
                "media_file_id": c.voice_file_id,
                "caller_id"    : c.caller_id,
                "plan_id"      : c.plan_id,
                "call_type"    : c.call_type,
                "total"        : c.total,
                "success"   : counts["answered"],
                "failed"    : counts["failed"],
                "invalid"   : counts["invalid"],
                "no_answer"    : counts["no_answer"],
                "busy"         : counts["busy"],
                "job_id"       : c.job_id,
                "status"       : c.status,
                "scheduled_at" : c.scheduled_at.isoformat() if c.scheduled_at else None,
                "created_at"   : c.created_at.isoformat(),
                "username"     : c.user.username,
                "results"      : c.results,
            })

        return Response(data)

    except Exception as e:
        print("GET CAMPAIGNS ERROR:", e)
        return Response([])


# =====================================
# GET CAMPAIGN DETAIL
# =====================================

@api_view(['GET'])
def get_campaign_detail(request):
    try:
        campaign = VoiceCampaign.objects.get(id=request.GET.get("campaign_id"))
        counts   = compute_counts_from_campaign(campaign)

        return Response({
            "id"           : campaign.id,
            "name"         : campaign.name,
            "voice_file_id": campaign.voice_file_id,
            "media_file_id": campaign.voice_file_id,
            "caller_id"    : campaign.caller_id,
            "plan_id"      : campaign.plan_id,
            "call_type"    : campaign.call_type,
            "total"        : campaign.total,
            "success"   : counts["answered"],
            "failed"    : counts["failed"],
            "invalid"   : counts["invalid"],
            "no_answer"    : counts["no_answer"],
            "busy"         : counts["busy"],
            "job_id"       : campaign.job_id,
            "status"       : campaign.status,
            "scheduled_at" : campaign.scheduled_at.isoformat() if campaign.scheduled_at else None,
            "created_at"   : campaign.created_at.isoformat(),
            "username"     : campaign.user.username,
            "results"      : campaign.results,
        })

    except VoiceCampaign.DoesNotExist:
        return Response({"status": "failed", "message": "Campaign not found"}, status=404)
    except Exception as e:
        print("GET CAMPAIGN DETAIL ERROR:", e)
        return Response({"status": "error", "message": str(e)})


# =====================================
# CREDIT HISTORY
# =====================================


@api_view(['GET'])
def credit_history(request):
    try:
        logged_user = User.objects.get(id=request.GET.get("user_id"))

        if logged_user.role == "admin":
            history = CreditHistory.objects.all().order_by("-id")
        elif logged_user.role == "reseller":
            users   = [logged_user] + list(logged_user.children.all())
            history = CreditHistory.objects.filter(user__in=users).order_by("-id")
        else:
            history = CreditHistory.objects.filter(user=logged_user).order_by("-id")

        data = []
        for h in history:
            data.append({
                "username"  : h.user.username,
                "credit"    : h.amount,
                "type"      : h.type,
                "remarks"   : h.remarks,
                "created_at": h.created_at.isoformat(),
            })

        return Response(data)

    except Exception as e:
        print("CREDIT HISTORY ERROR:", e)
        return Response([])