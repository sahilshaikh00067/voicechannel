import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search, Wallet } from "lucide-react";
import { BASE } from "../api";

const CreditHistory = () => {
  const [creditData, setCreditData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showEntries, setShowEntries] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => { loadCreditData(); }, []);

  const loadCreditData = async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/credit-history/?user_id=${userId}`);
      const data = await res.json();

      if (!data || data.length === 0) { setCreditData([]); setLoading(false); return; }

      const formatted = data.map((item, index) => ({
        id: index + 1,
        date: new Date(item.created_at).toLocaleString(),
        funds: item.credit || 0,
        creditType:
          item.type === "credit"
            ? "Credit"
            : "Debit",
        remarks: item.remarks || `Credit Credited from Admin To UserName : ${item.username || "User"}`,
      }));

      setCreditData(formatted);
    } catch (err) {
      console.log(err);
      setCreditData([]);
    }
    setLoading(false);
  };

  const filteredData = creditData.filter((item) =>
    item.remarks?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / showEntries);
  const paginated = filteredData.slice((page - 1) * showEntries, page * showEntries);

  const handleExport = () => {
    if (filteredData.length === 0) { alert("No Data Found ❌"); return; }
    const rows = [["Date", "Funds", "Credit Type", "Remarks"].join(",")];
    filteredData.forEach((row) => {
      rows.push([row.date, row.funds, row.creditType, `"${row.remarks}"`].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "credit-report.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-[#f4f5f8] p-3 md:p-6 overflow-x-hidden">
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden">

        {/* HEADER */}
        <div className="px-5 md:px-7 py-6 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-[46px] h-[46px] rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <Wallet size={22} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-[19px] font-[700] text-slate-900 leading-tight">Credit History</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">View all credit and debit transactions</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
            <div className="flex items-center gap-2 text-[13.5px] text-slate-700">
              <span>Show</span>
              <select value={showEntries} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1); }}
                className="w-[68px] h-[38px] border border-slate-300 rounded-lg px-2 bg-white outline-none text-[13.5px]">
                <option value="10">10</option><option value="25">25</option><option value="50">50</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleExport}
                className="h-[38px] px-5 rounded-lg bg-emerald-500 hover:bg-emerald-600 duration-200 text-white text-[13.5px] font-semibold flex items-center gap-2 shadow-sm">
                <Download size={16} /> Export
              </button>
              <span className="text-[13.5px] text-slate-700">Search:</span>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search remarks" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-[180px] md:w-[240px] h-[38px] border border-slate-300 rounded-lg bg-white pl-9 pr-3 outline-none text-[13.5px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50" />
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {["Date", "Funds", "Credit Type", "Remarks"].map((h, i) => (
                    <th key={i} className="px-3 py-3.5 border-b border-r border-slate-200 text-left text-[12.5px] font-[700] text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-12 text-[14px] text-slate-500">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-12 text-[14px] text-slate-500">No data available in table</td></tr>
                ) : paginated.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3.5 border-b border-r border-slate-100 text-[13px] text-slate-600 whitespace-nowrap">{item.date}</td>
                    <td className="px-3 py-3.5 border-b border-r border-slate-100 text-[13px] text-slate-900 font-medium whitespace-nowrap">{item.funds}</td>
                    <td className="px-3 py-3.5 border-b border-r border-slate-100 whitespace-nowrap">
                      <span className={`px-3 h-[26px] inline-flex items-center rounded-full text-[11.5px] font-semibold border ${item.creditType === "Credit" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                        {item.creditType}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 border-b border-slate-100 text-[13px] text-slate-700 min-w-[600px]">{item.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between flex-wrap gap-4 mt-5">
            <div className="text-[13px] text-slate-600">
              Showing {filteredData.length === 0 ? 0 : (page - 1) * showEntries + 1} to{" "}
              {Math.min(page * showEntries, filteredData.length)} of {filteredData.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-[38px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1 text-[13px] font-semibold shadow-sm duration-200">
                <ChevronLeft size={15} /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="h-[38px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1 text-[13px] font-semibold shadow-sm duration-200">
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditHistory;