import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Trash2, Info } from "lucide-react";
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
  method : "POST",
  headers: { "Content-Type": "application/json" },
  body   : JSON.stringify({
    user_id   : userId,
    name      : friendlyName,
    media_url : mediaUrl,
    caller_id : callerId,
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
      <div className="w-full bg-[#f5f5f5]">
        <div className="w-[100%] mx-auto">

          <h1 className="text-[28px] font-bold text-[#1d2756] mb-4">Upload Voice File</h1>

          {/* NOTICE */}
          <div className="bg-blue-50 border border-blue-300 rounded-2xl px-5 py-4 mb-6 flex gap-3">
            <Info size={22} className="text-blue-500 mt-1 shrink-0" />
            <div>
              <p className="text-[15px] font-bold text-blue-700 mb-1">Audio File Setup</p>
              <p className="text-[13px] text-blue-600 leading-6">
                Audio file ka <strong>public URL</strong> chahiye — Plivo call pe bajata hai.<br />
                Free options:<br />
                • <strong>GitHub</strong> pe .mp3 / .wav / .mp4 upload karo → Raw URL copy karo<br />
                • <strong>Google Drive</strong> → Share → Anyone with link → direct URL<br />
                • <strong>Dropbox</strong> → Share link → <code>dl=0</code> ko <code>dl=1</code> karo<br />
                • Koi bhi <strong>https://</strong> wala direct audio/video link
              </p>
            </div>
          </div>

          {/* NAME INPUT */}
          <div className="mb-3">
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Audio Name (e.g. Diwali Campaign)"
              className="w-full max-w-[540px] h-[50px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 text-[15px]"
            />
          </div>

          {/* URL INPUT */}
          <div className="mb-4">
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://yoursite.com/audio.mp3  (public URL)"
              className="w-full max-w-[540px] h-[50px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 text-[14px]"
            />
            <p className="text-[12px] text-gray-400 mt-1">
              ⚠️ URL publicly accessible hona chahiye — Plivo isko call pe bajayega
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={callerId}
                onChange={(e) => setCallerId(e.target.value)}
                placeholder="Caller ID"
                className="w-full max-w-[540px] h-[50px] border border-gray-300 rounded-xl px-4 outline-none focus:border-pink-400 text-[14px]"
              />
            </div>
          </div>

          {/* FILE PICK + SAVE BUTTON */}
          <div className="flex items-center gap-3 flex-wrap mb-5">
            <div className="bg-[#d8d9e1] rounded-full px-4 py-3 flex items-center gap-3 w-[380px]">
              <input
                type="file"
                accept=".wav,.mp3,.mp4,.ogg"
                ref={fileRef}
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current.click()}
                className="bg-white border border-gray-400 px-4 py-1 rounded-md text-[16px]"
              >
                Choose file
              </button>
              <p className="text-[16px] text-[#39476a] truncate">
                {fileName || "No file chosen"}
              </p>
            </div>

            <button
              onClick={handleUpload}
              className="bg-gradient-to-r from-pink-400 to-pink-500 text-white px-4 py-3 rounded-full text-[18px] font-semibold"
            >
              Save Audio File
            </button>
          </div>

          {/* FILES TABLE */}
          <div className="border border-pink-300 bg-white rounded-4xl mb-6">
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <h2 className="text-[20px] font-bold">Saved Audio Files</h2>
              <button onClick={loadMedia} className="text-pink-500 text-[14px] underline">🔄 Refresh</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[14px] font-bold border-b">Name</th>
                    <th className="px-4 py-3 text-left text-[14px] font-bold border-b">Audio URL</th>
                    <th className="px-4 py-3 text-left text-[14px] font-bold border-b">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr><td colSpan="3" className="text-center py-6">Loading...</td></tr>
                  ) : mediaList.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-6 text-gray-400">No files yet — add one above</td></tr>
                  ) : mediaList.map((f) => (
                    <tr key={f.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-[14px] font-medium">{f.name}</td>
                      <td className="px-4 py-3 text-[12px] text-blue-500 max-w-[300px]">
                        <a
                          href={f.media_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate block hover:underline"
                        >
                          {f.media_url}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="bg-red-100 text-red-500 w-[30px] h-[30px] rounded-lg flex items-center justify-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RULES BOX */}
          <div className="border-1 border-pink-400 bg-white rounded-4xl">
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <h2 className="text-[24px] font-bold">File Instructions</h2>
              <a
                href="https://audio.online-convert.com/convert-to-wav"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#dceedd] text-green-700 px-4 py-3 rounded-full text-[18px] font-bold"
              >Convert to MP3</a>
            </div>
            <div className="p-3 space-y-5">
              <div className="flex gap-4 h-23">
                <div className="w-4 h-4 rounded-full bg-[#ff744f] mt-7"></div>
                <div className="bg-[#f8e4df] rounded-[25px] px-6 py-5 w-full">
                  <p className="text-[15px] text-gray-500 mb-1">Rule 1</p>
                  <h3 className="text-[24px] font-semibold text-[#202c58]">
                    Supported formats: <span className="text-pink-500">WAV, MP3, MP4, OGG</span>
                  </h3>
                </div>
              </div>
              <div className="flex gap-4 h-23">
                <div className="w-4 h-4 rounded-full bg-[#16b7d7] mt-7"></div>
                <div className="bg-[#a9e3ef] rounded-[25px] px-6 py-5 w-full">
                  <p className="text-[15px] text-gray-500 mb-1">Rule 2</p>
                  <h3 className="text-[24px] font-semibold text-[#6b6f8d]">
                    Audio <span className="text-[#00a6c8]">public URL</span> chahiye — Plivo directly bajata hai.
                  </h3>
                </div>
              </div>
              <div className="flex gap-4 h-23">
                <div className="w-4 h-4 rounded-full bg-pink-500 mt-7"></div>
                <div className="bg-[#f8edf5] rounded-[25px] px-6 py-5 w-full">
                  <p className="text-[15px] text-gray-500 mb-1">Rule 3</p>
                  <h3 className="text-[24px] font-semibold text-[#202c58]">
                    GitHub raw URL best option hai — free aur reliable.
                  </h3>
                </div>
              </div>
              <div className="flex gap-4 h-23">
                <div className="w-4 h-4 rounded-full bg-green-500 mt-7"></div>
                <div className="bg-[#e4f3e4] rounded-[25px] px-6 py-5 w-full">
                  <p className="text-[15px] text-gray-500 mb-1">Rule 4</p>
                  <h3 className="text-[22px] font-semibold text-[#202c58]">
                    Test karo: browser mein URL open karo — audio play hona chahiye.
                  </h3>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* POPUP */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[320px] rounded-3xl p-6 text-center">
            <div className="flex justify-center mb-4">
              {type === "error"
                ? <AlertCircle size={55} className="text-red-500" />
                : <CheckCircle2 size={55} className="text-green-500" />}
            </div>
            <h2 className="text-[28px] font-bold mb-2">{type === "error" ? "Error" : "Success"}</h2>
            <p className="text-[18px] text-gray-600">{msg}</p>
            <button
              onClick={() => setPopup(false)}
              className={`mt-5 px-6 py-2 rounded-full text-white text-[16px] ${type === "error" ? "bg-red-500" : "bg-green-500"}`}
            >OK</button>
          </div>
        </div>
      )}
    </>
  );
}