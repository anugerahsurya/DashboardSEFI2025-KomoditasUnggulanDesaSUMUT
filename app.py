import streamlit as st
import geopandas as gpd
import pandas as pd
import plotly.express as px
import numpy as np
import folium 
from streamlit_folium import st_folium 
import matplotlib.colors as mcolors 

# 🌟 INISIALISASI SESSION STATE UNTUK STABILITAS
# Dipastikan ada di awal skrip
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
def load_data(shp_file_path):
    gdf = gpd.read_file(shp_file_path)
    
    # Solusi MessageSizeError: Sederhanakan geometri
    gdf['geometry'] = gdf.geometry.simplify(0.001, preserve_topology=True)
    
    # Ganti nama kolom: WADMKK diubah menjadi Kabupaten
    # Asumsi: Kolom 'Prediksi' sudah ada di SHP
    gdf = gdf.rename(columns={'WADMKK': 'Kabupaten'}) 
    
    # Hapus baris yang kolom kritisnya kosong
    gdf = gdf.dropna(subset=['Kabupaten', 'Prediksi', 'jumlah_poi']) 
    gdf['TIPADM'] = gdf['TIPADM'].astype(str) 
    
    return gdf

# Ganti dengan path file SHP Anda yang sebenarnya
SHP_FILE = 'PetaLengkap-KomoditasdanPOI-SumateraUtara/PetaLengkap-KomoditasdanPOI-SumateraUtara.shp' 
try:
    data_gdf = load_data(SHP_FILE)
except Exception as e:
    st.error(f"Gagal memuat file SHP. Pastikan path benar dan pustaka Geopandas terinstal: {e}")
    st.stop()


# --- 2. Kolom-kolom Sidebar (Filter) ---
st.sidebar.header("⚙️ Pengaturan Filter")
kabupaten_list = sorted(data_gdf['Kabupaten'].unique().tolist())
selected_kabupaten = st.sidebar.multiselect(
    "Pilih Kabupaten/Kota",
    kabupaten_list,
    default=[] # Filter dimulai dalam keadaan kosong
)

# Filter data berdasarkan pilihan
if selected_kabupaten:
    filtered_gdf = data_gdf[data_gdf['Kabupaten'].isin(selected_kabupaten)].copy()
    st.sidebar.success(f"{len(selected_kabupaten)} Kabupaten/Kota terpilih.")
else:
    st.sidebar.warning("Silakan pilih minimal satu Kabupaten/Kota untuk melihat data.")
    filtered_gdf = gpd.GeoDataFrame([], columns=data_gdf.columns, crs=data_gdf.crs)

is_data_present = not filtered_gdf.empty
default_lat = 2.0 
default_lon = 99.5 

# --- 3. Tata Letak Dashboard Utama ---
st.title("🗺️ Dashboard Geospatial Komoditas Unggulan & POI")
map_col = st.container()
st.markdown("---")
col1, col2 = st.columns(2) 
st.markdown("---")
detail_col = st.container()

# --- 4. Visualisasi Peta Choropleth INTERAKTIF (Menggunakan Folium) ---
with map_col:
    st.header("Peta Desa Interaktif - Klik untuk Detail")

    m = folium.Map(location=[default_lat, default_lon], zoom_start=8, scrollWheelZoom=True)
    
    if not is_data_present:
        st.session_state['clicked_data'] = None

    if is_data_present:
        # LOGIKA PEWARNAAN BERDASARKAN 'PREDIKSI'
        prediksi_categories = filtered_gdf['Prediksi'].unique().tolist()
        distinct_colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
        color_map = {category: distinct_colors[i % len(distinct_colors)] for i, category in enumerate(prediksi_categories)}

        def style_function(feature):
            prediksi_value = feature['properties']['Prediksi']
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
            name='Desa Choropleth',
            # Tambahkan POPUP untuk memaksa deteksi atribut saat klik
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
            highlight_function=lambda x: {'weight': 3, 'color': 'yellow'},
        ).add_to(m)

        # Legenda Dinamis
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
             </div>
             """
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Tampilkan peta dan dapatkan hasil klik
        st_map = st_folium(
            m, 
            width=700, 
            height=500, 
            feature_group_to_add=[geojson_layer],
            key="folium_map_final",
        )

        # 🌟 PERBAIKAN UTAMA: Ambil data dari 'last_active_drawing'
        if st_map and st_map.get('last_active_drawing'):
            new_data = st_map['last_active_drawing']['properties']
            
            # Mendapatkan data klik yang ada di state dengan penanganan None yang aman
            current_clicked_data = st.session_state.get('clicked_data')
            
            # Mendapatkan nama desa saat ini dan yang baru untuk perbandingan
            # Jika current_clicked_data adalah None, gunakan dict kosong untuk menghindari AttributeError
            current_wadmkd = (current_clicked_data or {}).get('WADMKD') 
            new_wadmkd = new_data.get('WADMKD')
            
            # Cek apakah data baru berbeda (berdasarkan nama desa/kelurahan)
            if current_wadmkd != new_wadmkd:
                st.session_state['clicked_data'] = new_data
                st.rerun() # Paksa RERUN untuk update tabel
                 
    else:
        st_folium(m, width=700, height=500)
        st.info("Silakan pilih minimal satu Kabupaten/Kota untuk menampilkan peta.")


# --- 5. Grafik Bar Chart (Komoditas Unggulan) ---
with col1:
    st.header("Jumlah Desa per Komoditas Unggulan")
    if is_data_present: 
        komoditas_count = filtered_gdf['Prediksi'].value_counts().reset_index()
        komoditas_count.columns = ['Komoditas_Unggulan', 'Jumlah_Desa']
        
        fig_komoditas = px.bar(
            komoditas_count, 
            x='Jumlah_Desa', 
            y='Komoditas_Unggulan',
            orientation='h',
            title='Distribusi Jumlah Desa berdasarkan Komoditas',
            color='Jumlah_Desa',
            color_continuous_scale=px.colors.sequential.Plasma
        )
        fig_komoditas.update_layout(yaxis={'categoryorder':'total ascending'})
        st.plotly_chart(fig_komoditas, use_container_width=True)
    else:
        st.info("Tidak ada data yang tersedia untuk visualisasi Komoditas Unggulan.")


# --- 6. Grafik Bar Chart (Jumlah POI per Kabupaten) ---
with col2:
    st.header("Total POI per Kabupaten/Kota")
    if is_data_present: 
        poi_sum = filtered_gdf.groupby('Kabupaten')['jumlah_poi'].sum().reset_index()
        
        fig_poi = px.bar(
            poi_sum, 
            x='Kabupaten', 
            y='jumlah_poi',
            title='Total POI berdasarkan Kabupaten/Kota',
            color='jumlah_poi',
            color_continuous_scale=px.colors.sequential.Viridis
        )
        fig_poi.update_xaxes(tickangle=45)
        st.plotly_chart(fig_poi, use_container_width=True)
    else:
        st.info("Tidak ada data yang tersedia untuk visualisasi POI.")


# --- 7. Tabel Detail (Implementasi Fungsionalitas Klik) ---
with detail_col:
    st.header("Tabel Detail Desa yang Dipilih")
    
    DISPLAY_COLUMNS = [
        'WADMKD', 'WADMKK', 'LUAS', 'EVI', 'MNDWI', 'NBR', 'NDRE', 'NDVI', 
        'NDWI', 'RVI', 'SAVI', 'Elevation', 'Slope', 'Rainfall', 'TCI', 
        'Prediksi', 'jumlah_poi'
    ]
    
    # Periksa apakah ada data yang diklik dari Session State
    if st.session_state.get('clicked_data'):
        data = st.session_state['clicked_data']
        
        selected_data = {col: data.get(col) for col in DISPLAY_COLUMNS if col in data and data.get(col) is not None}
        
        # Susun ulang untuk tampilan vertikal (Transpose)
        df_selected = pd.DataFrame.from_dict(selected_data, orient='index', columns=['Nilai']).reset_index()
        df_selected.columns = ['Atribut', 'Nilai']
        
        # Konversi float ke 2 desimal agar lebih rapi
        df_selected['Nilai'] = df_selected.apply(
            lambda row: f"{row['Nilai']:.2f}" if isinstance(row['Nilai'], (int, float)) else row['Nilai'], 
            axis=1
        )

        st.markdown(f"**Detail untuk Desa/Kelurahan: {data.get('WADMKD', '-')}**")
        st.dataframe(df_selected, use_container_width=True)
        
    else:
        st.info("Silakan **klik** pada salah satu desa di peta untuk menampilkan detail atribut.")