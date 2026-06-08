import React, { useState, useCallback } from "react";
import {
  User, Lock, Mail, Phone, Building2, MapPin, ShieldCheck, UserPlus,
} from "lucide-react";

// ==============================
// ALERT MODAL COMPONENT
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
// useAlert HOOK
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

    try {
      const res = await fetch("https://voicecall-8m4p.onrender.com/api/create-user/", {
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
        return;
      }

      const data = await res.json();

      if (data.status !== "success") {
        alert.error(data.message || "Failed to create user.", "Error");
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
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] p-4 md:p-7">

      {/* GLOBAL ALERT RENDERER */}
      <AlertModal alerts={alert.alerts} removeAlert={alert.removeAlert} />

      {/* MAIN CARD */}
      <div className="max-w-[1300px] mx-auto bg-white rounded-[30px] border border-[#ef7fa4] overflow-hidden shadow-sm">

        {/* HEADER */}
        <div className="px-8 py-7 border-b border-[#f5c8d5] bg-[#fffafb]">
          <div className="flex items-center gap-4">
            <div className="w-[62px] h-[62px] rounded-2xl bg-[#fff0f4] border border-[#ef7fa4] flex items-center justify-center">
              <UserPlus size={28} className="text-[#EA7A9A]" />
            </div>
            <div>
              <h1 className="text-[30px] font-[700] text-[#EA7A9A]">Add User</h1>
              <p className="text-[14px] text-gray-500 mt-1">Create reseller or user account</p>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-8">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

              {/* USERNAME */}
              <div>
                <label className="label">Username</label>
                <div className="inputBox">
                  <User size={18} className="icon" />
                  <input type="text" name="username" value={form.username} placeholder="Enter Username" onChange={handleChange} className="input" />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label className="label">Password</label>
                <div className="inputBox">
                  <Lock size={18} className="icon" />
                  <input type="password" name="password" value={form.password} placeholder="Enter Password" onChange={handleChange} className="input" />
                </div>
              </div>

              {/* EMAIL */}
              <div>
                <label className="label">Email Address</label>
                <div className="inputBox">
                  <Mail size={18} className="icon" />
                  <input type="email" name="email" value={form.email} placeholder="Enter Email Address" onChange={handleChange} className="input" />
                </div>
              </div>

              {/* MOBILE */}
              <div>
                <label className="label">Mobile Number</label>
                <div className="inputBox">
                  <Phone size={18} className="icon" />
                  <input type="text" name="mobile" value={form.mobile} placeholder="Enter Mobile Number" onChange={handleChange} className="input" />
                </div>
              </div>

              {/* COMPANY */}
              <div>
                <label className="label">Company Name</label>
                <div className="inputBox">
                  <Building2 size={18} className="icon" />
                  <input type="text" name="company" value={form.company} placeholder="Enter Company Name" onChange={handleChange} className="input" />
                </div>
              </div>

              {/* CITY */}
              <div>
                <label className="label">City</label>
                <div className="inputBox">
                  <MapPin size={18} className="icon" />
                  <input type="text" name="city" value={form.city} placeholder="Enter City" onChange={handleChange} className="input" />
                </div>
              </div>

              {/* ROLE */}
              <div>
                <label className="label">User Role</label>
                <div className="inputBox">
                  <ShieldCheck size={18} className="icon" />
                  <select name="role" value={form.role} onChange={handleChange} className="input bg-transparent">
                    <option value="User">User</option>
                    <option value="Reseller">Reseller</option>
                  </select>
                </div>
              </div>

            </div>

            {/* BUTTON */}
            <div className="mt-8 flex justify-end">
              <button type="submit"
                className="h-[56px] px-10 rounded-2xl bg-[#EA7A9A] hover:bg-[#e3688b] duration-300 text-white text-[16px] font-semibold shadow-sm">
                Add User
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CSS */}
      <style>{`
        .label { display:block; margin-bottom:10px; font-size:14px; font-weight:600; color:#EA7A9A; }
        .inputBox { width:100%; height:58px; border:1px solid #ef7fa4; border-radius:18px; background:#fffafb; display:flex; align-items:center; padding:0 18px; transition:0.3s; }
        .inputBox:focus-within { border:1px solid #EA7A9A; background:white; box-shadow:0 0 0 4px rgba(234,122,154,0.10); }
        .icon { color:#EA7A9A; min-width:18px; }
        .input { width:100%; height:100%; border:none; outline:none; background:transparent; padding-left:14px; font-size:15px; color:#111827; }
        .input::placeholder { color:#9ca3af; }
      `}</style>
    </div>
  );
};

export default AddUser;