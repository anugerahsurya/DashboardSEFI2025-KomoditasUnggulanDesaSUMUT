// Data Global
let geojsonData = null;
let poiData = [];
let filteredGeojsonLayer = null;
let poiLayer = null;
let selectedFeature = null;
let map = null; // Dideklarasikan di sini agar dapat diakses secara global

// Definisi Warna Kustom (mirip Python)
const CUSTOM_COLOR_MAP = {
  KARET: "#FFBF00", // Kuning
  KOPI: "#492C18", // Coklat gelap
  PADI: "#1A9B23", // Hijau
  LAINNYA: "#808080", // Abu-abu
};
const MARKER_COLOR_POI = "#DC3545"; // Merah Bootstrap

// --- MAPPING LULC SESUAI URUTAN LEGENDA (KODE 1 SAMPAI 8) ---
// Asumsi:
// 1 = Water
// 2 = Trees
// 3 = Grass
// 4 = Flooded Vegetation
// 5 = Crops
// 6 = Shrub and Scrub
// 7 = Built
// 8 = Bare
const LULC_ESRI_MAP = {
  1: "Badan Air", // Water
  2: "Pohon / Hutan", // Trees
  3: "Rumput/Padang Rumput", // Grass
  4: "Vegetasi Tergenang/Lahan Basah", // Flooded Vegetation
  5: "Tanaman Pertanian", // Crops
  6: "Semak dan Belukar", // Shrub and Scrub
  7: "Area Terbangun", // Built
  8: "Lahan Terbuka/Tidak Bervegetasi", // Bare
  99: "Lainnya/Tidak Didefinisikan", // Fallback untuk kode di luar 1-8
};

// Mapping Kolom
const COLUMN_MAP = {
  Kabupaten: "Nama Kabupaten",
  WADMKC: "Nama Kecamatan",
  WADMKD: "Nama Desa",
  LUAS: "Luas Wilayah",
  EVI: "Enhanced Vegetation Index (EVI)",
  MNDWI: "Modified Normalized Difference Water Index (MNDWI)",
  NDRE: "Normalized Difference Red Edge (NDRE)",
  NDVI: "Normalized Difference Vegetation Index (NDVI)",
  NDWI: "Normalized Difference Water Index (NDWI)",
  RVI: "Ratio Vegetation Index (RVI)",
  LULC: "Land Use/Land Cover (Tutupan Lahan)",
  Elevation: "Ketinggian (mdpl)",
  Slope: "Kemiringan Lahan (Derajat)",
  Rainfall: "Curah Hujan",
  Prediksi: "Komoditas Unggulan",
  jumlah_poi: "Jumlah POI Fasilitas Keuangan",
};
const DISPLAY_COLUMNS = Object.keys(COLUMN_MAP);

// --- INISIALISASI APLIKASI ---
document.addEventListener("DOMContentLoaded", () => {
  // Inisialisasi Peta Leaflet
  map = L.map("map", {
    scrollWheelZoom: true,
  }).setView([2.0, 99.5], 8);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Esri World Imagery",
      maxZoom: 18,
    }
  ).addTo(map);

  poiLayer = L.featureGroup().addTo(map); // Muat data dan terapkan listener

  loadData();
  document
    .getElementById("apply-filter-btn")
    .addEventListener("click", applyFilter); // Tambahkan listener untuk Tombol Reset
  document
    .getElementById("reset-filter-btn")
    .addEventListener("click", resetFilter);
});

// --- 1. FUNGSI MEMUAT DATA ASYNC ---
async function loadData() {
  try {
    const [geoJsonRes, poiJsonRes] = await Promise.all([
      fetch("data_desa.geojson"),
      fetch("data_poi.json"),
    ]);

    geojsonData = await geoJsonRes.json();
    poiData = await poiJsonRes.json();

    populateFilters();
    applyFilter();
  } catch (error) {
    console.error("Gagal memuat data GeoJSON atau POI:", error);
    document.getElementById("filter-status").innerHTML =
      '<span class="text-danger">❌ Gagal memuat data. Pastikan file `data_desa.geojson` dan `data_poi.json` tersedia.</span>';
  }
}

// --- 2. LOGIKA FILTER (Menggunakan Select Multiple) ---

// Fungsi untuk mengisi kedua select
function populateFilters() {
  const selectKab = document.getElementById("kabupaten-select");
  const selectKomoditas = document.getElementById("komoditas-select");

  const kabList = new Set();
  const komoditasList = new Set();

  // 🟢 Ubah: jangan filter berdasarkan TIPADM == 1
  geojsonData.features.forEach((f) => {
    kabList.add(f.properties.Kabupaten);
    if (f.properties.Prediksi) {
      komoditasList.add(f.properties.Prediksi);
    }
  });

  selectKab.innerHTML = "";
  [...kabList].sort().forEach((kab) => {
    const option = document.createElement("option");
    option.value = kab;
    option.textContent = kab;
    selectKab.appendChild(option);
  });

  selectKomoditas.innerHTML = "";
  [...komoditasList].sort().forEach((komoditas) => {
    const option = document.createElement("option");
    option.value = komoditas;
    option.textContent = komoditas;
    selectKomoditas.appendChild(option);
  });
}

// FUNGSI UNTUK MEMBACA DAN MENERAPKAN NILAI FILTER
function applyFilter() {
  const selectKabupaten = document.getElementById("kabupaten-select");
  const selectedKabupaten = Array.from(selectKabupaten.selectedOptions).map(
    (option) => option.value
  );

  const selectKomoditas = document.getElementById("komoditas-select");
  const selectedKomoditas = Array.from(selectKomoditas.selectedOptions).map(
    (option) => option.value
  );

  let filteredFeatures = geojsonData.features;

  // 1️⃣ Filter Kabupaten
  if (selectedKabupaten.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKabupaten.includes(f.properties.Kabupaten)
    );
  }

  // 2️⃣ Filter Komoditas
  if (selectedKomoditas.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKomoditas.includes(f.properties.Prediksi)
    );
  }

  // 🟢 Hapus filter TIPADM == 1 (biar semua unit tetap muncul)
  const filterCount = selectedKabupaten.length + selectedKomoditas.length;
  const totalAll = geojsonData.features.length;

  if (filterCount > 0) {
    document.getElementById(
      "filter-status"
    ).innerHTML = `<span class="text-success">✔️ ${filteredFeatures.length} wilayah terpilih.</span>`;
  } else {
    document.getElementById(
      "filter-status"
    ).innerHTML = `<span class="text-warning">⚠️ Menampilkan semua ${totalAll} wilayah.</span>`;
  }

  // 🟢 Kirim langsung tanpa pisahkan TIPADM=1
  const filteredGeoJson = {
    type: "FeatureCollection",
    features: filteredFeatures,
  };

  updateMap(filteredGeoJson);
  updateKPI(filteredGeoJson);
  updateCharts(filteredGeoJson);
  updateDetailTable(null);
}

// --- 4. LOGIKA UPDATE KPI ---
function updateKPI(filteredGeoJson) {
  const totalWilayah = filteredGeoJson.features.length;
  let wilayahPoiPositive = 0;
  let wilayahPoiZero = 0;

  filteredGeoJson.features.forEach((f) => {
    const jumlahPoi = f.properties.jumlah_poi || 0;
    if (jumlahPoi > 0) {
      wilayahPoiPositive += 1;
    } else {
      wilayahPoiZero += 1;
    }
  });

  document.getElementById("kpi-desa").textContent =
    totalWilayah.toLocaleString("id-ID"); // Total semua wilayah
  document.getElementById("kpi-poi").textContent =
    wilayahPoiPositive.toLocaleString("id-ID"); // Wilayah dengan POI > 0
  document.getElementById("kpi-komoditas").textContent =
    wilayahPoiZero.toLocaleString("id-ID"); // Wilayah dengan POI = 0
}

// --- 5. LOGIKA UPDATE CHARTS ---
function updateCharts(filteredGeoJson) {
  const features = filteredGeoJson.features;

  // CHART 1: Distribusi Komoditas
  const komoditasCount = features.reduce((acc, f) => {
    const komoditas = f.properties.Prediksi || "LAINNYA";
    acc[komoditas] = (acc[komoditas] || 0) + 1;
    return acc;
  }, {});

  const komoditasData = Object.entries(komoditasCount)
    .map(([komoditas, count]) => ({
      Komoditas: komoditas,
      Jumlah: count,
    }))
    .sort((a, b) => a.Jumlah - b.Jumlah);

  const layoutKomoditas = {
    margin: { t: 40, l: 120, r: 10, b: 40 },
    height: 350,
    xaxis: { title: "Jumlah Wilayah" },
    yaxis: { automargin: true },
  };

  Plotly.newPlot(
    "chart-komoditas",
    [
      {
        x: komoditasData.map((d) => d.Jumlah),
        y: komoditasData.map((d) => d.Komoditas),
        type: "bar",
        orientation: "h",
        marker: {
          color: komoditasData.map(
            (d) => CUSTOM_COLOR_MAP[d.Komoditas.toUpperCase()] || "#808080"
          ),
        },
      },
    ],
    layoutKomoditas
  );

  // CHART 2: Top 10 Berdasarkan Jumlah POI
  const poiDataDesa = features
    .map((f) => ({
      label: f.properties.WADMKD || f.properties.WADMKC || "Wilayah",
      jumlah: f.properties.jumlah_poi || 0,
    }))
    .filter((d) => d.jumlah > 0)
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 10)
    .reverse();

  const layoutPoi = {
    margin: { t: 40, l: 120, r: 10, b: 40 },
    height: 350,
    xaxis: { title: "Total POI" },
    yaxis: { automargin: true },
  };

  Plotly.newPlot(
    "chart-poi",
    [
      {
        x: poiDataDesa.map((d) => d.jumlah),
        y: poiDataDesa.map((d) => d.label),
        type: "bar",
        orientation: "h",
        marker: {
          color: "steelblue",
        },
      },
    ],
    layoutPoi
  );
}

// --- 6. LOGIKA DETAIL TABLE ---
function formatNilai(key, value) {
  if (value === null || value === undefined) return "N/A";

  if (key === "LULC") {
    // Pastikan nilai adalah numerik dan cari di map
    const lulcCode = parseInt(value);
    if (!isNaN(lulcCode) && LULC_ESRI_MAP[lulcCode]) {
      return LULC_ESRI_MAP[lulcCode];
    } // Fallback jika kode LULC tidak ditemukan (akan menggunakan 99)
    return LULC_ESRI_MAP[99] + ` (Kode ${lulcCode})`;
  }

  const numericValue = parseFloat(value);

  if (!isNaN(numericValue)) {
    if (key === "LUAS") {
      return `${numericValue.toFixed(2)} km\u00b2`;
    } // Format angka desimal lainnya
    return numericValue.toFixed(2);
  } // Jika non-numerik (string)

  return String(value);
}

function updateDetailTable(properties) {
  const tableBody = document.getElementById("detail-table-body");
  const titlePlaceholder = document.getElementById("detail-title-placeholder");

  tableBody.innerHTML = "";
  titlePlaceholder.innerHTML = "";

  if (!properties) {
    tableBody.innerHTML =
      '<tr><td colspan="2">Klik desa untuk melihat data.</td></tr>';
    titlePlaceholder.innerHTML =
      '<p class="mb-2">Silakan **klik** pada salah satu desa di peta untuk menampilkan detail atribut.</p>';
    return;
  }

  titlePlaceholder.innerHTML = `<p class="mb-2"><strong>Desa : ${
    properties.WADMKD || "-"
  }</strong></p>`;

  DISPLAY_COLUMNS.forEach((colKey) => {
    const row = tableBody.insertRow();
    const attrCell = row.insertCell();
    const valueCell = row.insertCell();

    attrCell.textContent = COLUMN_MAP[colKey];
    valueCell.textContent = formatNilai(colKey, properties[colKey]);
  });
}
