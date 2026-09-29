import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { BASE } from "../api";

const ACCENT = "#3F51B5";

const pad = (n) => String(n).padStart(2, "0");
const defaultExpireTime = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 20:59:00`;
};

function Section({ title, isOpen, onToggle, children }) {
  return (
    <div className="bg-white border border-gray-200 border-l-3 border-l-[#3F51B5] border-t-3 border-t-[#dfe0e4] border-b-3 border-b-[#dfe0e4] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-gray-800 text-[15px]">{title}</span>
        {isOpen ? (
          <ChevronUp size={18} className="text-gray-500" />
        ) : (
          <ChevronDown size={18} className="text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100">{children}</div>
      )}
    </div>
  );
}

function Radio({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: ACCENT }}
        className="w-[18px] h-[18px]"
      />
      <span className="text-[14px] text-gray-700">{label}</span>
    </label>
  );
}

export default function VoiceCampaign() {
  // ---- core fields ----
  const [creditType, setCreditType] = useState("trans");
  const [callerId, setCallerId] = useState("");
  const [callerIds, setCallerIds] = useState([]);
  const [additionalCallerId, setAdditionalCallerId] = useState("");
  const [campaignType, setCampaignType] = useState("obd");
  const [campaignName, setCampaignName] = useState(
    `${new Date().toLocaleDateString()}-${new Date().getHours()}:${new Date().getMinutes()}`
  );
  const [mediaFiles, setMediaFiles] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [retryAttempt, setRetryAttempt] = useState("0");
  const [retryDuration, setRetryDuration] = useState("0");
  const [scheduleMode, setScheduleMode] = useState("now"); // now | later | calendar
  const [laterMinutes, setLaterMinutes] = useState("15");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [expireTime, setExpireTime] = useState(defaultExpireTime());

  // ---- numbers (from uploaded file) ----
  const [numbers, setNumbers] = useState([]);
  const [uploadFileType, setUploadFileType] = useState("excel");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef(null);

  // ---- group panel ----
  const [fromRange, setFromRange] = useState(0);
  const [toRange, setToRange] = useState(0);
  // const groups = [
  //   { name: "Demo Group", total: 150 },
  //   { name: "Customer Group", total: 350 },
  // ];

  // ---- sms panel ----
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");

  // ---- test call panel ----
  const [testNumber, setTestNumber] = useState("");
  const [testCallLoading, setTestCallLoading] = useState(false);

  // ---- collapsibles ----
  const [openPanels, setOpenPanels] = useState({ file: true, group: false, sms: false, test: true });
  const togglePanel = (key) => setOpenPanels((p) => ({ ...p, [key]: !p[key] }));

  // ---- run state ----
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ---- result popup ----
  const [popup, setPopup] = useState(false);
  const [popupType, setPopupType] = useState("success");
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMsg, setPopupMsg] = useState("");
  const [popupStats, setPopupStats] = useState(null);

  const showPopup = (t, title, m, stats = null) => {
    setPopupType(t);
    setPopupTitle(title);
    setPopupMsg(m);
    setPopupStats(stats);
    setPopup(true);
  };

  const userId = () => sessionStorage.getItem("user_id");

  useEffect(() => {
    loadMediaFiles();
    loadCallerIds();
  }, []);

  // ==============================
  // LOAD MEDIA FILES / CALLER IDS
  // ==============================
  const loadMediaFiles = async () => {
    try {
      const res = await fetch(`${BASE}/get-media-files/?user_id=${userId()}`);
      const data = await res.json();
      setMediaFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("Media load error:", err);
    }
  };

  const loadCallerIds = async () => {
    try {
      const res = await fetch(`${BASE}/get-caller-ids/?user_id=${userId()}`);
      const data = await res.json();
      setCallerIds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("Caller ID load error:", err);
      setCallerIds([]);
    }
  };

  // ==============================
  // INDIAN MOBILE NUMBER HELPERS
  // ==============================
  const isValidIndianMobile = (value) => /^[6-9]\d{9}$/.test(String(value));

  // Supports 10-digit numbers and +91 / 91 prefixed 12-digit numbers.
  const extractIndianNumbers = (raw) => {
    const text = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
    const tokens = text
      .replace(/[\r\n\t;|]+/g, ",")
      .split(/[\s,]+/)
      .map((x) => x.replace(/\D/g, ""))
      .filter(Boolean);

    const result = [];

    for (const token of tokens) {
      let n = token;

      if (n.length === 12 && n.startsWith("91")) {
        n = n.slice(2);
      }

      if (n.length > 10 && n.length % 10 === 0) {
        for (let i = 0; i < n.length; i += 10) {
          const part = n.slice(i, i + 10);
          if (isValidIndianMobile(part)) result.push(part);
        }
      } else if (isValidIndianMobile(n)) {
        result.push(n);
      }
    }

    return [...new Set(result)];
  };

  // ==============================
  // FILE UPLOAD -> NUMBERS
  // ==============================
  const acceptFor = (type) =>
    type === "excel" ? ".xlsx,.xls" : type === "csv" ? ".csv" : ".txt";

  const handleChooseClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    try {
      let rawValues = [];
      if (uploadFileType === "excel" || /\.(xlsx|xls)$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        rawValues = rows.map((r) => r[0]).filter(Boolean);
      } else {
        const text = await file.text();
        rawValues = text
          .split("\n")
          .map((l) => l.split(",")[0])
          .filter(Boolean);
      }
      const valid = extractIndianNumbers(rawValues);
      if (valid.length === 0) {
        showPopup("error", "Invalid File", "No valid numbers found in the file.");
        return;
      }
      setNumbers(valid);
      showPopup("success", "Upload Complete", `${valid.length} numbers loaded successfully!`);
    } catch (err) {
      showPopup("error", "Error", "Could not read this file. Please check the format and try again.");
    }
  };

  const handleCancelFile = () => {
    setUploadedFileName("");
    setNumbers([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadSampleFile = () => {
    const csv = "Mobile Number\n9876543210\n9123456780\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-numbers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==============================
  // PAYLOAD + RUN
  // ==============================
  const planId = () => (campaignType === "obd" ? "2" : "1");
  const callTypeValue = () => (creditType === "trans" ? "2" : "1");

  const basePayload = () => ({
    user_id: userId(),
    numbers,
    media_file_id: selectedMediaId,
    caller_id: callerId,
    additional_caller_id: additionalCallerId || undefined,
    plan_id: planId(),
    call_type: callTypeValue(),
    campaign_name: campaignName,
    retry_attempt: retryAttempt,
    retry_duration: retryDuration,
    expire_at: expireTime,
    sms_enabled: smsEnabled,
    sms_message: smsEnabled ? smsMessage : undefined,
  });

  const validateBeforeRun = () => {
    if (numbers.length === 0)
      return "Please upload a file with valid 10-digit Indian mobile numbers (starting with 6-9).";
    const invalidNumbers = numbers.filter((n) => !isValidIndianMobile(n));
    if (invalidNumbers.length > 0)
      return `Only valid 10-digit Indian mobile numbers are allowed. Invalid numbers: ${invalidNumbers
        .slice(0, 5)
        .join(", ")}${invalidNumbers.length > 5 ? "..." : ""}`;
    if (!selectedMediaId) return "Please select a voice file.";
    if (!callerId) return "Please enter a Caller ID.";
    if (!campaignName.trim()) return "Please enter a Campaign Name";
    if (scheduleMode === "calendar" && (!scheduleDate || !scheduleTime))
      return "Please select both date and time.";
    return null;
  };

  const handleRunClick = () => {
    const err = validateBeforeRun();
    if (err) {
      showPopup("error", "Missing Information", err);
      return;
    }
    if (scheduleMode === "now") {
      setShowConfirm(true);
    } else {
      runCampaign();
    }
  };

  const resetAfterSend = () => {
    setNumbers([]);
    setUploadedFileName("");
    setSelectedMediaId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runCampaign = async () => {
    if (loading) return;
    setShowConfirm(false);
    setLoading(true);
    try {
      if (scheduleMode === "now") {
        const res = await fetch(`${BASE}/send-bulk-voice/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload()),
        });
        const data = await res.json();

        console.log("SEND RESPONSE =", data);

        if (data.status === "done" || data.status === "pending" || data.campaign_id) {
          if (data.remaining_credit !== undefined) {
            const user = JSON.parse(sessionStorage.getItem("user"));
            sessionStorage.setItem(
              "user",
              JSON.stringify({ ...user, credit: data.remaining_credit })
            );
          }

          if (data.status === "pending") {
            showPopup(
              "success",
              "Campaign Send ⏳",
              "Campaign submitted successfully.",
              [
                ["Total Numbers", data.total ?? numbers.length],
                ["Status", "Pending"],
              ]
            );
          } else {
            showPopup(
              "success",
              "Campaign Sent 🚀",
              "Your voice campaign has been dispatched successfully.",
              [
                ["Total", data.total],
                ["Success", data.success],
                ["Failed", data.failed],
                ["Invalid", data.invalid],
              ]
            );
          }

          resetAfterSend();
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showPopup("error", "Send Failed", data.message || "Something went wrong.");
        }
      } else {
        let scheduled_at;
        if (scheduleMode === "later") {
          scheduled_at = new Date(Date.now() + Number(laterMinutes) * 60000).toISOString();
        } else {
          scheduled_at = `${scheduleDate}T${scheduleTime}`;
        }
        const res = await fetch(`${BASE}/schedule-campaign/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload(), scheduled_at }),
        });
        const data = await res.json();
        if (data.status === "scheduled") {
          showPopup(
            "success",
            "Scheduled Successfully",
            "Your campaign has been scheduled successfully.",
            [
              ["Total Numbers", data.total],
              ["Scheduled At", scheduleMode === "calendar" ? `${scheduleDate} ${scheduleTime}` : `After ${laterMinutes} min`],
            ]
          );
          resetAfterSend();
        } else {
          showPopup("error", "Schedule Failed", data.message || "Something went wrong.");
        }
      }
    } catch (err) {
      console.log(err);
      showPopup("error", "Network Error", "Network error. Please try again.");
    }
    setLoading(false);
  };

  // ==============================
  // TEST CALL
  // ==============================
  const handleTestCall = async () => {
    const cleanTestNumber = String(testNumber).replace(/\D/g, "");

    if (!isValidIndianMobile(cleanTestNumber)) {
      showPopup(
        "warning",
        "Invalid Mobile Number",
        "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9."
      );
      return;
    }

    if (!selectedMediaId) {
      showPopup("warning", "Voice File Missing", "Please select a voice file first.");
      return;
    }

    setTestCallLoading(true);
    try {
      const res = await fetch(`${BASE}/send-bulk-voice/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId(),
          numbers: [cleanTestNumber],
          media_file_id: selectedMediaId,
          caller_id: callerId,
          plan_id: planId(),
          call_type: callTypeValue(),
          campaign_name: "Test Call",
          retry_attempt: retryAttempt,
          retry_duration: retryDuration,
        }),
      });
      const data = await res.json();
      if (data.status === "done") {
        showPopup("success", "Test Call Sent", "Test call sent successfully!");
        setTestNumber("");
      } else {
        showPopup("error", "Test Call Failed", data.message || "Something went wrong.");
      }
    } catch (err) {
      showPopup("error", "Network Error", "Network error. Please try again.");
    }
    setTestCallLoading(false);
  };

  // ==============================
  // CALLER ID OPTIONS (API, else from voice files)
  // ==============================
  const callerOptions =
    callerIds.length > 0
      ? callerIds.map((c) => ({ id: c.id, name: c.name, number: String(c.number) }))
      : [
          ...new Map(
            mediaFiles
              .filter((f) => f.caller_id)
              .map((f) => [
                String(f.caller_id),
                { id: f.caller_id, name: "", number: String(f.caller_id) },
              ])
          ).values(),
        ];

  const inputClass =
    "w-full h-[30px] border border-gray-400 rounded-sm px-2 text-[9px] outline-none focus:border-[#3F51B5] focus:ring-1 focus:ring-[#3F51B5]/20 bg-white";
  const labelClass = "text-[12px] font-semibold text-gray-700 mb-1 block";

  const popupIcon = () => {
    if (popupType === "success") return <CheckCircle2 size={50} className="text-green-500" />;
    if (popupType === "warning") return <AlertCircle size={50} className="text-amber-500" />;
    return <AlertCircle size={50} className="text-red-500" />;
  };
  const popupBtn = () => {
    if (popupType === "success") return "bg-green-500";
    if (popupType === "warning") return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      <div className="max-w-[1800px]">
        <h1 className="text-[16px] font-semibold text-gray-800">Create Campaign</h1>
        <div className=" bg-gray-200 w-full my-2" />

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-2 items-start">
          {/* LEFT: FORM */}
          <div className="bg-white border border-gray-200 border-t-2 border-t-[#3F51B5] border-l-3 border-l-[#dfe0e4] border-r-3 border-r-[#dfe0e4] border-b-3 border-b-[#dfe0e4] rounded-lg p-4  ">
            <div className="space-y-2.5">
              <div className="flex items-center gap-6 flex-wrap">
                <span className={labelClass + " mb-0 w-fit"}>
                  Credit Type<span className="text-red-500">*</span>
                </span>
                <div className="flex items-center gap-6">
                  <Radio checked={creditType === "trans"} onChange={() => setCreditType("trans")} label="Trans" />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Caller ID<span className="text-red-500">*</span>
                </label>
                {callerOptions.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-300 text-gray-700 rounded-lg px-2 py-2 text-[13px]">
                    No Caller IDs found. Please add one from the Audio File section.
                  </div>
                ) : (
                  <select value={callerId} onChange={(e) => setCallerId(e.target.value)} className={inputClass}>
                    <option value="">Select Service Number</option>
                    {callerOptions.map((c) => (
                      <option key={c.id} value={c.number}>
                        {c.name ? `${c.name} - ${c.number}` : c.number}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelClass}>Additional CallerID</label>
                <input
                  value={additionalCallerId}
                  onChange={(e) => setAdditionalCallerId(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Call Type<span className="text-red-500">*</span>
                </label>
                <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className={inputClass}>
                  <option value="obd">OBD Campaign</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Name<span className="text-red-500">*</span>
                </label>

                <input
                  value={campaignName}
                  maxLength={30}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Max 30 Character"
                  className={`${inputClass} !bg-[#ffe4c4] !text-gray-500 placeholder:!text-gray-500`}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Voice File
                  <span
                    onClick={loadMediaFiles}
                    className="ml-3 text-[#3F51B5] cursor-pointer text-[11px] underline"
                  >
                    🔄 Refresh
                  </span>
                </label>
                {mediaFiles.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-300 text-gray-700 rounded-lg px-4 py-2 text-[13px]">
                    No voice files found. Please upload one from the Audio File section first.
                  </div>
                ) : (
                  <select
                    value={selectedMediaId}
                    onChange={(e) => {
                      setSelectedMediaId(e.target.value);
                      const selected = mediaFiles.find((x) => x.media_url === e.target.value);
                      if (selected?.caller_id) setCallerId(String(selected.caller_id));
                    }}
                    className={inputClass}
                  >
                    <option value="">Select Voice File</option>
                    {mediaFiles.map((f) => (
                      <option key={f.id} value={f.media_url}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelClass}>Retries</label>
                <select value={retryAttempt} onChange={(e) => setRetryAttempt(e.target.value)} className={inputClass}>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Retry Duration</label>
                <select value={retryDuration} onChange={(e) => setRetryDuration(e.target.value)} className={inputClass}>
                  <option value="0">Immediate</option>
                  <option value="15">15 Min</option>
                  <option value="30">30 Min</option>
                  <option value="60">1 Hour</option>
                </select>
              </div>

              <div>
                <div className="flex items-center gap-8 flex-wrap">
                  <span className={labelClass + " mb-0 w-fit"}>
                    Schedule<span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-6 flex-wrap">
                    <Radio checked={scheduleMode === "now"} onChange={() => setScheduleMode("now")} label="Now" />
                    <Radio checked={scheduleMode === "later"} onChange={() => setScheduleMode("later")} label="Later" />
                    <Radio checked={scheduleMode === "calendar"} onChange={() => setScheduleMode("calendar")} label="Calendar" />
                  </div>
                </div>

                {scheduleMode === "later" && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[13px] text-gray-500">Send after</span>
                    <select
                      value={laterMinutes}
                      onChange={(e) => setLaterMinutes(e.target.value)}
                      className="h-[38px] border border-gray-300 rounded-lg px-2 text-[13px]"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                )}

                {scheduleMode === "calendar" && (
                  <div className="flex items-center gap-3 mt-3">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="h-[38px] border border-gray-300 rounded-lg px-2 text-[13px]"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="h-[38px] border border-gray-300 rounded-lg px-2 text-[13px]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Campaign Expire Time</label>
                <input value={expireTime} onChange={(e) => setExpireTime(e.target.value)} className={inputClass} />
              </div>
            </div>

            <button
              onClick={handleRunClick}
              disabled={loading}
              className="mt-4 bg-[#3F51B5] hover:bg-[#32408f] text-white font-semibold px-9 h-[40px] rounded-lg flex items-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Running..." : "Run"}
            </button>
          </div>

          {/* RIGHT: COLLAPSIBLE PANELS */}
          <div className="space-y-4">
            <Section title="File" isOpen={openPanels.file} onToggle={() => togglePanel("file")}>
              <label className={labelClass}>
                Upload Data<span className="text-red-500">*</span>
              </label>
              <select value={uploadFileType} onChange={(e) => setUploadFileType(e.target.value)} className={inputClass}>
                <option value="excel">Excel File</option>
                <option value="csv">CSV File</option>
              </select>

              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={downloadSampleFile}
                  className="flex items-center gap-8 text-[13px] font-semibold text-gray-700"
                >
                  Download Sample File - <FileSpreadsheet size={39} className="text-green-600" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={acceptFor(uploadFileType)}
                className="hidden"
                onChange={handleFileSelected}
              />

              <div className="mt-4 bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleChooseClick}
                    className="bg-[#3F51B5] text-white px-4 h-[38px] rounded-lg flex items-center gap-1.5 text-[13px] font-semibold"
                  >
                    <Plus size={14} /> Choose
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelFile}
                    className="bg-gray-200 text-gray-600 px-4 h-[38px] rounded-lg flex items-center gap-1.5 text-[13px] font-semibold"
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
                {uploadedFileName && (
                  <p className="text-[13px] text-gray-600 mt-3">
                    📄 {uploadedFileName} — <span className="font-semibold text-gray-800">{numbers.length}</span> valid numbers
                  </p>
                )}
              </div>
            </Section>

            {/* GROUP PANEL */}
            {/* <Section title="Group" isOpen={openPanels.group} onToggle={() => togglePanel("group")}>
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className={labelClass}>From Range</label>
                  <input
                    type="number"
                    value={fromRange}
                    onChange={(e) => setFromRange(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>To Range</label>
                  <input
                    type="number"
                    value={toRange}
                    onChange={(e) => setToRange(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Group Name</th>
                      <th className="text-left px-3 py-2 border-b">Total Contacts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer">
                        <td className="px-3 py-2">{g.name}</td>
                        <td className="px-3 py-2">{g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section> */}

            <Section title="SMS" isOpen={openPanels.sms} onToggle={() => togglePanel("sms")}>
              <label className="inline-flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  style={{ accentColor: ACCENT }}
                  className="w-4 h-4"
                />
                <span className="text-[13px] text-gray-700 font-medium">Send SMS along with this campaign</span>
              </label>
              {smsEnabled && (
                <>
                  <textarea
                    value={smsMessage}
                    maxLength={160}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Enter SMS message"
                    className="w-full h-[90px] border border-gray-300 rounded-lg p-3 text-[13px] outline-none focus:border-[#3F51B5] resize-none"
                  />
                  <p className="text-[11px] text-gray-400 text-right mt-1">{smsMessage.length}/160</p>
                </>
              )}
            </Section>

            {/* TEST CALL */}
            <Section title="Test Call" isOpen={openPanels.test} onToggle={() => togglePanel("test")}>
              <div className="flex items-center gap-4">
                <label className="text-[13px] font-semibold text-gray-700 whitespace-nowrap">
                  Mobile No
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="flex-1 h-[38px] border border-gray-300 rounded-md px-3 text-[13px] outline-none focus:border-[#3F51B5] focus:ring-1 focus:ring-[#3F51B5]/20 bg-gray-100"
                />
                <button
                  type="button"
                  onClick={handleTestCall}
                  disabled={testCallLoading}
                  className="bg-[#3F51B5] hover:bg-[#32408f] text-white font-semibold px-6 h-[38px] rounded-md flex items-center gap-2 text-[13px] disabled:opacity-60 whitespace-nowrap"
                >
                  {testCallLoading && <Loader2 size={14} className="animate-spin" />}
                  {testCallLoading ? "Dialing..." : "Dial"}
                </button>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-[380px] shadow-2xl text-center">
            <h2 className="text-[22px] font-bold text-gray-800 mb-2">Confirm Send</h2>
            <p className="text-gray-500 text-[14px]">Are you sure you want to run this campaign now?</p>
            <div className="mt-4 bg-gray-50 rounded-lg p-4 text-left space-y-1 text-[13px] text-gray-600">
              <p>
                Caller ID: <span className="font-semibold">{callerId || "—"}</span>
              </p>
              <p>
                Numbers: <span className="font-semibold">{numbers.length}</span>
              </p>
              <p>
                Name: <span className="font-semibold">{campaignName || "—"}</span>
              </p>
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={runCampaign} className="bg-[#3F51B5] text-white px-6 h-[42px] rounded-lg font-semibold">
                Yes, Run
              </button>
              <button onClick={() => setShowConfirm(false)} className="bg-gray-200 text-gray-700 px-6 h-[42px] rounded-lg font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT POPUP */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-[360px] rounded-2xl p-6 text-center shadow-2xl">
            <div className="flex justify-center mb-4">{popupIcon()}</div>
            <h2 className="text-[20px] font-bold mb-1">{popupTitle}</h2>
            <p className="text-[14px] text-gray-600">{popupMsg}</p>
            {popupStats && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {popupStats.map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-gray-400">{label}</p>
                    <p className="text-[16px] font-bold text-gray-700">{val}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setPopup(false)}
              className={`mt-5 px-6 py-2 rounded-full text-white text-[14px] font-semibold ${popupBtn()}`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}