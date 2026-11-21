import { supabase } from "./supabase.js";
import { displayDate, requireAdmin, setMessage, statusLabel } from "./admin-common.js";
import { formatPrice } from "./store.js";

const metrics = document.querySelector("#dashboard-metrics");
const latest = document.querySelector("#latest-products");
const topClicked = document.querySelector("#top-clicked-products");
const message = document.querySelector("#dashboard-message");

function cell(row, value) {
  const td = document.createElement("td");
  td.textContent = value;
  row.append(td);
}

async function loadDashboard() {
  const user = await requireAdmin();
  if (!user) return;
  const [all, published, categories, latestProducts, topProducts] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("products").select("title,source_store,source_domain,source_price,currency,status,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("products").select("title,source_store,source_domain,source_price,currency,clicks_count,last_clicked_at").order("clicks_count", { ascending: false }).limit(5)
  ]);
  const resultError = [all, published, categories, latestProducts].find((result) => result.error)?.error;
  if (resultError) {
    setMessage(message, `โหลดข้อมูล Dashboard ไม่สำเร็จ: ${resultError.message}`, true);
    return;
  }

  // คำนวณยอดคลิกรวมทั้งหมด
  let totalClicks = 0;
  if (topProducts.data) {
    totalClicks = topProducts.data.reduce((sum, p) => sum + (p.clicks_count || 0), 0);
  }

  metrics.replaceChildren(
    metric("📦 สินค้าทั้งหมด", all.count),
    metric("🟢 เผยแพร่อยู่", published.count),
    metric("📁 หมวดหมู่ทั้งหมด", categories.count),
    metric("🔥 ยอดคลิกไปซื้อรวม", `${totalClicks} ครั้ง`)
  );

  // Render ตารางสินค้าที่คนคลิกมากที่สุด (Top Clicked)
  if (topClicked) {
    if (!topProducts.data || !topProducts.data.length || totalClicks === 0) {
      topClicked.innerHTML = '<tr><td class="empty-cell" colspan="5">ยังไม่มีสถิติการคลิกไปซื้อ (ระบบจะนับอัตโนมัติเมื่อลูกค้าคลิกปุ่ม "สั่งซื้อ")</td></tr>';
    } else {
      const topRows = topProducts.data.map((p, idx) => {
        const tr = document.createElement("tr");
        const titleTd = document.createElement("td");
        titleTd.innerHTML = `<strong>#${idx + 1}</strong> ${p.title || 'ไม่มีชื่อ'}`;
        tr.append(titleTd);

        cell(tr, p.source_store || p.source_domain || "Shopee/Lazada");
        cell(tr, formatPrice(p.source_price, p.currency));

        const clickTd = document.createElement("td");
        clickTd.style.textAlign = "center";
        clickTd.innerHTML = `<span class="status-pill active" style="font-weight:700;">🔥 ${p.clicks_count || 0} ครั้ง</span>`;
        tr.append(clickTd);

        cell(tr, p.last_clicked_at ? displayDate(p.last_clicked_at) : "ยังไม่มี");
        return tr;
      });
      topClicked.replaceChildren(...topRows);
    }
  }

  if (!latestProducts.data.length) {
    latest.innerHTML = '<tr><td class="empty-cell" colspan="5">ยังไม่มีสินค้า</td></tr>';
    return;
  }
  const rows = latestProducts.data.map((product) => {
    const tr = document.createElement("tr");
    cell(tr, product.title);
    cell(tr, product.source_store || product.source_domain || "—");
    cell(tr, formatPrice(product.source_price, product.currency));
    const status = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-pill ${product.status}`;
    badge.textContent = statusLabel(product.status);
    status.append(badge);
    tr.append(status);
    cell(tr, displayDate(product.created_at));
    return tr;
  });
  latest.replaceChildren(...rows);
}

function metric(label, value) {
  const card = document.createElement("div");
  card.className = "metric-card";
  const name = document.createElement("small");
  name.textContent = label;
  const number = document.createElement("strong");
  number.textContent = String(value ?? 0);
  card.append(name, number);
  return card;
}

loadDashboard().catch((error) => setMessage(message, `เกิดข้อผิดพลาด: ${error.message}`, true));
