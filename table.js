const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyNeBG-LGH6qxn-_5FZxfNDloXY50WnFgr3MuQNH9qpQ0lsbcfTWAqlRFWY7n6qGFQkaA/exec"; // Web App Apps Script terbaru

async function loadLogs() {
  const tableBody = document.querySelector("#log-table tbody");
  tableBody.innerHTML =
    '<tr><td colspan="8" class="text-center text-muted">🔄 Memuat data...</td></tr>';

  try {
    const res = await fetch(SHEET_URL);
    const data = await res.json();

    if (!data || data.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="8" class="text-center text-muted">Belum ada aktivitas tercatat</td></tr>';
      return;
    }

    const rows = data
      .slice(-100) // tampilkan 100 data terakhir
      .reverse() // dari terbaru ke terlama
      .map(
        (r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${new Date(r.timestamp).toLocaleString("id-ID")}</td>
              <td><b>${r.event || "-"}</b></td>
              <td class="text-break">${r.url || "-"}</td>
              <td>${r.city || "-"}</td>
              <td>${r.country || "-"}</td>
              <td>${r.text || r.percent || r.state || "-"}</td>
              <td>${r.seconds || "-"}</td>
            </tr>
          `
      )
      .join("");

    tableBody.innerHTML = rows;
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuat data: ${err}</td></tr>`;
  }
}

// tombol refresh manual
document.getElementById("refresh-btn").addEventListener("click", loadLogs);

// load saat halaman dibuka
window.addEventListener("load", loadLogs);
