import React, { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FaUsers, FaPaperPlane, FaLayerGroup, FaCalendarAlt } from "react-icons/fa";
import { BASE } from "../api";

// ==============================
// CUSTOM ALERT SYSTEM
// ==============================
const AlertModal = ({ alerts, removeAlert }) => {
  const iconMap = {
    success: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    info: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };

  const colorMap = {
    success: {
      bg: "#f0fdf4",
      border: "#86efac",
      icon: "#16a34a",
      title: "#15803d",
      text: "#166534",
      btn: "#16a34a",
      btnHover: "#15803d",
      bar: "#22c55e",
    },
    error: {
      bg: "#fff1f2",
      border: "#fda4af",
      icon: "#e11d48",
      title: "#be123c",
      text: "#9f1239",
      btn: "#e11d48",
      btnHover: "#be123c",
      bar: "#f43f5e",
    },
    info: {
      bg: "#eff6ff",
      border: "#93c5fd",
      icon: "#2563eb",
      title: "#1d4ed8",
      text: "#1e40af",
      btn: "#2563eb",
      btnHover: "#1d4ed8",
      bar: "#3b82f6",
    },
    warning: {
      bg: "#fffbeb",
      border: "#fcd34d",
      icon: "#d97706",
      title: "#b45309",
      text: "#92400e",
      btn: "#d97706",
      btnHover: "#b45309",
      bar: "#f59e0b",
    },
  };

  return (
    <>
      <style>{`
        @keyframes alertSlideIn {
          from { opacity: 0; transform: translateY(-40px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes alertSlideOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-40px) scale(0.92); }
        }
        @keyframes progressBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes backdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .alert-modal-box {
          animation: alertSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .alert-modal-box.removing {
          animation: alertSlideOut 0.25s ease-in forwards;
        }
        .alert-close-btn:hover {
          opacity: 0.75;
          transform: scale(1.1);
        }
      `}</style>

      {alerts.map((alert) => {
        const c = colorMap[alert.type] || colorMap.info;
        return (
          <div
            key={alert.id}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "backdropIn 0.2s ease forwards",
            }}
            onClick={() => removeAlert(alert.id)}
          >
            <div
              className={`alert-modal-box ${alert.removing ? "removing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: c.bg,
                border: `1.5px solid ${c.border}`,
                borderRadius: 20,
                padding: "36px 40px 30px",
                maxWidth: 420,
                width: "90%",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.1)",
              }}
            >
              {/* Progress bar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: 4,
                  background: c.bar,
                  borderRadius: "20px 20px 0 0",
                  animation: `progressBar ${alert.duration || 3500}ms linear forwards`,
                }}
              />

              {/* Close button */}
              <button
                className="alert-close-btn"
                onClick={() => removeAlert(alert.id)}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: c.icon,
                  fontSize: 20,
                  lineHeight: 1,
                  transition: "all 0.2s",
                  padding: 4,
                }}
              >
                ✕
              </button>

              {/* Icon circle */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: `${c.border}55`,
                  border: `2px solid ${c.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 18px",
                  color: c.icon,
                }}
              >
                {iconMap[alert.type]}
              </div>

              {/* Title */}
              {alert.title && (
                <h3 style={{
                  margin: "0 0 8px",
                  fontSize: 20,
                  fontWeight: 700,
                  color: c.title,
                  letterSpacing: "-0.3px",
                }}>
                  {alert.title}
                </h3>
              )}

              {/* Message */}
              <p style={{
                margin: "0 0 24px",
                fontSize: 15,
                color: c.text,
                lineHeight: 1.6,
                whiteSpace: "pre-line",
              }}>
                {alert.message}
              </p>

              {/* OK Button */}
              <button
                onClick={() => removeAlert(alert.id)}
                style={{
                  background: c.btn,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px 40px",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = c.btnHover;
                  e.target.style.transform = "scale(1.04)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = c.btn;
                  e.target.style.transform = "scale(1)";
                }}
              >
                OK
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
};

// ==============================
// useAlert HOOK
// ==============================
const useAlert = () => {
  const [alerts, setAlerts] = useState([]);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, removing: true } : a))
    );
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 280);
  }, []);

  const showAlert = useCallback(
    ({ type = "info", title, message, duration = 3500 }) => {
      const id = Date.now() + Math.random();
      setAlerts((prev) => [...prev, { id, type, title, message, duration }]);
      setTimeout(() => removeAlert(id), duration);
    },
    [removeAlert]
  );

  const success = (message, title = "Success!") =>
    showAlert({ type: "success", title, message });
  const error = (message, title = "Error!") =>
    showAlert({ type: "error", title, message });
  const info = (message, title = "Info") =>
    showAlert({ type: "info", title, message });
  const warning = (message, title = "Warning!") =>
    showAlert({ type: "warning", title, message });

  return { alerts, removeAlert, success, error, info, warning };
};

// ==============================
// MAIN COMPONENT
// ==============================
export default function VoiceCampaign() {
  const alert = useAlert();

  // MAIN STATES
  const [numbers, setNumbers] = useState("");
  const [campaignName, setCampaignName] = useState(
    `${new Date().toLocaleDateString()}-${new Date().getHours()}:${new Date().getMinutes()}`
  );
  const [callerId, setCallerId] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [callType, setCallType] = useState("2");
  const [voicePlan, setVoicePlan] = useState("2");
  const [retryAttempt, setRetryAttempt] = useState("0");
  const [retryDuration, setRetryDuration] = useState("0");

  // POPUPS
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [showTestPopup, setShowTestPopup] = useState(false);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);

  // EXTRA STATES
  const [testNumber, setTestNumber] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [fromRange, setFromRange] = useState(0);
  const [toRange, setToRange] = useState(0);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // GROUPS (static demo)
  const groups = [
    { name: "Demo Group", total: 150 },
    { name: "Customer Group", total: 350 },
  ];

  // ==============================
  // LOAD MEDIA FILES FROM BACKEND
  // ==============================
  useEffect(() => {
    loadMediaFiles();
  }, []);

  const loadMediaFiles = async () => {
    try {
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/get-media-files/?user_id=${userId}`);
      const data = await res.json();
      setMediaFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("Media load error:", err);
    }
  };

  // ==============================
  // AUDIO DROPZONE BOX
  // ==============================
  const UploadBox = ({ file, setFile }) => {
    const { getRootProps, getInputProps } = useDropzone({
      accept: { "audio/*": [".wav", ".mp3"] },
      onDrop: (files) => setFile(files[0]),
    });

    return (
      <div
        {...getRootProps()}
        className="relative border border-gray-300 rounded-xl bg-white h-[52px] px-4 flex items-center cursor-pointer hover:border-pink-400 duration-300 shadow-sm"
      >
        <input {...getInputProps()} />
        <p className="text-[13px] text-gray-600 truncate w-full">
          {file ? file.name : "Choose WAV File"}
        </p>
      </div>
    );
  };

  // ==============================
  // FILE UPLOAD HANDLER (CSV to numbers)
  // ==============================
  const handleFileUpload = () => {
    if (!uploadFile) {
      alert.warning("Please select a file first.", "No File Selected");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const nums = lines
        .map((line) => line.split(",")[0].trim())
        .filter((n) => /^\d+$/.test(n));
      if (nums.length > 0) {
        setNumbers((prev) =>
          prev ? prev + "," + nums.join(",") : nums.join(",")
        );
        alert.success(`${nums.length} numbers loaded successfully!`, "Upload Complete");
        setShowUploadPopup(false);
      } else {
        alert.error("No valid numbers found in the file.", "Invalid File");
      }
    };
    reader.readAsText(uploadFile);
  };

  // ==============================
  // TEST CALL
  // ==============================
  const handleTestCall = async () => {
    if (!testNumber) {
      alert.warning("Please enter a mobile number.", "Number Required");
      return;
    }
    if (!selectedMediaId) {
      alert.warning("Please select a voice file first.", "Voice File Missing");
      return;
    }

    try {
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/send-bulk-voice/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          numbers: [testNumber],
          media_file_id: selectedMediaId,
          caller_id: callerId,
          plan_id: voicePlan,
          call_type: callType,
          campaign_name: "Test Call",
          retry_attempt: retryAttempt,
          retry_duration: retryDuration,
        }),
      });
      const data = await res.json();
      if (data.status === "done") {
        alert.success("Test call sent successfully!", "Test Call Sent");
      } else {
        alert.error(data.message || "Something went wrong.", "Test Call Failed");
      }
    } catch (err) {
      alert.error("Network error. Please try again.", "Network Error");
    }

    setShowTestPopup(false);
  };

  // ==============================
  // NUMBERS CHANGE
  // ==============================
  const handleNumbersChange = (e) => {
    const raw = e.target.value;
    const formatted = raw
      .replace(/[\s\n]+/g, ",")
      .replace(/,+/g, ",")
      .replace(/^,/, "");
    setNumbers(formatted);
  };

  // ==============================
  // SEND CAMPAIGN (immediate)
  // ==============================
  const sendCampaign = async () => {
    if (loading) return;
    setLoading(true);
    setShowConfirm(false);

    const numberList = [
      ...new Set(
        numbers
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n !== "")
      ),
    ];

    if (numberList.length === 0) {
      alert.warning("Please enter at least one number.", "Numbers Required");
      setLoading(false);
      return;
    }
    if (!selectedMediaId) {
      alert.warning("Please select a voice file.", "Voice File Required");
      setLoading(false);
      return;
    }
    if (!callerId) {
      alert.warning("Please enter a Caller ID.", "Caller ID Required");
      setLoading(false);
      return;
    }

    try {
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/send-bulk-voice/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          numbers: numberList,
          media_file_id: selectedMediaId,
          caller_id: callerId,
          plan_id: voicePlan,
          call_type: callType,
          campaign_name: campaignName,
          retry_attempt: retryAttempt,
          retry_duration: retryDuration,
        }),
      });

      const data = await res.json();

      console.log("SEND RESPONSE =", data);

      if (
        data.status === "done" ||
        data.campaign_id
      ) {
        if (data.remaining_credit !== undefined) {
          const user = JSON.parse(sessionStorage.getItem("user"));
          sessionStorage.setItem(
            "user",
            JSON.stringify({ ...user, credit: data.remaining_credit })
          );
        }

  alert.success(
    `Campaign sent!\n\nTotal: ${data.total}\nSent: ${data.success}\nFailed: ${data.failed}\nInvalid: ${data.invalid}`,
    "Campaign Sent 🚀"
  );

        setNumbers("");
        setSelectedMediaId("");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        alert.error(data.message || "Something went wrong.", "Send Failed");
      }
    } catch (err) {
      console.log(err);
      alert.error("Network error. Please try again.", "Network Error");
    }

    setLoading(false);
  };

  // ==============================
  // SCHEDULE CAMPAIGN
  // ==============================
  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      alert.warning("Please select both date and time.", "Date & Time Required");
      return;
    }

    const numberList = [
      ...new Set(
        numbers
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n !== "")
      ),
    ];

    if (numberList.length === 0) {
      alert.warning("Please enter at least one number.", "Numbers Required");
      return;
    }
    if (!selectedMediaId) {
      alert.warning("Please select a voice file.", "Voice File Required");
      return;
    }
    if (!callerId) {
      alert.warning("Please enter a Caller ID.", "Caller ID Required");
      return;
    }

    try {
      setScheduleLoading(true);
      const userId = sessionStorage.getItem("user_id");
      const scheduledAt = `${scheduleDate}T${scheduleTime}`;

      const res = await fetch(`${BASE}/schedule-campaign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          numbers: numberList,
          media_file_id: selectedMediaId,
          caller_id: callerId,
          plan_id: voicePlan,
          call_type: callType,
          campaign_name: campaignName,
          scheduled_at: scheduledAt,
          retry_attempt: retryAttempt,
          retry_duration: retryDuration,
        }),
      });

      const data = await res.json();

      if (data.status === "scheduled") {
        alert.success(
          `Campaign scheduled!\n\nTotal Numbers: ${data.total}\nScheduled At: ${scheduleDate} ${scheduleTime}`,
          "Scheduled Successfully"
        );
        setNumbers("");
        setSelectedMediaId("");
        setShowSchedulePopup(false);
      } else {
        alert.error(data.message || "Something went wrong.", "Schedule Failed");
      }
    } catch (err) {
      console.log(err);
      alert.error("Network error. Please try again.", "Network Error");
    }

    setScheduleLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-2">

      {/* GLOBAL ALERT RENDERER */}
      <AlertModal alerts={alert.alerts} removeAlert={alert.removeAlert} />

      {/* MAIN CARD */}
      <div className="bg-white rounded-[22px] border border-[#ef7d9f] overflow-hidden shadow-md">

        {/* HEADER */}
        <div className="px-7 py-5 border-b border-gray-200 bg-[#fafafa]">
          <h1 className="text-[26px] font-bold text-gray-700 tracking-wide">
            Compose Voice Call
          </h1>
        </div>

        <div className="p-7">

          {/* TOP GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">

            {/* CALL TYPE */}
            <div>
              <label className="text-[14px] text-gray-500 mb-2 block font-medium">Call Type</label>
              <select
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
                className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
              >
                <option value="2">Transactional</option>
              </select>
            </div>

            {/* VOICE PLAN */}
            <div>
              <label className="text-[14px] text-gray-500 mb-2 block font-medium">Voice Plan</label>
              <select
                value={voicePlan}
                onChange={(e) => setVoicePlan(e.target.value)}
                className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
              >
                <option value="1">Delivery Base 15</option>
                <option value="2">Delivery Base 30</option>
              </select>
            </div>

            {/* CALLER ID */}
            <div>
              <label className="text-[14px] text-gray-500 mb-2 block font-medium">CallerId</label>
              <input
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
                placeholder="Leave empty"
                className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
              />

              {callerId && (
                <div className="mt-3 bg-[#e95d96] h-[36px] rounded-lg flex items-center px-4 text-white font-semibold text-[13px] shadow">
                  {callerId}
                </div>
              )}

              {/* BUTTONS */}
              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={() => setShowUploadPopup(true)}
                  className="bg-[#e95d96] hover:scale-105 duration-300 text-white px-5 h-[44px] rounded-xl flex items-center gap-2 text-[13px] shadow-lg"
                >
                  <FaUsers /> File
                </button>
                <button
                  onClick={() => setShowGroupPopup(true)}
                  className="bg-[#34c7f3] hover:scale-105 duration-300 text-white px-5 h-[44px] rounded-xl flex items-center gap-2 text-[13px] shadow-lg"
                >
                  <FaLayerGroup /> Group
                </button>
                <button
                  onClick={() => setShowTestPopup(true)}
                  className="bg-[#39d65d] hover:scale-105 duration-300 text-white px-5 h-[44px] rounded-xl flex items-center gap-2 text-[13px] shadow-lg"
                >
                  📞 Testing Call
                </button>
              </div>
            </div>

            {/* CAMPAIGN NAME */}
            <div>
              <label className="text-[14px] text-gray-500 mb-2 block font-medium">Campaign Name</label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
              />
            </div>

          </div>

          {/* NUMBERS */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[17px] text-gray-700 font-semibold">Numbers</h2>
              <span className="text-gray-400 text-[13px]">
                ({numbers
                  ? [...new Set(numbers.split(",").map((n) => n.trim()).filter(Boolean))].length
                  : 0})
              </span>
            </div>
            <textarea
              value={numbers}
              onChange={handleNumbersChange}
              placeholder="Enter Number"
              className="w-full h-[240px] border border-gray-300 rounded-2xl p-5 outline-none resize-none focus:border-pink-400 text-[14px] shadow-sm"
            />
          </div>

          {/* VOICE FILE SELECT */}
          <div className="mt-8">
            <label className="text-[14px] text-gray-500 mb-2 block font-medium">
              Select Voice File
              <span
                onClick={loadMediaFiles}
                className="ml-3 text-pink-500 cursor-pointer text-[12px] underline"
              >
                🔄 Refresh
              </span>
            </label>

            {mediaFiles.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-xl px-4 py-3 text-[13px]">
                No voice files found. Please upload from <strong>Audio File</strong> section first.
              </div>
            ) : (
              <select
                value={selectedMediaId}
                onChange={(e) => {
                  setSelectedMediaId(e.target.value);
                  const selected = mediaFiles.find((x) => x.media_url === e.target.value);
                  if (selected?.caller_id) setCallerId(selected.caller_id);
                }}
                className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
              >
                <option value="">-- Select Voice File --</option>
                {mediaFiles.map((f) => (
                  <option key={f.id} value={f.media_url}>
                    {f.name} | Caller ID: {f.caller_id}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* RETRIES */}
          <div className="mt-1">
            <label className="text-[14px] text-gray-500 mb-2 block font-medium">Retries</label>
            <select
              value={retryAttempt}
              onChange={(e) => setRetryAttempt(e.target.value)}
              className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
            >
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>

          {/* RETRY DURATION */}
          <div className="mt-1">
            <label className="text-[14px] text-gray-500 mb-2 block font-medium">Retry Duration</label>
            <select
              value={retryDuration}
              onChange={(e) => setRetryDuration(e.target.value)}
              className="w-full h-[54px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 shadow-sm"
            >
              <option value="0">Immediate</option>
              <option value="15">15 Min</option>
              <option value="30">30 Min</option>
              <option value="60">1 Hour</option>
            </select>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap gap-5 mt-10 items-center">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={loading}
              className="bg-[#e95d96] hover:scale-105 duration-300 text-white px-9 h-[50px] rounded-xl flex items-center gap-3 shadow-lg font-semibold disabled:opacity-50"
            >
              <FaPaperPlane />
              {loading ? "Sending..." : "Send Now"}
            </button>
            <span className="text-gray-500 text-[15px] font-medium">or</span>
            <button
              onClick={() => setShowSchedulePopup(true)}
              className="bg-[#3d2d83] hover:scale-105 duration-300 text-white px-9 h-[50px] rounded-xl flex items-center gap-3 shadow-lg font-semibold"
            >
              <FaCalendarAlt /> Schedule Now
            </button>
          </div>
        </div>
      </div>

      {/* ===== FILE UPLOAD POPUP ===== */}
      {showUploadPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-[520px] rounded-[18px] overflow-hidden shadow-2xl">
            <div className="bg-[#e95d96] text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-[20px] font-semibold">Upload Numbers File</h2>
              <button onClick={() => setShowUploadPopup(false)} className="text-[24px]">×</button>
            </div>
            <div className="p-6">
              <div className="border border-gray-300 rounded-xl p-4">
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx,.txt"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="mb-4"
                />
                <p className="text-[13px] text-gray-500">
                  Upload CSV / TXT file. Numbers should be in first column.
                </p>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button
                  onClick={() => setShowUploadPopup(false)}
                  className="bg-[#ff5c5c] hover:bg-red-600 text-white px-6 h-[42px] rounded-lg font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleFileUpload}
                  className="bg-[#35c2f2] hover:bg-cyan-600 text-white px-6 h-[42px] rounded-lg font-medium"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== GROUP POPUP ===== */}
      {showGroupPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-[650px] rounded-[18px] overflow-hidden shadow-2xl">
            <div className="bg-[#35c2f2] text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-[20px] font-semibold">Upload Group</h2>
              <button onClick={() => setShowGroupPopup(false)} className="text-[24px]">×</button>
            </div>
            <div className="p-6">
              <div className="flex gap-6 mb-6">
                <div>
                  <p className="text-[14px] text-gray-600 mb-2">From Range :</p>
                  <input
                    type="number"
                    value={fromRange}
                    onChange={(e) => setFromRange(e.target.value)}
                    className="w-[180px] h-[45px] border border-gray-300 rounded-lg px-3 outline-none"
                  />
                </div>
                <div>
                  <p className="text-[14px] text-gray-600 mb-2">To Range :</p>
                  <input
                    type="number"
                    value={toRange}
                    onChange={(e) => setToRange(e.target.value)}
                    className="w-[180px] h-[45px] border border-gray-300 rounded-lg px-3 outline-none"
                  />
                </div>
              </div>
              <div className="border border-gray-300 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#f5f5f5]">
                    <tr>
                      <th className="text-left p-4 border-b">Group Name</th>
                      <th className="text-left p-4 border-b">Total Contacts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer">
                        <td className="p-4">{g.name}</td>
                        <td className="p-4">{g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button
                  onClick={() => setShowGroupPopup(false)}
                  className="bg-[#ff5c5c] hover:bg-red-600 text-white px-6 h-[42px] rounded-lg font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowGroupPopup(false)}
                  className="bg-[#35c2f2] hover:bg-cyan-600 text-white px-6 h-[42px] rounded-lg font-medium"
                >
                  Select Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEST CALL POPUP ===== */}
      {showTestPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-[420px] rounded-[18px] overflow-hidden shadow-2xl">
            <div className="bg-[#39d65d] text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-[20px] font-semibold">Testing Call</h2>
              <button onClick={() => setShowTestPopup(false)} className="text-[24px]">×</button>
            </div>
            <div className="p-6">
              <p className="text-[15px] text-gray-600 mb-3">Enter Mobile No. for test</p>
              <input
                type="number"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                className="w-full h-[48px] border border-gray-300 rounded-xl px-4 outline-none focus:border-green-400"
              />
              <div className="flex justify-end gap-3 mt-7">
                <button
                  onClick={() => setShowTestPopup(false)}
                  className="bg-[#ff5c5c] hover:bg-red-600 text-white px-6 h-[42px] rounded-lg font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleTestCall}
                  className="bg-[#39d65d] hover:bg-green-600 text-white px-6 h-[42px] rounded-lg font-medium"
                >
                  Test Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCHEDULE POPUP ===== */}
      {showSchedulePopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white w-[500px] rounded-[22px] overflow-hidden shadow-2xl">
            <div className="bg-[#3d2d83] text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-[22px] font-semibold">Schedule Campaign</h2>
              <button onClick={() => setShowSchedulePopup(false)} className="text-[24px]">×</button>
            </div>
            <div className="p-7">
              <div className="mb-6">
                <label className="text-[15px] text-gray-600 mb-2 block font-medium">Select Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full h-[52px] border border-gray-300 rounded-xl px-4 outline-none focus:border-[#3d2d83]"
                />
              </div>
              <div className="mb-6">
                <label className="text-[15px] text-gray-600 mb-2 block font-medium">Select Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full h-[52px] border border-gray-300 rounded-xl px-4 outline-none focus:border-[#3d2d83]"
                />
              </div>
              <div className="bg-[#f5f5f5] rounded-xl p-4 mb-7">
                <p className="text-[14px] text-gray-700">Scheduled Date :</p>
                <p className="text-[#3d2d83] font-semibold mt-1">{scheduleDate || "Not Selected"}</p>
                <p className="text-[14px] text-gray-700 mt-3">Scheduled Time :</p>
                <p className="text-[#3d2d83] font-semibold mt-1">{scheduleTime || "Not Selected"}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSchedulePopup(false)}
                  className="bg-[#ff5c5c] hover:bg-red-600 text-white px-6 h-[44px] rounded-xl font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={scheduleLoading}
                  className="bg-[#3d2d83] hover:bg-[#2c2063] disabled:opacity-50 text-white px-6 h-[44px] rounded-xl font-semibold"
                >
                  {scheduleLoading ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONFIRM POPUP ===== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-[24px] p-10 w-[390px] shadow-2xl text-center">
            <h1 className="text-[32px] font-bold text-gray-700 mb-3">Confirm Send</h1>
            <p className="text-gray-500 text-[15px] leading-7">
              Are you sure you want to send this voice campaign?
            </p>
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={sendCampaign}
                className="bg-[#35c2f2] text-white px-8 h-[48px] rounded-xl font-semibold hover:scale-105 duration-300 shadow-lg"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-[#ff5c5c] text-white px-8 h-[48px] rounded-xl font-semibold hover:scale-105 duration-300 shadow-lg"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}