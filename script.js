// Data Global
let geojsonData = null;
let poiData = [];
let filteredGeojsonLayer = null;
let poiLayer = null;
let selectedFeature = null;
let map = null; 

// Definisi Warna Kustom (mirip Python)
const CUSTOM_COLOR_MAP = {
  KARET: "#FFBF00", // Kuning
  KOPI: "#492C18", // Coklat gelap
  PADI: "#1A9B23", // Hijau
  LAINNYA: "#808080", // Abu-abu
};
const MARKER_COLOR_POI = "#DC3545"; // Merah Bootstrap

// --- MAPPING LULC SESUAI URUTAN LEGENDA (KODE 1 SAMPAI 8) ---
const LULC_ESRI_MAP = {
  1: "Badan Air", 
  2: "Pohon / Hutan", 
  3: "Rumput/Padang Rumput", 
  4: "Vegetasi Tergenang/Lahan Basah", 
  5: "Tanaman Pertanian", 
  6: "Semak dan Belukar", 
  7: "Area Terbangun", 
  8: "Lahan Terbuka/Tidak Bervegetasi", 
  99: "Lainnya/Tidak Didefinisikan", 
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

  // Hanya kumpulkan daftar dari fitur yang relevan (TIPADM=1) untuk filter
  geojsonData.features.forEach((f) => {
    // Memastikan TIPADM dikonversi ke float untuk perbandingan yang konsisten
    if (parseFloat(f.properties.TIPADM) === 1) { 
        kabList.add(f.properties.Kabupaten);
        if (f.properties.Prediksi) {
            komoditasList.add(f.properties.Prediksi);
        }
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

// FUNGSI UNTUK MEMBACA DAN MENERAPKAN NILAI FILTER (TELAH DIMODIFIKASI UNTUK STATUS FILTER YANG AKURAT)
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

  // 1. Filter Kabupaten
  if (selectedKabupaten.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKabupaten.includes(f.properties.Kabupaten)
    );
  } 
  
  // 2. Filter Komoditas
  if (selectedKomoditas.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKomoditas.includes(f.properties.Prediksi)
    );
  } 
  
  // 3. FILTER KRITIS: Hanya ambil unit Desa/Kelurahan yang relevan (TIPADM=1 atau 1.0)
  // Fitur-fitur ini digunakan untuk KPI, Charts, dan Status Count.
  const activeFilteredFeatures = filteredFeatures.filter(
      (f) => parseFloat(f.properties.TIPADM) === 1 
  );

  // Periksa apakah ada filter yang aktif
  const filterCount = selectedKabupaten.length + selectedKomoditas.length;

  // Tentukan teks status
  if (filterCount > 0) {
    document.getElementById(
      "filter-status"
    ).innerHTML = `<span class="text-success">✔️ ${activeFilteredFeatures.length} desa terpilih.</span>`;
  } else {
    // Jika tidak ada filter yang dipilih, hitung total desa TIPADM=1 dari semua data
    const totalDesaAktif = geojsonData.features.filter(
        (f) => parseFloat(f.properties.TIPADM) === 1
    ).length;
    document.getElementById(
      "filter-status"
    ).innerHTML = `<span class="text-warning">⚠️ Menampilkan semua ${totalDesaAktif} desa.</span>`;
  }

  // Siapkan GeoJSON untuk peta. Gunakan filteredFeatures (termasuk TIPADM!=1)
  const filteredGeoJsonMap = {
    type: "FeatureCollection",
    features: filteredFeatures, 
  };
  
  // Siapkan GeoJSON untuk KPI/Charts: HANYA TIPADM=1
  const filteredGeoJsonKPI = {
    type: "FeatureCollection",
    features: activeFilteredFeatures, 
  };


  updateMap(filteredGeoJsonMap); 
  updateKPI(filteredGeoJsonKPI); 
  updateCharts(filteredGeoJsonKPI); 
  updateDetailTable(null); 
}

// Fungsi untuk mereset filter
function resetFilter() {
  Array.from(document.getElementById("kabupaten-select").options).forEach(
    (option) => {
      option.selected = false;
    }
  ); 
  Array.from(document.getElementById("komoditas-select").options).forEach(
    (option) => {
      option.selected = false;
    }
  ); 

  applyFilter();
}

// --- 3. LOGIKA UPDATE PETA ---
function getStyle(feature) {
  // Menggunakan parseFloat untuk perbandingan konsisten
  if (parseFloat(feature.properties.TIPADM) !== 1) {
    return {
      fillColor: "white", 
      color: "black",
      weight: 0.5,
      fillOpacity: 0.3, 
    };
  } 

  const prediksi = (feature.properties.Prediksi || "LAINNYA").toUpperCase();
  const color = CUSTOM_COLOR_MAP[prediksi] || CUSTOM_COLOR_MAP["LAINNYA"];

  let weight = 0.5;
  let outlineColor = "black"; 

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

// FUNGSI ON EACH FEATURE 
function onEachFeature(feature, layer) {
  const props = feature.properties;
    
    // Non-Desa/Kelurahan (TIPADM != 1) tidak diberi interaksi
    if (parseFloat(props.TIPADM) !== 1) return;
    
    const popupContent = `
        <b>Desa:</b> ${props.WADMKD}<br>
        <b>Kabupaten:</b> ${props.Kabupaten}<br>
        <b>Komoditas:</b> ${props.Prediksi}<br>
        <b>Jumlah POI:</b> ${props.jumlah_poi}
    `; 

  layer.on("mouseover", function (e) {
    layer.bindPopup(popupContent).openPopup(); 
    layer.setStyle({
      weight: 2,
      color: "#333",
      fillOpacity: 0.9,
    });
  }); 

  layer.on("mouseout", function (e) {
    layer.closePopup(); 
    layer.setStyle(getStyle(feature));
  }); 

  layer.on("click", function (e) {
    if (selectedFeature && filteredGeojsonLayer) {
      filteredGeojsonLayer.eachLayer(function (l) {
        if (l.feature.properties.WADMKD === selectedFeature.properties.WADMKD) {
          l.setStyle(getStyle(l.feature));
        }
      });
    } 

    selectedFeature = feature; 
    layer.setStyle(getStyle(feature)); 
    updateDetailTable(feature.properties);
  });
}

function updateMap(filteredGeoJson) {
  if (filteredGeojsonLayer) {
    map.removeLayer(filteredGeojsonLayer);
  } 
  poiLayer.clearLayers(); 
  selectedFeature = null; 

  if (filteredGeoJson.features.length > 0) {
    filteredGeojsonLayer = L.geoJSON(filteredGeoJson, {
      style: getStyle,
      onEachFeature: onEachFeature,
    }).addTo(map);

    try {
      // Ambil batas hanya dari fitur TIPADM=1 untuk zoom yang akurat
      const boundsFeatures = filteredGeoJson.features.filter(f => parseFloat(f.properties.TIPADM) === 1);
      if (boundsFeatures.length > 0) {
          const boundsLayer = L.geoJSON({ type: "FeatureCollection", features: boundsFeatures });
          map.fitBounds(boundsLayer.getBounds());
      } else {
          map.setView([2.0, 99.5], 8);
      }
    } catch (e) {
      map.setView([2.0, 99.5], 8);
    }
  } else {
    map.setView([2.0, 99.5], 8); 
  } 

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
  }); 

  if (filteredGeojsonLayer) {
    L.control
      .layers(null, {
        "Komoditas Unggulan Desa": filteredGeojsonLayer,
        "POI Fasilitas Keuangan": poiLayer,
      })
      .addTo(map);
  }
}

// --- 4. LOGIKA UPDATE KPI ---
function updateKPI(filteredGeoJson) {
  // filteredGeoJson.features kini sudah HANYA berisi TIPADM=1
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
    desaPoiPositive.toLocaleString("id-ID"); 
  document.getElementById("kpi-komoditas").textContent =
    desaPoiZero.toLocaleString("id-ID"); 
}

// --- 5. LOGIKA UPDATE CHARTS (Menggunakan Plotly.js) ---
function updateCharts(filteredGeoJson) {
  const features = filteredGeoJson.features; // HANYA TIPADM=1 

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
  ); 

  const poiDataDesa = features
    .map((f) => ({
      label: f.properties.WADMKD,
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
    const lulcCode = parseInt(value);
    if (!isNaN(lulcCode) && LULC_ESRI_MAP[lulcCode]) {
      return LULC_ESRI_MAP[lulcCode];
    } 
    return LULC_ESRI_MAP[99] + ` (Kode ${lulcCode})`;
  }

  const numericValue = parseFloat(value);

  if (!isNaN(numericValue)) {
    if (key === "LUAS") {
      return `${numericValue.toFixed(2)} km\u00b2`;
    } 
    return numericValue.toFixed(2);
  } 

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