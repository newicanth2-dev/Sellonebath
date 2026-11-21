import "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.KHUEM_WOER_CONFIG || {};
const url = config.supabaseUrl || "";
const anonKey = config.supabaseAnonKey || "";

export const isConfigured = Boolean(url && anonKey && !url.includes("YOUR_PROJECT"));
export const supabase = isConfigured ? createClient(url, anonKey) : null;

export function showSetupMessage(container, message = "เว็บไซต์ยังไม่ได้เชื่อมต่อ Supabase") {
  container.innerHTML = "";
  const state = document.createElement("div");
  state.className = "state-card";
  state.textContent = `${message} กรุณาตั้งค่า assets/js/config.js ตาม README`;
  container.append(state);
}
