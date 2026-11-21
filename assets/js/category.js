import { displaySetupState, fetchCategories, fetchPublishedProducts, getFavorites, initFooter, renderProductCard, renderProductSkeletons } from "./store.js";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const container   = document.querySelector("#all-products");
const form        = document.querySelector("#catalog-form");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const sortOrder   = document.querySelector("#sort-order");
const countEl     = document.querySelector("#results-count");
const pagination  = document.querySelector("#pagination");
const sidebarCats = document.querySelector("#sidebar-categories");
const clearBtn    = document.querySelector("#sidebar-clear");
const searchClearBtn = document.querySelector("#search-clear-btn");

const pageSize = 24;
let currentPage = 0;

// ── Search Clear Button Helper ────────────────────────────────────────────────
function updateSearchClearBtn() {
  if (searchClearBtn) {
    searchClearBtn.hidden = !searchInput.value.trim();
  }
}

// ── URL params (initial state) ────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
searchInput.value  = params.get("q") || "";
updateSearchClearBtn();
searchInput.addEventListener("input", updateSearchClearBtn);

searchClearBtn?.addEventListener("click", () => {
  searchInput.value = "";
  updateSearchClearBtn();
  searchInput.focus();
  currentPage = 0;
  syncUrl();
  loadProducts();
});
let currentBudget  = params.get("budget") || "";
let currentPlatform = params.get("platform") || "";
let currentCatId   = params.get("category") || "";
let currentShipping = params.get("shipping") || "";
let onlyFavorites  = params.get("filter") === "fav";

// ── Favorites Badge & Chip Helper ─────────────────────────────────────────────
const favChip = document.querySelector("#chip-fav-filter");
const favCountEl = document.querySelector("#fav-count");

function updateFavCount() {
  const count = getFavorites().length;
  if (favCountEl) favCountEl.textContent = String(count);
}
window.addEventListener("favorites-updated", () => {
  updateFavCount();
  updateModalQuickTags();
  if (onlyFavorites) loadProducts();
});
updateFavCount();

if (favChip) {
  favChip.classList.toggle("active", onlyFavorites);
  favChip.addEventListener("click", () => {
    onlyFavorites = !onlyFavorites;
    favChip.classList.toggle("active", onlyFavorites);
    if (onlyFavorites) {
      chipCatGroup?.querySelectorAll(".filter-chip[data-cat]").forEach((c) => c.classList.remove("active"));
    } else {
      chipCatGroup?.querySelector(".filter-chip[data-cat='']")?.classList.add("active");
    }
    currentPage = 0;
    syncUrl();
    loadProducts();
  });
}

// Apply saved category dropdown value
categoryFilter.value = currentCatId;

// ── Mobile Sidebar Toggle & Quick Shipping Tab ───────────────────────────────
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebarEl = document.querySelector("#sidebar");
const sidebarCloseBtn = document.querySelector("#sidebar-close-btn");
const filterActiveDot = document.querySelector("#filter-active-dot");
const quickShippingTab = document.querySelector("#quick-shipping-tab");
const sortTabs = document.querySelectorAll(".sort-tab[data-sort]");

if (sidebarToggle && sidebarEl) {
  sidebarToggle.addEventListener("click", () => {
    const isOpen = sidebarEl.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

sidebarCloseBtn?.addEventListener("click", () => {
  sidebarEl?.classList.remove("open");
  sidebarToggle?.setAttribute("aria-expanded", "false");
});

function updateFilterActiveState() {
  const hasActiveFilter = Boolean(currentBudget || currentPlatform || currentCatId || currentShipping);
  if (filterActiveDot) {
    filterActiveDot.hidden = !hasActiveFilter;
  }
  if (sidebarToggle) {
    sidebarToggle.classList.toggle("active", hasActiveFilter);
  }
  if (quickShippingTab) {
    quickShippingTab.classList.toggle("active", currentShipping === "free");
  }
}

// ── Platform checkboxes ───────────────────────────────────────────────────────
const platformBoxes = document.querySelectorAll(".sidebar-check input[type=checkbox]");
platformBoxes.forEach((cb) => {
  if (cb.value.toLowerCase() === currentPlatform.toLowerCase()) cb.checked = true;
  cb.addEventListener("change", () => {
    // Allow only one platform at a time (toggle off if same clicked)
    platformBoxes.forEach((other) => { if (other !== cb) other.checked = false; });
    currentPlatform = cb.checked ? cb.value : "";
    currentPage = 0;
    updateFilterActiveState();
    syncUrl();
    loadProducts();
  });
});

// ── Budget radio buttons (sidebar) ────────────────────────────────────────────
const budgetRadios = document.querySelectorAll("[name=sidebar-budget]");
budgetRadios.forEach((r) => {
  if (r.value === currentBudget) r.checked = true;
  r.addEventListener("change", () => {
    currentBudget = r.value;
    currentPage = 0;
    updateFilterActiveState();
    syncUrl();
    loadProducts();
  });
});

// ── Shipping radio buttons (sidebar) ──────────────────────────────────────────
const shippingRadios = document.querySelectorAll("[name=sidebar-shipping]");
shippingRadios.forEach((r) => {
  if (r.value === currentShipping) r.checked = true;
  r.addEventListener("change", () => {
    currentShipping = r.value;
    currentPage = 0;
    updateFilterActiveState();
    syncUrl();
    loadProducts();
  });
});

// ── Clear filters ─────────────────────────────────────────────────────────────
clearBtn?.addEventListener("click", () => {
  currentBudget   = "";
  currentPlatform = "";
  currentCatId    = "";
  currentShipping = "";
  onlyFavorites   = false;
  favChip?.classList.remove("active");
  currentPage     = 0;
  searchInput.value = "";
  categoryFilter.value = "";
  sortOrder.value = "newest";
  platformBoxes.forEach((cb) => (cb.checked = false));
  budgetRadios.forEach((r) => { r.checked = r.value === ""; });
  shippingRadios.forEach((r) => { r.checked = r.value === ""; });
  document.querySelectorAll("[name=sidebar-cat]").forEach((r) => { r.checked = r.value === ""; });
  updateSidebarSubVisibility();
  quickShippingTab?.classList.remove("active");
  sortTabs.forEach((t) => t.classList.toggle("active", t.dataset.sort === "newest"));
  updateSearchClearBtn();
  syncCategoryChips();
  updateFilterActiveState();
  syncUrl();
  loadProducts();
});

// ── URL sync ──────────────────────────────────────────────────────────────────
function syncUrl() {
  const next = new URLSearchParams();
  if (searchInput.value.trim()) next.set("q", searchInput.value.trim());
  if (currentCatId) next.set("category", currentCatId);
  if (currentBudget) next.set("budget", currentBudget);
  if (currentPlatform) next.set("platform", currentPlatform);
  if (currentShipping) next.set("shipping", currentShipping);
  const suffix = next.size ? `?${next.toString()}` : "";
  window.history.replaceState(null, "", `${window.location.pathname}${suffix}`);
}

// ── Load categories (populate both dropdown + sidebar + full screen grid) ──
async function loadCategories() {
  const { data, error } = await fetchCategories();
  if (error || !data) return;

  // Render Full-Screen Category Modal Grid (with subcategories support)
  renderCategoryGrid(data);

  // Group parents & subcategories
  const parents = data.filter((c) => !c.parent_id);
  const childrenMap = new Map();
  data.forEach((c) => {
    if (c.parent_id) {
      if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, []);
      childrenMap.get(c.parent_id).push(c);
    }
  });

  // Populate header dropdown (with parent / sub indentation)
  categoryFilter.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "ทั้งหมด";
  categoryFilter.append(defaultOpt);

  parents.forEach((parent) => {
    const opt = document.createElement("option");
    opt.value = parent.id;
    opt.textContent = parent.name;
    if (currentCatId === parent.id) opt.selected = true;
    categoryFilter.append(opt);

    const subs = childrenMap.get(parent.id) || [];
    subs.forEach((sub) => {
      const subOpt = document.createElement("option");
      subOpt.value = sub.id;
      subOpt.textContent = `　↳ ${sub.name}`;
      if (currentCatId === sub.id) subOpt.selected = true;
      categoryFilter.append(subOpt);
    });
  });

  // Populate sidebar radios
  if (sidebarCats) {
    sidebarCats.replaceChildren();
    const allLabel = document.createElement("label");
    allLabel.className = "sidebar-check";
    const allRadio = document.createElement("input");
    allRadio.type = "radio";
    allRadio.name = "sidebar-cat";
    allRadio.value = "";
    allRadio.checked = !currentCatId;
    allRadio.addEventListener("change", () => {
      selectCategory("");
    });
    allLabel.append(allRadio, document.createTextNode(" ทั้งหมด"));
    sidebarCats.append(allLabel);

    parents.forEach((parent) => {
      const pLabel = document.createElement("label");
      pLabel.className = "sidebar-check sidebar-parent-cat";
      const pRadio = document.createElement("input");
      pRadio.type = "radio";
      pRadio.name = "sidebar-cat";
      pRadio.value = parent.id;
      pRadio.checked = currentCatId === parent.id;
      pRadio.addEventListener("change", () => {
        selectCategory(parent.id);
      });
      pLabel.append(pRadio, document.createTextNode(" " + parent.name));
      sidebarCats.append(pLabel);

      const subs = childrenMap.get(parent.id) || [];
      if (subs.length > 0) {
        const subGroup = document.createElement("div");
        subGroup.className = "sidebar-subcat-group";
        subGroup.dataset.parentId = parent.id;
        // ซ่อนหมวดย่อยเป็นค่าเริ่มต้น แสดงเฉพาะเมื่อเลือกหมวดหลักหรือหมวดย่อยนี้
        const isParentOrChildActive = currentCatId === parent.id || subs.some((s) => s.id === currentCatId);
        subGroup.hidden = !isParentOrChildActive;

        subs.forEach((sub) => {
          const sLabel = document.createElement("label");
          sLabel.className = "sidebar-check sidebar-sub-check";
          sLabel.style.paddingLeft = "20px";
          const sRadio = document.createElement("input");
          sRadio.type = "radio";
          sRadio.name = "sidebar-cat";
          sRadio.value = sub.id;
          sRadio.checked = currentCatId === sub.id;
          sRadio.addEventListener("change", () => {
            selectCategory(sub.id);
          });
          sLabel.append(sRadio, document.createTextNode(" ↳ " + sub.name));
          subGroup.append(sLabel);
        });
        sidebarCats.append(subGroup);
      }
    });
  }

  // Populate category chips (mobile)
  if (chipCatGroup) {
    chipCatGroup.querySelectorAll(".filter-chip[data-cat]:not([data-cat=''])").forEach((c) => c.remove());
    for (const cat of parents) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (currentCatId === cat.id ? " active" : "");
      chip.dataset.cat = cat.id;
      chip.textContent = cat.name;
      chip.addEventListener("click", function() { handleCatChipClick(this); });
      chipCatGroup.append(chip);
    }
    syncCategoryChips();
  }
}

// ── Load products ─────────────────────────────────────────────────────────────
async function loadProducts() {
  container.replaceChildren(renderProductSkeletons(10));

  let maxPrice = null;
  if (currentBudget === "1") maxPrice = 1;
  else if (currentBudget === "20") maxPrice = 20;
  else if (currentBudget === "50") maxPrice = 50;
  else if (currentBudget === "100") maxPrice = 100;

  const { data, error, count: resultCount } = await fetchPublishedProducts({
    categoryId: getEffectiveCategoryIds(currentCatId || categoryFilter.value),
    search:     searchInput.value.trim(),
    sort:       sortOrder.value,
    maxPrice,
    platform:   currentPlatform,
    shipping:   currentShipping,
    limit:      pageSize,
    offset:     currentPage * pageSize,
  });

  if (error) {
    displaySetupState(container, error.message.includes("ยังไม่ได้ตั้งค่า") ? error.message : "โหลดสินค้าไม่สำเร็จ");
    countEl.textContent = "";
    return;
  }

  let displayData = data;
  let finalCount = resultCount ?? data.length;

  if (onlyFavorites) {
    const favIds = getFavorites();
    displayData = data.filter((p) => favIds.includes(p.id));
    finalCount = displayData.length;
    countEl.textContent = `ดีลที่ถูกใจ ${finalCount} รายการ`;

    if (!favIds.length || !displayData.length) {
      container.innerHTML = `
        <div class="state-card">
          <p style="font-size:36px; margin:0 0 6px;">🤍</p>
          <p><strong>ยังไม่มีสินค้าในรายการที่ถูกใจ</strong></p>
          <p style="color:var(--muted); font-size:13px; margin:4px 0 16px;">แตะรูปหัวใจ 🤍 บนการ์ดสินค้า เพื่อบันทึกดีลไว้ดูภายหลังได้เลย</p>
          <button type="button" class="clear-filter-btn" id="fav-empty-back-btn">ดูสินค้าทั้งหมด</button>
        </div>
      `;
      document.querySelector("#fav-empty-back-btn")?.addEventListener("click", () => {
        onlyFavorites = false;
        favChip?.classList.remove("active");
        currentPage = 0;
        loadProducts();
      });
      pagination.replaceChildren();
      return;
    }
  } else {
    countEl.textContent = `พบ ${finalCount} รายการ`;
  }

  if (!displayData.length) {
    container.innerHTML = '<div class="state-card"><p>ไม่พบสินค้าที่ตรงกับการค้นหาหรือตัวกรองที่เลือก</p><button type="button" class="clear-filter-btn" id="empty-clear-btn">🔄 ล้างตัวกรองทั้งหมด</button></div>';
    document.querySelector("#empty-clear-btn")?.addEventListener("click", () => clearBtn?.click());
    pagination.replaceChildren();
    return;
  }

  container.replaceChildren(...displayData.map(renderProductCard));
  renderPagination(finalCount);
}

// ── Pagination Helper ─────────────────────────────────────────────────────────
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

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(total) {
  if (!total || total <= 0) { pagination.replaceChildren(); return; }
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const scrollToTop = () => {
    const scrollContainer = document.querySelector(".catalog-scroll");
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fragment = document.createDocumentFragment();

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "button button-outline";
  previous.textContent = "← ก่อนหน้า";
  previous.disabled = currentPage === 0;
  previous.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage -= 1;
      loadProducts();
      scrollToTop();
    }
  });
  fragment.append(previous);

  const numbersWrap = document.createElement("div");
  numbersWrap.className = "pagination-numbers";
  const pageList = getPageNumbers(currentPage, pageCount);

  for (const item of pageList) {
    if (typeof item === "number") {
      const pageBtn = document.createElement("button");
      pageBtn.type = "button";
      pageBtn.className = "pagination-number" + (item === currentPage ? " active" : "");
      pageBtn.textContent = String(item + 1);
      pageBtn.setAttribute("aria-label", `หน้า ${item + 1}`);
      if (item === currentPage) pageBtn.setAttribute("aria-current", "page");
      pageBtn.addEventListener("click", () => {
        if (currentPage !== item) {
          currentPage = item;
          loadProducts();
          scrollToTop();
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

  const next = document.createElement("button");
  next.type = "button";
  next.className = "button button-outline";
  next.textContent = "ถัดไป →";
  next.disabled = currentPage >= pageCount - 1;
  next.addEventListener("click", () => {
    if (currentPage < pageCount - 1) {
      currentPage += 1;
      loadProducts();
      scrollToTop();
    }
  });
  fragment.append(next);

  pagination.replaceChildren(fragment);
}

// ── Form events ───────────────────────────────────────────────────────────────
form.addEventListener("submit", (e) => {
  e.preventDefault();
  currentPage = 0;
  searchInput?.blur();
  collapseCategoryBar();
  syncUrl();
  loadProducts();
});
categoryFilter.addEventListener("change", () => {
  currentCatId = categoryFilter.value;
  // sync sidebar radio
  document.querySelectorAll("[name=sidebar-cat]").forEach((r) => { r.checked = r.value === currentCatId; });
  currentPage = 0;
  updateFilterActiveState();
  syncUrl();
  loadProducts();
});
sortOrder.addEventListener("change", () => { currentPage = 0; loadProducts(); });

// ── Sort Tabs & Quick Free Shipping Tab ───────────────────────────────────────
sortTabs.forEach((tab) => {
  if (tab.dataset.sort === sortOrder.value) tab.classList.add("active");
  tab.addEventListener("click", () => {
    sortTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    sortOrder.value = tab.dataset.sort;
    currentPage = 0;
    loadProducts();
  });
});

// Keep tabs in sync when select changes
sortOrder.addEventListener("change", () => {
  sortTabs.forEach((t) => {
    t.classList.toggle("active", t.dataset.sort === sortOrder.value);
  });
});

quickShippingTab?.addEventListener("click", () => {
  const isFree = currentShipping === "free";
  currentShipping = isFree ? "" : "free";
  quickShippingTab.classList.toggle("active", !isFree);
  const shippingRadios = document.querySelectorAll("[name=sidebar-shipping]");
  shippingRadios.forEach((r) => { r.checked = r.value === currentShipping; });
  currentPage = 0;
  updateFilterActiveState();
  syncUrl();
  loadProducts();
});

// ── Chip Category Buttons (mobile & desktop) ──────────────────────────────────
const chipCatGroup = document.querySelector("#chip-cat-group");
function syncCategoryChips() {
  if (!chipCatGroup) return;
  chipCatGroup.querySelectorAll(".filter-chip[data-cat]").forEach((c) => {
    const isActive = c.dataset.cat === currentCatId;
    c.classList.toggle("active", isActive);
    if (isActive) {
      c.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  });
}
function handleCatChipClick(chip) {
  onlyFavorites = false;
  favChip?.classList.remove("active");
  currentCatId = chip.dataset.cat;
  categoryFilter.value = currentCatId;
  // sync sidebar radio
  document.querySelectorAll("[name=sidebar-cat]").forEach((r) => { r.checked = r.value === currentCatId; });
  currentPage = 0;
  updateFilterActiveState();
  syncCategoryChips();
  chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  syncUrl();
  loadProducts();
}
// Wire the initial "ทั้งหมด" chip
if (chipCatGroup) {
  chipCatGroup.querySelector(".filter-chip[data-cat='']")?.addEventListener("click", function() { handleCatChipClick(this); });
}

// ── Enable Mouse Wheel & Drag Scrolling on Chip Groups ────────────────────────
function enableChipHorizontalScroll() {
  document.querySelectorAll(".chip-group").forEach((group) => {
    // 1. Mouse wheel horizontal scrolling
    group.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        group.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // 2. Mouse click & drag to scroll
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    group.addEventListener("mousedown", (e) => {
      isDown = true;
      hasMoved = false;
      startX = e.pageX - group.offsetLeft;
      scrollLeft = group.scrollLeft;
      group.classList.add("dragging");
    });

    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      group.classList.remove("dragging");
      setTimeout(() => { hasMoved = false; }, 60);
    });

    group.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const x = e.pageX - group.offsetLeft;
      const walk = (x - startX) * 1.6;
      if (Math.abs(walk) > 4) {
        hasMoved = true;
        e.preventDefault();
        group.scrollLeft = scrollLeft - walk;
      }
    });

    // Prevent accidental button clicks when dragging
    group.addEventListener("click", (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  });
}

// ── Back to Top Floating Button ───────────────────────────────────────────────
const backToTopBtn = document.querySelector("#back-to-top-btn");
const catalogScroll = document.querySelector(".catalog-scroll");

function checkScrollTop() {
  const scrollTop = (catalogScroll ? catalogScroll.scrollTop : 0) || window.scrollY || document.documentElement.scrollTop;
  if (backToTopBtn) {
    backToTopBtn.hidden = scrollTop < 320;
  }
}

window.addEventListener("scroll", checkScrollTop, { passive: true });
catalogScroll?.addEventListener("scroll", checkScrollTop, { passive: true });

backToTopBtn?.addEventListener("click", () => {
  if (catalogScroll) catalogScroll.scrollTo({ top: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ── Scroll Edge Affordance & Micro-Hint ───────────────────────────────────────
function initScrollEdgeAffordance() {
  document.querySelectorAll(".chip-row-wrapper").forEach((wrapper) => {
    const group = wrapper.querySelector(".chip-group");
    const fade = wrapper.querySelector(".scroll-edge-fade");
    if (!group || !fade) return;

    const checkOverflow = () => {
      const hasOverflow = group.scrollWidth > group.clientWidth + 4;
      const isAtEnd = group.scrollLeft >= group.scrollWidth - group.clientWidth - 8;
      fade.classList.toggle("hidden", !hasOverflow || isAtEnd);
    };

    group.addEventListener("scroll", checkOverflow, { passive: true });
    window.addEventListener("resize", checkOverflow, { passive: true });
    checkOverflow();
  });
}

function playScrollHint() {
  const catGroup = document.querySelector("#chip-cat-group");
  if (catGroup && catGroup.scrollWidth > catGroup.clientWidth + 10) {
    setTimeout(() => {
      catGroup.scrollTo({ left: 32, behavior: "smooth" });
      setTimeout(() => {
        catGroup.scrollTo({ left: 0, behavior: "smooth" });
      }, 420);
    }, 400);
  }
}

// ── Full-Screen Category Modal (Shopee Mobile Style with Subcategories) ──────
const categoryModal = document.querySelector("#category-modal");
const categoryModalClose = document.querySelector("#category-modal-close");
const modalSearchInput = document.querySelector("#modal-search-input");
const modalSearchClear = document.querySelector("#modal-search-clear");
const modalFavCount = document.querySelector("#modal-fav-count");
const modalCatCountHint = document.querySelector("#modal-cat-count-hint");
const categoryGrid = document.querySelector("#category-grid");
const subcategoryGrid = document.querySelector("#subcategory-grid");
const modalViewMain = document.querySelector("#modal-view-main");
const modalViewSub = document.querySelector("#modal-view-sub");
const subBackBtn = document.querySelector("#sub-back-btn");
const subParentTitle = document.querySelector("#sub-parent-title");
const subAllBtn = document.querySelector("#sub-all-btn");
const subAllText = document.querySelector("#sub-all-text");
const modalQuickTags = document.querySelectorAll(".modal-quick-tag");

let allCategoriesCache = [];
let currentActiveParent = null;

function getEffectiveCategoryIds(catId) {
  if (!catId) return null;
  const subs = allCategoriesCache.filter((c) => c.parent_id === catId).map((c) => c.id);
  if (subs.length > 0) {
    return [catId, ...subs];
  }
  return catId;
}

function showMainCategoriesView() {
  currentActiveParent = null;
  if (modalViewMain) modalViewMain.hidden = false;
  if (modalViewSub) modalViewSub.hidden = true;
}

function showSubcategoriesView(parentCategory) {
  currentActiveParent = parentCategory;
  if (modalViewMain) modalViewMain.hidden = true;
  if (modalViewSub) modalViewSub.hidden = false;

  if (subParentTitle) subParentTitle.textContent = parentCategory.name;
  if (subAllText) subAllText.textContent = `⚡ ดูสินค้าทั้งหมดในหมวด ${parentCategory.name}`;

  const subs = allCategoriesCache.filter((c) => c.parent_id === parentCategory.id);
  renderSubcategoryGrid(parentCategory, subs);
}

function openCategoryModal() {
  if (!categoryModal) return;
  showMainCategoriesView();
  categoryModal.classList.add("open");
  categoryModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  if (modalSearchInput) {
    modalSearchInput.value = searchInput.value;
    updateModalSearchClear();
    setTimeout(() => { modalSearchInput.focus(); }, 120);
  }

  updateModalQuickTags();
  syncCategoryGridActiveState();
}

function closeCategoryModal() {
  if (!categoryModal) return;
  categoryModal.classList.remove("open");
  categoryModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function updateModalSearchClear() {
  if (modalSearchClear) {
    modalSearchClear.hidden = !modalSearchInput?.value.trim();
  }
}

function updateModalQuickTags() {
  if (modalFavCount) {
    modalFavCount.textContent = String(getFavorites().length);
  }
  modalQuickTags.forEach((tag) => {
    const isFav = tag.dataset.cat === "fav";
    if (isFav) {
      tag.classList.toggle("active", onlyFavorites);
    } else {
      tag.classList.toggle("active", !onlyFavorites && !currentCatId);
    }
  });
}

function syncCategoryGridActiveState() {
  if (!categoryGrid) return;
  categoryGrid.querySelectorAll(".category-grid-item").forEach((card) => {
    const isActive = !onlyFavorites && card.dataset.cat === currentCatId;
    card.classList.toggle("active", isActive);
  });
  if (subcategoryGrid) {
    subcategoryGrid.querySelectorAll(".category-grid-item").forEach((card) => {
      const isActive = !onlyFavorites && card.dataset.cat === currentCatId;
      card.classList.toggle("active", isActive);
    });
  }
}

function updateSidebarSubVisibility() {
  document.querySelectorAll(".sidebar-subcat-group").forEach((group) => {
    const parentId = group.dataset.parentId;
    const hasActiveChild = Array.from(group.querySelectorAll("input[type=radio]")).some((r) => r.checked);
    const isParentSelected = currentCatId === parentId;
    group.hidden = !(isParentSelected || hasActiveChild);
  });
}

function selectCategory(catId) {
  onlyFavorites = false;
  favChip?.classList.remove("active");
  currentCatId = catId;
  categoryFilter.value = catId;
  document.querySelectorAll("[name=sidebar-cat]").forEach((r) => { r.checked = r.value === currentCatId; });
  updateSidebarSubVisibility();
  closeCategoryModal();
  currentPage = 0;
  updateFilterActiveState();
  syncCategoryChips();
  syncCategoryGridActiveState();
  syncUrl();
  loadProducts();
}

function renderCategoryGrid(categories) {
  allCategoriesCache = categories || [];
  if (!categoryGrid) return;

  const parents = allCategoriesCache.filter((c) => !c.parent_id);
  const subsMap = new Map();
  allCategoriesCache.forEach((c) => {
    if (c.parent_id) {
      if (!subsMap.has(c.parent_id)) subsMap.set(c.parent_id, []);
      subsMap.get(c.parent_id).push(c);
    }
  });

  if (modalCatCountHint) {
    modalCatCountHint.textContent = `${parents.length} หมวดหลัก`;
  }

  categoryGrid.replaceChildren(...parents.map((cat) => {
    const card = document.createElement("button");
    card.type = "button";
    const subList = subsMap.get(cat.id) || [];
    const hasSubs = subList.length > 0;

    card.className = "category-grid-item" + (currentCatId === cat.id && !onlyFavorites ? " active" : "");
    card.dataset.cat = cat.id;

    const imgBox = document.createElement("div");
    imgBox.className = "cat-img-box";

    if (cat.image_url) {
      const img = document.createElement("img");
      img.src = cat.image_url;
      img.alt = cat.name;
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        const ph = document.createElement("span");
        ph.className = "cat-fallback-icon";
        ph.textContent = "🏷️";
        imgBox.append(ph);
      };
      imgBox.append(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "cat-fallback-icon";
      ph.textContent = "🏷️";
      imgBox.append(ph);
    }

    const title = document.createElement("span");
    title.className = "cat-grid-title";
    title.textContent = cat.name;

    card.append(imgBox, title);

    if (hasSubs) {
      const badge = document.createElement("span");
      badge.className = "cat-sub-count-badge";
      badge.textContent = `${subList.length} หมวดย่อย ›`;
      card.append(badge);
    }

    card.addEventListener("click", () => {
      if (hasSubs) {
        showSubcategoriesView(cat);
      } else {
        selectCategory(cat.id);
      }
    });

    return card;
  }));
}

function renderSubcategoryGrid(parentCat, subcategories) {
  if (!subcategoryGrid) return;
  subcategoryGrid.replaceChildren(...subcategories.map((sub) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "category-grid-item" + (currentCatId === sub.id && !onlyFavorites ? " active" : "");
    card.dataset.cat = sub.id;

    const imgBox = document.createElement("div");
    imgBox.className = "cat-img-box";

    if (sub.image_url) {
      const img = document.createElement("img");
      img.src = sub.image_url;
      img.alt = sub.name;
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        const ph = document.createElement("span");
        ph.className = "cat-fallback-icon";
        ph.textContent = "🔹";
        imgBox.append(ph);
      };
      imgBox.append(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "cat-fallback-icon";
      ph.textContent = "🔹";
      imgBox.append(ph);
    }

    const title = document.createElement("span");
    title.className = "cat-grid-title";
    title.textContent = sub.name;

    card.append(imgBox, title);

    card.addEventListener("click", () => {
      selectCategory(sub.id);
    });

    return card;
  }));
}

function filterCategoryGrid(query) {
  if (!categoryGrid) return;
  const q = query.toLowerCase();
  if (q) {
    showMainCategoriesView();
    const matches = allCategoriesCache.filter((c) => c.name.toLowerCase().includes(q));
    categoryGrid.replaceChildren(...matches.map((cat) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "category-grid-item" + (currentCatId === cat.id && !onlyFavorites ? " active" : "");
      card.dataset.cat = cat.id;
      const isSub = Boolean(cat.parent_id);

      const imgBox = document.createElement("div");
      imgBox.className = "cat-img-box";
      if (cat.image_url) {
        const img = document.createElement("img");
        img.src = cat.image_url;
        img.alt = cat.name;
        imgBox.append(img);
      } else {
        const ph = document.createElement("span");
        ph.className = "cat-fallback-icon";
        ph.textContent = isSub ? "🔹" : "🏷️";
        imgBox.append(ph);
      }

      const title = document.createElement("span");
      title.className = "cat-grid-title";
      title.textContent = cat.name;
      card.append(imgBox, title);

      if (isSub) {
        const parent = allCategoriesCache.find((p) => p.id === cat.parent_id);
        const subBadge = document.createElement("span");
        subBadge.className = "cat-sub-count-badge";
        subBadge.textContent = parent ? `ใน ${parent.name}` : "หมวดย่อย";
        card.append(subBadge);
      }

      card.addEventListener("click", () => {
        selectCategory(cat.id);
      });
      return card;
    }));
  } else {
    renderCategoryGrid(allCategoriesCache);
  }
}

subBackBtn?.addEventListener("click", showMainCategoriesView);

subAllBtn?.addEventListener("click", () => {
  if (currentActiveParent) {
    selectCategory(currentActiveParent.id);
  }
});

// Open modal when tapping on the search input or search bar
searchInput?.addEventListener("focus", (e) => {
  e.preventDefault();
  openCategoryModal();
});

searchInput?.addEventListener("click", (e) => {
  e.preventDefault();
  openCategoryModal();
});

categoryModalClose?.addEventListener("click", closeCategoryModal);

modalSearchClear?.addEventListener("click", () => {
  if (modalSearchInput) {
    modalSearchInput.value = "";
    updateModalSearchClear();
    modalSearchInput.focus();
    filterCategoryGrid("");
  }
});

modalSearchInput?.addEventListener("input", () => {
  updateModalSearchClear();
  filterCategoryGrid(modalSearchInput.value.trim());
});

modalSearchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchInput.value = modalSearchInput.value.trim();
    updateSearchClearBtn();
    closeCategoryModal();
    currentPage = 0;
    syncUrl();
    loadProducts();
  } else if (e.key === "Escape") {
    closeCategoryModal();
  }
});

// Quick tags click inside modal
modalQuickTags.forEach((tag) => {
  tag.addEventListener("click", () => {
    const cat = tag.dataset.cat;
    if (cat === "fav") {
      onlyFavorites = true;
      currentCatId = "";
      categoryFilter.value = "";
      favChip?.classList.add("active");
    } else {
      onlyFavorites = false;
      currentCatId = "";
      categoryFilter.value = "";
      favChip?.classList.remove("active");
    }
    document.querySelectorAll("[name=sidebar-cat]").forEach((r) => { r.checked = r.value === ""; });
    closeCategoryModal();
    currentPage = 0;
    updateFilterActiveState();
    syncCategoryChips();
    syncCategoryGridActiveState();
    syncUrl();
    loadProducts();
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && categoryModal?.classList.contains("open")) {
    closeCategoryModal();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
initFooter();
updateFilterActiveState();
await loadCategories();
enableChipHorizontalScroll();
initScrollEdgeAffordance();
await loadProducts();
