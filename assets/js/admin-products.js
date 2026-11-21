import { supabase } from "./supabase.js";
import { collectProductImages, getImageFiles, getSourceInfo, requireAdmin, setMessage, slugFor, statusLabel } from "./admin-common.js";
import { formatPrice, getProductShipping, safeImage } from "./store.js";

const form = document.querySelector("#product-form");
const list = document.querySelector("#products-list");
const message = document.querySelector("#product-message");
const categorySelect = document.querySelector("#category-select");
const statusFilter = document.querySelector("#status-filter");
const searchInput = document.querySelector("#product-search");
const openProductModalBtn = document.querySelector("#btn-open-product-modal");
const productModal = document.querySelector("#product-modal");
const productModalClose = document.querySelector("#product-modal-close");
const productModalCancel = document.querySelector("#product-modal-cancel");
const formTitle = document.querySelector("#form-title");
const formEyebrow = document.querySelector("#form-eyebrow");
const formMode = document.querySelector("#form-mode");
const saveButton = form.querySelector('[type="submit"]');
const previewImage = document.querySelector("#product-preview-image");
const previewPlaceholder = document.querySelector("#product-preview-placeholder");
const imageSelectionStatus = document.querySelector("#image-selection-status");
const sourceUrlInput = form.elements.namedItem("source_url");
const sourceUrlError = document.querySelector("#source-url-error");
const adminPagination = document.querySelector("#admin-product-pagination");
const adminCount = document.querySelector("#admin-product-count");
const adminPageSize = 10;
let adminCurrentPage = 0;
let loadedProducts = null;
let previewObjectUrl = null;
let previewFile = null;

function getPageNumbers(currentPage, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const pages = [];
  pages.push(0);
  let start = Math.max(1, currentPage - 1);
  let end = Math.min(pageCount - 2, currentPage + 1);
  if (currentPage <= 2) {
    end = 3;
  } else if (currentPage >= pageCount - 3) {
    start = pageCount - 4;
  }
  if (start > 1) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < pageCount - 2) pages.push("...");
  pages.push(pageCount - 1);
  return pages;
}

function normalizeUrlForCompare(urlStr) {
  if (!urlStr) return "";
  try {
    const u = new URL(String(urlStr).trim());
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href.toLowerCase();
  } catch {
    return String(urlStr).trim().toLowerCase();
  }
}

function getSaveButtonLabel() {
  return form.elements.namedItem("id").value ? "บันทึกการแก้ไข" : "บันทึกสินค้า";
}

function setSaveButtonState(isSaving) {
  saveButton.disabled = isSaving;
  saveButton.textContent = isSaving ? "กำลังบันทึก..." : getSaveButtonLabel();
  if (productModalCancel) productModalCancel.disabled = isSaving;
}

function releasePreviewObjectUrl() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
  previewFile = null;
}

function updateProductPreviewImage() {
  const imageUrls = [
    form.elements.namedItem("image_url").value,
    ...form.elements.namedItem("image_urls").value.split(/\r?\n/)
  ].map((url) => safeImage(url.trim())).filter(Boolean);
  const file = getImageFiles(form)[0];
  let source = imageUrls[0] || "";
  if (!source && file) {
    if (file !== previewFile) {
      releasePreviewObjectUrl();
      previewFile = file;
      previewObjectUrl = URL.createObjectURL(file);
    }
    source = previewObjectUrl;
  } else if (previewObjectUrl) {
    releasePreviewObjectUrl();
  }

  if (previewImage.dataset.source === source) return;
  previewImage.dataset.source = source;
  previewImage.hidden = !source;
  previewPlaceholder.hidden = Boolean(source);
  if (source) {
    previewImage.src = source;
  } else {
    previewImage.removeAttribute("src");
  }
}

function updateProductPreview() {
  const title = String(form.elements.namedItem("title").value).trim();
  const currency = String(form.elements.namedItem("currency").value || "THB").trim().toUpperCase();
  const price = String(form.elements.namedItem("source_price").value).trim();
  const originalPrice = String(form.elements.namedItem("original_price").value).trim();
  const status = String(form.elements.namedItem("status").value);
  const category = categorySelect.selectedOptions[0]?.textContent || "ไม่มีหมวดหมู่";
  const previewStatus = document.querySelector("#product-preview-status");
  const previewFeatured = document.querySelector("#product-preview-featured");
  const previewOriginal = document.querySelector("#product-preview-original");

  document.querySelector("#product-preview-title").textContent = title || "ชื่อสินค้าของคุณ";
  document.querySelector("#product-preview-category").textContent = category;
  document.querySelector("#product-preview-price").textContent = price
    ? formatPrice(Number(price), currency)
    : "ยังไม่ระบุราคา";
  previewOriginal.textContent = originalPrice ? formatPrice(Number(originalPrice), currency) : "";
  previewOriginal.hidden = !originalPrice;
  previewStatus.className = `status-pill ${status}`;
  previewStatus.textContent = statusLabel(status);
  previewFeatured.hidden = !form.elements.namedItem("is_featured").checked;

  const shippingType = form.elements.namedItem("shipping_type")?.value;
  const previewShipping = document.querySelector("#product-preview-shipping");
  if (previewShipping) {
    if (shippingType === "free") {
      previewShipping.className = "card-shipping-badge free";
      previewShipping.textContent = "🚚 รวมส่ง";
      previewShipping.hidden = false;
    } else if (shippingType === "paid") {
      previewShipping.className = "card-shipping-badge paid";
      previewShipping.textContent = "📦 ไม่รวมส่ง";
      previewShipping.hidden = false;
    } else {
      previewShipping.hidden = true;
    }
  }

  const urlCount = new Set([
    form.elements.namedItem("image_url").value,
    ...form.elements.namedItem("image_urls").value.split(/\r?\n/)
  ].map((url) => url.trim()).filter(Boolean)).size;
  const fileCount = getImageFiles(form).length;
  const imageCount = urlCount + fileCount;
  imageSelectionStatus.textContent = fileCount
    ? `เลือกไฟล์แล้ว ${fileCount} รูป · มีรูปทั้งหมด ${imageCount}/10 รูป`
    : imageCount
      ? `เพิ่ม URL แล้ว ${urlCount} รูป · รวม ${imageCount}/10 รูป`
      : "ยังไม่ได้เพิ่มรูปภาพ";
  imageSelectionStatus.classList.toggle("over-limit", imageCount > 10);
  updateProductPreviewImage();
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function addProductCell(row, product) {
  const cell = document.createElement("td");
  const item = document.createElement("div");
  item.className = "product-list-item";
  const thumbnail = document.createElement("span");
  thumbnail.className = "product-list-thumbnail";
  thumbnail.setAttribute("aria-hidden", "true");
  const imageUrl = safeImage(product.image_url || product.image_urls?.[0]);
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.onerror = () => showThumbnailFallback(thumbnail);
    thumbnail.append(image);
  } else {
    showThumbnailFallback(thumbnail);
  }
  const title = document.createElement("span");
  title.className = "product-list-title";
  title.textContent = product.title || "ไม่มีชื่อสินค้า";
  item.append(thumbnail, title);
  cell.append(item);
  row.append(cell);
}

function showThumbnailFallback(thumbnail) {
  const fallback = document.createElement("span");
  fallback.className = "product-list-thumbnail-fallback";
  fallback.textContent = "◇";
  thumbnail.replaceChildren(fallback);
}

function addSourceLinkCell(row, sourceUrl, isDuplicate = false) {
  const cell = document.createElement("td");
  let url;
  try {
    url = new URL(sourceUrl);
  } catch (error) {
    cell.textContent = sourceUrl || "—";
    row.append(cell);
    return;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    cell.textContent = sourceUrl || "—";
    row.append(cell);
    return;
  }
  const link = document.createElement("a");
  link.className = "source-product-link";
  link.href = url.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = url.href;
  link.textContent = url.href;
  cell.append(link);

  if (isDuplicate) {
    const badge = document.createElement("span");
    badge.className = "duplicate-badge";
    badge.textContent = "ลิงก์ซ้ำ";
    badge.title = "มีสินค้าอื่นใช้ลิงก์ต้นทางนี้ซ้ำกัน";
    cell.append(badge);
  }

  row.append(cell);
}

async function loadCategories() {
  let { data, error } = await supabase.from("categories").select("id,name,parent_id").order("name");
  if (error && error.message?.includes("parent_id")) {
    const fallback = await supabase.from("categories").select("id,name").order("name");
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;

  const parents = (data || []).filter((c) => !c.parent_id);
  const childrenMap = new Map();
  (data || []).forEach((c) => {
    if (c.parent_id) {
      if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, []);
      childrenMap.get(c.parent_id).push(c);
    }
  });

  parents.forEach((parent) => {
    const pOption = document.createElement("option");
    pOption.value = parent.id;
    pOption.textContent = parent.name;
    categorySelect.append(pOption);

    const subs = childrenMap.get(parent.id) || [];
    subs.forEach((sub) => {
      const sOption = document.createElement("option");
      sOption.value = sub.id;
      sOption.textContent = `　↳ ${sub.name}`;
      categorySelect.append(sOption);
    });
  });
}

async function loadProducts() {
  loadedProducts = null;
  list.innerHTML = '<tr><td colspan="5">กำลังโหลด...</td></tr>';
  let query = supabase.from("products")
    .select("id,title,source_domain,source_store,source_price,currency,status,created_at,source_url,image_url,image_urls,description,original_price,category_id,is_featured,slug")
    .order("created_at", { ascending: false });
  if (statusFilter.value) query = query.eq("status", statusFilter.value);
  const { data, error } = await query;
  if (error) {
    list.innerHTML = '<tr><td class="empty-cell" colspan="5">โหลดสินค้าไม่สำเร็จ</td></tr>';
    setMessage(message, `โหลดสินค้าไม่สำเร็จ: ${error.message}`, true);
    return;
  }
  loadedProducts = data;
  renderProducts();
}

function renderProducts() {
  if (loadedProducts === null) return;
  const search = searchInput.value.trim().toLocaleLowerCase();
  const products = loadedProducts.filter((product) =>
    String(product.title || "").toLocaleLowerCase().includes(search)
  );
  if (!products.length) {
    const emptyMessage = search ? "ไม่พบสินค้าที่ค้นหา" : "ไม่พบสินค้า";
    list.innerHTML = `<tr><td class="empty-cell" colspan="5">${emptyMessage}</td></tr>`;
    if (adminCount) adminCount.textContent = "ทั้งหมด 0 รายการ";
    if (adminPagination) adminPagination.replaceChildren();
    return;
  }

  // Count duplicate source URLs
  const urlCounts = new Map();
  for (const p of loadedProducts) {
    const norm = normalizeUrlForCompare(p.source_url);
    if (norm) {
      urlCounts.set(norm, (urlCounts.get(norm) || 0) + 1);
    }
  }

  const totalItems = products.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / adminPageSize));
  if (adminCurrentPage >= pageCount) {
    adminCurrentPage = Math.max(0, pageCount - 1);
  }

  const startIndex = adminCurrentPage * adminPageSize;
  const endIndex = Math.min(startIndex + adminPageSize, totalItems);
  const pagedProducts = products.slice(startIndex, endIndex);

  const rows = pagedProducts.map((product) => {
    const row = document.createElement("tr");
    addProductCell(row, product);
    const normUrl = normalizeUrlForCompare(product.source_url);
    const isDuplicate = normUrl ? (urlCounts.get(normUrl) > 1) : false;
    addSourceLinkCell(row, product.source_url, isDuplicate);
    const priceCell = document.createElement("td");
    priceCell.textContent = formatPrice(product.source_price, product.currency);
    const shipping = getProductShipping(product);
    if (shipping) {
      const shipBadge = document.createElement("span");
      shipBadge.className = `admin-shipping-badge ${shipping}`;
      shipBadge.textContent = shipping === "free" ? "🚚 รวมส่ง" : "📦 ไม่รวมส่ง";
      priceCell.append(document.createTextNode(" "), shipBadge);
    }
    row.append(priceCell);
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-pill ${product.status}`;
    badge.textContent = statusLabel(product.status);
    statusCell.append(badge);
    row.append(statusCell);
    const actions = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "row-action";
    edit.textContent = "แก้ไข";
    edit.addEventListener("click", () => beginEdit(product));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "row-action";
    toggle.textContent = product.status === "published" ? "ซ่อน" : "เผยแพร่";
    toggle.addEventListener("click", () => changeStatus(product, product.status === "published" ? "hidden" : "published"));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "row-action danger";
    remove.textContent = "ลบ";
    remove.addEventListener("click", () => deleteProduct(product));
    const caption = document.createElement("button");
    caption.type = "button";
    caption.className = "row-action btn-caption";
    caption.textContent = "📋 แคปชั่น";
    caption.title = "คัดลอกแคปชั่นโปรโมท";
    caption.addEventListener("click", () => copyProductCaption(product, caption));
    actionGroup.append(edit, caption, toggle, remove);
    actions.append(actionGroup);
    row.append(actions);
    return row;
  });
  list.replaceChildren(...rows);

  renderAdminPagination(totalItems, pageCount, startIndex, endIndex);
}

function renderAdminPagination(totalItems, pageCount, startIndex, endIndex) {
  if (adminCount) {
    adminCount.textContent = `แสดง ${totalItems > 0 ? startIndex + 1 : 0}-${endIndex} จากทั้งหมด ${totalItems} รายการ`;
  }
  if (!adminPagination) return;

  const fragment = document.createDocumentFragment();

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "button button-outline";
  prevBtn.textContent = "← ก่อนหน้า";
  prevBtn.disabled = adminCurrentPage === 0;
  prevBtn.addEventListener("click", () => {
    if (adminCurrentPage > 0) {
      adminCurrentPage -= 1;
      renderProducts();
    }
  });
  fragment.append(prevBtn);

  // Numbered page buttons
  const numbersWrap = document.createElement("div");
  numbersWrap.className = "pagination-numbers";
  const pageList = getPageNumbers(adminCurrentPage, pageCount);

  for (const item of pageList) {
    if (typeof item === "number") {
      const pageBtn = document.createElement("button");
      pageBtn.type = "button";
      pageBtn.className = "pagination-number" + (item === adminCurrentPage ? " active" : "");
      pageBtn.textContent = String(item + 1);
      pageBtn.setAttribute("aria-label", `หน้า ${item + 1}`);
      if (item === adminCurrentPage) pageBtn.setAttribute("aria-current", "page");
      pageBtn.addEventListener("click", () => {
        if (adminCurrentPage !== item) {
          adminCurrentPage = item;
          renderProducts();
        }
      });
      numbersWrap.append(pageBtn);
    } else {
      const ellipsis = document.createElement("span");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.textContent = "…";
      numbersWrap.append(ellipsis);
    }
  }
  fragment.append(numbersWrap);

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "button button-outline";
  nextBtn.textContent = "ถัดไป →";
  nextBtn.disabled = adminCurrentPage >= pageCount - 1;
  nextBtn.addEventListener("click", () => {
    if (adminCurrentPage < pageCount - 1) {
      adminCurrentPage += 1;
      renderProducts();
    }
  });
  fragment.append(nextBtn);

  adminPagination.replaceChildren(fragment);
}

function openProductModal() {
  resetForm();
  if (formTitle) formTitle.textContent = "เพิ่มสินค้า";
  if (formEyebrow) formEyebrow.textContent = "NEW ITEM";
  if (formMode) formMode.textContent = "สินค้าใหม่";
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = "บันทึกสินค้า";
  }
  if (productModal) productModal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    form.elements.namedItem("title")?.focus();
  }, 80);
}

function closeProductModal() {
  if (productModal) productModal.hidden = true;
  document.body.style.overflow = "";
  resetForm();
}

function beginEdit(product) {
  if (saveButton.disabled) return;
  releasePreviewObjectUrl();
  if (sourceUrlError) sourceUrlError.hidden = true;
  if (sourceUrlInput) sourceUrlInput.classList.remove("field-has-error");
  form.elements.namedItem("image_files").value = "";
  for (const [key, value] of Object.entries(product)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  }
  const shippingSelect = form.elements.namedItem("shipping_type");
  if (shippingSelect) {
    shippingSelect.value = getProductShipping(product) || "unspecified";
  }
  const cleanDesc = (product.description || "").replace(/<!--shipping:[^>]+-->\s*/g, "").trim();
  form.elements.namedItem("description").value = cleanDesc;
  form.elements.namedItem("image_urls").value = (product.image_urls || [])
    .filter((url) => url !== product.image_url).join("\n");
  if (formTitle) formTitle.textContent = "แก้ไขสินค้า";
  if (formEyebrow) formEyebrow.textContent = "EDIT ITEM";
  if (formMode) formMode.textContent = "กำลังแก้ไข";
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = "บันทึกการแก้ไข";
  }
  updateProductPreview();
  if (productModal) productModal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    form.elements.namedItem("title")?.focus();
  }, 80);
}

function resetForm() {
  releasePreviewObjectUrl();
  if (sourceUrlError) sourceUrlError.hidden = true;
  if (sourceUrlInput) sourceUrlInput.classList.remove("field-has-error");
  form.reset();
  form.elements.namedItem("id").value = "";
  const shippingSelect = form.elements.namedItem("shipping_type");
  if (shippingSelect) {
    shippingSelect.value = "unspecified";
  }
  if (formTitle) formTitle.textContent = "เพิ่มสินค้า";
  if (formEyebrow) formEyebrow.textContent = "NEW ITEM";
  if (formMode) formMode.textContent = "สินค้าใหม่";
  if (!saveButton.disabled) saveButton.textContent = getSaveButtonLabel();
  updateProductPreview();
  if (message) {
    message.textContent = "";
    message.className = "form-message";
  }
}

// --- Feature 5: Caption Generator ---
function copyProductCaption(product, btn) {
  const price = product.source_price
    ? `฿${Number(product.source_price).toLocaleString("th-TH")}`
    : "ราคาพิเศษ";
  const shipping = getProductShipping(product) === "free"
    ? "🚚 ส่งฟรี!"
    : "📦 ตรวจสอบค่าส่งที่ร้าน";
  const baseUrl = window.location.origin.replace(/\/admin\/?$/, "");
  const link = `${baseUrl}/product.html?id=${product.id}`;
  const captionText = `🚨 ดีลใหม่มาแล้ว!\n\n✨ ${product.title}\n💰 ราคาเพียง ${price}\n${shipping}\n\n👉 ดูและสั่งซื้อที่นี่:\n${link}\n\n#คุ้มเว่อร์1บาท #ดีล1บาท #ของถูก`;

  navigator.clipboard.writeText(captionText)
    .then(() => {
      setMessage(message, "คัดลอกแคปชั่นแล้ว! นำไปโพสต์ได้เลย 🎉");
      const original = btn.textContent;
      btn.textContent = "✅ คัดลอกแล้ว!";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 2000);
    })
    .catch(() => {
      // fallback สำหรับเบราว์เซอร์ที่ไม่รองรับ clipboard API
      prompt("คัดลอกแคปชั่น:", captionText);
    });
}
// --- /Feature 5 ---

async function changeStatus(product, status) {
  const { error } = await supabase.from("products").update({ status }).eq("id", product.id);
  if (error) {
    setMessage(message, `เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`, true);
    return;
  }
  setMessage(message, "อัปเดตสถานะสินค้าแล้ว");
  await loadProducts();
}

async function deleteProduct(product) {
  if (!window.confirm(`ยืนยันลบสินค้า “${product.title}” หรือไม่?`)) return;
  const { error } = await supabase.from("products").delete().eq("id", product.id);
  if (error) {
    setMessage(message, `ลบสินค้าไม่สำเร็จ: ${error.message}`, true);
    return;
  }
  if (form.elements.namedItem("id").value === product.id) closeProductModal();
  setMessage(message, "ลบสินค้าแล้ว");
  await loadProducts();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSaveButtonState(true);
  setMessage(message, "กำลังบันทึก...");
  const values = new FormData(form);
  let source;
  try {
    source = getSourceInfo(String(values.get("source_url")).trim());
  } catch (error) {
    setMessage(message, error.message, true);
    setSaveButtonState(false);
    return;
  }
  const existingId = String(values.get("id") || "");

  // ตรวจสอบไม่ให้ลิงก์ต้นทางซ้ำกับสินค้าอื่นในระบบ
  const altUrl = source.url.endsWith("/") ? source.url.slice(0, -1) : source.url + "/";
  let dupQuery = supabase
    .from("products")
    .select("id, title, source_url")
    .in("source_url", [source.url, altUrl]);

  if (existingId) {
    dupQuery = dupQuery.neq("id", existingId);
  }

  const { data: duplicates, error: dupError } = await dupQuery;
  if (!dupError && duplicates && duplicates.length > 0) {
    const dupTitle = duplicates[0].title || "สินค้าอื่น";
    setMessage(
      message,
      `ไม่อนุญาตให้ใช้ลิงก์ซ้ำ: ลิงก์ต้นทางนี้มีอยู่ในระบบแล้ว (สินค้า: "${dupTitle}")`,
      true
    );
    if (sourceUrlInput) {
      sourceUrlInput.focus();
      sourceUrlInput.classList.add("field-has-error");
    }
    if (sourceUrlError) {
      sourceUrlError.textContent = `⚠️ ลิงก์ต้นทางนี้ซ้ำกับสินค้า "${dupTitle}" ในระบบ`;
      sourceUrlError.hidden = false;
    }
    setSaveButtonState(false);
    return;
  }

  const rawPrice = String(values.get("source_price") || "").trim();
  const rawOriginal = String(values.get("original_price") || "").trim();
  const price = rawPrice ? Number(rawPrice) : null;
  const originalPrice = rawOriginal ? Number(rawOriginal) : null;
  if ((price !== null && (!Number.isFinite(price) || price <= 0)) || (originalPrice !== null && (!Number.isFinite(originalPrice) || originalPrice <= 0))) {
    setMessage(message, "ราคาต้องเป็นตัวเลขมากกว่า 0 หรือเว้นว่างไว้", true);
    setSaveButtonState(false);
    return;
  }
  let imageUrls;
  try {
    imageUrls = await collectProductImages(
      String(values.get("image_url") || ""),
      String(values.get("image_urls") || ""),
      getImageFiles(form)
    );
  } catch (error) {
    setMessage(message, error.message, true);
    setSaveButtonState(false);
    return;
  }
  const shippingType = String(values.get("shipping_type") || "unspecified");
  let rawDesc = String(values.get("description") || "").trim();
  rawDesc = rawDesc.replace(/<!--shipping:[^>]+-->\s*/g, "").trim();
  if (shippingType === "free" || shippingType === "paid") {
    rawDesc = `<!--shipping:${shippingType}-->\n${rawDesc}`.trim();
  }

  const payload = {
    title: String(values.get("title")).trim(),
    slug: existingId ? undefined : slugFor(String(values.get("title")).trim()),
    description: rawDesc || null,
    image_url: imageUrls[0] || null,
    image_urls: imageUrls,
    source_url: source.url,
    source_domain: source.domain,
    source_platform: source.platform,
    source_store: String(values.get("source_store") || "").trim() || null,
    source_price: price,
    original_price: originalPrice,
    currency: String(values.get("currency") || "THB").trim().toUpperCase(),
    category_id: String(values.get("category_id") || "") || null,
    status: String(values.get("status")),
    is_featured: form.elements.namedItem("is_featured").checked,
    last_checked_at: price === null ? null : new Date().toISOString()
  };
  const query = existingId
    ? supabase.from("products").update(payload).eq("id", existingId)
    : supabase.from("products").insert(payload);
  const { data: saved, error } = await query.select("id").single();
  if (error) {
    setMessage(message, `บันทึกสินค้าไม่สำเร็จ: ${error.message}`, true);
  } else {
    if (price !== null) {
      const { error: historyError } = await supabase.from("price_history").insert({
        product_id: saved.id,
        price,
        original_price: originalPrice,
        currency: payload.currency,
        checked_at: payload.last_checked_at
      });
      if (historyError) {
        setMessage(message, `บันทึกสินค้าแล้ว แต่บันทึกประวัติราคาไม่สำเร็จ: ${historyError.message}`, true);
      } else {
        setMessage(message, "บันทึกสินค้าและประวัติราคาแล้ว");
      }
    } else {
      setMessage(message, "บันทึกสินค้าแล้ว โดยไม่ได้บันทึกราคาเนื่องจากไม่มีข้อมูลที่ตรวจสอบได้");
    }
    await loadProducts();
    setTimeout(closeProductModal, 600);
  }
  setSaveButtonState(false);
});

function validateSourceUrlRealtime() {
  if (!sourceUrlInput) return true;
  const currentId = form.elements.namedItem("id").value;
  const val = (sourceUrlInput.value || "").trim();
  if (!val) {
    if (sourceUrlError) sourceUrlError.hidden = true;
    sourceUrlInput.classList.remove("field-has-error");
    return true;
  }

  const normVal = normalizeUrlForCompare(val);
  if (loadedProducts) {
    const dup = loadedProducts.find(
      (p) => String(p.id) !== String(currentId) && normalizeUrlForCompare(p.source_url) === normVal
    );
    if (dup) {
      if (sourceUrlError) {
        sourceUrlError.textContent = `⚠️ ลิงก์ต้นทางนี้ซ้ำกับสินค้า "${dup.title || 'ไม่มีชื่อ'}" ในระบบ`;
        sourceUrlError.hidden = false;
      }
      sourceUrlInput.classList.add("field-has-error");
      return false;
    }
  }

  if (sourceUrlError) sourceUrlError.hidden = true;
  sourceUrlInput.classList.remove("field-has-error");
  return true;
}

if (sourceUrlInput) {
  sourceUrlInput.addEventListener("input", () => {
    validateSourceUrlRealtime();
    autoFillFromSourceUrl();
  });
  sourceUrlInput.addEventListener("change", () => {
    validateSourceUrlRealtime();
    autoFillFromSourceUrl();
  });
}

// ระบบ Auto-Fill อัจฉริยะสำหรับแอดมิน: ตรวจจับแพลตฟอร์มและร้านค้าให้อัตโนมัติเมื่อวางลิงก์
function autoFillFromSourceUrl() {
  const val = (sourceUrlInput.value || "").trim();
  if (!val) return;
  try {
    const info = getSourceInfo(val);
    const storeInput = form.elements.namedItem("source_store");
    if (storeInput && (!storeInput.value || storeInput.value === "Shopee" || storeInput.value === "Lazada" || storeInput.value === "TikTok")) {
      storeInput.value = info.platform;
    }
    // แนะนำการตั้งค่าค่าส่งอัตโนมัติตามแพลตฟอร์มถ้ายังไม่เคยเลือก
    const shippingSelect = form.elements.namedItem("shipping_type");
    if (shippingSelect && shippingSelect.value === "unspecified") {
      // ค่าเริ่มต้นที่ปลอดภัย
      shippingSelect.value = "free";
    }
    updateProductPreview();
  } catch (err) {
    // ปล่อยผ่านหาก URL ยังพิมพ์ไม่สมบูรณ์
  }
}

openProductModalBtn?.addEventListener("click", openProductModal);
productModalClose?.addEventListener("click", closeProductModal);
productModalCancel?.addEventListener("click", closeProductModal);
productModal?.addEventListener("click", (e) => {
  if (e.target === productModal) closeProductModal();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && productModal && !productModal.hidden) {
    closeProductModal();
  }
});
statusFilter.addEventListener("change", () => { adminCurrentPage = 0; loadProducts(); });
searchInput.addEventListener("input", () => { adminCurrentPage = 0; renderProducts(); });
form.addEventListener("input", updateProductPreview);
form.addEventListener("change", updateProductPreview);
updateProductPreview();

async function initialize() {
  saveButton.disabled = true;
  saveButton.textContent = getSaveButtonLabel();
  const user = await requireAdmin();
  if (!user) return;
  await loadCategories();
  await loadProducts();
  setSaveButtonState(false);
}

initialize().catch((error) => setMessage(message, `เริ่มต้นหน้าจัดการไม่สำเร็จ: ${error.message}`, true));
previewImage.addEventListener("error", () => {
  if (previewImage.dataset.source !== previewImage.src) return;
  previewImage.hidden = true;
  previewPlaceholder.hidden = false;
});
