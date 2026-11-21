// PWA Helper: Service Worker Registration & Mobile Install Prompt
let deferredPrompt = null;

export function initPWA() {
  // 1. Register Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    });
  }

  // 2. Mobile Install Prompt (PWA)
  const isDismissed = localStorage.getItem("pwa_install_dismissed");
  const dismissedTime = isDismissed ? Number(isDismissed) : 0;
  // If dismissed within 3 days, don't show prompt
  if (Date.now() - dismissedTime < 3 * 24 * 60 * 60 * 1000) {
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
}

function showInstallBanner() {
  if (document.querySelector("#pwa-install-banner")) return;

  const banner = document.createElement("aside");
  banner.id = "pwa-install-banner";
  banner.className = "pwa-install-banner";
  banner.setAttribute("aria-label", "ติดตั้งเว็บแอปพลิเคชัน");
  banner.innerHTML = `
    <div class="pwa-banner-main">
      <img src="Logo.png" alt="โลโก้ คุ้มเว่อร์ 1 บาท" class="pwa-banner-logo">
      <div class="pwa-banner-text">
        <strong>คุ้มเว่อร์ 1 บาท</strong>
        <span>ติดตั้งลงหน้าจอมือถือ ช้อปดีลไวขึ้น ไม่พลาดของ 1 บาท</span>
      </div>
    </div>
    <div class="pwa-banner-actions">
      <button type="button" class="button pwa-btn-install" id="pwa-btn-install">
        📲 ติดตั้งแอป
      </button>
      <button type="button" class="pwa-btn-close" id="pwa-btn-close" aria-label="ปิด">✕</button>
    </div>
  `;

  document.body.append(banner);

  const installBtn = banner.querySelector("#pwa-btn-install");
  const closeBtn = banner.querySelector("#pwa-btn-close");

  installBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.remove();
    if (outcome === "accepted") {
      localStorage.setItem("pwa_install_dismissed", String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }
  });

  closeBtn?.addEventListener("click", () => {
    banner.classList.add("fade-out");
    setTimeout(() => banner.remove(), 250);
    localStorage.setItem("pwa_install_dismissed", String(Date.now()));
  });
}
