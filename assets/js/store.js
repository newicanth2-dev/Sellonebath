import { isConfigured, supabase, showSetupMessage } from "./supabase.js";

export function initFooter() {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

export function formatPrice(price, currency = "THB") {
  if (price === null || price === undefined || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return "ไม่สามารถตรวจสอบราคาได้";
  }
  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(price));
  } catch (error) {
    return `${Number(price).toLocaleString("th-TH")} ${currency}`;
  }
}

export function formatCheckedAt(value) {
  if (!value) return "ยังไม่มีข้อมูลการอัพเดตราคา";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ยังไม่มีข้อมูลการอัพเดตราคา";
  return `อัพเดตล่าสุด ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
}

export function safeImage(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.href);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch (error) {
    return "";
  }
}

// ── Wishlist / Favorites Helper ─────────────────────────────────────────────
const FAVORITES_KEY = "khuem_woer_favs";

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch {
    return [];
  }
}

export function getHeartIconSvg(filled = false) {
  if (filled) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  }
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
}

export function isFavorite(productId) {
  return getFavorites().includes(productId);
}

export function toggleFavorite(productId) {
  const favs = getFavorites();
  const idx = favs.indexOf(productId);
  let added = false;
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(productId);
    added = true;
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {}
  window.dispatchEvent(new CustomEvent("favorites-updated", { detail: { favs, productId, added } }));
  return added;
}

export function getProductShipping(product) {
  if (!product) return null;
  if (product.shipping_type && product.shipping_type !== "unspecified") return product.shipping_type;
  if (!product.description) return null;
  const match = String(product.description).match(/<!--shipping:(free|paid)-->/);
  if (match) return match[1];
  if (/รวมส่ง|ส่งฟรี|ฟรีค่าส่ง/i.test(product.description)) return "free";
  if (/ไม่รวมส่ง|มีค่าจัดส่ง|ค่าส่งแยก/i.test(product.description)) return "paid";
  return null;
}

export function renderProductCard(product) {
  const link = document.createElement("a");
  link.className = "product-card";
  link.href = `product.html?id=${encodeURIComponent(product.id)}`;

  // Product Image Container
  const imageBox = document.createElement("div");
  imageBox.className = "product-image";

  // Favorite Heart Button (Feature 1)
  const isFav = isFavorite(product.id);
  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "card-fav-btn" + (isFav ? " active" : "");
  favBtn.setAttribute("aria-label", isFav ? "นำออกจากที่ถูกใจ" : "บันทึกดีลที่ชอบ");
  favBtn.setAttribute("title", isFav ? "นำออกจากที่ถูกใจ" : "บันทึกดีลที่ชอบ");
  favBtn.innerHTML = getHeartIconSvg(isFav);
  favBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isNowFav = toggleFavorite(product.id);
    favBtn.classList.toggle("active", isNowFav);
    favBtn.innerHTML = getHeartIconSvg(isNowFav);
    favBtn.classList.add("heart-bounce");
    setTimeout(() => favBtn.classList.remove("heart-bounce"), 400);
  });
  imageBox.append(favBtn);

  // Discount calculation & badge with Savings (Feature 2)
  const sourcePrice = Number(product.source_price);
  const origPrice = Number(product.original_price);
  if (origPrice && sourcePrice && origPrice > sourcePrice) {
    const savedAmount = origPrice - sourcePrice;
    const discountPercent = Math.round((savedAmount / origPrice) * 100);
    if (discountPercent > 0) {
      const discountBadge = document.createElement("span");
      discountBadge.className = "card-discount-badge";
      discountBadge.innerHTML = `-${discountPercent}% <small class="discount-save">ประหยัด ${formatPrice(savedAmount)}</small>`;
      imageBox.append(discountBadge);
    }
  }

  // Hot Deal / Best Seller Badge (Feature 4)
  const isHotDeal = product.is_featured || (sourcePrice > 0 && sourcePrice <= 1);
  if (isHotDeal) {
    const hotBadge = document.createElement("span");
    hotBadge.className = "card-hot-badge";
    hotBadge.innerHTML = '<span class="flame-icon" aria-hidden="true">🔥</span> ยอดฮิต 1฿';
    imageBox.append(hotBadge);
  }

  // Platform Tag
  const rawPlatform = product.source_platform || product.source_domain || "";
  const isShopee = /shopee/i.test(rawPlatform);
  const isLazada = /lazada/i.test(rawPlatform);
  const platformBadge = document.createElement("span");
  platformBadge.className = `card-platform-badge ${isShopee ? "shopee" : isLazada ? "lazada" : "general"}`;
  platformBadge.textContent = product.source_store || (isShopee ? "Shopee" : isLazada ? "Lazada" : product.source_domain || "ร้านค้า");
  imageBox.append(platformBadge);

  // Smooth Lazy Image (Feature 5)
  const imageUrl = safeImage(product.image_url);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = product.title || "สินค้า";
    image.loading = "lazy";
    image.className = "img-lazy";
    image.onload = () => image.classList.add("img-loaded");
    image.onerror = () => {
      image.remove();
      const fallback = document.createElement("span");
      fallback.className = "image-fallback";
      fallback.textContent = "✦";
      imageBox.append(fallback);
    };
    imageBox.append(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.textContent = "✦";
    imageBox.append(fallback);
  }

  // Content Container
  const content = document.createElement("div");
  content.className = "product-content";

  const title = document.createElement("h3");
  title.className = "product-title";
  title.textContent = product.title || "ไม่มีชื่อสินค้า";

  const priceWrapper = document.createElement("div");
  priceWrapper.className = "product-price-wrapper";

  const price = document.createElement("div");
  price.className = "product-price";
  price.textContent = formatPrice(product.source_price, product.currency);
  if (!product.source_price) price.classList.add("unknown");
  priceWrapper.append(price);

  if (origPrice && sourcePrice && origPrice > sourcePrice) {
    const original = document.createElement("del");
    original.className = "product-original-price";
    original.textContent = formatPrice(origPrice, product.currency);
    priceWrapper.append(original);
  }

  const shippingType = getProductShipping(product);
  if (shippingType) {
    const shippingBadge = document.createElement("span");
    shippingBadge.className = `card-shipping-badge ${shippingType}`;
    shippingBadge.textContent = shippingType === "free" ? "🚚 รวมส่ง" : "ไม่รวมส่ง";
    priceWrapper.append(shippingBadge);
  }

  const checked = document.createElement("div");
  checked.className = "price-checked";
  const pulseDot = document.createElement("span");
  pulseDot.className = "pulse-dot";
  checked.append(pulseDot, document.createTextNode(formatCheckedAt(product.last_checked_at)));

  content.append(title, priceWrapper, checked);

  // Buy button
  const buyBtn = document.createElement("a");
  buyBtn.className = "card-buy-btn";
  buyBtn.href = product.source_url || `product.html?id=${encodeURIComponent(product.id)}`;
  buyBtn.target = product.source_url ? "_blank" : "_self";
  buyBtn.rel = "noopener noreferrer";
  buyBtn.textContent = "ไปดู ↗";
  buyBtn.addEventListener("click", (e) => e.stopPropagation());
  content.append(buyBtn);

  link.append(imageBox, content);
  return link;
}

export function renderProductSkeletons(count = 8) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "product-card skeleton-card";
    skeleton.innerHTML = `
      <div class="product-image skeleton-box"></div>
      <div class="product-content">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-title-short"></div>
        <div class="skeleton-line skeleton-price"></div>
        <div class="skeleton-line skeleton-meta"></div>
      </div>
    `;
    fragment.append(skeleton);
  }
  return fragment;
}

export async function fetchPublishedProducts({ categoryId, search, sort, limit, offset, featured, minPrice, maxPrice, platform, shipping } = {}) {
  if (!isConfigured || !supabase) return { data: null, error: new Error("Supabase ยังไม่ได้ตั้งค่า") };
  let query = supabase
    .from("products")
    .select(
      "id,title,slug,description,image_url,source_url,source_domain,source_platform,source_store,source_price,original_price,currency,category_id,last_checked_at,created_at",
      offset === undefined ? undefined : { count: "exact" }
    )
    .eq("status", "published");
  if (categoryId) {
    if (Array.isArray(categoryId)) {
      query = query.in("category_id", categoryId);
    } else {
      query = query.eq("category_id", categoryId);
    }
  }
  if (featured) query = query.eq("is_featured", true);
  if (search) query = query.ilike("title", `%${search.replace(/[%_]/g, "")}%`);
  if (minPrice !== undefined && minPrice !== null) query = query.gte("source_price", minPrice);
  if (maxPrice !== undefined && maxPrice !== null) query = query.lte("source_price", maxPrice);
  if (platform) query = query.ilike("source_platform", `%${platform}%`);
  if (shipping === "free") {
    query = query.or("description.ilike.%<!--shipping:free-->%,description.ilike.%ส่งฟรี%,description.ilike.%รวมส่ง%,description.ilike.%ฟรีค่าส่ง%");
  } else if (shipping === "paid") {
    query = query.or("description.ilike.%<!--shipping:paid-->%,description.ilike.%ไม่รวมส่ง%,description.ilike.%มีค่าจัดส่ง%,description.ilike.%ค่าส่งแยก%");
  }
  if (sort === "price-asc") query = query.order("source_price", { ascending: true, nullsFirst: false });
  else if (sort === "price-desc") query = query.order("source_price", { ascending: false, nullsFirst: false });
  else if (sort === "popular") query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  if (limit && offset !== undefined) query = query.range(offset, offset + limit - 1);
  else if (limit) query = query.limit(limit);
  return query;
}

export async function fetchCategories() {
  if (!isConfigured || !supabase) return { data: null, error: new Error("Supabase ยังไม่ได้ตั้งค่า") };
  const res = await supabase.from("categories")
    .select("id,name,slug,description,image_url,parent_id")
    .eq("status", "active")
    .order("name");
  if (res.error && res.error.message?.includes("parent_id")) {
    return supabase.from("categories")
      .select("id,name,slug,description,image_url")
      .eq("status", "active")
      .order("name");
  }
  return res;
}

export function displaySetupState(element, message) {
  showSetupMessage(element, message);
}

initFooter();
