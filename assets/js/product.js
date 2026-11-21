import { isConfigured, supabase } from "./supabase.js";
import { formatCheckedAt, formatPrice, fetchPublishedProducts, getHeartIconSvg, getProductShipping, initFooter, isFavorite, renderProductCard, safeImage, toggleFavorite } from "./store.js";
import { initPWA } from "./pwa.js";

initFooter();
initPWA();
const container = document.querySelector("#product-detail");
const id = new URLSearchParams(window.location.search).get("id");

function handleGoBack(e) {
  if (e) e.preventDefault();
  if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
}

// Wire header back button
document.querySelector("#header-back-btn")?.addEventListener("click", handleGoBack);

function showToast(msg) {
  let toast = document.querySelector("#toast-msg");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-msg";
    toast.className = "toast-notification";
    document.body.append(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("คัดลอกลิงก์ดีลแล้ว ส่งต่อให้เพื่อนได้เลย! 🎉");
    }).catch(() => {
      prompt("คัดลอกลิงก์เพื่อแชร์:", text);
    });
  } else {
    prompt("คัดลอกลิงก์เพื่อแชร์:", text);
  }
}

async function handleShare(product, platform = "native") {
  const pageUrl = window.location.href;
  const shareTitle = `${product.title} | คุ้มเว่อร์ 1 บาท`;
  const shareText = `🔥 เจอดีลสุดคุ้ม! ${product.title} ราคา ${formatPrice(product.source_price, product.currency)} ที่ คุ้มเว่อร์ 1 บาท`;

  if (platform === "line") {
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(lineUrl, "_blank", "noopener,noreferrer,width=550,height=500");
    return;
  }

  if (platform === "facebook") {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer,width=550,height=500");
    return;
  }

  if (platform === "copy") {
    copyToClipboard(pageUrl);
    return;
  }

  // Native Web Share API (สำหรับมือถือ)
  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: pageUrl
      });
    } catch (err) {
      if (err.name !== "AbortError") copyToClipboard(pageUrl);
    }
  } else {
    copyToClipboard(pageUrl);
  }
}

// ฟังก์ชันนับสถิติการคลิกไปซื้อ (Affiliate Click Tracker)
function recordProductClick(productId) {
  if (!productId || !supabase) return;
  try {
    // เรียก RPC ฟังก์ชันใน Supabase หรืออัปเดตแบบ fallback
    supabase.rpc("track_product_click", { target_product_id: productId }).then(({ error }) => {
      if (error) {
        // Fallback: หากยังไม่ได้รันฟังก์ชัน RPC ให้อัปเดตตรงๆ
        supabase.from("products").select("clicks_count").eq("id", productId).single().then(({ data }) => {
          const currentClicks = (data?.clicks_count || 0) + 1;
          supabase.from("products").update({ clicks_count: currentClicks, last_clicked_at: new Date().toISOString() }).eq("id", productId);
        });
      }
    });
  } catch (e) {
    // ป้องกันไม่ให้กระทบการเปิดหน้าเว็บของลูกค้า
  }
}

function showMessage(message) {
  const state = document.createElement("div");
  state.className = "state-card";
  state.textContent = message;
  container.replaceChildren(state);
}

function renderProduct(product) {
  document.title = `${product.title} | คุ้มเว่อร์ 1 บาท`;
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${product.title} | คุ้มเว่อร์ 1 บาท`);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", `ราคา ${formatPrice(product.source_price, product.currency)} ดูรายละเอียดและสั่งซื้อที่ร้านค้าต้นทาง`);
  if (product.image_url) {
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", product.image_url);
  }
  const wrapper = document.createElement("div");
  wrapper.className = "product-detail";
  const gallery = document.createElement("div");
  gallery.className = "detail-gallery";
  const imagePanel = document.createElement("div");
  imagePanel.className = "detail-image";
  const imageUrls = [...new Set([product.image_url, ...(product.image_urls || [])]
    .map(safeImage).filter(Boolean))].slice(0, 10);
  const thumbnails = document.createElement("div");
  thumbnails.className = "gallery-thumbnails";
  let activeThumbnail = null;
  let currentImageIndex = 0;

  const showImage = (indexOrUrl) => {
    let imageUrl;
    if (typeof indexOrUrl === "number") {
      currentImageIndex = indexOrUrl;
      imageUrl = imageUrls[currentImageIndex];
    } else {
      imageUrl = indexOrUrl;
      currentImageIndex = Math.max(0, imageUrls.indexOf(imageUrl));
    }
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = product.title;
    image.onerror = () => {
      const fallback = document.createElement("span");
      fallback.className = "image-fallback";
      fallback.textContent = "◇";
      imagePanel.replaceChildren(fallback);
    };
    imagePanel.replaceChildren(image);
    if (activeThumbnail) activeThumbnail.classList.remove("active");
    const newActive = thumbnails.children[currentImageIndex];
    if (newActive) {
      newActive.classList.add("active");
      activeThumbnail = newActive;
      newActive.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  if (imageUrls.length) {
    showImage(0);
    for (const [index, imageUrl] of imageUrls.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-thumbnail";
      button.setAttribute("aria-label", `ดูรูปที่ ${index + 1}`);
      const thumbnail = document.createElement("img");
      thumbnail.src = imageUrl;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      thumbnail.onerror = () => button.remove();
      button.append(thumbnail);
      if (index === 0) {
        button.classList.add("active");
        activeThumbnail = button;
      }
      button.addEventListener("click", () => showImage(index));
      thumbnails.append(button);
    }

    // Touch swipe left/right for mobile gallery
    let touchStartX = 0;
    let touchStartY = 0;
    imagePanel.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    imagePanel.addEventListener("touchend", (e) => {
      const diffX = e.changedTouches[0].screenX - touchStartX;
      const diffY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) && imageUrls.length > 1) {
        if (diffX < 0) {
          showImage((currentImageIndex + 1) % imageUrls.length);
        } else {
          showImage((currentImageIndex - 1 + imageUrls.length) % imageUrls.length);
        }
      }
    }, { passive: true });
  } else {
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.textContent = "◇";
    imagePanel.append(fallback);
  }
  gallery.append(imagePanel);
  if (imageUrls.length > 1) gallery.append(thumbnails);

  const details = document.createElement("section");
  details.className = "detail-copy";

  const back = document.createElement("a");
  back.className = "back-link";
  back.href = "index.html";
  back.innerHTML = '<span aria-hidden="true">←</span> กลับไปดูสินค้าทั้งหมด';
  back.addEventListener("click", handleGoBack);

  // Platform pill badge
  const rawPlatform = product.source_platform || product.source_domain || "";
  const isShopee = /shopee/i.test(rawPlatform);
  const isLazada = /lazada/i.test(rawPlatform);
  const platformBadge = document.createElement("div");
  platformBadge.className = `detail-platform-badge ${isShopee ? "shopee" : isLazada ? "lazada" : "general"}`;
  platformBadge.textContent = product.source_store || (isShopee ? "Shopee Mall / Official" : isLazada ? "LazMall / ร้านค้าทางการ" : product.source_domain || "ร้านค้าออนไลน์");

  const title = document.createElement("h1");
  title.className = "detail-title";
  title.textContent = product.title;

  // Price Section
  const priceCard = document.createElement("div");
  priceCard.className = "detail-price-card";

  const priceHeader = document.createElement("div");
  priceHeader.className = "detail-price-header";

  const price = document.createElement("div");
  price.className = `product-price${product.source_price ? "" : " unknown"}`;
  price.textContent = formatPrice(product.source_price, product.currency);

  priceHeader.append(price);

  const sourcePrice = Number(product.source_price);
  const origPrice = Number(product.original_price);
  if (origPrice && sourcePrice && origPrice > sourcePrice) {
    const original = document.createElement("del");
    original.className = "detail-original-price";
    original.textContent = formatPrice(origPrice, product.currency);

    const discountPercent = Math.round(((origPrice - sourcePrice) / origPrice) * 100);
    const discountBadge = document.createElement("span");
    discountBadge.className = "detail-discount-pill";
    discountBadge.textContent = `ประหยัด ${discountPercent}%`;

    priceHeader.append(original, discountBadge);
  }

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "share-deal-btn";
  shareBtn.innerHTML = '<span aria-hidden="true">📤</span> <span>แชร์ดีลนี้</span>';
  shareBtn.addEventListener("click", () => handleShare(product));

  const isFav = isFavorite(product.id);
  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "share-deal-btn detail-fav-btn" + (isFav ? " active" : "");
  const updateFavBtnUI = (active) => {
    favBtn.classList.toggle("active", active);
    favBtn.innerHTML = `${getHeartIconSvg(active)} <span>${active ? "บันทึกแล้ว" : "บันทึกดีล"}</span>`;
  };
  updateFavBtnUI(isFav);
  favBtn.addEventListener("click", () => {
    const isNowFav = toggleFavorite(product.id);
    updateFavBtnUI(isNowFav);
    showToast(isNowFav ? "บันทึกในรายการที่ถูกใจแล้ว! ❤️" : "นำออกจากรายการที่ถูกใจแล้ว");
  });

  priceHeader.append(shareBtn, favBtn);

  priceCard.append(priceHeader);

  const shippingType = getProductShipping(product);
  if (shippingType) {
    const shippingRow = document.createElement("div");
    shippingRow.className = `detail-shipping-row ${shippingType}`;
    if (shippingType === "free") {
      shippingRow.innerHTML = '<span class="shipping-icon">🚚</span> <span>การจัดส่ง: <strong>รวมส่งแล้ว / ส่งฟรี</strong></span>';
    } else {
      shippingRow.innerHTML = '<span class="shipping-icon">📦</span> <span>การจัดส่ง: <strong>ไม่รวมค่าจัดส่ง (คิดตามเงื่อนไขร้านค้า)</strong></span>';
    }
    priceCard.append(shippingRow);
  }

  const checked = document.createElement("div");
  checked.className = "price-checked detail-checked";
  const pulseDot = document.createElement("span");
  pulseDot.className = "pulse-dot";
  checked.append(pulseDot, document.createTextNode(formatCheckedAt(product.last_checked_at)));
  priceCard.append(checked);

  details.append(back, platformBadge, title, priceCard);

  const cleanDescription = (product.description || "").replace(/<!--shipping:[^>]+-->/g, "").trim();
  if (cleanDescription) {
    const description = document.createElement("p");
    description.className = "detail-description";
    description.textContent = cleanDescription;
    details.append(description);
  }

  if (product.source_url) {
    const rawPlatform = product.source_platform || product.source_domain || "";
    const isShopee = /shopee/i.test(rawPlatform);
    const isLazada = /lazada/i.test(rawPlatform);
    const platformName = isShopee ? "Shopee" : isLazada ? "Lazada" : (product.source_store || product.source_domain || "ร้านค้าต้นทาง");
    const ctaText = `สั่งซื้อที่ ${platformName} (ร้านต้นทาง)`;

    const buy = document.createElement("a");
    buy.className = `button button-dark detail-buy ${isShopee ? "shopee" : isLazada ? "lazada" : "general"}`;
    buy.href = product.source_url;
    buy.target = "_blank";
    buy.rel = "noopener noreferrer";
    buy.innerHTML = `<span>${ctaText}</span> <span class="buy-arrow" aria-hidden="true">↗</span>`;
    buy.addEventListener("click", () => recordProductClick(product.id));
    details.append(buy);

    // Social Share Bar Section (แชร์ลง LINE / Facebook / คัดลอกลิงก์)
    const shareSection = document.createElement("div");
    shareSection.className = "detail-share-box";
    shareSection.innerHTML = `
      <span class="share-box-label">แชร์ดีลสุดคุ้มนี้ให้เพื่อน:</span>
      <div class="share-buttons-row">
        <button type="button" class="social-share-btn line" title="แชร์ลง LINE">
          <span class="social-icon">🟢</span> LINE
        </button>
        <button type="button" class="social-share-btn fb" title="แชร์ลง Facebook">
          <span class="social-icon">🔵</span> Facebook
        </button>
        <button type="button" class="social-share-btn copy" title="คัดลอกลิงก์">
          <span class="social-icon">📋</span> คัดลอกลิงก์
        </button>
      </div>
    `;
    shareSection.querySelector(".social-share-btn.line")?.addEventListener("click", () => handleShare(product, "line"));
    shareSection.querySelector(".social-share-btn.fb")?.addEventListener("click", () => handleShare(product, "facebook"));
    shareSection.querySelector(".social-share-btn.copy")?.addEventListener("click", () => handleShare(product, "copy"));
    details.append(shareSection);

    // Mobile Sticky Bottom CTA Bar
    const stickyBottom = document.createElement("div");
    stickyBottom.className = "mobile-sticky-bar";
    stickyBottom.innerHTML = `
      <div class="sticky-bar-info">
        <small class="sticky-bar-source">${platformName}</small>
        <strong class="sticky-bar-price">${formatPrice(product.source_price, product.currency)}</strong>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button type="button" class="sticky-share-btn" id="sticky-share-btn" aria-label="แชร์ดีลนี้" title="แชร์ดีลนี้">📤</button>
        <a class="button button-dark sticky-bar-btn ${isShopee ? "shopee" : isLazada ? "lazada" : ""}" href="${product.source_url}" target="_blank" rel="noopener noreferrer" id="sticky-buy-btn">
          <span>สั่งซื้อที่ ${platformName}</span> <span aria-hidden="true">↗</span>
        </a>
      </div>
    `;
    stickyBottom.querySelector("#sticky-share-btn")?.addEventListener("click", () => handleShare(product, "native"));
    stickyBottom.querySelector("#sticky-buy-btn")?.addEventListener("click", () => recordProductClick(product.id));
    wrapper.append(stickyBottom);
  }
  wrapper.append(gallery, details);
  container.replaceChildren(wrapper);
}

async function loadProduct() {
  if (!id) {
    showMessage("ไม่พบรหัสสินค้า");
    return;
  }
  if (!isConfigured || !supabase) {
    showMessage("เว็บไซต์ยังไม่ได้เชื่อมต่อ Supabase กรุณาตั้งค่าตาม README");
    return;
  }
  const { data, error } = await supabase.from("products")
    .select("id,title,description,image_url,image_urls,source_url,source_domain,source_platform,source_store,source_price,original_price,currency,last_checked_at")
    .eq("id", id).eq("status", "published").maybeSingle();
  if (error) {
    showMessage("โหลดรายละเอียดสินค้าไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
    return;
  }
  if (!data) {
    showMessage("ไม่พบสินค้านี้ หรือสินค้าอาจยังไม่เผยแพร่");
    return;
  }
  renderProduct(data);
  loadRelatedDeals(data);
}

// ── Feature 4: Related Deals ───────────────────────────────────────────────
async function loadRelatedDeals(product) {
  const section = document.querySelector("#related-deals-section");
  const grid = document.querySelector("#related-deals-grid");
  if (!section || !grid) return;

  // ดึงสินค้าในหมวดหมู่เดียวกัน ถ้าไม่มีหมวดหมู่ ดึงสินค้ายอดนิยม
  const { data } = await fetchPublishedProducts({
    categoryId: product.category_id || undefined,
    sort: "popular",
    limit: 6
  });

  if (!data || data.length === 0) return;

  // กรองสินค้าตัวเองออก
  const related = data.filter((p) => p.id !== product.id).slice(0, 6);
  if (related.length === 0) return;

  grid.replaceChildren(...related.map(renderProductCard));
  section.hidden = false;
}

loadProduct();
