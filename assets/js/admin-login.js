import { isConfigured, supabase } from "./supabase.js";
import { setMessage } from "./admin-common.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");
const params = new URLSearchParams(window.location.search);
if (params.get("error") === "setup") setMessage(message, "กรุณาตั้งค่า Supabase ก่อนใช้งาน", true);
if (params.get("error") === "not-admin") setMessage(message, "บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแล", true);
if (!isConfigured || !supabase) {
  form.querySelector("button").disabled = true;
  if (!message.textContent) setMessage(message, "เว็บไซต์ยังไม่ได้เชื่อมต่อ Supabase กรุณาตั้งค่าตาม README", true);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  setMessage(message, "กำลังตรวจสอบบัญชี...");
  const values = new FormData(form);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(values.get("email")).trim(),
    password: String(values.get("password"))
  });
  if (error) {
    const loginError = String(error.message || "").toLowerCase();
    let detail = "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน";
    if (loginError.includes("invalid login credentials")) detail = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    else if (loginError.includes("email not confirmed")) detail = "อีเมลนี้ยังไม่ยืนยัน กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
    else if (loginError.includes("email logins are disabled")) detail = "ผู้ดูแลระบบยังไม่ได้เปิด Email login ใน Supabase";
    else if (loginError.includes("too many requests")) detail = "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่";
    setMessage(message, detail, true);
    button.disabled = false;
    return;
  }
  const { data: admin, error: adminError } = await supabase.from("admin_users")
    .select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (adminError || !admin) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setMessage(message, `ไม่มีสิทธิ์ผู้ดูแล และออกจากระบบไม่สำเร็จ: ${signOutError.message}`, true);
    } else {
      setMessage(message, adminError ? `ตรวจสอบสิทธิ์ไม่สำเร็จ: ${adminError.message}` : "บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแล", true);
    }
    button.disabled = false;
    return;
  }
  window.location.replace("dashboard.html");
});
