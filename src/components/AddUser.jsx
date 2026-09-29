import React, { useState, useCallback } from "react";
import {
  User, Lock, Mail, Phone, Building2, MapPin, UserPlus, Loader2,
} from "lucide-react";

// ==============================
// ALERT MODAL COMPONENT (unchanged)
// ==============================
const AlertModal = ({ alerts, removeAlert }) => {
  const iconMap = {
    success: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  };

  const colorMap = {
    success: { bg:"#f0fdf4", border:"#86efac", icon:"#16a34a", title:"#15803d", text:"#166534", btn:"#16a34a", btnHover:"#15803d", bar:"#22c55e" },
    error:   { bg:"#fff1f2", border:"#fda4af", icon:"#e11d48", title:"#be123c", text:"#9f1239", btn:"#e11d48", btnHover:"#be123c", bar:"#f43f5e" },
    warning: { bg:"#fffbeb", border:"#fcd34d", icon:"#d97706", title:"#b45309", text:"#92400e", btn:"#d97706", btnHover:"#b45309", bar:"#f59e0b" },
  };

  return (
    <>
      <style>{`
        @keyframes alertSlideIn { from{opacity:0;transform:translateY(-40px) scale(0.92)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes alertSlideOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(-40px) scale(0.92)} }
        @keyframes progressBar { from{width:100%} to{width:0%} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        .au-alert-box { animation: alertSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .au-alert-box.removing { animation: alertSlideOut 0.25s ease-in forwards; }
        .au-close-x:hover { opacity:0.75; transform:scale(1.1); }
        .au-ok-btn { transition:all 0.2s; }
        .au-ok-btn:hover { transform:scale(1.04); }
      `}</style>

      {alerts.map((al) => {
        const c = colorMap[al.type] || colorMap.success;
        return (
          <div key={al.id}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", animation:"backdropIn 0.2s ease forwards" }}
            onClick={() => removeAlert(al.id)}
          >
            <div
              className={`au-alert-box${al.removing ? " removing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              style={{ background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:20, padding:"36px 40px 30px", maxWidth:420, width:"90%", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:"0 25px 60px rgba(0,0,0,0.18),0 8px 20px rgba(0,0,0,0.1)" }}
            >
              <div style={{ position:"absolute", top:0, left:0, height:4, background:c.bar, borderRadius:"20px 20px 0 0", animation:`progressBar ${al.duration||3500}ms linear forwards` }} />
              <button className="au-close-x" onClick={() => removeAlert(al.id)}
                style={{ position:"absolute", top:14, right:14, background:"none", border:"none", cursor:"pointer", color:c.icon, fontSize:20, lineHeight:1, transition:"all 0.2s", padding:4 }}>
                ✕
              </button>
              <div style={{ width:64, height:64, borderRadius:"50%", background:`${c.border}55`, border:`2px solid ${c.border}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", color:c.icon }}>
                {iconMap[al.type]}
              </div>
              {al.title && <h3 style={{ margin:"0 0 8px", fontSize:20, fontWeight:700, color:c.title, letterSpacing:"-0.3px" }}>{al.title}</h3>}
              <p style={{ margin:"0 0 24px", fontSize:15, color:c.text, lineHeight:1.6, whiteSpace:"pre-line" }}>{al.message}</p>
              <button className="au-ok-btn" onClick={() => removeAlert(al.id)}
                style={{ background:c.btn, color:"#fff", border:"none", borderRadius:12, padding:"11px 40px", fontSize:15, fontWeight:600, cursor:"pointer" }}
                onMouseEnter={(e) => { e.target.style.background = c.btnHover; }}
                onMouseLeave={(e) => { e.target.style.background = c.btn; }}>
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
// useAlert HOOK (unchanged)
// ==============================
const useAlert = () => {
  const [alerts, setAlerts] = useState([]);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, removing: true } : a));
    setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), 280);
  }, []);

  const showAlert = useCallback(({ type = "success", title, message, duration = 3500 }) => {
    const id = Date.now() + Math.random();
    setAlerts((prev) => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => removeAlert(id), duration);
  }, [removeAlert]);

  const success = (message, title = "Success!") => showAlert({ type: "success", title, message });
  const error   = (message, title = "Error!")   => showAlert({ type: "error",   title, message });
  const warning = (message, title = "Warning!") => showAlert({ type: "warning", title, message });

  return { alerts, removeAlert, success, error, warning };
};

// ==============================
// ADD USER COMPONENT
// ==============================
const AddUser = () => {
  const alert = useAlert();

  const [form, setForm] = useState({
    username: "", password: "", email: "", mobile: "", company: "", city: "", role: "User",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const currentUser = JSON.parse(sessionStorage.getItem("user"));

  // ==============================
  // SUBMIT
  // ==============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username) {
      alert.warning("Please enter a username.", "Username Required");
      return;
    }
    if (!form.password) {
      alert.warning("Please enter a password.", "Password Required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("https://voice-backend-bqji.onrender.com/api/create-user/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          role: form.role.toLowerCase(),
          parent: currentUser?.username || null,
          created_by: currentUser?.id,
        }),
      });

      if (!res.ok) {
        alert.error("Server error. Please try again.", "Server Error");
        setSubmitting(false);
        return;
      }

      const data = await res.json();

      if (data.status !== "success") {
        alert.error(data.message || "Failed to create user.", "Error");
        setSubmitting(false);
        return;
      }

      // Save to localStorage
      const newUser = {
        id: data.user_id,
        username: form.username,
        password: form.password,
        role: form.role.toLowerCase(),
        parent: currentUser?.username,
        status: "Active",
        credit: 0,
      };

      const oldUsers = JSON.parse(localStorage.getItem("users")) || [];
      localStorage.setItem("users", JSON.stringify([newUser, ...oldUsers]));

      alert.success(`User "${form.username}" created successfully!`, "User Added");

      // Reset form
      setForm({ username: "", password: "", email: "", mobile: "", company: "", city: "", role: "User" });

    } catch (err) {
      console.log(err);
      alert.error("Network error. Please check your connection.", "Network Error");
    }
    setSubmitting(false);
  };

  const fields = [
    { name: "username", label: "Username", type: "text", icon: User, placeholder: "Enter Username" },
    { name: "password", label: "Password", type: "password", icon: Lock, placeholder: "Enter Password" },
    { name: "email", label: "Email Address", type: "email", icon: Mail, placeholder: "Enter Email Address" },
    { name: "mobile", label: "Mobile Number", type: "text", icon: Phone, placeholder: "Enter Mobile Number" },
    { name: "company", label: "Company Name", type: "text", icon: Building2, placeholder: "Enter Company Name" },
    { name: "city", label: "City", type: "text", icon: MapPin, placeholder: "Enter City" },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f8] p-4 md:p-8">

      {/* GLOBAL ALERT RENDERER */}
      <AlertModal alerts={alert.alerts} removeAlert={alert.removeAlert} />

      {/* BREADCRUMB */}
      <div className="max-w-[1100px] mx-auto mb-4 flex items-center gap-2 text-[13px] text-slate-500">
        <span>Users</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-medium">Add New</span>
      </div>

      {/* MAIN CARD */}
      <div className="max-w-[1100px] mx-auto bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden">

        {/* HEADER */}
        <div className="px-7 py-6 border-b border-slate-200 flex items-center gap-4">

          <div className="w-[46px] h-[46px] rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <UserPlus size={22} className="text-indigo-600" />
          </div>

          <div>
            <h1 className="text-[19px] font-[700] text-slate-900 leading-tight">
              Add User
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Create a new Reseller or User account under your organization
            </p>
          </div>

        </div>

        {/* BODY */}
        <div className="p-7">

          <form onSubmit={handleSubmit}>

            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">

              {fields.map(({ name, label, type, icon: Icon, placeholder }) => (
                <div key={name}>
                  <label className="block mb-1.5 text-[13px] font-medium text-slate-700">
                    {label}
                  </label>
                  <div className="flex items-center h-[44px] rounded-lg border border-slate-300 bg-white px-3 gap-2.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50">
                    <Icon size={16} className="text-slate-400 shrink-0" />
                    <input
                      type={type}
                      name={name}
                      value={form[name]}
                      placeholder={placeholder}
                      onChange={handleChange}
                      className="w-full h-full bg-transparent outline-none text-[14px] text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ))}

              {/* ROLE — segmented toggle */}
              <div>
                <label className="block mb-1.5 text-[13px] font-medium text-slate-700">
                  User Role
                </label>
                <div className="h-[44px] rounded-lg border border-slate-300 bg-slate-50 p-1 flex gap-1">
                  {["User", "Reseller"].map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setForm((f) => ({ ...f, role: r }))}
                      className={`flex-1 rounded-md text-[13.5px] font-medium transition ${
                        form.role === r
                          ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* BUTTON */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="h-[44px] px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 duration-200 disabled:opacity-60 text-white text-[14px] font-semibold shadow-sm flex items-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? "Adding User..." : "Add User"}
              </button>
            </div>

          </form>

        </div>

      </div>

    </div>
  );
};

export default AddUser;