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

# Tumhara ngrok URL (no trailing slash)
SERVER_URL = "https://voicecall-8m4p.onrender.com"
# Plivo client
plivo_client = plivo.RestClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN)


# =====================================
# CLEAN NUMBER
# Indian 10-digit → 91XXXXXXXXXX (Plivo format)
# =====================================

def clean_number(number):

    num    = str(number).strip()
    digits = ''.join(filter(str.isdigit, num))

    if not digits:
        return None

    # Remove country code if present
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]

    if len(digits) != 10:
        return None

    return "91" + digits    # Plivo format: 91XXXXXXXXXX (no + sign)


# =====================================
# PLIVO CALLBACK — XML (what to play)
# Plivo hits this URL when call connects
# =====================================

@csrf_exempt
def twilio_callback(request):

    media_url   = request.GET.get("file", "")
    campaign_id = request.GET.get("campaign_id", "")

    print(
        f"=== PLIVO CALLBACK === "
        f"campaign={campaign_id} "
        f"file={media_url}"
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

    return HttpResponse(
        xml,
        content_type="application/xml"
    )

# =====================================
# PLIVO STATUS CALLBACK
# Plivo hits this after call ends
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

@csrf_exempt
def twilio_status(request):

    campaign_id = request.GET.get("campaign_id", "")
    call_uuid   = request.POST.get("CallUUID", "")
    call_status = request.POST.get("CallStatus", "")
    print("CALL STATUS =", call_status)

    print("POST DATA =", dict(request.POST))

    number   = request.POST.get("To", "")
    duration = request.POST.get("Duration", "0")

    print(
        f"=== PLIVO STATUS === "
        f"campaign={campaign_id} "
        f"uuid={call_uuid} "
        f"status={call_status} "
        f"number={number} "
        f"duration={duration}s"
    )

    if campaign_id:

        try:

            campaign = VoiceCampaign.objects.get(
                id=campaign_id
            )

            results = campaign.results or []

            # ==========================
            # UPDATE RESULT
            # ==========================
            for r in results:

                if r.get("number") == number:

                    r["final_status"] = call_status
                    r["status"] = call_status   
                    r["duration"] = duration

                    break

            # ==========================
            # RECALCULATE COUNTS
            # ==========================
            answered = 0
            failed = 0

            for item in results:

                status = str(
                    item.get(
                        "final_status",
                        ""
                    )
                ).lower()

                if status in [
    "completed",
    "answered"
                ]:
                 answered += 1

                elif status in [
    "busy",
    "failed",
    "no-answer",
    "rejected",
    "canceled"
                ]:
                 failed += 1

            campaign.success = answered
            campaign.failed = failed
            campaign.results = results

            campaign.save()

            # ==========================
            # RETRY LOGIC
            # ==========================
            status_lower = call_status.lower()

            if status_lower in [
                "busy",
                "failed",
                "no-answer"
            ]:

                for r in results:

                    if r.get("number") == number:

                        retry_count = r.get(
                            "retry_count",
                            0
                        )

                        if (
                            hasattr(campaign, "retry_attempt")
                            and
                            retry_count < campaign.retry_attempt
                        ):

                            r["retry_count"] = (
                                retry_count + 1
                            )

                            from threading import Timer

                            delay_seconds = (
                                campaign.retry_duration * 60
                            )

                            Timer(
                                delay_seconds,

                                lambda: make_twilio_call(
                                    number=number,
                                    media_url=campaign.voice_file_id,
                                    campaign_id=campaign.id
                                )

                            ).start()

                            print(
                                f"RETRY SCHEDULED "
                                f"{retry_count + 1}/"
                                f"{campaign.retry_attempt}"
                            )

                        break

                campaign.results = results
                campaign.save()

            print(
                f"UPDATED => "
                f"SUCCESS={answered} "
                f"FAILED={failed}"
            )

        except VoiceCampaign.DoesNotExist:

            print(
                f"Campaign {campaign_id} not found"
            )

        except Exception as e:

            print(
                "STATUS UPDATE ERROR:",
                e
            )

    return HttpResponse("OK")

# =====================================
# MAKE ONE PLIVO CALL
# =====================================

def make_twilio_call(number, media_url, campaign_id, retry_attempt="0"):

    callback_url = f"{SERVER_URL}/api/twilio-callback/?campaign_id={campaign_id}&file={media_url}"
    status_url   = f"{SERVER_URL}/api/twilio-status/?campaign_id={campaign_id}"

    try:
        response = plivo_client.calls.create(
            from_         = PLIVO_NUMBER,
            to_           = number,
            answer_url    = callback_url,
            answer_method = "GET",
            hangup_url    = status_url,
            hangup_method = "POST",
        )

        call_uuid = response[1].get("request_uuid", "")
        print("PLIVO RESPONSE =", response)
        print("CALL UUID =", call_uuid)
        print(f"=== PLIVO CALL CREATED === UUID={call_uuid} to={number}")
        return call_uuid

    except Exception as e:
        print(f"PLIVO CALL ERROR for {number}:", e)
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
        # ==========================
        # LOGIN USER CHECK
        # ==========================
        logged_user = User.objects.get(
            id=request.data.get("created_by")
        )

        role = request.data.get("role", "user")

        if logged_user.role == "user":
            return Response({
                "status": "failed",
                "message": "Permission Denied"
            })

        if logged_user.role == "reseller":
            if role == "admin":
                return Response({
                    "status": "failed",
                    "message": "Reseller cannot create Admin"
                })

        # ==========================
        # EXISTING LOGIC
        # ==========================
        username        = request.data.get("username")
        password        = request.data.get("password")
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

    except Exception as e:
        print("CREATE USER ERROR:", e)
        return Response({
            "status": "error"
        })

# =====================================
# UPDATE USER
# =====================================

@api_view(['POST'])
def update_user(request):
    try:
        user     = User.objects.get(id=request.data.get("user_id"))
        admin_id = request.data.get("admin_id")
        admin    = User.objects.filter(id=admin_id).first()

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

        user.vc_username  = request.data.get("vc_username", user.vc_username)
        user.vc_password  = request.data.get("vc_password", user.vc_password)
        user.vc_caller_id = request.data.get("vc_caller_id", user.vc_caller_id)
        user.vc_plan_id   = request.data.get("vc_plan_id", user.vc_plan_id)
        user.vc_call_type = request.data.get("vc_call_type", user.vc_call_type)

        if add_credit != 0:

            # ADMIN = unlimited
            if admin and admin.role == "admin":

                if add_credit > 0:

                    user.credit += add_credit

                    CreditHistory.objects.create(
                        user=user,
                        amount=add_credit,
                        type="credit",
                        remarks=f"{add_credit} Credits Added By Admin",
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
                        remarks=f"{remove_amount} Credits Removed By Admin",
                        created_by=admin
                    )

            # RESELLER TRANSFER
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
                        remarks=f"{add_credit} Credits Transfer To {user.username}",
                        created_by=admin
                    )

                    CreditHistory.objects.create(
                        user=user,
                        amount=add_credit,
                        type="credit",
                        remarks=f"{add_credit} Credits Received From {admin.username}",
                        created_by=admin
                    )

        user.save()

        return Response({"status": "success", "credit": user.credit})

    except Exception as e:
        print("UPDATE USER ERROR:", e)
        return Response({"status": "error", "message": str(e)})


@api_view(['POST'])
def delete_user(request):

    try:

        user_id = request.data.get("user_id")

        print("DELETE USER ID =", user_id)

        all_users = User.objects.values(
            "id",
            "username"
        )

        print("ALL USERS =", list(all_users))

        user = User.objects.filter(
            id=user_id
        ).first()

        if not user:

            return Response({
                "status": "failed",
                "message": f"User ID {user_id} not found"
            })

        user.delete()

        return Response({
            "status": "success"
        })

    except Exception as e:

        print("DELETE USER ERROR:", e)

        return Response({
            "status": "error",
            "message": str(e)
        })




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

        for u in users:

            data.append({
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "credit": u.credit,
                "status": u.status,
                "parent": u.parent.username if u.parent else None,
                "created_at": u.created_at.isoformat(),
                "vc_username": u.vc_username,
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
        caller_id  = request.data.get("caller_id", "").strip()

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
# 🔥 SEND BULK VOICE — PLIVO OBD
# =====================================

@api_view(['POST'])
def send_bulk_voice(request):
    try:
        user = User.objects.get(id=request.data.get("user_id"))

        raw_numbers = request.data.get("numbers", [])

        if isinstance(raw_numbers, str):
            raw_numbers = [
                n.strip()
                for n in raw_numbers.split(",")
                if n.strip()
            ]

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

        retry_attempt = str(
            request.data.get("retry_attempt", "0")
        ).strip()

        campaign_name = request.data.get(
            "campaign_name",
            "Untitled Campaign"
        )

        if not media_file_id:
            return Response({
                "status": "failed",
                "message": "Voice File (Audio URL) Required"
            })

        valid_numbers = []
        invalid_results = []

        for raw in raw_numbers:

            cleaned = clean_number(raw)

            if cleaned:
                valid_numbers.append(cleaned)

            else:
                invalid_results.append({
                    "number": raw,
                    "status": "invalid"
                })

        if not valid_numbers:
            return Response({
                "status": "failed",
                "message": "No Valid Numbers"
            })

        # CREDIT CHECK
        if user.role != "admin":

            if user.credit < len(valid_numbers):

                return Response({
                    "status": "failed",
                    "message": "Insufficient Credit"
                })

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
            retry_duration=int(
            request.data.get("retry_duration", 0)
            ),

        )

        results = list(invalid_results)
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
                    "status": "sent",
                    "job_id": call_uuid,
                })

            else:

                results.append({
                    "number": number,
                    "status": "failed",
                    "error": "Plivo API Error"
                })

        # FINAL COUNTS
        success_count = len([
            r for r in results
            if r["status"] == "sent"
        ])

        failed_count = len([
            r for r in results
            if r["status"] == "failed"
        ])

        invalid_count = len([
            r for r in results
            if r["status"] == "invalid"
        ])

        campaign.success = 0
        campaign.failed = 0
        campaign.nonwa = invalid_count
        campaign.job_id = ",".join(all_job_ids)
        campaign.results = results
        campaign.status = "running"
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
            "status": "done",
            "campaign_id": campaign.id,
            "total": len(valid_numbers),
            "success": success_count,
            "failed": failed_count,
            "invalid": invalid_count,
            "job_ids": all_job_ids,
            "results": results,
            "remaining_credit": user.credit
        })

    except Exception as e:
        print("SEND BULK VOICE ERROR:", e)

        return Response({
            "status": "error",
            "message": str(e)
        })

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
                invalid_results.append({"number": raw, "status": "invalid"})

        if not valid_numbers:
            return Response({"status": "failed", "message": "No Valid Numbers"})

        if user.role != "admin":
            if user.credit < len(valid_numbers):
                return Response({"status": "failed", "message": "Insufficient Credit"})

        pending_results = [{"number": n, "status": "pending"} for n in valid_numbers] + invalid_results

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
            data.append({
                "id"           : c.id,
                "name"         : c.name,
                "voice_file_id": c.voice_file_id,
                "media_file_id": c.voice_file_id,
                "caller_id"    : c.caller_id,
                "plan_id"      : c.plan_id,
                "call_type"    : c.call_type,
                "total"        : c.total,
                "success"      : c.success,
                "failed"       : c.failed,
                "invalid"      : c.nonwa,
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

        return Response({
            "id"           : campaign.id,
            "name"         : campaign.name,
            "voice_file_id": campaign.voice_file_id,
            "media_file_id": campaign.voice_file_id,
            "caller_id"    : campaign.caller_id,
            "plan_id"      : campaign.plan_id,
            "call_type"    : campaign.call_type,
            "total"        : campaign.total,
            "success"      : campaign.success,
            "failed"       : campaign.failed,
            "invalid"      : campaign.nonwa,
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