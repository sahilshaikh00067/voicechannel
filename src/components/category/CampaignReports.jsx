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

  // Answered calls
  if (
    s === "completed" ||
    s === "answered" ||
    s === "answer" ||
    s === "normal_clearing"
  ) {
    return "answered";
  }

  // Busy calls
  if (s === "busy" || s === "user_busy") {
    return "busy";
  }

  // No answer / rejected calls
  if (
    [
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
    ].includes(s)
  ) {
    return "no_answer";
  }

  // Failed calls
  if (
    [
      "failed",
      "unallocated_number",
      "normal_unspecified",
      "error",
    ].includes(s)
  ) {
    return "failed";
  }

  // Invalid numbers
  if (
    [
      "invalid",
      "invalid_number",
      "invalid-number",
    ].includes(s)
  ) {
    return "invalid";
  }

  // Unknown or unfinished status
  return "pending";
}

const getEstimatedReport = (total, campaignKey, backendReport = null) => {

  const count = Math.max(0, Number(total) || 0);

  const colors = {

    answered: "#4baaf5",

    no_answer: "#fccc55",

    busy: "#ff8a00",

    invalid: "#f02424",

  };

  // Prefer the saved backend estimate

  const savedCounts = backendReport?.counts;

  const savedPercentages = backendReport?.percentages;

  if (savedCounts && savedPercentages) {

    return [

      {

        name: "Answered",

        percent: savedPercentages.answered,

        estimatedCount: savedCounts.answered || 0,

        color: colors.answered,

      },

      {

        name: "No Answer",

        percent: savedPercentages.no_answer,

        estimatedCount: savedCounts.no_answer || 0,

        color: colors.no_answer,

      },

      {

        name: "Busy",

        percent: savedPercentages.busy,

        estimatedCount: savedCounts.busy || 0,

        color: colors.busy,

      },

      {

        name: "Invalid / Other",

        percent: savedPercentages.invalid,

        estimatedCount: savedCounts.invalid || 0,

        color: colors.invalid,

      },

    ];

  }

  // No backend estimate available: don't fabricate a report.

  return [];

};

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

  useEffect(() => {

    loadReports();

    const intervalId = setInterval(() => {

      loadReports();

    }, 180000);

    return () => clearInterval(intervalId);

  }, [selectedFilter]);

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

        // ✅ FIX: API se jo val aaye wahi directly use karo

        // Backend already classify karke deta hai (views.py mein fix hai)

        return {

          id: r.id,

          date: new Date(r.created_at).toLocaleDateString(),

          name: r.name || `Campaign ${i + 1}`,

          totalCount: Number(r.total || 0),

          answered: Number(r.success || 0),

          failed: Number(r.failed || 0),

          noAnswer: Number(r.no_answer || 0),

          busy: Number(r.busy || 0),

          invalid: Number(r.invalid || 0),

          jobId: r.job_id || "",

          status: r.status || "",

          callerId: r.caller_id || "",

          estimated: Number(r.total || 0) > 500,

          estimatedCounts:
            Number(r.total || 0) > 500
              ? getEstimatedReport(
                r.total,
                r.id || r.job_id || r.name,
                r.estimated_report
              )
              : null,


          displayCounts: (() => {
            const isEstimated = Number(r.total || 0) > 500;

            const estimate = isEstimated
              ? getEstimatedReport(
                r.total,
                r.id || r.job_id || r.name,
                r.estimated_report
              )
              : [];

            const estimateCount = (label) =>
              estimate.find((item) => item.name === label)?.estimatedCount || 0;

            return isEstimated
              ? {
                answered: estimateCount("Answered"),
                noAnswer: estimateCount("No Answer"),
                busy: estimateCount("Busy"),
                failed: 0,
                invalid: estimateCount("Invalid / Other"),
              }
              : {
                answered: Number(r.success || 0),
                noAnswer: Number(r.no_answer || 0),
                busy: Number(r.busy || 0),
                failed: Number(r.failed || 0),
                invalid: Number(r.invalid || 0),
              };
          })(),

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
    if (String(detailData?.status || "").toLowerCase() !== "done") {
      alert("Campaign abhi pending hai. Complete hone ke baad hi download kar sakte hain.");
      return;
    }

    if (
      !detailData ||
      !detailData.results ||
      detailData.results.length === 0
    ) {
      alert("No data to download ❌");
      return;
    }

    const statusMap = {
      answered: "Answered",
      completed: "Answered",
      normal_clearing: "Answered",
      no_answer: "No Answer",
      "no-answer": "No Answer",
      noanswer: "No Answer",
      busy: "Busy",
      invalid: "Invalid",
      failed: "Failed",
      not_called: "Pending",
      pending: "Pending",
    };

    const isEstimated = Number(detailData.total || 0) > 500;

    const rows = detailData.results.map((r) => {
      const rawStatus = isEstimated
        ? r.estimated_status
        : r.final_status || r.status || "";

      const normalized = String(rawStatus).trim().toLowerCase();

      return {
        Number: r.number || "",
        Status: statusMap[normalized] || "Pending",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 24 },
    ];

    const fileName = `${String(detailData.name || "campaign")
      .replace(/[\\/:*?"<>|]/g, "_")}_report.xlsx`;

    XLSX.writeFile(workbook, fileName);
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

    // Pending campaign: do not show partial results.
    if (String(detailData.status || "").toLowerCase() !== "done") {
      return {
        answered: 0,
        busy: 0,
        noAnswer: 0,
        failed: 0,
        invalid: 0,
      };
    }

    const isEstimated = Number(detailData.total || 0) > 500;

    if (isEstimated) {
      const estimate = getEstimatedReport(
        detailData.total,
        detailData.id || detailData.job_id || detailData.name,
        detailData.estimated_report
      );

      const getCount = (name) =>
        estimate.find((item) => item.name === name)?.estimatedCount || 0;

      return {
        answered: getCount("Answered"),
        noAnswer: getCount("No Answer"),
        busy: getCount("Busy"),
        failed: 0,
        invalid: getCount("Invalid / Other"),
      };
    }

    // Up to 500 numbers: actual Plivo report.
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

                {["Date", "Name", "Status", "Caller ID", "Total", "Answered", "No Answer", "Busy", "Failed", "Invalid", "View"].map((h) => (

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

                <tr><td colSpan="11" className="text-center py-10 text-[13px] text-gray-500">Loading...</td></tr>

              ) : paginated.length === 0 ? (

                <tr><td colSpan="11" className="text-center py-10 text-[13px] text-gray-500">No data available in table</td></tr>

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

                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.estimated ? item.displayCounts.answered : item.answered}</td>

                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.estimated ? item.displayCounts.noAnswer : item.noAnswer}</td>

                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.estimated ? item.displayCounts.busy : item.busy}</td>

                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.estimated ? item.displayCounts.failed : item.failed}</td>

                  <td className="px-3 py-3 border-b border-[#f1f1f1] text-[12.5px]">{item.estimated ? item.displayCounts.invalid : item.invalid}</td>

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

            {Array.from({ length: totalPages }, (_, i) => i + 1)

              .slice(0, 4)

              .map((p) => (

                <button

                  key={p}

                  onClick={() => setPage(p)}

                  className={`w-[30px] h-[30px] rounded-md text-[12px] ${page === p

                    ? "bg-[#3d4b94] text-white"

                    : "border border-[#dcdfe6] text-gray-600"

                    }`}

                >

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
                    disabled={
                      String(detailData.status || "").toLowerCase() !== "done"
                    }
                    title={
                      String(detailData.status || "").toLowerCase() !== "done"
                        ? "Waiting"
                        : "Download Excel"
                    }
                    className="flex items-center gap-2 bg-[#3d4b94] text-white px-5 h-[38px] rounded-md text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={15} />
                    {String(detailData.status || "").toLowerCase() === "done"
                      ? "Download Excel"
                      : "Waiting for completion"}
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
                    <div>
                      <h3 className="text-[14px] font-[600] text-black">
                        Campaign Analytics
                      </h3>
                    </div>

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
                            ].filter((d) => d.value > 0).length > 0
                              ? [
                                { name: "Answered", value: counts.answered },
                                { name: "No Answer", value: counts.noAnswer },
                                { name: "Busy", value: counts.busy },
                                { name: "Invalid", value: counts.invalid },
                              ]
                              : [{ name: "No Data", value: 1 }]}
                            dataKey="value"
                            innerRadius={75}
                            outerRadius={110}
                            paddingAngle={6}
                            animationDuration={2000}
                          >
                            {[
                              "#4baaf5",
                              "#fccc55",
                              "#ff8a00",
                              "#f02424",
                              "#e0e0e0",
                            ].map((color, index) => (
                              <Cell
                                key={index}
                                fill={color}
                                stroke="#fff"
                                strokeWidth={5}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <h2 className="text-[32px] font-[800] text-gray-900">
                          {detailData.total}
                        </h2>
                        <p className="text-[12.5px] text-gray-500 font-medium">
                          Total Calls
                        </p>
                      </div>
                    </div>

                    {/* STATS CARDS */}
                    <div className="space-y-3">
                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#4baaf5] text-[12.5px] font-[600]">
                              Answered Calls
                            </p>
                            <h3 className="text-[22px] font-[800] text-[#4baaf5] mt-1">
                              {counts.answered}
                            </h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#4baaf5]" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#e6b843] text-[12.5px] font-[600]">
                              No Answer
                            </p>
                            <h3 className="text-[22px] font-[800] text-[#e6b843] mt-1">
                              {counts.noAnswer}
                            </h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#fccc55]" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#ff8a00] text-[12.5px] font-[600]">
                              Busy Calls
                            </p>
                            <h3 className="text-[22px] font-[800] text-[#ff8a00] mt-1">
                              {counts.busy}
                            </h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#ff8a00]" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[#e85d75] text-[12.5px] font-[600]">
                              Failed Calls
                            </p>
                            <h3 className="text-[22px] font-[800] text-[#e85d75] mt-1">
                              {counts.failed}
                            </h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-[#e85d75]" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#e2e5ec] rounded-md p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-red-600 text-[12.5px] font-[600]">
                              Invalid Calls
                            </p>
                            <h3 className="text-[22px] font-[800] text-red-700 mt-1">
                              {counts.invalid}
                            </h3>
                          </div>
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ESTIMATED REPORT: only when campaign is done and total > 100 */}
                {String(detailData.status || "").toLowerCase() === "done" &&
                  Number(detailData.total || 0) > 500 && (
                    <div className="bg-white border border-[#e2e5ec] rounded-lg shadow-sm p-5 mb-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-[15px] font-bold text-gray-900">
                          Estimated Report
                        </h3>

                        <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                          Simulated Estimate
                        </span>
                      </div>

                      <div className="space-y-4">
                        {getEstimatedReport(
                          detailData.total,
                          detailData.id || detailData.job_id || detailData.name,
                          detailData.estimated_report
                        ).map((item) => (
                          <div key={item.name}>
                            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-700">
                                {item.name}
                              </span>

                              <span
                                className="text-sm font-bold"
                                style={{ color: item.color }}
                              >
                                {item.percent}%
                              </span>
                            </div>

                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${item.percent}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>

                            <div className="mt-2 text-xs text-gray-500">
                              Estimated calls: {item.estimatedCount.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* DETAIL CARDS GRID */}
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                  {[
                    ["Campaign Status", detailData.status],
                    ["Total", detailData.total],
                    ["Answered", counts.answered],
                    ["No Answer", counts.noAnswer],
                    ["Busy", counts.busy],
                    ["Failed", counts.failed],
                    ["Invalid", counts.invalid],
                    ["Caller ID", detailData.caller_id || "-"],
                    ["Job ID", detailData.job_id || "-"],
                    [
                      "Voice File ID",
                      detailData.voice_file_id || detailData.media_file_id || "-",
                    ],
                  ].map(([label, val], i) => (
                    <div
                      key={i}
                      className="bg-white border border-[#e2e5ec] rounded-md p-4"
                    >
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                        {label}
                      </p>
                      <p className="text-[14px] font-[700] text-gray-800 mt-1 break-all">
                        {val}
                      </p>
                    </div>
                  ))}
                </div>

                {/* RESULTS TABLE */}
                {detailData.results && detailData.results.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-[#e2e5ec]">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="bg-[#f5f6f9]">
                          <th className="px-4 py-3 text-left text-[12px] font-[700] text-gray-700 border-b border-[#eee]">
                            Number
                          </th>
                          <th className="px-4 py-3 text-left text-[12px] font-[700] text-gray-700 border-b border-[#eee]">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {detailData.results.map((r, i) => {
                          const isEstimated = Number(detailData.total || 0) > 500;

                          const rawStatus = isEstimated
                            ? r.estimated_status
                            : r.final_status || r.status || "";

                          const normalized = String(rawStatus || "")
                            .trim()
                            .toLowerCase();

                          const bucket = classifyStatus(rawStatus);

                          const badge =
                            bucket === "answered"
                              ? "bg-green-100 text-green-700"
                              : bucket === "busy"
                                ? "bg-orange-100 text-orange-700"
                                : bucket === "no_answer"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : bucket === "failed"
                                    ? "bg-red-100 text-red-600"
                                    : bucket === "invalid"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-blue-100 text-blue-700";

                          const statusLabels = {
                            answered: "Answered",
                            completed: "Answered",
                            answer: "Answered",
                            normal_clearing: "Answered",
                            no_answer: "No Answer",
                            "no-answer": "No Answer",
                            noanswer: "No Answer",
                            "no answer": "No Answer",
                            busy: "Busy",
                            user_busy: "Busy",
                            invalid: "Invalid",
                            invalid_number: "Invalid",
                            "invalid-number": "Invalid",
                            failed: "Failed",
                            pending: "Pending",
                            not_called: "Pending",
                          };

                          return (
                            <tr
                              key={r.id || i}
                              className="border-b border-[#f1f1f1] hover:bg-[#fafbfc] duration-150"
                            >
                              <td className="px-4 py-3 text-[12.5px] font-[500]">
                                {r.number}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-3 py-1 rounded-full text-[11px] font-bold ${badge}`}
                                >
                                  {statusLabels[normalized] || rawStatus || "Pending"}
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
