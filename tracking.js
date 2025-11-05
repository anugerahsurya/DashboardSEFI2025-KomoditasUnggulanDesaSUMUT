const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyNeBG-LGH6qxn-_5FZxfNDloXY50WnFgr3MuQNH9qpQ0lsbcfTWAqlRFWY7n6qGFQkaA/exec";

// --- Ambil lokasi user (city + country) ---
async function getLocation() {
  try {
    const res = await fetch("https://ipapi.co/json/"); // gratis, bebas pakai untuk demo
    const data = await res.json();
    return {
      city: data.city || "",
      country: data.country_name || "",
    };
  } catch {
    return { city: "", country: "" };
  }
}

// --- Kirim data ke Google Sheet ---
async function logEvent(eventName, extra = {}) {
  const loc = await getLocation();
  const payload = {
    event: eventName,
    url: window.location.href,
    userAgent: navigator.userAgent,
    city: loc.city,
    country: loc.country,
    ...extra,
  };

  fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("Gagal kirim log:", err));
}

// --- Page view otomatis saat load ---
window.addEventListener("load", () => logEvent("page_view"));

// --- Track klik semua tombol ---
document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    logEvent("button_click", { text: e.target.innerText });
  });
});

// --- Track scroll ---
let lastScroll = 0;
window.addEventListener("scroll", () => {
  const scrollY = window.scrollY;
  if (Math.abs(scrollY - lastScroll) > 50) {
    // kirim tiap 50px scroll
    lastScroll = scrollY;
    logEvent("scroll", {
      percent: `${Math.round((scrollY / document.body.scrollHeight) * 100)}%`,
    });
  }
});

// --- Track waktu aktif user tiap 30 detik ---
setInterval(() => {
  logEvent("active_time", { seconds: 30 });
}, 30000);

// --- Track custom events ---
function trackCustom(eventName, options = {}) {
  logEvent(eventName, options);
}

// contoh: track form submit
document.querySelectorAll("form").forEach((f) => {
  f.addEventListener("submit", (e) => {
    logEvent("form_submit", { text: e.target.id || e.target.name });
  });
});
