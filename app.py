import streamlit as st
import geopandas as gpd
import pandas as pd
import plotly.express as px
import numpy as np
import folium 
from streamlit_folium import st_folium 
import matplotlib.colors as mcolors 

# 🌟 INISIALISASI SESSION STATE UNTUK STABILITAS
if 'clicked_data' not in st.session_state:
    st.session_state['clicked_data'] = None

# --- Konfigurasi Halaman ---
st.set_page_config(
    page_title="Dashboard Geospatial Komoditas Unggulan",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- 1. Fungsi untuk Memuat Data (Gunakan Caching & Simplifikasi) ---
@st.cache_data
def load_data(shp_file_path, poi_excel_path):
    # 1. Muat GeoDataFrame (Data Wilayah)
    gdf = gpd.read_file(shp_file_path)
    gdf['geometry'] = gdf.geometry.simplify(0.001, preserve_topology=True)
    gdf = gdf.rename(columns={'WADMKK': 'Kabupaten'}) 
    # Tambahkan pengamanan untuk kolom WADMKK
    gdf['Kabupaten'] = gdf['Kabupaten'].fillna('N/A') 
    gdf = gdf.dropna(subset=['Kabupaten', 'Prediksi', 'jumlah_poi']) 
    gdf['TIPADM'] = gdf['TIPADM'].astype(str) 

    # 2. Muat DataFrame POI dari Excel
    try:
        poi_df = pd.read_excel(poi_excel_path)
        poi_df = poi_df.dropna(subset=['longitude', 'latitude'])
        # Pastikan kolom 'Kabupaten' dan 'Kategori_POI' ada
        if 'Kategori_POI' not in poi_df.columns:
             poi_df['Kategori_POI'] = 'Umum' 
        if 'Kabupaten' not in poi_df.columns:
            # Menggunakan 'Kabupaten' besar di poi_df agar konsisten di pop-up
            poi_df['Kabupaten'] = poi_df.get('kabupaten', 'Unknown') 
            if 'kabupaten' in poi_df.columns:
                 poi_df = poi_df.drop(columns=['kabupaten'], errors='ignore')

    except FileNotFoundError:
        st.error(f"File POI tidak ditemukan di path: {poi_excel_path}. Menggunakan DataFrame POI kosong.")
        poi_df = pd.DataFrame(columns=['longitude', 'latitude', 'name', 'Kategori_POI', 'Kabupaten'])
    except Exception as e:
        st.error(f"Gagal memuat file Excel POI: {e}. Menggunakan DataFrame POI kosong.")
        poi_df = pd.DataFrame(columns=['longitude', 'latitude', 'name', 'Kategori_POI', 'Kabupaten'])
    
    return gdf, poi_df

# Ganti dengan path file Anda yang sebenarnya
SHP_FILE = 'PetaLengkap-KomoditasdanPOI-SumateraUtara/PetaLengkap-KomoditasdanPOI-SumateraUtara.shp' 
POI_EXCEL_FILE = 'DataPOI.xlsx' 

try:
    data_gdf, poi_df_full = load_data(SHP_FILE, POI_EXCEL_FILE)
except Exception as e:
    st.error(f"Gagal memuat data. Detail: {e}")
    st.stop()


# --- 2. Kolom-kolom Sidebar (Filter) ---
st.sidebar.header("Pengaturan Filter")

# Filter Kabupaten/Kota (TETAP ADA)
kabupaten_list = sorted(data_gdf['Kabupaten'].unique().tolist())
selected_kabupaten = st.sidebar.multiselect(
    "Pilih Kabupaten/Kota",
    kabupaten_list,
    default=[] 
)

# Filter data GeoPandas (Data Desa/Wilayah)
if selected_kabupaten:
    filtered_gdf = data_gdf[data_gdf['Kabupaten'].isin(selected_kabupaten)].copy()
    st.sidebar.success(f"✔️ {len(selected_kabupaten)} Kabupaten/Kota terpilih.")
else:
    st.sidebar.warning("Silakan pilih minimal satu Kabupaten/Kota.")
    filtered_gdf = gpd.GeoDataFrame([], columns=data_gdf.columns, crs=data_gdf.crs)

# 🚀 HAPUS FILTER POI: Gunakan SEMUA data POI untuk peta.
poi_df = poi_df_full.copy()


is_data_present = not filtered_gdf.empty
default_lat = 2.0 
default_lon = 99.5 

# --- 3. Tata Letak Dashboard Utama ---
st.title("Dashboard Geospatial Komoditas Unggulan & POI Sumatera Utara")
map_col = st.container()
st.markdown("---")

# SUMMARY METRICS
if is_data_present:
    total_desa = filtered_gdf.shape[0]
    total_poi_desa = filtered_gdf['jumlah_poi'].sum()
    # Gunakan total POI dari SEMUA data (poi_df_full) untuk metrik
    total_poi_peta = len(poi_df_full) 
    total_komoditas_unik = filtered_gdf['Prediksi'].nunique()
    
    col_kpi_1, col_kpi_2, col_kpi_3 = st.columns(3)
    col_kpi_1.metric("Total Desa Terpilih", f"{total_desa:,}")
    col_kpi_2.metric("Total POI di Peta (Semua Data)", f"{total_poi_peta:,}") 
    col_kpi_3.metric("Jenis Komoditas Unik", f"{total_komoditas_unik}")
st.markdown("---")

# Bar Charts
col1, col2 = st.columns(2) 
st.markdown("---")
detail_col = st.container()

# --- 4. Visualisasi Peta Choropleth INTERAKTIF (Menggunakan Folium) ---
with map_col:
    st.header("Peta Desa Interaktif - Klik untuk Detail")

    m = folium.Map(
        location=[default_lat, default_lon], 
        zoom_start=8, 
        scrollWheelZoom=True,
        tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr='Esri World Imagery' 
    )
    
    if not is_data_present:
        st.session_state['clicked_data'] = None

    if is_data_present:
        # 🌟 LOGIKA PEWARNAAN BERDASARKAN 'PREDIKSI' (CUSTOM COLOR SCHEME)
        CUSTOM_COLOR_MAP = {
            'KARET': "#FFBF00", # Kuning
            'KOPI': "#492C18", 
            'PADI': "#1A9B23",
            'LAINNYA': "#D8D8D8B6" # Abu-abu
        }
        
        prediksi_categories = filtered_gdf['Prediksi'].unique().tolist()
        color_map = {}
        for category in prediksi_categories:
            color_map[category] = CUSTOM_COLOR_MAP.get(category.upper(), '#808080') 

        def style_function(feature):
            prediksi_value = feature['properties']['Prediksi'].upper()
            return {
                'fillColor': color_map.get(prediksi_value, '#FFFFFF'), 
                'color': 'black',
                'weight': 0.5,
                'fillOpacity': 0.7
            }

        # Zoom Otomatis ke Batas Wilayah Terpilih
        bounds = filtered_gdf.total_bounds
        m.fit_bounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]]) 
        
        # Tambahkan GeoJSON layer ke Folium
        geojson_layer = folium.GeoJson(
            filtered_gdf,
            style_function=style_function,
            name='Desa Choropleth (Komoditas)',
            popup=folium.GeoJsonPopup(
                fields=['WADMKD', 'Kabupaten', 'Prediksi', 'jumlah_poi'],
                aliases=['Desa:', 'Kabupaten:', 'Komoditas:', 'Jumlah POI:'],
                labels=True,
                localize=True
            ),
            tooltip=folium.GeoJsonTooltip(
                fields=['Kabupaten', 'Prediksi'],
                aliases=['Kabupaten:', 'Komoditas:'],
                localize=True
            ),
            highlight_function=lambda x: {'weight': 3, 'color': 'white'},
        ).add_to(m)

        # Marker POI (Merah) - MENGGUNAKAN poi_df (yang adalah poi_df_full)
        MARKER_COLOR_POI = "#FF0000" # Merah
        
        poi_group = folium.FeatureGroup(name=f"Point of Interest ({len(poi_df)} Titik)").add_to(m)
        
        if not poi_df.empty:
            for idx, row in poi_df.iterrows():
                try:
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                except ValueError:
                    continue 

                poi_name = row.get('name', f"POI-{idx+1}") 
                poi_category = row.get('Kategori_POI', 'Umum')
                marker_color = MARKER_COLOR_POI 
                # Ambil nama Kabupaten POI
                poi_kabupaten = row.get('Kabupaten', 'N/A')

                folium.CircleMarker(
                    [lat, lon],
                    radius=4,
                    color=marker_color, 
                    weight=1,
                    fill=True,
                    fill_color=marker_color, 
                    fill_opacity=0.7,
                    tooltip=f"{poi_name} ({poi_category})",
                    popup=folium.Popup(f"<b>{poi_name}</b><br>Kategori: {poi_category}<br>Kabupaten: {poi_kabupaten}"),
                ).add_to(poi_group)

        # Legenda Dinamis Komoditas
        legend_entries = ""
        for category, color in color_map.items():
            legend_entries += f'&nbsp; <i style="background:{color}; color:{color}; padding-left: 10px; border-radius: 2px;"></i> {category} <br>'
            
        legend_html = f"""
              <div style="position: fixed; 
                          bottom: 50px; left: 50px; width: 200px; max-height: 250px; 
                          border:2px solid grey; z-index:9999; font-size:14px;
                          background-color:white; opacity:0.9; padding: 5px; overflow-y: auto;">
                &nbsp; <b>Komoditas Unggulan</b> <br>
                {legend_entries}
                <hr style="margin: 5px 0;">
                &nbsp; <b>Point of Interest</b> <br>
                &nbsp; <i style="background:{MARKER_COLOR_POI}; color:{MARKER_COLOR_POI}; padding-left: 10px; border-radius: 2px;"></i> Semua POI <br>
              </div>
              """
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Tambahkan kontrol layer
        folium.LayerControl(position='topright').add_to(m)

        # Tampilkan peta dan dapatkan hasil klik
        st_map = st_folium(
            m, 
            width=700, 
            height=500, 
            feature_group_to_add=[geojson_layer],
            key="folium_map_final",
        )

        # Penanganan Klik (tetap)
        if st_map and st_map.get('last_active_drawing'):
            new_data = st_map['last_active_drawing']['properties']
            current_clicked_data = st.session_state.get('clicked_data')
            current_wadmkd = (current_clicked_data or {}).get('WADMKD') 
            new_wadmkd = new_data.get('WADMKD')
            
            if current_wadmkd != new_wadmkd:
                st.session_state['clicked_data'] = new_data
                st.rerun()
                
    else:
        m_base = folium.Map(
            location=[default_lat, default_lon], 
            zoom_start=8, 
            tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attr='Esri World Imagery' 
        )
        st_folium(m_base, width=700, height=500)
        st.info("Silakan pilih minimal satu Kabupaten/Kota untuk menampilkan peta.")


# --- 5. Grafik Bar Chart (Komoditas Unggulan) ---
with col1:
    st.subheader("Distribusi Desa per Komoditas")
    if is_data_present: 
        komoditas_count = filtered_gdf['Prediksi'].value_counts().reset_index()
        komoditas_count.columns = ['Komoditas_Unggulan', 'Jumlah_Desa']
        
        komoditas_top = komoditas_count.iloc[0]['Komoditas_Unggulan'] if not komoditas_count.empty else 'Tidak Ada'
        st.caption(f"Komoditas dominan di wilayah terpilih: **{komoditas_top}**.")
        
        fig_komoditas = px.bar(
            komoditas_count, 
            x='Jumlah_Desa', 
            y='Komoditas_Unggulan',
            orientation='h',
            title='Jumlah Desa berdasarkan Komoditas',
            color='Jumlah_Desa',
            color_continuous_scale=px.colors.sequential.Viridis 
        )
        fig_komoditas.update_layout(
            yaxis={'categoryorder':'total ascending'},
            margin=dict(t=30, l=10, r=10, b=10)
        )
        st.plotly_chart(fig_komoditas, use_container_width=True)
    else:
        st.info("Tidak ada data yang tersedia.")


# --- 6. Grafik Bar Chart (Jumlah POI per Kabupaten) ---
with col2:
    st.subheader("Total POI per Kabupaten/Kota")
    if is_data_present: 
        # Menggunakan semua POI (poi_df_full) untuk grafik ini
        poi_sum = poi_df_full.groupby('Kabupaten').size().reset_index(name='jumlah_poi_total')
        
        poi_max_kab = poi_sum.loc[poi_sum['jumlah_poi_total'].idxmax()]['Kabupaten'] if not poi_sum.empty else 'Tidak Ada'
        st.caption(f"Kabupaten dengan POI terbanyak: **{poi_max_kab}**.")
        
        fig_poi = px.bar(
            poi_sum, 
            x='Kabupaten', 
            y='jumlah_poi_total',
            title='Total POI berdasarkan Kabupaten/Kota (Semua Data)',
            color='jumlah_poi_total',
            color_continuous_scale=px.colors.sequential.Viridis
        )
        fig_poi.update_xaxes(tickangle=45)
        fig_poi.update_layout(
            margin=dict(t=30, l=10, r=10, b=10)
        )
        st.plotly_chart(fig_poi, use_container_width=True)
    else:
        st.info("Tidak ada data yang tersedia.")


# --- 7. Tabel Detail (Implementasi Fungsionalitas Klik) ---
with detail_col:
    st.header("Keterangan Desa Terpilih")
    
    # 🌟 PENYESUAIAN: Mapping kolom asli ke nama panjang yang baru
    COLUMN_MAP = {
        'WADMKD': 'Nama Desa/Kelurahan',
        'WADMKK': 'Nama Kabupaten/Kota',
        'LUAS': 'Luas Wilayah',
        'EVI': 'Enhanced Vegetation Index (EVI)',
        'MNDWI': 'Modified Normalized Difference Water Index (MNDWI)',
        'NBR': 'Normalized Burn Ratio (NBR)',
        'NDRE': 'Normalized Difference Red Edge (NDRE)',
        'NDVI': 'Normalized Difference Vegetation Index (NDVI)', 
        'NDWI': 'Normalized Difference Water Index (NDWI)',
        'RVI': 'Ratio Vegetation Index (RVI)',
        'SAVI': 'Soil Adjusted Vegetation Index (SAVI)',
        'Elevation': 'Ketinggian (mdpl)',
        'Slope': 'Kemiringan Lahan (Derajat)',
        'Rainfall': 'Curah Hujan',
        'TCI': 'Thermal Condition Index (TCI)', 
        'Prediksi': 'Komoditas Unggulan', 
        'jumlah_poi': 'Jumlah POI Lokal'
    }
    DISPLAY_COLUMNS = list(COLUMN_MAP.keys())
    
    # Periksa apakah ada data yang diklik dari Session State
    if st.session_state.get('clicked_data'):
        data = st.session_state['clicked_data']
        
        selected_data = {}
        for col_short in DISPLAY_COLUMNS:
            if col_short in data and data.get(col_short) is not None:
                selected_data[col_short] = data.get(col_short)
        
        # Susun ulang untuk tampilan vertikal (Transpose)
        df_selected = pd.DataFrame.from_dict(selected_data, orient='index', columns=['Nilai']).reset_index()
        df_selected.columns = ['Atribut_Singkat', 'Nilai']
        
        # 🌟 PENYESUAIAN 1: Ganti nama singkatan dengan nama panjang
        df_selected['Atribut'] = df_selected['Atribut_Singkat'].map(COLUMN_MAP)
        
        # 🌟 PENANGANAN ERROR DAN FORMATTING NILAI
        def format_nilai(row):
            nilai = row['Nilai']
            atribut = row['Atribut_Singkat']
            
            # Coba konversi nilai ke float jika bukan string
            numeric_value = None
            if not isinstance(nilai, str) and nilai is not None:
                try:
                    numeric_value = float(nilai)
                except (ValueError, TypeError):
                    pass # Biarkan numeric_value tetap None
            
            # Logika Pemformatan
            if atribut == 'LUAS' and numeric_value is not None:
                return f"{numeric_value:.2f} km\u00b2"
            elif numeric_value is not None:
                return f"{numeric_value:.2f}"
            else:
                # Jika tidak numerik (seperti nama atau string prediksi)
                return str(nilai) if nilai is not None else 'N/A'
        
        df_selected['Nilai'] = df_selected.apply(format_nilai, axis=1)
        
        # Hapus kolom singkatan dan tampilkan kolom panjang
        df_selected = df_selected[['Atribut', 'Nilai']]
        
        st.markdown(f"**Detail untuk Desa/Kelurahan: {data.get('WADMKD', '-')}**")
        st.dataframe(df_selected, use_container_width=True, hide_index=True)
        
    else:
        st.info("Silakan **klik** pada salah satu desa di peta untuk menampilkan detail atribut.")