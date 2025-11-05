import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://zeksrlvgizvqjyjuagqj.supabase.co"; // ganti
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla3NybHZnaXp2cWp5anVhZ3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMTcxNDksImV4cCI6MjA3Nzg5MzE0OX0.fHbTVi4G9TV7PGFOLBGL3gpar-WUG9M_7LN_-o1AFn4"; // ganti

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Ambil lokasi user (opsional) ---
async function getLocation() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    return { city: data.city || "", country: data.country_name || "" };
  } catch {
    return { city: "", country: "" };
  }
}

// --- Kirim event ke Supabase ---
async function logEvent(eventName, extra = {}) {
  const loc = await getLocation();
  try {
    await supabase.from("web_logs").insert([
      {
        event: eventName,
        url: window.location.href,
        user_agent: navigator.userAgent,
        city: loc.city,
        country: loc.country,
        extra,
      },
    ]);
  } catch (err) {
    console.error("Gagal kirim log:", err);
  }
}

// --- Page view ---
window.addEventListener("load", () => logEvent("page_view"));

// --- Klik tombol ---
document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    logEvent("button_click", { text: e.target.innerText });
  });
});

// --- Scroll (debounce 500ms) ---
let scrollTimeout;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const percent = Math.round(
      (window.scrollY / document.body.scrollHeight) * 100
    );
    logEvent("scroll", { percent: percent + "%" });
  }, 500);
});

// --- Waktu aktif user tiap 30 detik ---
setInterval(() => logEvent("active_time", { seconds: 30 }), 30000);

// --- Form submit ---
document.querySelectorAll("form").forEach((f) => {
  f.addEventListener("submit", (e) => {
    logEvent("form_submit", { id: e.target.id || e.target.name });
  });
});

// --- Custom event function ---
window.trackCustom = (eventName, options = {}) => logEvent(eventName, options);
