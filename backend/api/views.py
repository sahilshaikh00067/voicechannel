import plivo

import requests

import random
import os

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





# =====================================

# ⚙️  PLIVO CONFIG

# =====================================



PLIVO_AUTH_ID    = os.getenv("PLIVO_AUTH_ID", "")

PLIVO_AUTH_TOKEN = os.getenv("PLIVO_AUTH_TOKEN", "")

PLIVO_NUMBER     = os.getenv("PLIVO_NUMBER", "")



SERVER_URL       = os.getenv("SERVER_URL", "https://voice-backend-bqji.onrender.com").rstrip("/")



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

    media_url   = request.GET.get("file", "")

    campaign_id = request.GET.get("campaign_id", "")



    print(f"=== PLIVO XML CALLBACK === campaign={campaign_id} file={media_url}")



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

    return Response({"status": "success", "created": created})





# =====================================

# PLIVO STATUS CALLBACK

# =====================================



@csrf_exempt

def twilio_status(request):



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

        final_bucket    = bucket_from_cause

        status_to_store = hangup_cause_raw.lower() if hangup_cause_raw else call_status_raw.lower()

    else:

        final_bucket    = bucket_from_status

        status_to_store = call_status_raw.lower()



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



                        from threading import Timer, Thread

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

            from_         = PLIVO_NUMBER,

            to_           = number,

            answer_url    = callback_url,

            answer_method = "GET",

            hangup_url    = status_url,

            hangup_method = "POST",

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









def send_whatsapp_alert(campaign_id, campaign_name, total):

    try:

        msg = f"""

Large Voice Campaign



Campaign ID: {campaign_id}

Campaign Name: {campaign_name}

Total Numbers: {total}



Approval Required

"""



        response = requests.get(

    "https://int.chatway.in/api/send-msg",

    params={

        "username": "APIDEMO",

        "number": "8381845350",

        "message": msg,

        "token": "NzVNSkxTdWhkeCtLT3RIYlZkNmRIUT09"

    },

    timeout=30

    )



        print("SMS STATUS =", response.status_code)

        print("SMS RESPONSE =", response.text)



    except Exception as e:

        print("SMS ALERT ERROR =", str(e))

# =====================================

# SEND BULK VOICE

# =====================================



# =====================================
# ESTIMATED REPORT (SIMULATED, NOT REAL CALL STATUSES)
# Stable for one campaign; different campaign IDs can have different estimates.
# =====================================

def build_estimated_report(campaign_id, total_numbers):
    rng = random.Random(int(campaign_id))

    # Keep percentages within the requested ranges and make the total 100%.
    while True:
        answered_pct = rng.randint(68, 72)
        no_answer_pct = rng.randint(15, 19)
        busy_pct = rng.randint(11, 14)
        invalid_pct = 100 - answered_pct - no_answer_pct - busy_pct
        if 2 <= invalid_pct <= 4:
            break

    percentages = {
        "answered": answered_pct,
        "no_answer": no_answer_pct,
        "busy": busy_pct,
        "invalid": invalid_pct,
    }

    # Largest-remainder allocation ensures counts add up to total_numbers.
    exact = {key: total_numbers * pct / 100 for key, pct in percentages.items()}
    counts = {key: int(value) for key, value in exact.items()}
    remaining = total_numbers - sum(counts.values())
    order = sorted(exact, key=lambda key: exact[key] - counts[key], reverse=True)
    for key in order[:remaining]:
        counts[key] += 1

    return {
        "type": "estimated",
        "label": "Estimated results — simulated, not actual Plivo call outcomes",
        "total_numbers": total_numbers,
        "percentages": percentages,
        "counts": counts,
    }


def get_estimated_report(campaign):
    for result in (campaign.results or []):
        report = result.get("estimated_report")
        if report:
            return report
    return None


def dispatch_real_campaign_calls(campaign_id, numbers_to_call, media_file_id, retry_attempt):
    """Send real Plivo requests for the capped list and persist each request result."""
    for number in numbers_to_call:
        try:
            call_uuid = make_twilio_call(
                number=number,
                media_url=media_file_id,
                campaign_id=campaign_id,
                retry_attempt=retry_attempt,
            )
        except Exception as exc:
            print(f"PLIVO CALL REQUEST ERROR for {number}: {exc}")
            call_uuid = None

        try:
            campaign = VoiceCampaign.objects.get(id=campaign_id)
            results = campaign.results or []
            for item in results:
                if item.get("number") == number and item.get("real_call") is True:
                    # A callback may already have updated the real status; do not overwrite it.
                    item["job_id"] = call_uuid or item.get("job_id", "")
                    if not call_uuid and (item.get("final_status") or "pending") == "pending":
                        item["status"] = "failed"
                        item["final_status"] = "failed"
                        item["error"] = "Plivo API request failed"
                    break
            campaign.results = results
            campaign.failed = sum(
                1 for item in results
                if item.get("real_call") is True
                and (item.get("final_status") or item.get("status")) == "failed"
            )
            if campaign.total <= 500:
                real_items = [item for item in results if item.get("real_call") is True]
                if real_items and all(
                    (item.get("final_status") or item.get("status")) not in ("pending", "")
                    for item in real_items
                ):
                    campaign.status = "done"
            campaign.save(update_fields=["results", "failed", "status"])
        except Exception as exc:
            print(f"FAILED TO SAVE CALL RESULT for campaign {campaign_id}, number {number}: {exc}")


def finalize_large_campaign(campaign_id):
    """End the 8–10 minute processing window without inventing real call outcomes."""
    try:
        campaign = VoiceCampaign.objects.get(id=campaign_id)
        if campaign.status in ("pending", "running"):
            # Actual call results remain as reported by Plivo; uncalled numbers stay not_processed.
            campaign.status = "done"
            campaign.save(update_fields=["status", "results"])
            print(f"CAMPAIGN PROCESSING WINDOW ENDED #{campaign.id}; actual statuses preserved")
    except VoiceCampaign.DoesNotExist:
        print(f"Campaign {campaign_id} not found while finalizing")
    except Exception as exc:
        print(f"CAMPAIGN FINALIZATION ERROR #{campaign_id}: {exc}")


# =====================================
# SEND BULK VOICE — MAX 500 REAL CALLS PER CAMPAIGN
# =====================================

@api_view(['POST'])
def send_bulk_voice(request):
    try:
        user = User.objects.get(id=request.data.get("user_id"))
        raw_numbers = request.data.get("numbers", [])
        if isinstance(raw_numbers, str):
            raw_numbers = [n.strip() for n in raw_numbers.split(",") if n.strip()]

        media_file_id = str(request.data.get("media_file_id", "")).strip()
        caller_id = str(request.data.get("caller_id", PLIVO_NUMBER)).strip()
        plan_id = str(request.data.get("plan_id", "2")).strip()
        call_type = str(request.data.get("call_type", "2")).strip()
        retry_attempt = int(request.data.get("retry_attempt", 0) or 0)
        retry_duration = int(request.data.get("retry_duration", 0) or 0)
        campaign_name = request.data.get("campaign_name", "Untitled Campaign")

        if not media_file_id:
            return Response({"status": "failed", "message": "Voice File (Audio URL) Required"}, status=400)

        valid_numbers = []
        invalid_results = []
        for raw in raw_numbers:
            cleaned = clean_number(raw)
            if cleaned:
                valid_numbers.append(cleaned)
            else:
                invalid_results.append({
                    "number": raw,
                    "status": "invalid",
                    "final_status": "invalid",
                    "real_call": False,
                })

        if not valid_numbers:
            return Response({"status": "failed", "message": "No Valid Numbers"}, status=400)

        # Only up to 500 numbers will be sent to Plivo and charged as real attempts.
        real_numbers = valid_numbers[:500]
        not_called_numbers = valid_numbers[500:]
        real_call_count = len(real_numbers)
        if user.role != "admin" and user.credit < real_call_count:
            return Response({"status": "failed", "message": "Insufficient Credit for up to 500 real call attempts"}, status=400)

        is_large_campaign = len(valid_numbers) > 500
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

        # These rows explicitly separate real call attempts from numbers not called.
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
        results.extend([
            {
                "number": number,
                "status": "not_processed",
                "final_status": "not_processed",
                "real_call": False,
                "reason": "500-number campaign limit; no call was placed",
            }
            for number in not_called_numbers
        ])
        results.extend(invalid_results)

        estimated_report = build_estimated_report(campaign.id, len(valid_numbers))
        # Store metadata on the first result to avoid a schema migration.
        # The API also exposes it as a separate top-level field below.
        results[0]["estimated_report"] = estimated_report
        campaign.results = results
        campaign.save(update_fields=["results"])

        # Deduct credits for the real call attempts only, not the uncalled remainder.
        if user.role != "admin":
            user.credit -= real_call_count
            user.save(update_fields=["credit"])
            CreditHistory.objects.create(
                user=user,
                amount=real_call_count,
                type="debit",
                remarks=f"{real_call_count} Credits Debited For Voice Campaign - {campaign_name}",
            )

        # Send real calls in a background thread so the HTTP request doesn't wait for 500 API calls.
        Thread(
            target=dispatch_real_campaign_calls,
            args=(campaign.id, real_numbers, media_file_id, str(retry_attempt)),
            daemon=True,
        ).start()

        # Large campaigns finish their processing window after a randomized 8–10 minutes.
        # This changes the campaign processing status only; it never fabricates Plivo outcomes.
        if is_large_campaign:
            completion_seconds = random.Random(campaign.id).randint(480, 600)
            Timer(completion_seconds, finalize_large_campaign, args=(campaign.id,)).start()

        try:
            send_whatsapp_alert(campaign.id, campaign_name, len(valid_numbers))
        except Exception as exc:
            print(f"CAMPAIGN ALERT ERROR #{campaign.id}: {exc}")

        return Response({
            "status": campaign.status,
            "campaign_id": campaign.id,
            "total": len(valid_numbers),
            "real_calls": real_call_count,
            "not_called": len(not_called_numbers),
            "invalid": len(invalid_results),
            "processing_window_seconds": completion_seconds if is_large_campaign else None,
            "estimated_report": estimated_report,
            "message": (
                "Campaign queued. Up to 500 real call requests are being sent; "
                "remaining numbers will not be called. Processing status will finish in 8–10 minutes."
                if is_large_campaign else
                "Real call requests are being sent for all valid numbers (maximum 500)."
            ),
            "remaining_credit": user.credit,
        }, status=202 if is_large_campaign else 200)

    except User.DoesNotExist:
        return Response({"status": "failed", "message": "User not found"}, status=404)
    except Exception as e:
        import traceback
        print("SEND BULK VOICE ERROR:", str(e))
        traceback.print_exc()
        return Response({"status": "error", "message": str(e)}, status=500)


def process_fake_campaign(campaign_id):
    """Backward-compatible alias; intentionally does not fabricate call statuses."""
    finalize_large_campaign(campaign_id)

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
                "estimated_report": get_estimated_report(c),
                "real_call_count": sum(1 for r in (c.results or []) if r.get("real_call") is True),
                "not_called_count": sum(1 for r in (c.results or []) if r.get("status") == "not_processed"),

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
            "estimated_report": get_estimated_report(campaign),
            "real_call_count": sum(1 for r in (campaign.results or []) if r.get("real_call") is True),
            "not_called_count": sum(1 for r in (campaign.results or []) if r.get("status") == "not_processed"),

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
