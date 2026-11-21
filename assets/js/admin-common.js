import { isConfigured, supabase } from "./supabase.js";

export async function requireAdmin() {
  if (!isConfigured || !supabase) {
    window.location.replace("index.html?error=setup");
    return null;
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) {
    window.location.replace("index.html");
    return null;
  }
  const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    await supabase.auth.signOut();
    window.location.replace("index.html?error=not-admin");
    return null;
  }
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) {
        button.disabled = false;
        throw logoutError;
      }
      window.location.replace("index.html");
    });
  });
  return user;
}

export function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

export function getSourceInfo(sourceUrl) {
  let url;
  try {
    url = new URL(String(sourceUrl || "").trim());
  } catch (error) {
    throw new Error("กรุณาระบุ URL ที่ถูกต้อง");
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("URL ต้องเป็น HTTP/HTTPS และไม่มีข้อมูลบัญชีใน URL");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    throw new Error("ไม่อนุญาตให้ใช้ localhost หรือ IP address เป็น URL ต้นทาง");
  }
  // Remove hash and normalize trailing slash on pathname
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  const isShopee = host === "shopee.co.th" || host.endsWith(".shopee.co.th") || host === "shopee.com" || host.endsWith(".shopee.com");
  const isLazada = host === "lazada.co.th" || host.endsWith(".lazada.co.th") || host === "lazada.com" || host.endsWith(".lazada.com");
  const isTikTok = host === "tiktok.com" || host.endsWith(".tiktok.com");
  const platform = isShopee ? "Shopee" : isLazada ? "Lazada" : isTikTok ? "TikTok" : "เว็บไซต์อื่น";
  return { url: url.href, domain: host, platform };
}

export function slugFor(title) {
  const normalized = title.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${normalized || "product"}-${crypto.randomUUID().slice(0, 8)}`;
}

export function escapeText(value) {
  return value == null ? "" : String(value);
}

export function statusLabel(status) {
  return ({ published: "เผยแพร่", hidden: "ซ่อน", draft: "ฉบับร่าง" })[status] || status || "—";
}

export function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(date);
}

export function normalizeImageUrls(primaryUrl, additionalUrls) {
  const candidates = [primaryUrl, ...additionalUrls.split(/\r?\n/)]
    .map((url) => url.trim())
    .filter(Boolean);
  const urls = [];
  for (const candidate of candidates) {
    let url;
    try {
      url = new URL(candidate);
    } catch (error) {
      throw new Error("URL รูปภาพไม่ถูกต้อง");
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("URL รูปภาพต้องเป็น HTTP/HTTPS และไม่มีข้อมูลบัญชีใน URL");
    }
    if (!urls.includes(url.href)) urls.push(url.href);
  }
  if (urls.length > 10) throw new Error("เพิ่มรูปภาพได้สูงสุด 10 รูปต่อสินค้า");
  return urls;
}

export async function collectProductImages(primaryUrl, additionalUrls, files) {
  const urls = normalizeImageUrls(primaryUrl, additionalUrls);
  if (urls.length + files.length > 10) throw new Error("เพิ่มรูปภาพได้สูงสุด 10 รูปต่อสินค้า");
  return [...urls, ...await uploadProductImages(files)];
}

export function getImageFiles(form) {
  const input = form.elements.namedItem("image_files") || form.elements.namedItem("image_file");
  if (!input) throw new Error("ไม่พบช่องอัปโหลดรูปภาพ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง");
  if (!(input instanceof HTMLInputElement) || input.type !== "file") {
    throw new Error("ช่องอัปโหลดรูปภาพไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองอีกครั้ง");
  }
  return Array.from(input.files || []);
}

async function uploadProductImages(files) {
  if (!files.length) return [];
  if (files.length > 10) throw new Error("อัปโหลดรูปภาพได้สูงสุด 10 รูปต่อสินค้า");
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const uploadedPaths = [];
  const urls = [];
  try {
    for (const file of files) {
      const extension = extensions[file.type];
      if (!extension) throw new Error("รองรับไฟล์ภาพ JPG, PNG หรือ WebP เท่านั้น");
      if (file.size > 5 * 1024 * 1024) throw new Error("ขนาดไฟล์ภาพแต่ละรูปต้องไม่เกิน 5 MB");
      const path = `${crypto.randomUUID()}.${extension}`;
      const { data, error } = await supabase.storage.from("product-images").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw new Error(`อัปโหลดรูปภาพไม่สำเร็จ: ${error.message}`);
      uploadedPaths.push(data.path);
      const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(data.path);
      urls.push(publicUrl.publicUrl);
    }
  } catch (error) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await supabase.storage.from("product-images").remove(uploadedPaths);
      if (cleanupError) {
        throw new Error(`${error.message}; ลบไฟล์ที่อัปโหลดบางส่วนไม่สำเร็จ: ${cleanupError.message}`);
      }
    }
    throw error;
  }
  return urls;
}
