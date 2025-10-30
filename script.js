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

// Fungsi yang dikembalikan untuk mengisi kedua select
function populateFilters() {
  const selectKab = document.getElementById("kabupaten-select");
  const selectKomoditas = document.getElementById("komoditas-select");

  const kabList = new Set();
  const komoditasList = new Set();

  geojsonData.features.forEach((f) => {
    kabList.add(f.properties.Kabupaten);
    if (f.properties.Prediksi) {
      komoditasList.add(f.properties.Prediksi);
    }
  }); // Populate Kabupaten Select

  selectKab.innerHTML = "";
  [...kabList].sort().forEach((kab) => {
    const option = document.createElement("option");
    option.value = kab;
    option.textContent = kab;
    selectKab.appendChild(option);
  }); // Populate Komoditas Select

  selectKomoditas.innerHTML = "";
  [...komoditasList].sort().forEach((komoditas) => {
    const option = document.createElement("option");
    option.value = komoditas;
    option.textContent = komoditas;
    selectKomoditas.appendChild(option);
  });
}

// Fungsi yang dikembalikan untuk membaca nilai dari select multiple
function applyFilter() {
  const selectKabupaten = document.getElementById("kabupaten-select");
  const selectedKabupaten = Array.from(selectKabupaten.selectedOptions).map(
    (option) => option.value
  );

  const selectKomoditas = document.getElementById("komoditas-select");
  const selectedKomoditas = Array.from(selectKomoditas.selectedOptions).map(
    (option) => option.value
  );

  let filteredFeatures = geojsonData.features; // Filter Kabupaten

  if (selectedKabupaten.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKabupaten.includes(f.properties.Kabupaten)
    );
  } // Filter Komoditas

  if (selectedKomoditas.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKomoditas.includes(f.properties.Prediksi)
    );
  } // Teks status

  const totalGeoData = geojsonData.features.length;
  const filterCount = selectedKabupaten.length + selectedKomoditas.length;

  if (filterCount > 0) {
    document.getElementById(
      "filter-status"
    ).innerHTML = `<span class="text-success">✔️ ${filteredFeatures.length} desa terpilih.</span>`;
  } else {
    // Jika tidak ada yang dipilih, tampilkan semua (mode default)
    document.getElementById(
      "filter-status"
    ).innerHTML = `<span class="text-warning">⚠️ Menampilkan semua ${totalGeoData} desa.</span>`;
  }

  const filteredGeoJson = {
    type: "FeatureCollection",
    features: filteredFeatures,
  };

  updateMap(filteredGeoJson);
  updateKPI(filteredGeoJson);
  updateCharts(filteredGeoJson);
  updateDetailTable(null); // Reset detail
}

// Fungsi untuk mereset filter
function resetFilter() {
  // Deselect semua opsi di Select Kabupaten
  Array.from(document.getElementById("kabupaten-select").options).forEach(
    (option) => {
      option.selected = false;
    }
  ); // Deselect semua opsi di Select Komoditas
  Array.from(document.getElementById("komoditas-select").options).forEach(
    (option) => {
      option.selected = false;
    }
  ); // Terapkan filter kembali (akan menampilkan semua data)

  applyFilter();
}

// --- 3. LOGIKA UPDATE PETA (Pengganti Folium/Streamlit-Folium) ---
function getStyle(feature) {
  // Cek kondisi TIPADM == 2 untuk mengabaikan pewarnaan komoditas
  if (feature.properties.TIPADM == 2) {
    return {
      fillColor: "white", // Warna putih untuk TIPADM == 2
      color: "black",
      weight: 0.5,
      fillOpacity: 0.5, // Sedikit transparan agar terlihat berbeda
    };
  } // Logika normal untuk pewarnaan berdasarkan Komoditas

  const prediksi = (feature.properties.Prediksi || "LAINNYA").toUpperCase();
  const color = CUSTOM_COLOR_MAP[prediksi] || CUSTOM_COLOR_MAP["LAINNYA"];

  let weight = 0.5;
  let outlineColor = "black"; // Logika highlight untuk fitur yang sedang diklik (selectedFeature)

  if (
    selectedFeature &&
    selectedFeature.properties.WADMKD === feature.properties.WADMKD
  ) {
    weight = 3;
    outlineColor = "white";
  }

  return {
    fillColor: color,
    color: outlineColor,
    weight: weight,
    fillOpacity: 0.7,
  };
}

// FUNGSI ON EACH FEATURE YANG DIMODIFIKASI UNTUK HOVER POPUP
function onEachFeature(feature, layer) {
  const props = feature.properties;
  const popupContent = `
        <b>Desa:</b> ${props.WADMKD}<br>
        <b>Kabupaten:</b> ${props.Kabupaten}<br>
        <b>Komoditas:</b> ${props.Prediksi}<br>
        <b>Jumlah POI:</b> ${props.jumlah_poi}
    `; // TIDAK LANGSUNG bindPopup, kita gunakan on-hover // Tambahkan event mouseover untuk menampilkan popup

  layer.on("mouseover", function (e) {
    // Tampilkan popup
    layer.bindPopup(popupContent).openPopup(); // Beri highlight ringan saat hover

    layer.setStyle({
      weight: 2,
      color: "#333",
      fillOpacity: 0.9,
    });
  }); // Tambahkan event mouseout untuk menutup popup dan mereset style

  layer.on("mouseout", function (e) {
    // Tutup popup
    layer.closePopup(); // Reset style menggunakan getStyle. Ini penting agar desa yang sedang diklik // tetap mempertahankan style "selected" mereka.

    layer.setStyle(getStyle(feature));
  }); // Pertahankan event click untuk memilih fitur dan mengisi detail tabel

  layer.on("click", function (e) {
    // Reset style fitur yang sebelumnya diklik
    if (selectedFeature && filteredGeojsonLayer) {
      filteredGeojsonLayer.eachLayer(function (l) {
        if (l.feature.properties.WADMKD === selectedFeature.properties.WADMKD) {
          l.setStyle(getStyle(l.feature));
        }
      });
    } // Simpan fitur yang baru diklik

    selectedFeature = feature; // Beri style 'selected' (getStyle akan menangani ini)

    layer.setStyle(getStyle(feature)); // Update detail tabel (Hanya saat klik)

    updateDetailTable(feature.properties);
  });
}

function updateMap(filteredGeoJson) {
  // Hapus layer GeoJSON lama
  if (filteredGeojsonLayer) {
    map.removeLayer(filteredGeojsonLayer);
  } // Hapus layer POI lama
  poiLayer.clearLayers(); // Reset selected feature

  selectedFeature = null; // Tambahkan layer GeoJSON baru

  if (filteredGeoJson.features.length > 0) {
    filteredGeojsonLayer = L.geoJSON(filteredGeoJson, {
      style: getStyle,
      onEachFeature: onEachFeature,
    }).addTo(map);

    try {
      map.fitBounds(filteredGeojsonLayer.getBounds());
    } catch (e) {
      // Fallback jika getBounds() gagal (misalnya hanya 1 titik)
      map.setView([2.0, 99.5], 8);
    }
  } else {
    map.setView([2.0, 99.5], 8); // Reset view jika tidak ada data
  } // Tambahkan Marker POI (Semua POI)

  poiData.forEach((row) => {
    try {
      const lat = parseFloat(row.latitude);
      const lon = parseFloat(row.longitude);
      const poiName = row.name || `POI-${poiData.indexOf(row) + 1}`;
      const poiCategory = row.Kategori_POI || "Umum";
      const poiKabupaten = row.Kabupaten || "N/A";

      L.circleMarker([lat, lon], {
        radius: 4,
        color: MARKER_COLOR_POI,
        weight: 1,
        fill: true,
        fillColor: MARKER_COLOR_POI,
        fillOpacity: 0.7,
      })
        .bindPopup(
          `<b>${poiName}</b><br>Kategori: ${poiCategory}<br>Kabupaten: ${poiKabupaten}`
        )
        .addTo(poiLayer);
    } catch (e) {
      // Abaikan POI dengan koordinat tidak valid
    }
  }); // Layer Control (optional)

  if (filteredGeojsonLayer) {
    L.control
      .layers(null, {
        "Desa Terpilih": filteredGeojsonLayer,
        "Point of Interest": poiLayer,
      })
      .addTo(map);
  }
}

// --- 4. LOGIKA UPDATE KPI ---
function updateKPI(filteredGeoJson) {
  const totalDesa = filteredGeoJson.features.length;
  let desaPoiPositive = 0;
  let desaPoiZero = 0;

  filteredGeoJson.features.forEach((f) => {
    const jumlahPoi = f.properties.jumlah_poi || 0;
    if (jumlahPoi > 0) {
      desaPoiPositive += 1;
    } else {
      desaPoiZero += 1;
    }
  });

  document.getElementById("kpi-desa").textContent =
    totalDesa.toLocaleString("id-ID");
  document.getElementById("kpi-poi").textContent =
    desaPoiPositive.toLocaleString("id-ID"); // Desa dengan POI > 0
  document.getElementById("kpi-komoditas").textContent =
    desaPoiZero.toLocaleString("id-ID"); // Desa dengan POI = 0
}

// --- 5. LOGIKA UPDATE CHARTS (Menggunakan Plotly.js) ---
function updateCharts(filteredGeoJson) {
  const features = filteredGeoJson.features; // ----------------------------------------------------------------- // CHART 1: DISTRIBUSI DESA PER KOMODITAS (TETAP) // -----------------------------------------------------------------

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
    title: "Distribusi Desa per Komoditas Unggulan",
    margin: { t: 40, l: 120, r: 10, b: 40 },
    height: 350,
    xaxis: { title: "Jumlah Desa" },
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
  ); // ----------------------------------------------------------------- // CHART 2: TOP 10 DESA BERDASARKAN JUMLAH POI (TETAP) // -----------------------------------------------------------------

  const poiDataDesa = features
    .map((f) => ({
      // HANYA MENGGUNAKAN NAMA DESA
      label: f.properties.WADMKD,
      jumlah: f.properties.jumlah_poi || 0,
    }))
    .filter((d) => d.jumlah > 0) // Hanya desa dengan POI > 0
    .sort((a, b) => b.jumlah - a.jumlah) // Urutkan dari terbesar ke terkecil
    .slice(0, 10) // Ambil hanya 10 desa teratas
    .reverse(); // Balikkan urutan untuk Plotly (tertinggi di atas)

  const layoutPoi = {
    title: "Top 10 Desa dengan POI Fasilitas Keuangan Terbanyak",
    margin: { t: 40, l: 120, r: 10, b: 40 }, // Margin disesuaikan
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
          color: "steelblue", // Warna tunggal 'steelblue'
        },
      },
    ],
    layoutPoi
  );
}

// --- 6. LOGIKA DETAIL TABLE ---
function formatNilai(key, value) {
  if (value === null || value === undefined) return "N/A"; // --- KASUS SPESIAL: LULC (Disesuaikan untuk kode 1-8) ---

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
