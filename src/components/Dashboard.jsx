import React, { useEffect, useState, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  PhoneCall, PhoneOff, PhoneIncoming, PhoneMissed, RefreshCw, ChevronDown,
} from "lucide-react";
import { BASE } from "./api";

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const target = value;
    const start = prev.current;
    prev.current = target;
    if (start === target) return;
    const steps = 40;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplay(Math.round(start + (target - start) * (i / steps)));
      if (i >= steps) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1.5px solid #fde0ea", borderRadius: 14,
      padding: "10px 16px", fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif",
      boxShadow: "0 8px 24px rgba(210,70,110,.10)",
    }}>
      <p style={{ color: "#b0b4c0", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "3px 0", fontWeight: 600 }}>
          {p.name}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ✅ Single classify function — same as backend
function classifyStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "completed" || s === "answered") return "answered";
  if (s === "busy") return "busy";
  if (["no-answer", "no_answer", "noanswer", "no answer", "rejected", "cancelled", "canceled"].includes(s))
    return "no_answer";
  if (s === "failed") return "failed";
  return "pending";
}

export default function Dashboard() {
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("Today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [total, setTotal] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [busy, setBusy] = useState(0);
  const [noAnswer, setNoAnswer] = useState(0);
  const [failed, setFailed] = useState(0);

  const [barData, setBarData] = useState([]);
  const [chartTab, setChartTab] = useState("bar");

  const filters = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom Range"];

  const handleFilter = (f) => { setSelectedFilter(f); setShowFilter(false); };

  useEffect(() => { loadData(); }, [selectedFilter, fromDate, toDate]);

  const loadData = async () => {
    try {
      const userId = sessionStorage.getItem("user_id");
      const res = await fetch(`${BASE}/get-campaigns/?user_id=${userId}`);
      const reports = await res.json();
      const now = new Date();

      const filtered = reports.filter((r) => {
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
        if (selectedFilter === "Custom Range" && fromDate && toDate)
          return d >= new Date(fromDate) && d <= new Date(toDate + "T23:59:59");
        return true;
      });

      let t = 0,
        s = 0,
        busyCount = 0,
        noAnswerCount = 0,
        failedCount = 0;


      filtered.forEach((r) => {
        t += Number(r.total || 0);

        // ✅ FIX: API se jo values aaye wahi use karo directly
        // Backend already classify karke de raha hai
        s += Number(r.success || 0);
        busyCount += Number(r.busy || 0);
        noAnswerCount += Number(r.no_answer || 0);
        failedCount += Number(r.failed || 0);
      });

      setTotal(t);
      setAnswered(s);
      setBusy(busyCount);
      setNoAnswer(noAnswerCount);
      setFailed(failedCount);

      // Bar chart — last 7 days
      const dayMap = {};
      WEEK.forEach(d => {
        dayMap[d] = { day: d, Answered: 0, "No Answer": 0, Busy: 0 };
      });

      const last7 = reports.filter((r) => {
        const d = new Date(r.created_at);
        const p = new Date(); p.setDate(p.getDate() - 7);
        return d >= p;
      });

      last7.forEach((r) => {
        const dow = new Date(r.created_at).getDay();
        const dayName = WEEK[dow === 0 ? 6 : dow - 1];
        if (dayMap[dayName]) {
          dayMap[dayName].Answered += Number(r.success || 0);
          dayMap[dayName]["No Answer"] += Number(r.no_answer || 0);
          dayMap[dayName].Busy += Number(r.busy || 0);
        }
      });

      setBarData(Object.values(dayMap));

    } catch (err) {
      console.log(err);
    }
  };

  const successRate = total > 0 ? Math.round((answered / total) * 100) : 0;

  const pieData = [
    { name: "Answered", value: answered },
    { name: "No Answer", value: noAnswer },
    { name: "Busy", value: busy },
    { name: "Failed", value: failed },
  ];

  // Pie mein saare zero hain to placeholder dikhao
  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);
  const safePie = pieTotal > 0 ? pieData : [{ name: "No Data", value: 1 }];

  const stats = [
    { label: "Total Calls", value: total, co: "#d94f78", bg: "#fff7f9", icon: PhoneCall },
    { label: "Answered", value: answered, co: "#c2446b", bg: "#fdf5f8", icon: PhoneIncoming },
    { label: "No Answer", value: noAnswer, co: "#a83070", bg: "#fcf3fa", icon: PhoneOff },
    { label: "Busy", value: busy, co: "#8b2a6e", bg: "#f9f0fd", icon: PhoneMissed },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .db { font-family:'Plus Jakarta Sans',sans-serif; padding:18px; background:#fefafb; min-height:100vh; }
        .db-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media(max-width:860px){ .db-grid{grid-template-columns:1fr;} }
        .db-panel { background:#fff; border-radius:28px; border:1.5px solid #fde0ea; overflow:hidden; position:relative; }
        .db-head { padding:14px 20px; border-bottom:1.5px solid #fdedf4; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .db-title { font-size:16px; font-weight:700; color:#1a1a2e; letter-spacing:-.2px; }
        .db-sub   { font-size:12px; color:#c0b4bc; margin-top:2px; }
        .db-fw { position:relative; }
        .db-fbtn { display:flex; align-items:center; gap:7px; height:38px; padding:0 16px; border-radius:50px; background:#fffbfc; border:1.5px solid #ffd6e4; color:#d94f78; font-size:13px; font-weight:600; cursor:pointer; transition:background .2s; font-family:'Plus Jakarta Sans',sans-serif; }
        .db-fbtn:hover { background:#fde8f0; }
        .db-fdrop { position:absolute; top:46px; right:0; z-index:99; background:#fff; border:1.5px solid #fde0ea; border-radius:16px; overflow:hidden; min-width:170px; box-shadow:0 16px 40px rgba(210,70,110,.12); }
        .db-fitem { padding:11px 18px; font-size:13px; cursor:pointer; color:#374151; transition:background .15s; font-family:'Plus Jakarta Sans',sans-serif; }
        .db-fitem:hover { background:#fff5f8; color:#d94f78; }
        .db-dates { display:flex; gap:10px; padding:14px 26px 0; }
        .db-date { height:40px; border:1.5px solid #ffd6e4; border-radius:12px; background:#fff8fa; color:#374151; padding:0 14px; font-size:13px; outline:none; font-family:'Plus Jakarta Sans',sans-serif; }
        .db-date:focus { border-color:#d94f78; }
        .db-refresh { width:38px; height:38px; border-radius:12px; background:#fffbfc; border:1.5px solid #ffd6e4; color:#d94f78; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; }
        .db-refresh:hover { background:#fde0ea; transform:rotate(45deg); }
        .db-pie-body { position:relative; height:320px; display:flex; align-items:center; justify-content:center; }
        .db-pie-center { position:absolute; display:flex; flex-direction:column; align-items:center; background:#fff; border:1.5px solid #fde0ea; border-radius:24px; padding:18px 28px; pointer-events:none; box-shadow:0 4px 20px rgba(210,70,110,.08); }
        .db-pie-num { font-size:46px; font-weight:800; color:#d94f78; line-height:1; }
        .db-pie-lbl { font-size:12px; color:#c0b4bc; margin-top:3px; }
        .db-ftag { position:absolute; background:#fff; border:1.5px solid var(--bd); border-radius:18px; padding:11px 16px; box-shadow:0 4px 16px rgba(0,0,0,.06); animation:fadeUp .5s ease both; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .db-ftag-lbl { font-size:11px; color:#c0b4bc; font-weight:500; }
        .db-ftag-val { font-size:24px; font-weight:800; color:var(--co); line-height:1.1; margin-top:2px; }
        .db-legend { position:absolute; bottom:16px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
        .db-pill { display:flex; align-items:center; gap:7px; background:#fff; border:1.5px solid #fdeef4; padding:6px 14px; border-radius:50px; font-size:12px; font-weight:600; color:#374151; }
        .db-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .db-stat-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-top:1.5px solid #fdeef4; }
        .db-stat-cell { padding:10px 14px; border-right:1.5px solid #fdeef4; }
        .db-stat-cell:last-child { border-right:none; }
        .db-stat-ico { width:32px; height:32px; border-radius:10px; background:var(--bg); display:flex; align-items:center; justify-content:center; margin-bottom:8px; }
        .db-stat-v { font-size:20px; font-weight:800; color:var(--co); line-height:1; }
        .db-stat-l { font-size:10px; color:#c0b4bc; margin-top:2px; font-weight:500; }
        .db-tabs { display:flex; gap:8px; }
        .db-tab { height:34px; padding:0 16px; border-radius:50px; font-size:12px; font-weight:600; cursor:pointer; border:1.5px solid #ffd6e4; transition:all .2s; font-family:'Plus Jakarta Sans',sans-serif; }
        .db-tab-on  { background:#d94f78; color:#fff; border-color:#d94f78; }
        .db-tab-off { background:#fffbfc; color:#d94f78; }
        .db-tab-off:hover { background:#fde8f0; }
        .db-chart-body { padding:16px 12px 8px; height:230px; }
        .db-sum-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; padding:0 20px 14px; }
        .db-sum-card { background:#fffbfc; border:1.5px solid #ffd6e4; border-radius:18px; padding:14px 16px; display:flex; align-items:center; gap:12px; }
        .db-sum-ico { width:38px; height:38px; border-radius:12px; background:#fff; border:1.5px solid #ffd6e4; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .db-sum-v { font-size:22px; font-weight:800; color:var(--co); line-height:1; }
        .db-sum-l { font-size:11px; color:#c0b4bc; margin-top:2px; }
        .db-rate-wrap { margin:0 20px 14px; }
        .db-rate-head { display:flex; justify-content:space-between; margin-bottom:8px; }
        .db-rate-lbl { font-size:12px; color:#b0b4c0; }
        .db-rate-pct { font-size:13px; font-weight:700; color:#d94f78; }
        .db-track { height:8px; background:#fdeef4; border-radius:99px; overflow:hidden; }
        .db-fill { height:100%; background:linear-gradient(90deg,#e8607a,#f4a8c0); border-radius:99px; transition:width 1.2s cubic-bezier(.4,0,.2,1); }
        .db-live { display:inline-flex; align-items:center; gap:6px; background:#fffbfc; border:1.5px solid #ffd6e4; color:#d94f78; font-size:11px; font-weight:600; padding:5px 14px; border-radius:50px; }
        .db-live-dot { width:6px; height:6px; border-radius:50%; background:#d94f78; animation:lp 1.5s infinite; }
        @keyframes lp { 0%,100%{opacity:1}50%{opacity:.3} }
      `}</style>

      <div className="db">
        <div className="db-grid">

          {/* LEFT PANEL */}
          <div className="db-panel">
            <div className="db-head">
              <div>
                <div className="db-title">Complete Status</div>
                <div className="db-sub">Campaign performance overview</div>
              </div>
              <div className="db-fw">
                <button className="db-fbtn" onClick={() => setShowFilter(!showFilter)}>
                  {selectedFilter} <ChevronDown size={14} />
                </button>
                {showFilter && (
                  <div className="db-fdrop">
                    {filters.map((f, i) => (
                      <div key={i} className="db-fitem" onClick={() => handleFilter(f)}>{f}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedFilter === "Custom Range" && (
              <div className="db-dates">
                <input type="date" className="db-date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <input type="date" className="db-date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            )}

            <div className="db-pie-body">
              <div style={{ width: "100%", height: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="gF2" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#e8607a" /><stop offset="100%" stopColor="#f4a8c0" />
                      </linearGradient>
                      <linearGradient id="gA2" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#c2446b" /><stop offset="100%" stopColor="#e890b4" />
                      </linearGradient>
                      <linearGradient id="gB2" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8b2a6e" /><stop offset="100%" stopColor="#d8a0d0" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={safePie}
                      innerRadius={80} outerRadius={115}
                      paddingAngle={5} cornerRadius={12}
                      dataKey="value" cx="50%" cy="50%"
                      animationBegin={0} animationDuration={900}
                    >
                      {safePie.map((_, i) => {
                        const fills = ["url(#gF2)", "url(#gA2)", "url(#gB2)", "#e0e0e0"];
                        return <Cell key={i} fill={fills[i] || fills[0]} stroke="none" />;
                      })}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="db-pie-center">
                <div className="db-pie-num"><CountUp value={total} /></div>
                <div className="db-pie-lbl">Total Calls</div>
              </div>

              <div className="db-ftag" style={{ left: 14, top: 28, "--co": "#e8607a", "--bd": "#ffd6e4" }}>
                <div className="db-ftag-lbl">No Answer</div>
                <div className="db-ftag-val"><CountUp value={noAnswer} /></div>
              </div>
              <div className="db-ftag" style={{ right: 14, top: 28, "--co": "#c2446b", "--bd": "#f9d0e8" }}>
                <div className="db-ftag-lbl">Answered</div>
                <div className="db-ftag-val"><CountUp value={answered} /></div>
              </div>

              <div className="db-legend">
                <div className="db-pill"><div className="db-dot" style={{ background: "#e8607a" }} />No Answer</div>
                <div className="db-pill"><div className="db-dot" style={{ background: "#c2446b" }} />Answered</div>
                <div className="db-pill"><div className="db-dot" style={{ background: "#8b2a6e" }} />Busy</div>
              </div>
            </div>

            <div className="db-stat-row">
              {stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div className="db-stat-cell" key={i} style={{ "--co": s.co, "--bg": s.bg }}>
                    <div className="db-stat-ico"><Icon size={16} style={{ color: s.co }} /></div>
                    <div className="db-stat-v"><CountUp value={s.value} /></div>
                    <div className="db-stat-l">{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="db-panel">
            <div className="db-head">
              <div>
                <div className="db-title">Calls in Queue</div>
                <div className="db-sub">Live analytics & distribution</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="db-tabs">
                  <button className={`db-tab ${chartTab === "bar" ? "db-tab-on" : "db-tab-off"}`} onClick={() => setChartTab("bar")}>Bar</button>
                  <button className={`db-tab ${chartTab === "area" ? "db-tab-on" : "db-tab-off"}`} onClick={() => setChartTab("area")}>Area</button>
                </div>
                <button className="db-refresh" onClick={loadData}><RefreshCw size={15} /></button>
              </div>
            </div>

            <div className="db-chart-body">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === "bar" ? (
                  <BarChart data={barData} barCategoryGap="30%" barGap={4}>
                    <defs>
                      <linearGradient id="bA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d94f78" /><stop offset="100%" stopColor="#f4a8c0" />
                      </linearGradient>
                      <linearGradient id="bF" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c2446b" /><stop offset="100%" stopColor="#e8a0c0" />
                      </linearGradient>
                      <linearGradient id="bI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a83070" /><stop offset="100%" stopColor="#d8a0d0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fdeef4" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#c0b4bc", fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#c0b4bc", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "#fff5f8" }} />
                    <Bar dataKey="Answered" fill="url(#bA)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="No Answer" fill="url(#bF)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Busy" fill="url(#bI)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={barData}>
                    <defs>
                      <linearGradient id="aA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d94f78" stopOpacity={0.25} /><stop offset="100%" stopColor="#d94f78" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="aF" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c2446b" stopOpacity={0.22} /><stop offset="100%" stopColor="#c2446b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="aI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a83070" stopOpacity={0.18} /><stop offset="100%" stopColor="#a83070" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fdeef4" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#c0b4bc", fontSize: 12, fontFamily: "'Plus Jakarta Sans',sans-serif" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#c0b4bc", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="Answered" stroke="#d94f78" strokeWidth={2.5} fill="url(#aA)" dot={false} />
                    <Area type="monotone" dataKey="No Answer" stroke="#c2446b" strokeWidth={2} fill="url(#aF)" dot={false} />
                    <Area type="monotone" dataKey="Busy" stroke="#a83070" strokeWidth={2} fill="url(#aI)" dot={false} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", gap: 8, padding: "0 20px 16px", flexWrap: "wrap" }}>
              {[["#d94f78", "Answered"], ["#c2446b", "No Answer"], ["#a83070", "Busy"]].map(([co, lbl]) => (
                <div className="db-pill" key={lbl}><div className="db-dot" style={{ background: co }} />{lbl}</div>
              ))}
              <div style={{ marginLeft: "auto" }}>
                <div className="db-live"><div className="db-live-dot" />Live</div>
              </div>
            </div>

            <div className="db-sum-grid">
              {[
                { label: "Total", value: total, co: "#d94f78", icon: PhoneCall },
                { label: "Answered", value: answered, co: "#c2446b", icon: PhoneIncoming },
                { label: "No Answer", value: noAnswer, co: "#a83070", icon: PhoneOff },
                { label: "Busy", value: busy, co: "#8b2a6e", icon: PhoneMissed },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div className="db-sum-card" key={i} style={{ "--co": s.co }}>
                    <div className="db-sum-ico"><Icon size={16} style={{ color: s.co }} /></div>
                    <div>
                      <div className="db-sum-v"><CountUp value={s.value} /></div>
                      <div className="db-sum-l">{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="db-rate-wrap">
              <div className="db-rate-head">
                <span className="db-rate-lbl">Overall success rate</span>
                <span className="db-rate-pct">{successRate}%</span>
              </div>
              <div className="db-track">
                <div className="db-fill" style={{ width: `${successRate}%` }} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}