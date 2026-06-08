import React, { useEffect, useState } from "react";
import {
  CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Eye, Download,
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
  if (["no-answer","no_answer","noanswer","no answer","rejected","cancelled","canceled"].includes(s))
    return "no_answer";
  if (s === "failed") return "failed";
  return "pending";
}

const CampaignReports = () => {
  const [filterOpen, setFilterOpen]           = useState(false);
  const [selectedFilter, setSelectedFilter]   = useState("Today");
  const [entries, setEntries]                 = useState([]);
  const [search, setSearch]                   = useState("");
  const [showEntries, setShowEntries]         = useState(10);
  const [page, setPage]                       = useState(1);
  const [loading, setLoading]                 = useState(false);

  // Detail modal
  const [showDetail, setShowDetail]           = useState(false);
  const [detailData, setDetailData]           = useState(null);
  const [detailLoading, setDetailLoading]     = useState(false);

  const filters = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Last Month"];

  useEffect(() => { loadReports(); }, [selectedFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem("user_id");
      const res    = await fetch(`${BASE}/get-campaigns/?user_id=${userId}`);
      const data   = await res.json();

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
          id         : r.id,
          date       : new Date(r.created_at).toLocaleDateString(),
          name       : r.name || `Campaign ${i + 1}`,
          totalCount : Number(r.total     || 0),
          answered   : Number(r.success   || 0),
          noAnswer   : Number(r.no_answer || 0),
          busy       : Number(r.busy      || 0),
          invalid    : Number(r.invalid   || 0),
          jobId      : r.job_id    || "",
          status     : r.status    || "",
          callerId   : r.caller_id || "",
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
      const res  = await fetch(`${BASE}/get-campaign-detail/?campaign_id=${campaignId}`);
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
      Number: r.number       || "",
      Status: r.final_status || r.status || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    worksheet["!cols"] = [{ wch: 20 }, { wch: 20 }];
    XLSX.writeFile(workbook, `${detailData.name || "campaign"}_report.xlsx`);
  };

  const filteredEntries = entries.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredEntries.length / showEntries);
  const paginated  = filteredEntries.slice((page - 1) * showEntries, page * showEntries);

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
    <div className="min-h-screen bg-[#efefef] p-3 md:p-5 overflow-x-hidden">
      <div className="w-full bg-[#f3f3f3] rounded-[20px] border border-[#ef7fa4] overflow-hidden shadow-sm">

        {/* HEADER */}
        <div className="bg-[#ececec] border-b border-[#e5e5e5] px-4 md:px-7 py-5">
          <h1 className="text-[18px] md:text-[24px] font-[700] text-black uppercase">Campaign Report</h1>
        </div>

        <div className="px-3 md:px-6 py-6">

          {/* TOP */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="h-[42px] px-5 rounded-full bg-[#e36f97] text-white flex items-center gap-2 text-[14px] md:text-[16px] font-[500]"
              >
                <CalendarDays size={16} />
                {selectedFilter}
                <ChevronDown size={14} />
              </button>
              {filterOpen && (
                <div className="absolute left-0 top-[52px] bg-white w-[180px] rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                  {filters.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => { setSelectedFilter(item); setFilterOpen(false); }}
                      className="px-4 py-2 hover:bg-pink-50 cursor-pointer text-[14px]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={loadReports}
              className="h-[42px] px-5 rounded-full bg-gray-200 text-gray-700 text-[14px] font-medium hover:bg-gray-300"
            >
              🔄 Refresh
            </button>
          </div>

          {/* SHOW + SEARCH */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
            <div className="flex items-center gap-2 text-[14px] md:text-[16px] text-black">
              <span>Show</span>
              <select
                value={showEntries}
                onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1); }}
                className="w-[70px] h-[40px] border border-[#d9d9d9] rounded-lg px-2 text-[14px] outline-none bg-white"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] md:text-[16px]">Search:</span>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-[180px] md:w-[240px] h-[40px] border border-[#d8d8d8] rounded-lg px-3 outline-none bg-white text-[14px]"
              />
            </div>
          </div>

          {/* TABLE */}
          <div className="w-full overflow-x-auto rounded-[14px] border border-[#e2e2e2] bg-white">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#fafafa]">
                  {["Date", "Name", "Caller ID", "Total", "Answered", "No Answer", "Busy", "Invalid", "View"].map((head, i) => (
                    <th key={i} className="border-r border-b border-[#e6e6e6] px-3 py-4 text-left">
                      <div className="flex items-center gap-1 text-[13px] md:text-[15px] font-[700] text-black whitespace-nowrap">
                        {head}
                        <ChevronsUpDown size={14} className="text-[#d3d3d3]" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-10 text-[15px]">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-10 text-[15px] text-black">No data available in table</td></tr>
                ) : paginated.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 duration-200">
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px]">{item.date}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px]">{item.name}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px]">{item.callerId || "-"}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px] font-semibold">{item.totalCount}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px] text-green-600 font-semibold">{item.answered}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px] text-yellow-600 font-semibold">{item.noAnswer}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px] text-orange-600 font-semibold">{item.busy}</td>
                    <td className="px-3 py-4 border-b border-[#ececec] text-[13px] text-red-600 font-semibold">{item.invalid}</td>
                    <td className="px-3 py-4 border-b border-[#ececec]">
                      <button
                        onClick={() => loadDetail(item.id)}
                        disabled={detailLoading}
                        className="w-[34px] h-[34px] rounded-full bg-pink-100 flex items-center justify-center disabled:opacity-50"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="flex items-center justify-between flex-wrap gap-4 mt-6">
            <div className="text-[13px] md:text-[15px] text-black">
              Showing {filteredEntries.length === 0 ? 0 : (page - 1) * showEntries + 1} to{" "}
              {Math.min(page * showEntries, filteredEntries.length)} of {filteredEntries.length} entries
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="bg-[#e36f97] hover:bg-[#d95f89] disabled:opacity-50 text-white px-5 h-[42px] rounded-full flex items-center gap-1 text-[13px] md:text-[14px] duration-200"
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="bg-[#e36f97] hover:bg-[#d95f89] disabled:opacity-50 text-white px-5 h-[42px] rounded-full flex items-center gap-1 text-[13px] md:text-[14px] duration-200"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
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
            <div className="bg-white rounded-[24px] w-full max-w-[950px] max-h-[90vh] overflow-y-auto shadow-[0_25px_80px_rgba(0,0,0,0.18)]">

              {/* MODAL HEADER */}
              <div className="flex justify-between items-center px-6 py-5 border-b bg-gradient-to-r from-pink-50 via-white to-pink-50 sticky top-0 z-10">
                <div>
                  <h2 className="text-[24px] font-black text-gray-800">Campaign Detail</h2>
                  <p className="text-[13px] text-gray-500 mt-1">{detailData.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadExcel}
                    className="flex items-center gap-2 bg-[#e36f97] hover:bg-[#d95f89] text-white px-5 h-[40px] rounded-full text-[13px] font-semibold duration-300 shadow-lg"
                  >
                    <Download size={15} />
                    Download Excel
                  </button>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="w-[40px] h-[40px] rounded-full bg-gray-100 hover:bg-gray-200 text-[22px] duration-300"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6">

                {/* ANALYTICS */}
                <div className="bg-gradient-to-br from-white via-pink-50 to-purple-50 border border-pink-100 rounded-[24px] p-6 shadow-lg mb-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[20px] font-black text-gray-800">Campaign Analytics</h3>
                    <div className="bg-pink-100 text-pink-700 px-4 py-2 rounded-full text-[13px] font-bold">
                      Total Calls : {detailData.total}
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6 items-center">

                    {/* DONUT CHART */}
                    <div className="relative h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Answered",  value: counts.answered  },
                              { name: "No Answer", value: counts.noAnswer  },
                              { name: "Busy",      value: counts.busy      },
                              { name: "Invalid",   value: counts.invalid   },
                            ].filter(d => d.value > 0).length > 0
                              ? [
                                  { name: "Answered",  value: counts.answered  },
                                  { name: "No Answer", value: counts.noAnswer  },
                                  { name: "Busy",      value: counts.busy      },
                                  { name: "Invalid",   value: counts.invalid   },
                                ]
                              : [{ name: "No Data", value: 1 }]
                            }
                            dataKey="value"
                            innerRadius={80}
                            outerRadius={120}
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
                        <h2 className="text-[40px] font-black text-gray-900">{detailData.total}</h2>
                        <p className="text-[13px] text-gray-500 font-medium">Total Calls</p>
                      </div>
                    </div>

                    {/* STATS CARDS */}
                    <div className="space-y-4">

                      {/* Answered */}
                      <div className="bg-[#c7e0f49e] border border-blue-100 rounded-2xl p-5 hover:scale-[1.02] duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#4baaf5] text-[13px] font-medium">Answered Calls</p>
                            <h3 className="text-[30px] font-black text-[#4baaf5] mt-1">{counts.answered}</h3>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-[#4baaf5] animate-pulse" />
                        </div>
                      </div>

                      {/* No Answer */}
                      <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-5 hover:scale-[1.02] duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#e6b843] text-[13px] font-medium">No Answer</p>
                            <h3 className="text-[30px] font-black text-[#e6b843] mt-1">{counts.noAnswer}</h3>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-[#fccc55] animate-pulse" />
                        </div>
                      </div>

                      {/* Busy */}
                      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 hover:scale-[1.02] duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#ff8a00] text-[13px] font-medium">Busy Calls</p>
                            <h3 className="text-[30px] font-black text-[#ff8a00] mt-1">{counts.busy}</h3>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-[#ff8a00] animate-pulse" />
                        </div>
                      </div>

                      {/* Invalid */}
                      <div className="bg-red-50 border border-red-100 rounded-2xl p-5 hover:scale-[1.02] duration-300 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-red-600 text-[13px] font-medium">Invalid Calls</p>
                            <h3 className="text-[30px] font-black text-red-700 mt-1">{counts.invalid}</h3>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-red-500 animate-pulse" />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* DETAIL CARDS GRID */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {[
                    ["Total",         detailData.total],
                    ["Answered",      counts.answered],
                    ["No Answer",     counts.noAnswer],
                    ["Busy",          counts.busy],
                    ["Invalid",       counts.invalid],
                    ["Caller ID",     detailData.caller_id  || "-"],
                    ["Job ID",        detailData.job_id     || "-"],
                    ["Status",        detailData.status],
                    ["Voice File ID", detailData.voice_file_id || detailData.media_file_id || "-"],
                  ].map(([label, val], i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md duration-300">
                      <p className="text-[12px] text-gray-500 uppercase tracking-wide">{label}</p>
                      <p className="text-[18px] font-bold text-gray-800 mt-1 break-all">{val}</p>
                    </div>
                  ))}
                </div>

                {/* RESULTS TABLE */}
                {detailData.results && detailData.results.length > 0 && (
                  <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="bg-gradient-to-r from-pink-50 to-white">
                          <th className="px-4 py-4 text-left text-[13px] font-bold border-b">Number</th>
                          <th className="px-4 py-4 text-left text-[13px] font-bold border-b">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.results.slice(0, 100).map((r, i) => {
                          const bucket = classifyStatus(r.final_status || r.status || "");
                          const badge  =
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
                            <tr key={i} className="border-b hover:bg-pink-50 duration-200">
                              <td className="px-4 py-3 text-[13px] font-medium">{r.number}</td>
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