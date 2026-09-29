import React, { useEffect, useState } from "react";
import {
  RotateCw, ChevronDown, X, Search, Download, ChevronsUpDown, Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import { BASE } from "../api";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ✅ Same classify function as backend & dashboard
function classifyStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "completed" || s === "answered") return "answered";
  if (s === "busy") return "busy";
  if (["no-answer", "no_answer", "noanswer", "no answer", "rejected", "cancelled", "canceled"].includes(s))
    return "no_answer";
  if (s === "failed") return "failed";
  return "pending";
}

const CampaignReports = () => {
  const [selectedFilter, setSelectedFilter] = useState("Today");
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [showEntries, setShowEntries] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filters = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Last Month"];

  useEffect(() => { loadReports(); }, [selectedFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/get-campaigns/?user_id=${userId}`);
      const data = await res.json();

      if (!data || data.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const now = new Date();

      const filtered = data.filter((r) => {
        const d = new Date(r.created_at);
        if (selectedFilter === "Today")
          return d.toDateString() === now.toDateString();
        if (selectedFilter === "Yesterday") {
          const y = new Date(); y.setDate(y.getDate() - 1);
          return d.toDateString() === y.toDateString();
        }
        if (selectedFilter === "Last 7 Days") {
          const p = new Date(); p.setDate(p.getDate() - 7); return d >= p;
        }
        if (selectedFilter === "Last 30 Days") {
          const p = new Date(); p.setDate(p.getDate() - 30); return d >= p;
        }
        if (selectedFilter === "This Month")
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (selectedFilter === "Last Month") {
          const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
        }
        return true;
      });

      const formatted = filtered.map((r, i) => {
        // ✅ FIX: API se jo values aaye wahi directly use karo
        // Backend already classify karke deta hai (views.py mein fix hai)
        return {
          id: r.id,
          date: new Date(r.created_at).toLocaleDateString(),
          name: r.name || `Campaign ${i + 1}`,
          totalCount: Number(r.total || 0),
          answered: Number(r.success || 0),
          noAnswer: Number(r.no_answer || 0),
          busy: Number(r.busy || 0),
          invalid: Number(r.invalid || 0),
          jobId: r.job_id || "",
          status: r.status || "",
          callerId: r.caller_id || "",
        };
      });

      setEntries(formatted);
      setPage(1);
    } catch (err) {
      console.log(err);
      setEntries([]);
    }
    setLoading(false);
  };

  const loadDetail = async (campaignId) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`${BASE}/get-campaign-detail/?campaign_id=${campaignId}`);
      const data = await res.json();
      setDetailData(data);
      setShowDetail(true);
    } catch (err) {
      alert("Error loading detail ❌");
    }
    setDetailLoading(false);
  };

  // ==============================
  // EXCEL DOWNLOAD
  // ==============================
  const downloadExcel = () => {
    if (!detailData || !detailData.results || detailData.results.length === 0) {
      alert("No data to download ❌");
      return;
    }

    const rows = detailData.results.map((r) => ({
      Number: r.number || "",
      Status: r.final_status || r.status || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    worksheet["!cols"] = [{ wch: 20 }, { wch: 20 }];
    XLSX.writeFile(workbook, `${detailData.name || "campaign"}_report.xlsx`);
  };

  const filteredEntries = entries.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredEntries.length / showEntries) || 1;
  const paginated = filteredEntries.slice((page - 1) * showEntries, page * showEntries);

  // ✅ Detail modal mein bhi recompute from results as fallback
  const getDetailCounts = () => {
    if (!detailData) {
      return {
        answered: 0,
        busy: 0,
        noAnswer: 0,
        failed: 0,
        invalid: 0,
      };
    }

    return {
      answered: Number(detailData.success || 0),
      busy: Number(detailData.busy || 0),
      noAnswer: Number(detailData.no_answer || 0),
      failed: Number(detailData.failed || 0),
      invalid: Number(detailData.invalid || 0),
    };
  };

  return (
    <div className="min-h-screen bg-[#eef0f5] p-3 md:p-5">
      {/* TABS */}
      <div className="flex items-center gap-1">
        <div className="px-5 py-2.5 bg-[#3d4b94] text-white text-[14px] font-[600] rounded-t-lg">
          Reports
        </div>
      </div>

      {/* FILTER CARD */}
      <div className="bg-white rounded-b-lg rounded-tr-lg border border-[#e2e5ec] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eee]">
          <h2 className="text-[14px] font-[600] text-black">Campaign Report</h2>
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <RotateCw size={15} className="cursor-pointer" onClick={loadReports} />
            <span>Dashboard &gt; Voice &gt; Reports &gt; Campaign Report &gt; Version: v1.0</span>
          </div>
        </div>

        <div className="px-5 py-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <label className="w-[110px] text-[13px] text-gray-600 shrink-0">Date Filter</label>
              <div className="relative flex-1">
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="w-full h-[38px] appearance-none border border-[#dcdfe6] rounded-md bg-[#f7f8fa] px-3 pr-16 text-[13px] outline-none"
                >
                  {filters.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 pointer-events-none">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CAMPAIGN LIST CARD */}
      <div className="bg-white rounded-lg border border-[#e2e5ec] shadow-sm mt-4">
        <div className="px-5 py-4 border-b border-[#eee]">
          <h2 className="text-[14px] font-[600] text-black">Campaign List</h2>
        </div>

        <div className="px-5 pt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-[13px] text-gray-600">
            <span>Show</span>
            <select
              value={showEntries}
              onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1); }}
              className="w-[70px] h-[36px] border border-[#dcdfe6] rounded-md px-2 text-[13px] outline-none bg-[#f7f8fa]"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] text-gray-500">Search:</span>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Enter keyword"
                className="w-[200px] h-[36px] border border-[#dcdfe6] rounded-md pl-8 pr-3 text-[13px] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#f5f6f9]">
                {["Date", "Name", "Status", "Caller ID", "Total", "Answered", "No Answer", "Busy", "Invalid", "View"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left border-b border-[#eee]">
                    <div className="flex items-center gap-1 text-[12px] font-[700] text-gray-700 whitespace-nowrap">
                      {h}
                      {h !== "View" && <ChevronsUpDown size={12} className="text-gray-300" />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="text-center py-10 text-[13px] text-gray-500">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="10" className="text-center py-10 text-[13px] text-gray-500">No data available in table</td></tr>
              ) : paginated.map((item) => (
                <tr key={item.id} className="hover:bg-[#fafbfc] duration-150">
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px] whitespace-nowrap">{item.date}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px] text-[#3d4b94] font-[600]">{item.name}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold
                       ${item.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : item.status === "done"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.callerId || "-"}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.totalCount}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.answered}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.noAnswer}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.busy}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.invalid}</td>
                  <td className="px-3 py-3 border-b border-[#f1f1f1]">
                    <button
                      onClick={() => loadDetail(item.id)}
                      disabled={detailLoading}
                      className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-white bg-[#3d4b94] hover:bg-[#323d78] disabled:opacity-50"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="px-5 pb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="text-[12.5px] text-gray-500">
            Showing {filteredEntries.length === 0 ? 0 : (page - 1) * showEntries + 1} to{" "}
            {Math.min(page * showEntries, filteredEntries.length)} of {filteredEntries.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="w-[30px] h-[30px] rounded-md border border-[#dcdfe6] text-gray-600 disabled:opacity-40 text-[12px]">«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-[30px] h-[30px] rounded-md border border-[#dcdfe6] text-gray-600 disabled:opacity-40 text-[12px]">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 4).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-[30px] h-[30px] rounded-md text-[12px] ${page === p ? "bg-[#3d4b94] text-white" : "border border-[#dcdfe6] text-gray-600"}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-[30px] h-[30px] rounded-md border border-[#dcdfe6] text-gray-600 disabled:opacity-40 text-[12px]">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="w-[30px] h-[30px] rounded-md border border-[#dcdfe6] text-gray-600 disabled:opacity-40 text-[12px]">»</button>
          </div>
        </div>
      </div>

      {/* ==============================
          DETAIL MODAL
      ============================== */}
      {showDetail && detailData && (() => {
        const counts = getDetailCounts();
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-[950px] max-h-[90vh] overflow-y-auto shadow-xl border border-[#e2e5ec]">

              {/* MODAL HEADER */}
              <div className="flex justify-between items-center px-5 py-4 border-b border-[#eee] bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-[14px] font-[600] text-black">Campaign Detail</h2>
                  <p className="text-[12px] text-gray-500 mt-0.5">{detailData.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadExcel}
                    className="flex items-center gap-2 bg-[#3d4b94] hover:bg-[#323d78] text-white px-5 h-[38px] rounded-md text-[13px] font-[600]"
                  >
                    <Download size={15} />
                    Download Excel
                  </button>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="w-[36px] h-[36px] rounded-md border border-[#dcdfe6] text-gray-600 flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-5">

                {/* ANALYTICS */}
                <div className="bg-white border border-[#e2e5ec] rounded-lg shadow-sm p-5 mb-4">
                  <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                    <h3 className="text-[14px] font-[600] text-black">Campaign Analytics</h3>
                    <div className="border border-[#dcdfe6] bg-[#f7f8fa] text-[#3d4b94] px-4 py-1.5 rounded-md text-[12.5px] font-[600]">
                      Total Calls : {detailData.total}
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6 items-center">

                    {/* DONUT CHART */}
                    <div className="relative h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Answered", value: counts.answered },
                              { name: "No Answer", value: counts.noAnswer },
                              { name: "Busy", value: counts.busy },
                              { name: "Invalid", value: counts.invalid },
                            ].filter(d => d.value > 0).length > 0
                              ? [
                                { name: "Answered", value: counts.answered },
                                { name: "No Answer", value: counts.noAnswer },
                                { name: "Busy", value: counts.busy },
                                { name: "Invalid", value: counts.invalid },
                              ]
                              : [{ name: "No Data", value: 1 }]
                            }
                            dataKey="value"
                            innerRadius={75}
                            outerRadius={110}
                            paddingAngle={6}
                            animationDuration={2000}
                          >
                            {["#4baaf5", "#fccc55", "#ff8a00", "#f02424", "#e0e0e0"].map((color, index) => (
                              <Cell key={index} fill={color} stroke="#fff" strokeWidth={5} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <h2 className="text-[32px] font-[800] text-gray-900">{detailData.total}</h2>
                        <p className="text-[12.5px] text-gray-500 font-medium">Total Calls</p>
                      </div>
                    </div>

                    {/* STATS CARDS */}
                    <div className="space-y-3">

                      {/* Answered */}
                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#4baaf5] text-[12.5px] font-[600]">Answered Calls</p>
                            <h3 className="text-[22px] font-[800] text-[#4baaf5] mt-1">{counts.answered}</h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#4baaf5]" />
                        </div>
                      </div>

                      {/* No Answer */}
                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#e6b843] text-[12.5px] font-[600]">No Answer</p>
                            <h3 className="text-[22px] font-[800] text-[#e6b843] mt-1">{counts.noAnswer}</h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#fccc55]" />
                        </div>
                      </div>

                      {/* Busy */}
                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#ff8a00] text-[12.5px] font-[600]">Busy Calls</p>
                            <h3 className="text-[22px] font-[800] text-[#ff8a00] mt-1">{counts.busy}</h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#ff8a00]" />
                        </div>
                      </div>

                      {/* Invalid */}
                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-red-600 text-[12.5px] font-[600]">Invalid Calls</p>
                            <h3 className="text-[22px] font-[800] text-red-700 mt-1">{counts.invalid}</h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* DETAIL CARDS GRID */}
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  {[
                    ["Campaign Status", detailData.status],
                    ["Total", detailData.total],
                    ["Answered", counts.answered],
                    ["No Answer", counts.noAnswer],
                    ["Busy", counts.busy],
                    ["Invalid", counts.invalid],
                    ["Caller ID", detailData.caller_id || "-"],
                    ["Job ID", detailData.job_id || "-"],
                    ["Voice File ID", detailData.voice_file_id || detailData.media_file_id || "-"],
                  ].map(([label, val], i) => (
                    <div key={i} className="bg-white border border-[#e2e5ec] rounded-md p-4">
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</p>
                      <p className="text-[14px] font-[700] text-gray-800 mt-1 break-all">{val}</p>
                    </div>
                  ))}
                </div>

                {/* RESULTS TABLE */}
                {detailData.results && detailData.results.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-[#e2e5ec]">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="bg-[#f5f6f9]">
                          <th className="px-4 py-3 text-left text-[12px] font-[700] text-gray-700 border-b border-[#eee]">Number</th>
                          <th className="px-4 py-3 text-left text-[12px] font-[700] text-gray-700 border-b border-[#eee]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.results.slice(0, 100).map((r, i) => {
                          const bucket = classifyStatus(r.final_status || r.status || "");
                          const badge =
                            bucket === "answered"
                              ? "bg-green-100 text-green-700"
                              : bucket === "busy"
                                ? "bg-orange-100 text-orange-700"
                                : bucket === "no_answer"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : bucket === "failed"
                                    ? "bg-red-100 text-red-600"
                                    : (r.status === "invalid" || r.final_status === "invalid")
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-blue-100 text-blue-700"; // pending

                          return (
                            <tr key={i} className="border-b border-[#f1f1f1] hover:bg-[#fafbfc] duration-150">
                              <td className="px-4 py-3 text-[12.5px] font-[500]">{r.number}</td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${badge}`}>
                                  {r.final_status || r.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CampaignReports;