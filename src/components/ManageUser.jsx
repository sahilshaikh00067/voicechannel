import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, KeyRound, Pencil, Users, Wallet, Trash2 } from "lucide-react";
import { BASE } from "./api";

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
    info: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    confirm: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  const colorMap = {
    success: { bg:"#f0fdf4", border:"#86efac", icon:"#16a34a", title:"#15803d", text:"#166534", btn:"#16a34a", btnHover:"#15803d", bar:"#22c55e" },
    error:   { bg:"#fff1f2", border:"#fda4af", icon:"#e11d48", title:"#be123c", text:"#9f1239", btn:"#e11d48", btnHover:"#be123c", bar:"#f43f5e" },
    info:    { bg:"#eff6ff", border:"#93c5fd", icon:"#2563eb", title:"#1d4ed8", text:"#1e40af", btn:"#2563eb", btnHover:"#1d4ed8", bar:"#3b82f6" },
    warning: { bg:"#fffbeb", border:"#fcd34d", icon:"#d97706", title:"#b45309", text:"#92400e", btn:"#d97706", btnHover:"#b45309", bar:"#f59e0b" },
    confirm: { bg:"#f0f9ff", border:"#7dd3fc", icon:"#0284c7", title:"#0369a1", text:"#075985", btn:"#22c55e", btnHover:"#15803d", btn2:"#ef4444", btn2Hover:"#dc2626", bar:"#38bdf8" },
  };

  return (
    <>
      <style>{`
        @keyframes alertSlideIn { from{opacity:0;transform:translateY(-40px) scale(0.92)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes alertSlideOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(-40px) scale(0.92)} }
        @keyframes progressBar { from{width:100%} to{width:0%} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        .alert-box { animation: alertSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .alert-box.removing { animation: alertSlideOut 0.25s ease-in forwards; }
        .alert-close-x:hover { opacity:0.75; transform:scale(1.1); }
        .alert-btn { transition: all 0.2s; }
        .alert-btn:hover { transform: scale(1.04); }
      `}</style>

      {alerts.map((al) => {
        const c = colorMap[al.type] || colorMap.info;
        return (
          <div
            key={al.id}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)", WebkitBackdropFilter:"blur(4px)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", animation:"backdropIn 0.2s ease forwards" }}
            onClick={() => !al.confirm && removeAlert(al.id)}
          >
            <div
              className={`alert-box${al.removing ? " removing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              style={{ background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:20, padding:"36px 40px 30px", maxWidth:420, width:"90%", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:"0 25px 60px rgba(0,0,0,0.18),0 8px 20px rgba(0,0,0,0.1)" }}
            >
              {!al.confirm && (
                <div style={{ position:"absolute", top:0, left:0, height:4, background:c.bar, borderRadius:"20px 20px 0 0", animation:`progressBar ${al.duration||3500}ms linear forwards` }} />
              )}
              {!al.confirm && (
                <button className="alert-close-x" onClick={() => removeAlert(al.id)}
                  style={{ position:"absolute", top:14, right:14, background:"none", border:"none", cursor:"pointer", color:c.icon, fontSize:20, lineHeight:1, transition:"all 0.2s", padding:4 }}>
                  ✕
                </button>
              )}
              <div style={{ width:64, height:64, borderRadius:"50%", background:`${c.border}55`, border:`2px solid ${c.border}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", color:c.icon }}>
                {iconMap[al.type]}
              </div>
              {al.title && <h3 style={{ margin:"0 0 8px", fontSize:20, fontWeight:700, color:c.title, letterSpacing:"-0.3px" }}>{al.title}</h3>}
              <p style={{ margin:"0 0 24px", fontSize:15, color:c.text, lineHeight:1.6, whiteSpace:"pre-line" }}>{al.message}</p>

              {al.confirm ? (
                <div style={{ display:"flex", justifyContent:"center", gap:12 }}>
                  <button className="alert-btn" onClick={() => { al.onCancel?.(); removeAlert(al.id); }}
                    style={{ background:c.btn2, color:"#fff", border:"none", borderRadius:12, padding:"11px 32px", fontSize:15, fontWeight:600, cursor:"pointer" }}>
                    {al.cancelText || "No"}
                  </button>
                  <button className="alert-btn" onClick={() => { al.onConfirm?.(); removeAlert(al.id); }}
                    style={{ background:c.btn, color:"#fff", border:"none", borderRadius:12, padding:"11px 32px", fontSize:15, fontWeight:600, cursor:"pointer" }}>
                    {al.confirmText || "Yes"}
                  </button>
                </div>
              ) : (
                <button className="alert-btn" onClick={() => removeAlert(al.id)}
                  style={{ background:c.btn, color:"#fff", border:"none", borderRadius:12, padding:"11px 40px", fontSize:15, fontWeight:600, cursor:"pointer" }}
                  onMouseEnter={(e) => { e.target.style.background = c.btnHover; }}
                  onMouseLeave={(e) => { e.target.style.background = c.btn; }}>
                  OK
                </button>
              )}
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

  const showAlert = useCallback(({ type = "info", title, message, duration = 3500, confirm = false, onConfirm, onCancel, confirmText, cancelText }) => {
    const id = Date.now() + Math.random();
    setAlerts((prev) => [...prev, { id, type, title, message, duration, confirm, onConfirm, onCancel, confirmText, cancelText }]);
    if (!confirm) setTimeout(() => removeAlert(id), duration);
  }, [removeAlert]);

  const success = (message, title = "Success!") => showAlert({ type: "success", title, message });
  const error   = (message, title = "Error!")   => showAlert({ type: "error",   title, message });
  const info    = (message, title = "Info")     => showAlert({ type: "info",    title, message });
  const warning = (message, title = "Warning!") => showAlert({ type: "warning", title, message });
  const confirm = ({ message, title = "Confirm?", onConfirm, onCancel, confirmText = "Yes", cancelText = "No" }) =>
    showAlert({ type: "confirm", title, message, confirm: true, onConfirm, onCancel, confirmText, cancelText });

  return { alerts, removeAlert, success, error, info, warning, confirm };
};

// ==============================
// MANAGE USER COMPONENT
// ==============================
const ManageUser = () => {
  const alert = useAlert();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "", password: "", role: "", credit: "", addCredit: "",
    vc_username: "", vc_password: "", vc_caller_id: "", vc_plan_id: "", vc_call_type: "",
  });

  const navigate = useNavigate();
  const role = sessionStorage.getItem("role");
  const loggedUserId = sessionStorage.getItem("user_id");

  useEffect(() => { loadUsers(); }, []);

  // ==============================
  // LOAD USERS
  // ==============================
  const loadUsers = async () => {
    try {
      const res = await fetch(`${BASE}/list-users/?user_id=${loggedUserId}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.log(err);
    }
  };

  const filteredUsers = users
    .filter((u) => u.username?.toLowerCase().includes(search.toLowerCase()))
    .filter((u) => {
      const loggedUser = JSON.parse(sessionStorage.getItem("user"));
      if (role === "admin") return true;
      if (role === "reseller") return u.parent === loggedUser?.username;
      return u.username === loggedUser?.username;
    });

  // ==============================
  // EDIT OPEN
  // ==============================
  const handleEditOpen = (user) => {
    setEditUser(user);
    setEditForm({
      username: user.username || "",
      password: user.password || "",
      role: user.role || "user",
      credit: user.credit || 0,
      addCredit: "",
      vc_username: user.vc_username || "",
      vc_password: user.vc_password || "",
      vc_caller_id: user.vc_caller_id || "",
      vc_plan_id: user.vc_plan_id || "2",
      vc_call_type: user.vc_call_type || "2",
    });
  };

  // ==============================
  // SAVE EDIT
  // ==============================
  const handleEditSave = async () => {
    try {
      const addCredit = Number(editForm.addCredit || 0);

      const res = await fetch(`${BASE}/update-user/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editUser.id,
          username: editForm.username,
          password: editForm.password,
          role: editForm.role,
          add_credit: addCredit,
          admin_id: loggedUserId,
          vc_username: editForm.vc_username,
          vc_password: editForm.vc_password,
          vc_caller_id: editForm.vc_caller_id,
          vc_plan_id: editForm.vc_plan_id,
          vc_call_type: editForm.vc_call_type,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        await loadUsers();
        setEditUser(null);
        alert.success("User updated successfully!", "User Updated");
      } else {
        alert.error("Failed to update user. Please try again.", "Update Failed");
      }
    } catch (err) {
      alert.error("Network error. Please try again.", "Network Error");
    }
  };

  // ==============================
  // RESET PASSWORD — custom prompt replaced with modal flow
  // ==============================
  const handleResetPassword = (user) => {
    // We use a small inline input state for the password prompt
    setResetTarget(user);
    setResetPass("");
    setShowResetModal(true);
  };

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPass, setResetPass] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  const submitResetPassword = async () => {
    if (!resetPass) {
      alert.warning("Please enter a new password.", "Password Required");
      return;
    }
    try {
      const res = await fetch(`${BASE}/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: resetTarget.id, password: resetPass }),
      });
      const data = await res.json();
      if (data.status === "success") {
        const updated = users.map((u) => u.id === resetTarget.id ? { ...u, password: resetPass } : u);
        setUsers(updated);
        await loadUsers();
        setShowResetModal(false);
        alert.success(`Password reset successfully for ${resetTarget.username}!`, "Password Reset");
      } else {
        alert.error("Failed to reset password.", "Reset Failed");
      }
    } catch (err) {
      alert.error("Network error. Please try again.", "Network Error");
    }
  };

  // ==============================
  // TOGGLE STATUS
  // ==============================
  const toggleActive = async (id) => {
    try {
      const res = await fetch(`${BASE}/toggle-status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id }),
      });
      const data = await res.json();
      if (data.status === "success") {
        const updated = users.map((u) => u.id === id ? { ...u, status: data.new_status } : u);
        setUsers(updated);
        await loadUsers();
      } else {
        alert.error("Failed to toggle status.", "Error");
      }
    } catch (err) {
      alert.error("Network error. Please try again.", "Network Error");
    }
  };

  // ==============================
  // DELETE USER — window.confirm replaced
  // ==============================
  const handleDeleteUser = (userId) => {
    const targetUser = users.find((u) => u.id === userId);
    alert.confirm({
      title: "Delete User?",
      message: `Are you sure you want to delete "${targetUser?.username}"?\nThis action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          const res = await fetch(`${BASE}/delete-user/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId }),
          });
          const data = await res.json();
          if (data.status === "success") {
            setUsers(users.filter((u) => u.id !== userId));
            alert.success("User deleted successfully!", "User Deleted");
          } else {
            alert.error("Failed to delete user.", "Delete Failed");
          }
        } catch (err) {
          alert.error("Network error. Please try again.", "Network Error");
        }
      },
    });
  };

  const getSubUserCount = (username) => users.filter((u) => u.parent === username).length;

  return (
    <div className="min-h-screen bg-[#f8f8f8] p-2 md:p-4 overflow-x-hidden">

      {/* GLOBAL ALERT RENDERER */}
      <AlertModal alerts={alert.alerts} removeAlert={alert.removeAlert} />

      <div className="w-full bg-white rounded-[28px] border border-[#ef7fa4] overflow-hidden shadow-sm">

        {/* HEADER */}
        <div className="px-4 md:px-7 py-5 border-b border-[#f5d1db] bg-[#fffafb]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-[58px] h-[58px] rounded-2xl bg-[#fff0f4] border border-[#ef7fa4] flex items-center justify-center">
                <Users size={26} className="text-[#EA7A9A]" />
              </div>
              <div>
                <h1 className="text-[24px] md:text-[28px] font-[700] text-[#EA7A9A]">Manage Users</h1>
                <p className="text-[13px] text-gray-500 mt-1">User management panel</p>
              </div>
            </div>
            {role !== "user" && (
              <button onClick={() => navigate("/adduser")}
                className="h-[48px] px-5 rounded-2xl bg-[#EA7A9A] hover:bg-[#e3688b] duration-300 text-white text-[14px] font-semibold flex items-center gap-2 shadow-sm">
                <UserPlus size={17} /> Add User
              </button>
            )}
          </div>
        </div>

        <div className="p-3 md:p-5">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
            <div className="flex items-center gap-2 text-[14px] text-black">
              <span>Show</span>
              <select className="w-[70px] h-[40px] border border-[#ef7fa4] rounded-xl px-2 bg-[#fffafb] outline-none text-[14px]">
                <option>10</option><option>25</option><option>50</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] text-black">Search:</span>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#EA7A9A]" />
                <input type="text" placeholder="Search User" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[180px] md:w-[240px] h-[42px] border border-[#ef7fa4] rounded-2xl bg-[#fffafb] pl-10 pr-4 outline-none text-[13px]" />
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div className="w-full overflow-x-auto rounded-[18px] border border-[#f0d3dc]">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="bg-[#fff5f8]">
                  {["Sr", "Name", "Username", "Credit", "Status", "Date", "Role", "Sub User", "Action"].map((head, i) => (
                    <th key={i} className="px-3 py-4 border-b border-r border-[#f2dbe2] text-left text-[13px] font-[700] text-[#EA7A9A] whitespace-nowrap">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="10" className="text-center py-12 text-[14px]">No data available in table</td></tr>
                ) : filteredUsers.map((u, index) => (
                  <tr key={u.id} className="hover:bg-[#fffafb]">
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7] text-[13px]">{index + 1}</td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7] text-[13px]">{u.name || u.username || "-"}</td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7] text-[13px]">{u.username}</td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7]">
                      <div className="inline-flex items-center gap-2 bg-[#fff0f4] border border-[#ef7fa4] rounded-full px-4 h-[34px]">
                        <Wallet size={14} className="text-[#EA7A9A]" />
                        <span className="text-[13px] font-[700] text-[#EA7A9A]">₹ {Number(u.credit || 0)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7]">
                      <button onClick={() => toggleActive(u.id)}
                        className={`px-4 h-[34px] rounded-full text-white text-[12px] font-semibold ${u.status === "Active" ? "bg-[#22c55e]" : "bg-[#ef4444]"}`}>
                        {u.status || "Active"}
                      </button>
                    </td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7] text-[13px] whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7] text-[13px] capitalize">{u.role}</td>
                    <td className="px-3 py-4 border-b border-r border-[#f5e1e7] text-[13px]">{getSubUserCount(u.username)}</td>
                    <td className="px-3 py-4 border-b border-[#f5e1e7]">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleResetPassword(u)}
                          className="w-[36px] h-[36px] rounded-xl bg-[#22c55e] text-white flex items-center justify-center">
                          <KeyRound size={15} />
                        </button>
                        <button onClick={() => handleEditOpen(u)}
                          className="w-[36px] h-[36px] rounded-xl bg-[#3b82f6] text-white flex items-center justify-center">
                          <Pencil size={15} />
                        </button>
                        {role === "admin" && (
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="w-[36px] h-[36px] rounded-xl bg-[#ef4444] text-white flex items-center justify-center">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editUser && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-3">
          <div className="w-full max-w-[520px] bg-white rounded-[24px] border border-[#ef7fa4] p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[24px] font-[700] text-[#EA7A9A] mb-5">Edit User</h2>
            <div className="space-y-4">
              <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                placeholder="Username" className="modalInput" />
              <input value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Password" type="password" className="modalInput" />
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="modalInput">
                <option value="user">User</option>
                <option value="reseller">Reseller</option>
                <option value="admin">Admin</option>
              </select>
              <input value={editForm.credit || 0} disabled placeholder="Current Credit" className="modalInput" />
              <input type="number" value={editForm.addCredit} onChange={(e) => setEditForm({ ...editForm, addCredit: e.target.value })}
                placeholder="Add Credit" className="modalInput" />
              <hr className="border-[#f5d1db]" />
              <p className="text-[13px] font-semibold text-[#EA7A9A]">VoiceChannel Credentials</p>
              <div className="flex gap-3">
                <select value={editForm.vc_plan_id} onChange={(e) => setEditForm({ ...editForm, vc_plan_id: e.target.value })}
                  className="modalInput">
                  <option value="1">Plan 15 pulse</option>
                  <option value="2">Plan 30 pulse</option>
                </select>
                <select value={editForm.vc_call_type} onChange={(e) => setEditForm({ ...editForm, vc_call_type: e.target.value })}
                  className="modalInput">
                  <option value="2">Transactional</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditUser(null)}
                className="h-[46px] px-5 rounded-xl bg-gray-200 text-black font-semibold text-[14px]">Cancel</button>
              <button onClick={handleEditSave}
                className="h-[46px] px-6 rounded-xl bg-[#EA7A9A] text-white font-semibold text-[14px]">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && resetTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999] p-3">
          <div className="w-full max-w-[420px] bg-white rounded-[24px] border border-[#86efac] overflow-hidden shadow-2xl">
            <div className="bg-[#22c55e] text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-[20px] font-semibold">Reset Password</h2>
              <button onClick={() => setShowResetModal(false)} className="text-[24px] leading-none">×</button>
            </div>
            <div className="p-6">
              <p className="text-[14px] text-gray-600 mb-4">
                Enter new password for <strong>{resetTarget.username}</strong>
              </p>
              <input
                type="password"
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
                placeholder="New Password"
                className="w-full h-[52px] border border-[#86efac] rounded-xl px-4 outline-none focus:border-[#22c55e] text-[14px] mb-2"
                onKeyDown={(e) => e.key === "Enter" && submitResetPassword()}
                autoFocus
              />
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setShowResetModal(false)}
                  className="bg-[#ff5c5c] hover:bg-red-600 text-white px-6 h-[42px] rounded-lg font-medium">
                  Cancel
                </button>
                <button onClick={submitResetPassword}
                  className="bg-[#22c55e] hover:bg-green-600 text-white px-6 h-[42px] rounded-lg font-medium">
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modalInput{width:100%;height:52px;border:1px solid #ef7fa4;border-radius:14px;padding:0 14px;outline:none;background:#fffafb;font-size:14px;}
        .modalInput:focus{border:1px solid #EA7A9A;box-shadow:0 0 0 4px rgba(234,122,154,0.10);}
      `}</style>
    </div>
  );
};

export default ManageUser;