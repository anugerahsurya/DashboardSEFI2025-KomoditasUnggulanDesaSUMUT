// table.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://zeksrlvgizvqjyjuagqj.supabase.co"; // ganti
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla3NybHZnaXp2cWp5anVhZ3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMTcxNDksImV4cCI6MjA3Nzg5MzE0OX0.fHbTVi4G9TV7PGFOLBGL3gpar-WUG9M_7LN_-o1AFn4"; // ganti

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tableBody = document.getElementById("log-table");
const refreshBtn = document.getElementById("refresh-btn");

// --- Fungsi untuk load log ---
async function loadLogs() {
  tableBody.innerHTML = `<tr>
      <td colspan="8" class="text-center text-muted">Memuat data aktivitas...</td>
    </tr>`;

  const { data, error } = await supabase
    .from("web_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100); // ambil 100 log terakhir

  if (error) {
    tableBody.innerHTML = `<tr>
      <td colspan="8" class="text-center text-danger">Gagal memuat data</td>
    </tr>`;
    console.error(error);
    return;
  }

  if (!data.length) {
    tableBody.innerHTML = `<tr>
      <td colspan="8" class="text-center text-muted">Belum ada data</td>
    </tr>`;
    return;
  }

  tableBody.innerHTML = "";

  data.forEach((log, index) => {
    const extra = log.extra || {};
    const textOrInfo = extra.text || extra.id || "";
    const duration = extra.seconds || "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${new Date(log.created_at).toLocaleString("id-ID")}</td>
      <td>${log.event}</td>
      <td>${log.url}</td>
      <td>${log.city || "-"}</td>
      <td>${log.country || "-"}</td>
      <td>${textOrInfo}</td>
      <td>${duration}</td>
    `;
    tableBody.appendChild(row);
  });
}

// --- Event refresh button ---
refreshBtn.addEventListener("click", loadLogs);

// --- Load saat halaman dibuka ---
window.addEventListener("load", loadLogs);
