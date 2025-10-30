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
  TIPADM: "Tipe Administrasi",
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

  poiLayer = L.featureGroup().addTo(map);

  loadData();
  document
    .getElementById("apply-filter-btn")
    .addEventListener("click", applyFilter);
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

  // Mengambil semua nilai dari semua fitur (tanpa filter TIPADM)
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

  // Filter dimulai dari SEMUA fitur (tidak ada filter implisit)
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

  // Update Status
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

  const filteredGeoJson = {
    type: "FeatureCollection",
    features: filteredFeatures,
  };

  updateMap(filteredGeoJson);
  updateKPI(filteredGeoJson);
  updateCharts(filteredGeoJson);
  updateDetailTable(null);
}

// FUNGSI RESET FILTER
function resetFilter() {
  // Deselect semua opsi
  Array.from(document.getElementById("kabupaten-select").options).forEach(
    (option) => (option.selected = false)
  );
  Array.from(document.getElementById("komoditas-select").options).forEach(
    (option) => (option.selected = false)
  );
  applyFilter();
}

// --- 3. LOGIKA PETA (Leaflet) ---

// Fungsi untuk menentukan warna berdasarkan komoditas
function getColor(d) {
  const komoditas = (d || "LAINNYA").toUpperCase();
  return CUSTOM_COLOR_MAP[komoditas] || CUSTOM_COLOR_MAP.LAINNYA;
}

// Fungsi styling GeoJSON
function styleFeature(feature) {
  return {
    fillColor: getColor(feature.properties.Prediksi),
    weight: 1.5,
    opacity: 1,
    color: "white",
    dashArray: "3",
    fillOpacity: 0.7,
  };
}

// Fungsi Highlight saat Mouse Over
function highlightFeature(e) {
  const layer = e.target;

  // Pastikan layer yang di-highlight bukan yang sedang dipilih
  if (layer !== selectedFeature) {
    layer.setStyle({
      weight: 3,
      color: "#666",
      dashArray: "",
      fillOpacity: 0.9,
    });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }

  // Tampilkan tooltip sederhana
  const props = layer.feature.properties;
  layer
    .bindTooltip(
      `<b>${props.WADMKD || props.Kabupaten}</b><br>${props.Prediksi || "N/A"}`
    )
    .openTooltip();
}

// Fungsi Reset Highlight saat Mouse Out
function resetHighlight(e) {
  const layer = e.target;
  if (layer !== selectedFeature) {
    // Kembalikan gaya ke default
    filteredGeojsonLayer.resetStyle(layer);
  }
}

// Fungsi Saat Klik (Select Feature)
function zoomToFeature(e) {
  const layer = e.target;

  // 1. Reset gaya fitur yang sebelumnya dipilih (jika ada)
  if (selectedFeature) {
    filteredGeojsonLayer.resetStyle(selectedFeature);
  }

  // 2. Terapkan gaya 'selected' pada fitur baru
  layer.setStyle({
    weight: 5,
    color: "#007BFF", // Biru terang untuk border
    dashArray: "",
    fillOpacity: 0.7,
  });

  // 3. Simpan fitur yang dipilih
  selectedFeature = layer;

  // 4. Update Detail Table
  updateDetailTable(layer.feature.properties);

  // 5. Zoom ke fitur
  map.fitBounds(layer.getBounds());
}

// Fungsi untuk menambahkan interaksi ke setiap fitur
function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature,
  });
}

// Fungsi utama untuk mengupdate peta
function updateMap(filteredGeoJson) {
  // 1. Hapus layer GeoJSON lama (jika ada)
  if (filteredGeojsonLayer) {
    map.removeLayer(filteredGeojsonLayer);
    selectedFeature = null; // Reset fitur yang dipilih
  }

  // 2. Tambahkan layer GeoJSON yang baru difilter
  filteredGeojsonLayer = L.geoJson(filteredGeoJson, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(map);

  // 3. Zoom ke bounds semua fitur
  if (filteredGeojsonLayer.getLayers().length > 0) {
    map.fitBounds(filteredGeojsonLayer.getBounds());
  } else {
    // Fallback jika tidak ada fitur (misalnya, reset view)
    map.setView([2.0, 99.5], 8);
  }

  // 4. Update POI Markers (jika perlu)
  updatePoiMarkers(filteredGeoJson);
}

// Fungsi untuk mengupdate POI Markers
function updatePoiMarkers(filteredGeoJson) {
  poiLayer.clearLayers();

  const visibleWADMKD = new Set(
    filteredGeoJson.features.map((f) => f.properties.WADMKD)
  );

  poiData.forEach((poi) => {
    // Hanya tampilkan POI yang WADMKD-nya ada di hasil filter
    if (visibleWADMKD.has(poi.WADMKD)) {
      L.circleMarker([poi.lat, poi.lon], {
        radius: 4,
        fillColor: MARKER_COLOR_POI,
        color: "#000",
        weight: 0.5,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(`<b>${poi.name}</b><br>Desa: ${poi.WADMKD || "N/A"}`)
        .addTo(poiLayer);
    }
  });
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
    title: { text: "Distribusi Komoditas", font: { size: 14 } },
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
    layoutKomoditas,
    { displayModeBar: false }
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
    title: {
      text: "Top 10 Wilayah Berdasarkan POI Keuangan",
      font: { size: 14 },
    },
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
    layoutPoi,
    { displayModeBar: false }
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
