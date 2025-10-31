// Data Global
let geojsonData = null;
let kabupatenData = null; // Data GeoJSON Kabupaten
let poiData = [];
let filteredGeojsonLayer = null;
let kabupatenBoundaryLayer = null; // Lapisan untuk Batas Kabupaten
let poiLayer = null;
let selectedFeature = null;
let map = null;
let layerControl = null;
let legendControl = null;

// Definisi Warna Kustom
const CUSTOM_COLOR_MAP = {
  KARET: "#2E8B57",
  KOPI: "#8B4513",
  PADI: "#FFD700",
  LAINNYA: "#A9A9A9",
};
const COLOR_NO_POI = "#696969";
const MARKER_COLOR_POI = "#B22222";

// Warna untuk Chart Komoditas (Cluster Bar)
const CHART_COLOR_WITH_POI = "#4682B4"; // Steel Blue
const CHART_COLOR_WITHOUT_POI = "#CC3333"; // Merah Calmer

const LULC_ESRI_MAP = {
  0: "Badan Air",
  1: "Pohon / Hutan",
  2: "Rumput/Padang Rumput",
  3: "Vegetasi Tergenang/Lahan Basah",
  4: "Tanaman Pertanian",
  5: "Semak dan Belukar",
  6: "Area Terbangun",
  7: "Lahan Terbuka/Tidak Bervegetasi",
  8: "Lainnya/Tidak Didefinisikan",
};

// Mapping Kolom
const COLUMN_MAP = {
  Kabupaten: "Nama Kabupaten",
  WADMKC: "Nama Kecamatan",
  WADMKD: "Nama Desa",
  TIPADM: "Tipe Administrasi",
  LUAS: "Luas Wilayah",
  EVI: "Enhanced Vegetation Index (EVI)",
  MNDWI: "Modified Normalized Difference Water Index (MNDWI)",
  NDRE: "Normalized Difference Red Edge (NDRE)",
  NDVI: "Normalized Difference Vegetation Index (NDVI)",
  NDWI: "Normalized Difference Water Index (NDWI)",
  RVI: "Ratio Vegetation Index (RVI)",
  LULC: "Land Use/Land Cover (Tutupan Lahan) Dominan",
  Elevation: "Ketinggian (mdpl)",
  Slope: "Kemiringan Lahan (Derajat)",
  Rainfall: "Curah Hujan",
  Prediksi: "Komoditas Unggulan",
  jumlah_poi: "Jumlah POI Fasilitas Keuangan"
};
const DISPLAY_COLUMNS = Object.keys(COLUMN_MAP);

// --- INISIALISASI APLIKASI ---
document.addEventListener("DOMContentLoaded", () => {
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
    const [geoJsonRes, poiJsonRes, kabRes] = await Promise.all([
      fetch("data_desa.geojson"),
      fetch("data_poi.json"),
      fetch("data_kabupaten.geojson"),
    ]);

    geojsonData = await geoJsonRes.json();
    poiData = await poiJsonRes.json();
    kabupatenData = await kabRes.json();

    populateFilters();
    applyFilter();
  } catch (error) {
    console.error("Gagal memuat data GeoJSON atau POI:", error);
    document.getElementById("filter-status").innerHTML =
      '<span class="text-danger">❌ Gagal memuat data. Pastikan file `data_desa.geojson`, `data_poi.json`, dan `data_kabupaten.geojson` tersedia.</span>';
  }
}

// --- 2. LOGIKA FILTER (Checkbox dinamis) ---

function populateFilters() {
  const containerKab = document.getElementById("kabupaten-filter-container");
  const containerKomoditas = document.getElementById(
    "komoditas-filter-container"
  );

  const kabList = new Set();
  const komoditasList = new Set();

  geojsonData.features.forEach((f) => {
    kabList.add(f.properties.Kabupaten);
    if (f.properties.Prediksi) {
      komoditasList.add(f.properties.Prediksi);
    }
  });

  const createCheckbox = (value, text, groupName, container) => {
    const div = document.createElement("div");
    div.classList.add("form-check");

    const input = document.createElement("input");
    input.classList.add("form-check-input");
    input.type = "checkbox";
    input.value = value;
    input.id = `${groupName}-${value.replace(/\s/g, "_")}`;
    input.name = groupName;

    const label = document.createElement("label");
    label.classList.add("form-check-label");
    label.htmlFor = input.id;
    label.textContent = text;

    div.appendChild(input);
    div.appendChild(label);
    container.appendChild(div);
  };

  containerKab.innerHTML = "";
  createCheckbox("ALL", "PILIH SEMUA", "kabupaten", containerKab);
  [...kabList].sort().forEach((kab) => {
    createCheckbox(kab, kab, "kabupaten", containerKab);
  });

  containerKomoditas.innerHTML = "";
  createCheckbox("ALL", "PILIH SEMUA", "komoditas", containerKomoditas);
  [...komoditasList].sort().forEach((komoditas) => {
    createCheckbox(komoditas, komoditas, "komoditas", containerKomoditas);
  });

  const setupSelectAll = (containerId, groupName) => {
    const allCheckbox = document.querySelector(
      `#${containerId} input[value='ALL']`
    );
    const otherCheckboxes = Array.from(
      document.querySelectorAll(
        `#${containerId} input[name='${groupName}']:not([value='ALL'])`
      )
    );

    allCheckbox.addEventListener("change", (e) => {
      otherCheckboxes.forEach((cb) => {
        cb.checked = e.target.checked;
      });
    });
  };

  setupSelectAll("kabupaten-filter-container", "kabupaten");
  setupSelectAll("komoditas-filter-container", "komoditas");
}

function applyFilter() {
  const getCheckedValues = (containerId) => {
    const checkboxes = Array.from(
      document.querySelectorAll(`#${containerId} input:checked`)
    );
    if (
      checkboxes.length === 0 ||
      checkboxes.find((cb) => cb.value === "ALL" && cb.checked)
    ) {
      return [];
    }

    return checkboxes.map((cb) => cb.value).filter((val) => val !== "ALL");
  };

  const selectedKabupaten = getCheckedValues("kabupaten-filter-container");
  const selectedKomoditas = getCheckedValues("komoditas-filter-container");

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

  const totalAll = geojsonData.features.length;

  if (selectedKabupaten.length > 0 || selectedKomoditas.length > 0) {
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

  updateMap(filteredGeoJson, selectedKabupaten);
  updateKPI(filteredGeoJson);
  updateCharts(filteredGeoJson);
  updateDetailTable(null);
}

function resetFilter() {
  const allCheckboxes = document.querySelectorAll(
    "#kabupaten-filter-container input, #komoditas-filter-container input"
  );
  allCheckboxes.forEach((cb) => (cb.checked = false));
  applyFilter();
}

// --- 3. LOGIKA PETA (Leaflet) ---

function getColor(d) {
  const komoditas = (d || "LAINNYA").toUpperCase();
  return CUSTOM_COLOR_MAP[komoditas] || CUSTOM_COLOR_MAP.LAINNYA;
}

function styleFeature(feature) {
  if (feature.properties.TIPADM && feature.properties.TIPADM != 1) {
    return {
      fillColor: "#FFFFFF",
      weight: 0.5,
      opacity: 1,
      color: "black",
      dashArray: "",
      fillOpacity: 1.0,
    };
  }

  return {
    fillColor: getColor(feature.properties.Prediksi),
    weight: 0.5,
    opacity: 1,
    color: "black",
    dashArray: "",
    fillOpacity: 1.0,
  };
}

// Memastikan Batas Kabupaten tidak menghalangi klik Desa
function drawKabupatenBoundaries(selectedKabs) {
  if (!kabupatenData) return;

  if (kabupatenBoundaryLayer) {
    map.removeLayer(kabupatenBoundaryLayer);
  }

  const filteredKabFeatures = kabupatenData.features.filter((f) => {
    const kabName = f.properties.Kabupaten || "";
    return selectedKabs.length === 0 || selectedKabs.includes(kabName);
  });

  const filteredKabData = {
    type: "FeatureCollection",
    features: filteredKabFeatures,
  };

  kabupatenBoundaryLayer = L.geoJson(filteredKabData, {
    style: function (feature) {
      return {
        fillColor: "transparent",
        weight: 4,
        opacity: 1,
        color: "#000000",
        fillOpacity: 0.0,
        clickable: false,
      };
    },
    onEachFeature: function (feature, layer) {
      // 1. Tambahan Solusi Leaflet Modern
      layer.setStyle({ interactive: false });

      // 2. SOLUSI KUNCI: Gunakan CSS pointer-events: none.
      if (layer._path) {
        layer._path.style.pointerEvents = "none";
      }

      const kabName = feature.properties.Kabupaten || "Kabupaten/Kota";

      layer
        .bindTooltip(
          `<b style="text-shadow: 1px 1px #ffffff;">${kabName}</b>`,
          {
            permanent: true,
            direction: "center",
            className: "kab-label-tooltip",
            opacity: 0.9,
          }
        )
        .openTooltip();
    },
  }).addTo(map);

  // Layer kabupaten/kota hanya dipanggil bringToFront saat pertama kali digambar di updateMap
  // atau hanya di sini (drawKabupatenBoundaries)
  kabupatenBoundaryLayer.bringToFront();
}

function highlightFeature(e) {
  const layer = e.target;
  const props = layer.feature.properties;

  if (props.TIPADM && props.TIPADM != 1) {
    return;
  }

  if (layer !== selectedFeature) {
    layer.setStyle({
      weight: 3,
      color: "#666",
      dashArray: "",
      fillOpacity: 0.9,
    });

    // Kritis: Pindahkan layer desa yang di-hover ke depan
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }

  // 💡 JAGA STROKE: Panggil bringToFront Layer Kabupaten agar stroke terlihat di atas fill desa yang di-hover.
  if (kabupatenBoundaryLayer) kabupatenBoundaryLayer.bringToFront();

  // POI harus selalu di atas semua (termasuk desa yang di-hover)
  if (poiLayer) poiLayer.bringToFront();

  const popupContent = `
        <b>Kabupaten:</b> ${props.Kabupaten || "N/A"}<br>
        <b>Desa:</b> ${props.WADMKD || "N/A"}<br>
        <b>Komoditas:</b> ${props.Prediksi || "N/A"}<br>
        <b>Jumlah POI:</b> ${props.jumlah_poi || 0}
    `;
  layer.bindTooltip(popupContent).openTooltip();
}

function resetHighlight(e) {
  const layer = e.target;
  if (layer.feature.properties.TIPADM && layer.feature.properties.TIPADM != 1) {
    return;
  }

  if (layer !== selectedFeature) {
    if (filteredGeojsonLayer) {
      filteredGeojsonLayer.resetStyle(layer);
    }
  }
}

function zoomToFeature(e) {
  const layer = e.target;
  const props = layer.feature.properties;

  if (props.TIPADM && props.TIPADM != 1) {
    if (selectedFeature) {
      filteredGeojsonLayer.resetStyle(selectedFeature);
    }
    selectedFeature = null;
    updateDetailTable(null);
    return;
  }

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

  // Kritis: Layer desa yang dipilih harus di depan layer kabupaten
  if (filteredGeojsonLayer) layer.bringToFront();

  // 💡 JAGA STROKE: Panggil bringToFront untuk Layer Kabupaten
  if (kabupatenBoundaryLayer) kabupatenBoundaryLayer.bringToFront();

  // POI harus di depan semua
  if (poiLayer) poiLayer.bringToFront();
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature,
  });
}

function addLegend() {
  if (legendControl) {
    map.removeControl(legendControl);
  }

  const legend = L.control({ position: "bottomleft" });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create("div", "info legend");
    const grades = [
      { label: "PADI", color: CUSTOM_COLOR_MAP.PADI },
      { label: "KARET", color: CUSTOM_COLOR_MAP.KARET },
      { label: "KOPI", color: CUSTOM_COLOR_MAP.KOPI },
      { label: "LAINNYA", color: CUSTOM_COLOR_MAP.LAINNYA },
    ];
    const otherLabel = "Wilayah Perkotaan/<br>Data Tidak Tersedia";

    div.innerHTML += "<h4>Komoditas Unggulan Desa</h4>";

    grades.forEach((item) => {
      div.innerHTML += `
        <div class="legend-item">
          <i style="background:${item.color}"></i> <span>${item.label}</span>
        </div>
      `;
    });

    div.innerHTML += `
      <div class="legend-item">
        <i style="background:#FFFFFF; border: 1px solid #000;"></i> <span>${otherLabel}</span>
      </div>
    `;

    return div;
  };
  legendControl = legend;
  legend.addTo(map);
}

function updateMap(filteredGeoJson, selectedKabs) {
  if (filteredGeojsonLayer) {
    map.removeLayer(filteredGeojsonLayer);
    selectedFeature = null;
  }

  // 1. Gambar/Update POI Marker
  updatePoiMarkers(filteredGeoJson);

  // 2. Gambar Batas Kabupaten (pointer-events: none)
  drawKabupatenBoundaries(selectedKabs);

  // 3. Gambar Layer Desa
  filteredGeojsonLayer = L.geoJson(filteredGeoJson, {
    style: styleFeature,
    onEachFeature: onEachFeature,
  }).addTo(map);

  // 4. Pastikan Layer Desa di Depan Layer Kabupaten (INTERAKSI)
  filteredGeojsonLayer.bringToFront();

  if (filteredGeojsonLayer.getLayers().length > 0) {
    map.fitBounds(filteredGeojsonLayer.getBounds());
  }

  if (layerControl) {
    map.removeControl(layerControl);
  }
  const overlayMaps = {
    "POI Fasilitas Keuangan": poiLayer,
    "Batas Kabupaten/Kota": kabupatenBoundaryLayer,
    "Peta Komoditas Unggulan": filteredGeojsonLayer,
  };
  layerControl = L.control.layers(null, overlayMaps).addTo(map);

  addLegend();

  // 5. POI harus di depan semua (final bringToFront)
  if (poiLayer) poiLayer.bringToFront();
}

// FUNGSI PLOTTING POI YANG HANYA BERADA DI DESA YANG TERFILTER
function updatePoiMarkers(filteredGeoJson) {
  poiLayer.clearLayers();

  if (!filteredGeoJson || filteredGeoJson.features.length === 0) {
    return;
  }

  const visibleDesaIDs = new Set(
    filteredGeoJson.features.map((f) => f.properties.WADMKD)
  );

  poiData.forEach((poi) => {
    if (poi.WADMKD && !visibleDesaIDs.has(poi.WADMKD)) {
      return;
    }

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
      L.circleMarker([lat, lon], {
        radius: 4,
        fillColor: MARKER_COLOR_POI,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(
          `
            <b>${name}</b><br>
            Kategori: ${poi.category || "N/A"}<br>
            Desa: ${poi.WADMKD || "N/A"}
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

  desaFeatures.forEach((f) => {
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

  const komoditasCount = features
    .filter((f) => f.properties.TIPADM == 1)
    .reduce(
      (acc, f) => {
        const komoditas = f.properties.Prediksi || "LAINNYA";
        const hasPoi = (f.properties.jumlah_poi || 0) > 0;
        const key = hasPoi ? "withPOI" : "withoutPOI";

        acc[key][komoditas] = (acc[key][komoditas] || 0) + 1;
        return acc;
      },
      { withPOI: {}, withoutPOI: {} }
    );

  const allKomoditas = [
    ...new Set([
      ...Object.keys(komoditasCount.withPOI),
      ...Object.keys(komoditasCount.withoutPOI),
    ]),
  ].sort();

  const dataWithPOI = allKomoditas.map((k) => komoditasCount.withPOI[k] || 0);
  const dataWithoutPOI = allKomoditas.map(
    (k) => komoditasCount.withoutPOI[k] || 0
  );

  // 🔥 PERUBAHAN: Menyiapkan teks label untuk ditampilkan di luar bar
  const textWithPOI = dataWithPOI.map((d) =>
    d > 0 ? d.toLocaleString("id-ID") : ""
  );
  const textWithoutPOI = dataWithoutPOI.map((d) =>
    d > 0 ? d.toLocaleString("id-ID") : ""
  );

  const traceWithPOI = {
    x: dataWithPOI,
    y: allKomoditas,
    name: "Dengan POI Fasilitas Keuangan",
    type: "bar",
    orientation: "h",
    marker: {
      color: CHART_COLOR_WITH_POI,
    },
    // 🔥 PERUBAHAN: Menampilkan label teks dan posisinya di luar bar
    text: textWithPOI,
    textposition: "outside",
    hoverinfo: "x+y",
  };

  const traceWithoutPOI = {
    x: dataWithoutPOI,
    y: allKomoditas,
    name: "Tanpa POI Fasilitas Keuangan",
    type: "bar",
    orientation: "h",
    marker: {
      color: CHART_COLOR_WITHOUT_POI,
    },
    // 🔥 PERUBAHAN: Menampilkan label teks dan posisinya di luar bar
    text: textWithoutPOI,
    textposition: "outside",
    hoverinfo: "x+y",
  };

  const layoutKomoditas = {
    barmode: "group",
    margin: {
      t: 40,
      l: 120,
      r: 60,
      b: 100, // 🔥 PERUBAHAN: Ditingkatkan untuk memberi ruang legenda di bawah
    },
    height: 350,
    // 🔥 PERUBAHAN: Sumbu X dibuat tidak terlihat/off
    xaxis: {
      visible: false, // Menyembunyikan sumbu X
      showgrid: false,
      showline: false,
      zeroline: false,
      showticklabels: false,
    },
    yaxis: {
      automargin: true,
    },
    legend: {
      // 🔥 PERUBAHAN: Posisikan legenda secara horizontal di bawah chart
      orientation: "h", // Orientasi horizontal
      x: 0.5, // Posisi horizontal di tengah (0.5)
      y: -0.2, // Posisi vertikal di bawah area plot (gunakan nilai negatif)
      xanchor: "center", // Titik jangkar horizontal di tengah legenda
      yanchor: "top", // Titik jangkar vertikal di bagian atas legenda
    },
  };

  Plotly.newPlot(
    "chart-komoditas",
    [traceWithoutPOI, traceWithPOI],
    layoutKomoditas,
    {
      displayModeBar: false,
    }
  );

  const poiDataDesa = features
    .filter((f) => f.properties.TIPADM == 1)
    .map((f) => ({
      label: f.properties.WADMKD || f.properties.Kabupaten || "Wilayah",
      jumlah: f.properties.jumlah_poi || 0,
    }))
    .filter((d) => d.jumlah > 0)
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 10)
    .reverse();

  const layoutPoi = {
    margin: {
      t: 40,
      l: 120,
      r: 10,
      b: 40,
    },
    height: 350,
    xaxis: {
      title: "Total POI",
    },
    yaxis: {
      automargin: true,
    },
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
    {
      displayModeBar: false,
    }
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
      return `${numericValue.toFixed(2)} ha`;
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

  if (properties.TIPADM && properties.TIPADM != 1) {
    tableBody.innerHTML =
      '<tr><td colspan="2">Data ini bukan Desa/Kelurahan (TIPADM $\\neq$ 1). Detail tidak ditampilkan.</td></tr>';
    titlePlaceholder.innerHTML =
      '<p class="mb-2 text-danger">Wilayah **non-Desa/Kelurahan** terpilih.</p>';
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
