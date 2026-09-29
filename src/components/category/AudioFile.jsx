import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Trash2, Info, UploadCloud, Music, RefreshCw } from "lucide-react";
import { BASE } from "../api";

export default function AudioFile() {
  const fileRef = useRef();

  const [fileName, setFileName] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [callerId, setCallerId] = useState("");

  const [popup, setPopup] = useState(false);
  const [msg, setMsg] = useState("");
  const [type, setType] = useState("");

  const [mediaList, setMediaList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => { loadMedia(); }, []);

  const loadMedia = async () => {
    try {
      setLoadingList(true);
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/get-media-files/?user_id=${userId}`);
      const data = await res.json();
      setMediaList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log(err);
    }
    setLoadingList(false);
  };

  // File pick — just for display name
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["wav", "mp3", "mp4", "ogg"].includes(ext)) {
      setType("error");
      setMsg("Only WAV, MP3, MP4 or OGG file allowed");
      setPopup(true);
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    setFriendlyName(file.name.replace(/\.(wav|mp3|mp4|ogg)$/, ""));
  };

  // Save audio URL to backend
  const handleUpload = async () => {
    if (!friendlyName.trim()) {
      setType("error"); setMsg("Please enter a name"); setPopup(true); return;
    }
    if (!mediaUrl.trim()) {
      setType("error"); setMsg("Please paste public audio URL"); setPopup(true); return;
    }
    if (!mediaUrl.startsWith("http")) {
      setType("error"); setMsg("URL must start with https://"); setPopup(true); return;
    }

    try {
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/upload-media/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          name: friendlyName,
          media_url: mediaUrl,
          caller_id: callerId,
        }),
      });
      const data = await res.json();

      if (data.status === "success") {
        setType("success");
        setMsg("Audio file saved! Select it in Voice Campaign now.");
        setPopup(true);
        setMediaUrl("");
        setFriendlyName("");
        setFileName("");
        loadMedia();
      } else {
        setType("error"); setMsg(data.message || "Failed"); setPopup(true);
      }
    } catch (err) {
      setType("error"); setMsg("Network Error ❌"); setPopup(true);
    }
  };

  const handleDelete = async (mediaId) => {
    if (!window.confirm("Delete this audio file?")) return;
    try {
      const res = await fetch(`${BASE}/delete-media/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: mediaId }),
      });
      const data = await res.json();
      if (data.status === "success") loadMedia();
    } catch (err) {
      alert("Error ❌");
    }
  };

  return (
    <>
      <div className="w-full">

        {/* ═══════════════════════════════
            SAVED AUDIO FILES — table
        ════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">

          <div className="flex items-center justify-between px-5 py-2 border-b border-gray-200">
            <h1 className="text-[20px] font-semibold text-[#1d2756]">Audio Store</h1>
            <button
              onClick={loadMedia}
              className="flex items-center gap-2 bg-[#3F51B5] text-white px-4 h-[34px] rounded-lg text-[14px] font-medium hover:opacity-90"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-5 py-2 text-left text-[13px] font-semibold text-gray-700">Name</th>
                  <th className="px-5 py-2 text-left text-[13px] font-semibold text-gray-700">Audio URL</th>
                  <th className="px-5 py-2 text-left text-[13px] font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr><td colSpan="3" className="text-center py-4 text-gray-400">Loading...</td></tr>
                ) : mediaList.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-4 text-gray-400">No files yet — add one below</td></tr>
                ) : mediaList.map((f) => (
                  <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2 text-[14px] font-medium text-[#3F51B5]">{f.name}</td>
                    <td className="px-5 py-2 text-[13px] text-gray-600 max-w-[300px]">
                      <a
                        href={f.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate block hover:text-[#3F51B5] hover:underline"
                      >
                        {f.media_url}
                      </a>
                    </td>
                    <td className="px-5 py-2">
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-red-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════
            UPLOAD PANEL
        ════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">

          <p className="text-[15px] font-semibold text-[#1d2756] mb-3">Upload Voice File</p>

          {/* NOTICE */}
          <div className="bg-blue-50 border border-blue-300 rounded-2xl px-5 py-3 mb-5 flex gap-3">
            <Info size={22} className="text-blue-500 mt-1 shrink-0" />
            <div>
              <p className="text-[15px] font-bold text-blue-700 mb-1">Audio File Setup</p>
              <p className="text-[13px] text-blue-600 leading-6">
                • A <strong>public URL</strong> of the audio file is required<br />
                • Upload your .mp3 / .wav / .mp4 on <strong>GitHub</strong> → copy the Raw URL<br />
                • <strong>Google Drive</strong> → Share → Anyone with the link → use the direct URL<br />
                • <strong>Dropbox</strong> → Share link → change <code>dl=0</code> to <code>dl=1</code><br />
                • Any direct audio/video link starting with <strong>https://</strong>
              </p>
            </div>
          </div>

          {/* CHOOSE FILE */}
          <div className="mb-5">
            <label className="text-[13px] text-gray-700 mb-2 block">Choose file</label>
            <div className="flex items-center gap-3 max-w-[540px]">
              <input
                type="file"
                accept=".wav,.mp3,.mp4,.ogg"
                ref={fileRef}
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current.click()}
                className="flex items-center gap-2 bg-[#3F51B5] text-white px-5 h-[39px] rounded-lg text-[14px] font-medium hover:opacity-90"
              >
                <UploadCloud size={16} />
                Choose
              </button>
              <p className="text-[13px] text-gray-700 font-medium flex items-center gap-1 truncate">
                {fileName ? <><Music size={14} /> {fileName}</> : <span className="text-gray-400">No file chosen</span>}
              </p>
            </div>
            <p className="text-[12px] text-gray-400 mt-2">
              <span className="text-red-500">*</span>.wav, .mp3, .mp4 and .ogg are acceptable.
            </p>
          </div>

          {/* NAME INPUT */}
          <div className="mb-5">
            <label className="text-[13px] text-gray-700 mb-1 block">
              Audio Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Audio Name (e.g. Diwali Campaign)"
              className="w-full max-w-[540px] h-[41px] border border-gray-300 rounded-lg px-4 outline-none focus:border-[#3F51B5] text-[14px]"
            />
          </div>

          {/* URL INPUT */}
          <div className="mb-5">
            <label className="text-[13px] text-gray-700 mb-1 block">
              Audio URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://yoursite.com/audio.mp3  (public URL)"
              className="w-full max-w-[540px] h-[41px] border border-gray-300 rounded-lg px-4 outline-none focus:border-[#3F51B5] text-[14px]"
            />
            <p className="text-[12px] text-gray-400 mt-1">
              ⚠️ The URL must be publicly accessible
            </p>
          </div>

          {/* CALLER ID */}
          <div className="mb-6">
            <label className="text-[13px] text-gray-700 mb-1 block">Caller ID</label>
            <input
              type="text"
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              placeholder="Caller ID"
              className="w-full max-w-[540px] h-[41px] border border-gray-300 rounded-lg px-4 outline-none focus:border-[#3F51B5] text-[14px]"
            />
          </div>

          {/* SAVE BUTTON */}
          <button
            onClick={handleUpload}
            className="bg-[#3F51B5] text-white px-8 h-[42px] rounded-lg text-[14px] font-semibold hover:opacity-90"
          >
            Save Audio File
          </button>
        </div>

        {/* ═══════════════════════════════
            FILE INSTRUCTIONS
        ════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-xl mb-5">
          <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200">
            <h2 className="text-[18px] font-semibold text-[#1d2756]">File Instructions</h2>
            <a
              href="https://audio.online-convert.com/convert-to-wav"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#3F51B5] text-white px-4 h-[34px] rounded-lg text-[14px] font-medium flex items-center hover:opacity-90"
            >
              Convert to MP3
            </a>
          </div>
          <div className="p-4 space-y-3">
            {[
              { dot: "bg-[#ff744f]", bg: "bg-[#f8e4df]", rule: "Rule 1", text: <>Supported formats: <span className="text-[#3F51B5]">WAV, MP3, MP4, OGG</span></> },
              { dot: "bg-[#16b7d7]", bg: "bg-[#e1f4f8]", rule: "Rule 2", text: <>A <span className="text-[#00a6c8]">public URL</span> is required</> },
              { dot: "bg-[#3F51B5]", bg: "bg-[#e8eaf6]", rule: "Rule 3", text: <>A GitHub raw URL is the best option — free and reliable.</> },
              { dot: "bg-green-500", bg: "bg-[#e4f3e4]", rule: "Rule 4", text: <>Test it: open the URL in your browser — the audio should play.</> },
            ].map((r) => (
              <div key={r.rule} className="flex gap-3 items-center">
                <div className={`w-3 h-3 rounded-full ${r.dot} shrink-0`}></div>
                <div className={`${r.bg} rounded-xl px-5 py-3 w-full`}>
                  <p className="text-[12px] text-gray-500 mb-0.5">{r.rule}</p>
                  <p className="text-[15px] font-semibold text-[#202c58]">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* POPUP */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[320px] rounded-3xl p-6 text-center shadow-2xl">
            <div className="flex justify-center mb-4">
              {type === "error"
                ? <AlertCircle size={55} className="text-red-500" />
                : <CheckCircle2 size={55} className="text-green-500" />}
            </div>
            <h2 className="text-[26px] font-bold mb-2">{type === "error" ? "Error" : "Success"}</h2>
            <p className="text-[16px] text-gray-600">{msg}</p>
            <button
              onClick={() => setPopup(false)}
              className={`mt-5 px-6 py-2 rounded-full text-white text-[15px] font-semibold ${type === "error" ? "bg-red-500" : "bg-green-500"}`}
            >OK</button>
          </div>
        </div>
      )}
    </>
  );
}