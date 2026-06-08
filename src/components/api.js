// ===============================
// 🔧 CENTRAL API CONFIG
// ===============================

export const BASE = "https://voice-backend-bqji.onrender.com/api";

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  return res.json();
}