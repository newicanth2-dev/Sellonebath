import { supabase } from "./supabase.js";
import { requireAdmin, setMessage } from "./admin-common.js";

const form = document.querySelector("#category-form");
const list = document.querySelector("#category-list");
const message = document.querySelector("#category-message");
const parentSelect = document.querySelector("#category-parent-select");

const openCatModalBtn = document.querySelector("#btn-open-category-modal");
const categoryModal = document.querySelector("#category-modal");
const categoryModalClose = document.querySelector("#category-modal-close");
const categoryModalCancel = document.querySelector("#category-modal-cancel");
const categoryModalTitle = document.querySelector("#category-modal-title");
const categoryModalEyebrow = document.querySelector("#category-modal-eyebrow");
const categoryModalSubmit = document.querySelector("#category-modal-submit");
const categoryNameInput = document.querySelector("#category-name-input");
const categorySlugInput = document.querySelector("#category-slug-input");
const categoryIdInput = document.querySelector("#category-id");

const imageFileInput = document.querySelector("#category-image-file");
const imageUrlInput = document.querySelector("#category-image-url");
const previewImg = document.querySelector("#category-preview-img");
const previewPlaceholder = document.querySelector("#category-preview-placeholder");
const clearImgBtn = document.querySelector("#clear-category-img");

let previewObjectUrl = null;
let allCategories = [];
let hasParentIdColumn = true;
let currentCategoryFilter = "all";

const countAllEl = document.querySelector("#count-all");
const countParentEl = document.querySelector("#count-parent");
const countSubEl = document.querySelector("#count-sub");
const filterTabs = document.querySelectorAll(".cat-filter-tab");

filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentCategoryFilter = tab.dataset.filter;
    renderCategoriesTable();
  });
});

function setPreviewImage(src) {
  if (src) {
    previewImg.src = src;
    previewImg.hidden = false;
    previewPlaceholder.hidden = true;
    if (clearImgBtn) clearImgBtn.style.display = "inline-flex";
  } else {
    previewImg.src = "";
    previewImg.hidden = true;
    previewPlaceholder.hidden = false;
    if (clearImgBtn) clearImgBtn.style.display = "none";
  }
}

imageFileInput?.addEventListener("change", () => {
  const file = imageFileInput.files?.[0];
  if (file) {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    setPreviewImage(previewObjectUrl);
  }
});

imageUrlInput?.addEventListener("input", () => {
  const url = imageUrlInput.value.trim();
  if (url && !imageFileInput?.files?.length) {
    setPreviewImage(url);
  } else if (!url && !imageFileInput?.files?.length) {
    setPreviewImage("");
  }
});

clearImgBtn?.addEventListener("click", () => {
  if (imageFileInput) imageFileInput.value = "";
  if (imageUrlInput) imageUrlInput.value = "";
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  setPreviewImage("");
});

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function updateParentSelect(currentEditId = null) {
  if (!parentSelect) return;
  const currentVal = parentSelect.value;
  parentSelect.replaceChildren();

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- ไม่มี (เป็นหมวดหมู่หลัก) --";
  parentSelect.append(defaultOpt);

  allCategories
    .filter((c) => (!c.parent_id || c.parent_id === "") && c.id !== currentEditId)
    .forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `📁 ${cat.name}`;
      parentSelect.append(opt);
    });

  parentSelect.value = currentVal;
}

function addSubcategoryTo(parent) {
  openSubcatModal(parent);
}

function renderCategoriesTable() {
  if (!allCategories.length) {
    list.innerHTML = '<tr><td class="empty-cell" colspan="6">ยังไม่มีหมวดหมู่</td></tr>';
    return;
  }

  const catMap = new Map(allCategories.map((c) => [c.id, c.name]));
  const parents = allCategories.filter((c) => !c.parent_id);
  const subs = allCategories.filter((c) => Boolean(c.parent_id));

  if (countAllEl) countAllEl.textContent = String(allCategories.length);
  if (countParentEl) countParentEl.textContent = String(parents.length);
  if (countSubEl) countSubEl.textContent = String(subs.length);

  // Group subcategories under parents
  const sorted = [];
  parents.forEach((p) => {
    if (currentCategoryFilter !== "sub") {
      sorted.push(p);
    }
    if (currentCategoryFilter !== "parent") {
      const children = allCategories.filter((c) => c.parent_id === p.id);
      children.forEach((ch) => sorted.push(ch));
    }
  });

  if (currentCategoryFilter !== "parent") {
    allCategories.forEach((c) => {
      if (c.parent_id && !sorted.includes(c)) sorted.push(c);
    });
  }

  list.replaceChildren(...sorted.map((category) => {
    const row = document.createElement("tr");
    const isSub = Boolean(category.parent_id);
    row.className = isSub ? "cat-row-sub" : "cat-row-parent";

    // 1. Image thumbnail cell
    const imgCell = document.createElement("td");
    if (category.image_url) {
      const img = document.createElement("img");
      img.src = category.image_url;
      img.className = "category-table-thumb";
      img.alt = category.name;
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        const ph = document.createElement("div");
        ph.className = "category-table-thumb-placeholder";
        ph.textContent = isSub ? "🔹" : "📁";
        imgCell.append(ph);
      };
      imgCell.append(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "category-table-thumb-placeholder";
      ph.textContent = isSub ? "🔹" : "📁";
      imgCell.append(ph);
    }
    row.append(imgCell);

    // 2. Name cell
    const nameCell = document.createElement("td");
    if (isSub) {
      nameCell.innerHTML = `
        <div class="cat-sub-name-wrap">
          <span class="cat-sub-tree-line">└──</span>
          <span class="cat-sub-name">${category.name}</span>
        </div>
      `;
    } else {
      const childCount = allCategories.filter((c) => c.parent_id === category.id).length;
      nameCell.innerHTML = `
        <div class="cat-parent-name">
          <span>📁 ${category.name}</span>
          ${childCount > 0 ? `<span class="badge-has-subs">${childCount} หมวดย่อย</span>` : ""}
        </div>
      `;
    }
    row.append(nameCell);

    // 3. Category Type / Parent cell
    const typeCell = document.createElement("td");
    if (isSub) {
      const pName = catMap.get(category.parent_id) || "ไม่พบหมวดหลัก";
      typeCell.innerHTML = `
        <span class="badge-cat-sub">↳ หมวดย่อย</span>
        <span class="cat-parent-ref">อยู่ใต้: <strong>${pName}</strong></span>
      `;
    } else {
      typeCell.innerHTML = `<span class="badge-cat-parent">📁 หมวดหลัก</span>`;
    }
    row.append(typeCell);

    // 4. Slug cell
    addCell(row, category.slug);

    // 5. Status cell
    addCell(row, category.status === "active" ? "เปิดใช้งาน" : "ซ่อน");

    // 6. Action cell
    const cell = document.createElement("td");
    cell.style.textAlign = "right";
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.style.justifyContent = "flex-end";

    // Quick "+ หมวดย่อย" button for parent categories
    if (!isSub) {
      const addSub = document.createElement("button");
      addSub.type = "button";
      addSub.className = "row-action btn-add-sub";
      addSub.textContent = "+ หมวดย่อย";
      addSub.title = `เพิ่มหมวดย่อยภายใต้ ${category.name}`;
      addSub.addEventListener("click", () => addSubcategoryTo(category));
      actions.append(addSub);
    }

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "row-action";
    edit.textContent = "แก้ไข";
    edit.addEventListener("click", () => beginEdit(category));

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "row-action";
    toggle.textContent = category.status === "active" ? "ซ่อน" : "เปิดใช้";
    toggle.addEventListener("click", () => changeStatus(category, category.status === "active" ? "hidden" : "active"));

    actions.append(edit, toggle);
    cell.append(actions);
    row.append(cell);
    return row;
  }));
}

async function loadCategories() {
  let { data, error } = await supabase.from("categories")
    .select("id,name,slug,description,status,image_url,parent_id").order("name");

  if (error && error.message?.includes("parent_id")) {
    hasParentIdColumn = false;
    const fallback = await supabase.from("categories")
      .select("id,name,slug,description,status,image_url").order("name");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    list.innerHTML = '<tr><td class="empty-cell" colspan="6">โหลดหมวดหมู่ไม่สำเร็จ</td></tr>';
    setMessage(message, `โหลดหมวดหมู่ไม่สำเร็จ: ${error.message}`, true);
    return;
  }

  allCategories = data || [];
  updateParentSelect();
  renderCategoriesTable();
}

function openCategoryModal() {
  resetForm();
  if (categoryModalTitle) categoryModalTitle.textContent = "เพิ่มหมวดหมู่";
  if (categoryModalEyebrow) categoryModalEyebrow.textContent = "NEW CATEGORY";
  if (categoryModalSubmit) {
    categoryModalSubmit.textContent = "บันทึกหมวดหมู่";
    categoryModalSubmit.disabled = false;
  }
  if (categoryModal) categoryModal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => categoryNameInput?.focus(), 80);
}

function closeCategoryModal() {
  if (categoryModal) categoryModal.hidden = true;
  document.body.style.overflow = "";
  resetForm();
}

function beginEdit(category) {
  resetForm();
  updateParentSelect(category.id);
  for (const [key, value] of Object.entries(category)) {
    const field = form.elements.namedItem(key);
    if (field) field.value = value ?? "";
  }
  if (parentSelect) parentSelect.value = category.parent_id || "";
  if (imageFileInput) imageFileInput.value = "";
  if (category.image_url) {
    setPreviewImage(category.image_url);
  } else {
    setPreviewImage("");
  }
  if (categoryModalTitle) categoryModalTitle.textContent = "แก้ไขหมวดหมู่";
  if (categoryModalEyebrow) categoryModalEyebrow.textContent = "EDIT CATEGORY";
  if (categoryModalSubmit) {
    categoryModalSubmit.textContent = "บันทึกการแก้ไข";
    categoryModalSubmit.disabled = false;
  }
  if (categoryModal) categoryModal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => categoryNameInput?.focus(), 80);
}

function resetForm() {
  form.reset();
  if (categoryIdInput) categoryIdInput.value = "";
  if (parentSelect) parentSelect.value = "";
  updateParentSelect();
  if (imageFileInput) imageFileInput.value = "";
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  setPreviewImage("");
  if (categoryModalTitle) categoryModalTitle.textContent = "เพิ่มหมวดหมู่";
  if (categoryModalEyebrow) categoryModalEyebrow.textContent = "NEW CATEGORY";
  if (message) {
    message.textContent = "";
    message.className = "form-message";
  }
}

// Auto-generate slug จากชื่อหมวดหมู่ (เมื่อสร้างหมวดหมู่ใหม่)
categoryNameInput?.addEventListener("input", () => {
  if (categoryIdInput?.value) return; // ไม่เขียนทับ slug หากเป็นการแก้ไข
  const val = categoryNameInput.value.trim();
  const slugified = val
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\u0E00-\u0E7F-]/g, "")
    .replace(/-+/g, "-");
  if (categorySlugInput) {
    categorySlugInput.value = slugified || `cat-${Date.now().toString(36)}`;
  }
});

openCatModalBtn?.addEventListener("click", openCategoryModal);
categoryModalClose?.addEventListener("click", closeCategoryModal);
categoryModalCancel?.addEventListener("click", closeCategoryModal);

categoryModal?.addEventListener("click", (e) => {
  if (e.target === categoryModal) closeCategoryModal();
});

async function changeStatus(category, status) {
  const { error } = await supabase.from("categories").update({ status }).eq("id", category.id);
  if (error) {
    setMessage(message, `เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`, true);
    return;
  }
  setMessage(message, "อัปเดตหมวดหมู่แล้ว");
  await loadCategories();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  setMessage(message, "กำลังบันทึก...");
  const values = new FormData(form);
  const id = String(values.get("id") || "");

  let finalImageUrl = String(values.get("image_url") || "").trim() || null;
  const file = imageFileInput?.files?.[0];
  if (file) {
    try {
      const ext = file.name.split(".").pop().toLowerCase() || "jpg";
      const path = `categories/${crypto.randomUUID()}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from("product-images").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });
      if (uploadErr) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${uploadErr.message}`);
      const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(uploadData.path);
      finalImageUrl = publicData.publicUrl;
    } catch (uploadError) {
      setMessage(message, uploadError.message, true);
      button.disabled = false;
      return;
    }
  }

  const payload = {
    name: String(values.get("name")).trim(),
    slug: String(values.get("slug")).trim().toLowerCase(),
    description: String(values.get("description") || "").trim() || null,
    image_url: finalImageUrl,
    status: String(values.get("status"))
  };
  const parentId = String(values.get("parent_id") || "").trim();
  if (hasParentIdColumn) {
    payload.parent_id = parentId || null;
  }
  let query = id
    ? supabase.from("categories").update(payload).eq("id", id)
    : supabase.from("categories").insert(payload);
  let { error } = await query;
  if (error && error.message?.includes("parent_id")) {
    hasParentIdColumn = false;
    delete payload.parent_id;
    const retry = id
      ? supabase.from("categories").update(payload).eq("id", id)
      : supabase.from("categories").insert(payload);
    const retryRes = await retry;
    if (retryRes.error) {
      error = retryRes.error;
    } else {
      setMessage(message, "⚠️ บันทึกหมวดหมู่แล้ว (แต่ยังไม่ได้ผูกหมวดหลัก เนื่องจากยังไม่ได้รัน SQL เพิ่มคอลัมน์ parent_id ใน Supabase SQL Editor กรุณารันไฟล์ 004_category_hierarchy.sql)", true);
      await loadCategories();
      setTimeout(closeCategoryModal, 2200);
      button.disabled = false;
      return;
    }
  }

  if (error) {
    setMessage(message, `บันทึกหมวดหมู่ไม่สำเร็จ: ${error.message}`, true);
    button.disabled = false;
  } else {
    setMessage(message, "✅ บันทึกหมวดหมู่เรียบร้อยแล้ว!");
    await loadCategories();
    setTimeout(closeCategoryModal, 600);
  }
});

// ==========================================================================
// Modal Popup: เพิ่มหมวดย่อย
// ==========================================================================
const subcatModal = document.querySelector("#subcat-modal");
const subcatModalForm = document.querySelector("#subcat-modal-form");
const subcatModalClose = document.querySelector("#subcat-modal-close");
const modalCancelBtn = document.querySelector("#modal-cancel-btn");
const modalParentIdInput = document.querySelector("#modal-parent-id");
const modalParentNameEl = document.querySelector("#modal-parent-name");
const modalNameInput = document.querySelector("#modal-subcat-name");
const modalSlugInput = document.querySelector("#modal-subcat-slug");
const modalStatusSelect = document.querySelector("#modal-subcat-status");
const modalDescInput = document.querySelector("#modal-subcat-desc");
const modalSubmitBtn = document.querySelector("#modal-submit-btn");
const modalMessage = document.querySelector("#modal-message");

const modalImageFileInput = document.querySelector("#modal-image-file");
const modalImageUrlInput = document.querySelector("#modal-image-url");
const modalPreviewImg = document.querySelector("#modal-preview-img");
const modalPreviewPlaceholder = document.querySelector("#modal-preview-placeholder");
const modalClearImgBtn = document.querySelector("#modal-clear-img");

function openSubcatModal(parent) {
  if (!subcatModal) return;
  subcatModalForm?.reset();
  if (modalMessage) {
    modalMessage.textContent = "";
    modalMessage.className = "form-message";
  }
  if (modalParentIdInput) modalParentIdInput.value = parent.id;
  if (modalParentNameEl) modalParentNameEl.textContent = parent.name;
  if (modalSubmitBtn) modalSubmitBtn.disabled = false;
  resetModalImagePreview();
  
  subcatModal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => modalNameInput?.focus(), 80);
}

function closeSubcatModal() {
  if (!subcatModal) return;
  subcatModal.hidden = true;
  document.body.style.overflow = "";
}

function resetModalImagePreview() {
  if (modalPreviewImg) {
    modalPreviewImg.hidden = true;
    modalPreviewImg.src = "";
  }
  if (modalPreviewPlaceholder) modalPreviewPlaceholder.hidden = false;
  if (modalClearImgBtn) modalClearImgBtn.style.display = "none";
}

function setModalImagePreview(url) {
  if (!url) {
    resetModalImagePreview();
    return;
  }
  if (modalPreviewImg) {
    modalPreviewImg.src = url;
    modalPreviewImg.hidden = false;
  }
  if (modalPreviewPlaceholder) modalPreviewPlaceholder.hidden = true;
  if (modalClearImgBtn) modalClearImgBtn.style.display = "inline-flex";
}

// Auto-generate slug จากชื่อใน Modal
modalNameInput?.addEventListener("input", () => {
  if (!modalSlugInput) return;
  const val = modalNameInput.value.trim();
  const slugified = val
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\u0E00-\u0E7F-]/g, "")
    .replace(/-+/g, "-");
  modalSlugInput.value = slugified || `sub-${Date.now().toString(36)}`;
});

modalImageFileInput?.addEventListener("change", () => {
  const file = modalImageFileInput.files?.[0];
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    setModalImagePreview(objectUrl);
    if (modalImageUrlInput) modalImageUrlInput.value = "";
  }
});

modalImageUrlInput?.addEventListener("input", () => {
  const url = modalImageUrlInput.value.trim();
  if (url) {
    setModalImagePreview(url);
    if (modalImageFileInput) modalImageFileInput.value = "";
  } else {
    resetModalImagePreview();
  }
});

modalClearImgBtn?.addEventListener("click", () => {
  if (modalImageFileInput) modalImageFileInput.value = "";
  if (modalImageUrlInput) modalImageUrlInput.value = "";
  resetModalImagePreview();
});

subcatModalClose?.addEventListener("click", closeSubcatModal);
modalCancelBtn?.addEventListener("click", closeSubcatModal);

subcatModal?.addEventListener("click", (e) => {
  if (e.target === subcatModal) closeSubcatModal();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (categoryModal && !categoryModal.hidden) {
      closeCategoryModal();
    }
    if (subcatModal && !subcatModal.hidden) {
      closeSubcatModal();
    }
  }
});

// บันทึกฟอร์มใน Modal Popup
subcatModalForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!modalSubmitBtn) return;
  modalSubmitBtn.disabled = true;
  setMessage(modalMessage, "กำลังบันทึกหมวดย่อย...");

  const name = modalNameInput.value.trim();
  const slug = modalSlugInput.value.trim().toLowerCase();
  const status = modalStatusSelect.value;
  const description = modalDescInput.value.trim() || null;
  const parentId = modalParentIdInput.value;

  let finalImageUrl = modalImageUrlInput.value.trim() || null;
  const file = modalImageFileInput?.files?.[0];
  if (file) {
    try {
      const ext = file.name.split(".").pop().toLowerCase() || "jpg";
      const path = `categories/${crypto.randomUUID()}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from("product-images").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });
      if (uploadErr) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${uploadErr.message}`);
      const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(uploadData.path);
      finalImageUrl = publicData.publicUrl;
    } catch (uploadError) {
      setMessage(modalMessage, uploadError.message, true);
      modalSubmitBtn.disabled = false;
      return;
    }
  }

  const payload = {
    name,
    slug,
    description,
    image_url: finalImageUrl,
    status
  };

  if (hasParentIdColumn) {
    payload.parent_id = parentId || null;
  }

  let { error } = await supabase.from("categories").insert(payload);
  if (error && error.message?.includes("parent_id")) {
    hasParentIdColumn = false;
    delete payload.parent_id;
    const retry = await supabase.from("categories").insert(payload);
    if (retry.error) {
      error = retry.error;
    } else {
      setMessage(modalMessage, "⚠️ บันทึกหมวดหมู่แล้ว (แต่ยังไม่ได้ผูกหมวดหลัก เนื่องจากยังไม่ได้รัน SQL เพิ่มคอลัมน์ parent_id ใน Supabase SQL Editor กรุณารันไฟล์ 004_category_hierarchy.sql)", true);
      await loadCategories();
      setTimeout(closeSubcatModal, 2200);
      modalSubmitBtn.disabled = false;
      return;
    }
  }

  if (error) {
    setMessage(modalMessage, `บันทึกหมวดย่อยไม่สำเร็จ: ${error.message}`, true);
    modalSubmitBtn.disabled = false;
  } else {
    setMessage(modalMessage, "✅ บันทึกหมวดย่อยเรียบร้อยแล้ว!");
    await loadCategories();
    setTimeout(closeSubcatModal, 700);
  }
});

requireAdmin().then(async (user) => {
  if (!user) return;
  await loadCategories();
  form.querySelector('[type="submit"]').disabled = false;
}).catch((error) => setMessage(message, `เริ่มต้นหน้าหมวดหมู่ไม่สำเร็จ: ${error.message}`, true));
