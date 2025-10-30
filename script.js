// Data Global
let geojsonData = null;
let poiData = [];
let filteredGeojsonLayer = null;
let countyBoundaryLayer = null; // ⬅️ BARU: Lapisan untuk Batas Kabupaten
let poiLayer = null;
let selectedFeature = null;
let map = null;
let layerControl = null; // Dideklarasikan untuk kontrol layer

// Definisi Warna Kustom (mirip Python)
const CUSTOM_COLOR_MAP = {
  KARET: "#FFBF00", // Kuning
  KOPI: "#492C18", // Coklat gelap
  PADI: "#1A9B23", // Hijau
  LAINNYA: "#808080", // Abu-abu
};
const MARKER_COLOR_POI = "#DC3545"; // Merah Bootstrap

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

    updatePoiMarkers();

    if (poiLayer.getLayers().length > 0) {
      map.fitBounds(poiLayer.getBounds());
    }
  } catch (error) {
    console.error("Gagal memuat data GeoJSON atau POI:", error);
    document.getElementById("filter-status").innerHTML =
      '<span class="text-danger">❌ Gagal memuat data. Pastikan file `data_desa.geojson` dan `data_poi.json` tersedia.</span>';
  }
}

// --- 2. LOGIKA FILTER (GeoJSON) ---

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

  if (selectedKabupaten.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKabupaten.includes(f.properties.Kabupaten)
    );
  }

  if (selectedKomoditas.length > 0) {
    filteredFeatures = filteredFeatures.filter((f) =>
      selectedKomoditas.includes(f.properties.Prediksi)
    );
  }

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

function resetFilter() {
  Array.from(document.getElementById("kabupaten-select").options).forEach(
    (option) => (option.selected = false)
  );
  Array.from(document.getElementById("komoditas-select").options).forEach(
    (option) => (option.selected = false)
  );
  applyFilter();
}

// --- 3. LOGIKA PETA (Leaflet) ---

function getColor(d) {
  const komoditas = (d || "LAINNYA").toUpperCase();
  return CUSTOM_COLOR_MAP[komoditas] || CUSTOM_COLOR_MAP.LAINNYA;
}

function styleFeature(feature) {
  return {
    fillColor: getColor(feature.properties.Prediksi),
    weight: 1.5,
    opacity: 1,
    color: "black", // Border Hitam Solid
    dashArray: "",
    fillOpacity: 0.25, // ⬅️ DIUBAH: Transparansi 25% untuk desa
  };
}

// 🎯 FUNGSI BARU: Membuat dan Menata Batas Kabupaten
function createCountyBoundaries(geojson) {
  // Gunakan fitur yang terfilter untuk simulasi batas luar kabupaten
  const countyFeatures = {};

  geojson.features.forEach((f) => {
    const kab = f.properties.Kabupaten;
    if (!countyFeatures[kab]) {
      // Asumsi untuk visualisasi, kita hanya perlu satu fitur per kabupaten
      countyFeatures[kab] = {
        type: "Feature",
        properties: { Kabupaten: kab },
        geometry: f.geometry, // Ini tidak akan menggabungkan geometri, hanya memilih satu
      };
    }
  });

  const countyGeoJson = {
    type: "FeatureCollection",
    features: Object.values(countyFeatures),
  };

  if (countyBoundaryLayer) {
    map.removeLayer(countyBoundaryLayer);
  }

  // Lapisan Batas Kabupaten (Simulasi Visual)
  // Fitur disetel agar fill-nya transparan, tetapi batas luarnya tebal
  countyBoundaryLayer = L.geoJson(geojson, {
    // Gunakan geojson lengkap
    style: function (feature) {
      return {
        fillColor: "transparent",
        weight: 3, // ⬅️ Batas Lebih Tebal
        opacity: 1,
        color: "#000000", // ⬅️ Batas Hitam Solid
        fillOpacity: 0.0, // ⬅️ Fill Benar-benar Transparan
      };
    },
    // Menangani interaksi mouse untuk batas kabupaten
    onEachFeature: function (feature, layer) {
      layer.on({
        mouseover: function (e) {
          const l = e.target;
          l.setStyle({ weight: 5, color: "#007BFF" });
          l.bringToFront();
          l.bindTooltip(
            `Batas Kabupaten: ${feature.properties.Kabupaten || "N/A"}`,
            { permanent: false, direction: "auto" }
          ).openTooltip();
        },
        mouseout: function (e) {
          countyBoundaryLayer.resetStyle(e.target);
          e.target.closeTooltip();
        },
        // Tidak ada klik untuk lapisan batas ini agar fokus ke desa
      });
    },
  });

  // Tambahkan ke peta
  countyBoundaryLayer.addTo(map);
}

function highlightFeature(e) {
  const layer = e.target;
  const props = layer.feature.properties;

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

  const popupContent = `
        <b>Kabupaten:</b> ${props.Kabupaten || "N/A"}<br>
        <b>Desa:</b> ${props.WADMKD || "N/A"}<br>
        <b>Komoditas:</b> ${props.Prediksi || "N/A"}<br>
        <b>POI:</b> ${props.jumlah_poi || 0}
    `;
  layer.bindTooltip(popupContent).openTooltip();
}

function resetHighlight(e) {
  const layer = e.target;
  if (layer !== selectedFeature) {
    filteredGeojsonLayer.resetStyle(layer);
  }
}

function zoomToFeature(e) {
  const layer = e.target;

  if (selectedFeature) {
    filteredGeojsonLayer.resetStyle(selectedFeature);
  }

  layer.setStyle({
    weight: 5,
    color: "#007BFF",
    dashArray: "",
    fillOpacity: 0.7,
  });

  selectedFeature = layer;

  updateDetailTable(layer.feature.properties);

  map.fitBounds(layer.getBounds());
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature,
  });
}

function updateMap(filteredGeoJson) {
  if (filteredGeojsonLayer) {
    map.removeLayer(filteredGeojsonLayer);
    selectedFeature = null;
  }

  if (countyBoundaryLayer) {
    // ⬅️ Hapus lapisan batas kabupaten jika ada
    map.removeLayer(countyBoundaryLayer);
  }

  if (layerControl) {
    map.removeControl(layerControl);
  }

  filteredGeojsonLayer = L.geoJson(filteredGeoJson, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(map);

  if (filteredGeojsonLayer.getLayers().length > 0) {
    map.fitBounds(filteredGeojsonLayer.getBounds());
  }

  updatePoiMarkers();

  // ⬅️ Panggil fungsi untuk membuat batas kabupaten
  createCountyBoundaries(filteredGeoJson);

  // Pastikan batas kabupaten ada di atas desa
  if (countyBoundaryLayer) {
    countyBoundaryLayer.bringToFront();
  }

  // Definisikan overlayMaps BARU
  const overlayMaps = {
    "Titik POI": poiLayer,
    "Batas Kabupaten/Kota": countyBoundaryLayer, // ⬅️ Tambahkan kontrol untuk Batas Kabupaten
    "Pemetaan Desa (Komoditas)": filteredGeojsonLayer, // ⬅️ Ganti nama agar lebih jelas
  };

  // Base layer sudah ditambahkan di DOMContentLoaded, jadi biarkan layer control hanya mengelola overlay
  layerControl = L.control.layers(null, overlayMaps).addTo(map);
}

// 🎯 FUNGSI PLOTTING SEMUA POI (Kembali ke Circle Marker Merah yang Ringan) 🎯
function updatePoiMarkers() {
  poiLayer.clearLayers();

  poiData.forEach((poi) => {
    const lat = parseFloat(poi.latitude);
    const lon = parseFloat(poi.longitude);
    const name = poi.name || poi.category || "POI";

    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      // Menggunakan L.circleMarker kembali
      L.circleMarker([lat, lon], {
        radius: 4,
        fillColor: MARKER_COLOR_POI,
        color: "#000",
        weight: 1, // Sedikit lebih tebal dari sebelumnya agar mudah di-hover
        opacity: 1,
        fillOpacity: 0.8,
      })
        // Keterangan saat di-hover/klik
        .bindPopup(
          `
            <b>${name}</b><br>
            Kategori: ${poi.category || "N/A"}<br>
            Lon: ${lon.toFixed(4)}, Lat: ${lat.toFixed(4)}
          `
        )
        .addTo(poiLayer);
    }
  });
}

// --- 4. LOGIKA UPDATE KPI ---
function updateKPI(filteredGeoJson) {
  const features = filteredGeoJson.features;

  const desaFeatures = features.filter((f) => f.properties.TIPADM == 1);

  let wilayahPoiPositive = 0;
  let wilayahPoiZero = 0;

  features.forEach((f) => {
    const jumlahPoi = f.properties.jumlah_poi || 0;
    if (jumlahPoi > 0) {
      wilayahPoiPositive += 1;
    } else {
      wilayahPoiZero += 1;
    }
  });

  document.getElementById("kpi-desa").textContent =
    desaFeatures.length.toLocaleString("id-ID");

  document.getElementById("kpi-poi").textContent =
    wilayahPoiPositive.toLocaleString("id-ID");

  document.getElementById("kpi-komoditas").textContent =
    wilayahPoiZero.toLocaleString("id-ID");
}

// --- 5. LOGIKA UPDATE CHARTS ---
function updateCharts(filteredGeoJson) {
  const features = filteredGeoJson.features;

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

  const poiDataDesa = features
    .map((f) => ({
      label: f.properties.WADMKD || f.properties.Kabupaten || "Wilayah",
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
    const lulcCode = parseInt(value);
    if (!isNaN(lulcCode) && LULC_ESRI_MAP[lulcCode]) {
      return LULC_ESRI_MAP[lulcCode];
    }
    return LULC_ESRI_MAP[99] + ` (Kode ${lulcCode})`;
  }

  if (key === "TIPADM") {
    return value == 1 ? "Desa/Kelurahan" : String(value);
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
