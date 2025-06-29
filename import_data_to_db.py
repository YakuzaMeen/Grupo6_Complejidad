import pandas as pd
import geopandas as gpd
from shapely import wkt
from shapely.errors import GEOSException # Importar la excepción específica
from sqlalchemy import create_engine
import psycopg2 

# --- Configuración de la base de datos ---
DB_USER = 'yakuza'       # Reemplazado con tu usuario
DB_PASSWORD = '1305'     # Reemplazado con tu contraseña
DB_HOST = 'localhost'
DB_PORT = '5432'
DB_NAME = 'ecoregula_db' # Reemplazado con el nombre de tu base de datos

# Construye la cadena de conexión para SQLAlchemy
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# --- Configuración del archivo Excel ---
FILEPATH = "ly_osi_tramos.xlsx"
COLS_TO_USE = ["CODTRAMO", "LONGITUD", "GEOMETRIA_WKT"]
CRS_GEOGRAPHIC = "EPSG:4326" # CRS para latitud/longitud
CRS_PROJECTED = "EPSG:32718" # CRS proyectado para Perú (para cálculos de distancia)

# --- Nombre de la tabla en PostgreSQL ---
TABLE_NAME = "tramos_gas"

# Función para intentar cargar WKT y manejar errores
def load_wkt_safe(wkt_string):
    if not isinstance(wkt_string, str):
        return None # No es una cadena, retornar None
    try:
        geometry = wkt.loads(wkt_string)
        # Opcional: Puedes añadir más validación aquí, como verificar el tipo de geometría
        if geometry.is_empty: # Algunas geometrías malformadas pueden cargarse como vacías
             return None
        return geometry
    except GEOSException as e:
        # print(f"Advertencia: Error al parsear WKT '{wkt_string[:50]}...': {e}") # Descomentar para ver los errores
        return None # Retornar None para geometrías que no se puedan parsear

def import_data_to_postgresql():
    print(f"Iniciando el proceso de importación a PostgreSQL para la base de datos '{DB_NAME}'...")

    try:
        conn_check = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        conn_check.close()
        print("Conexión exitosa a la base de datos.")
    except psycopg2.OperationalError as e:
        print(f"Error al conectar a la base de datos: {e}")
        print("Asegúrate de que PostgreSQL está corriendo y la base de datos, usuario y contraseña son correctos.")
        print("Si la base de datos no existe, créala con el usuario especificado.")
        return

    engine = create_engine(DATABASE_URL)

    try:
        print(f"Cargando datos desde '{FILEPATH}'...")
        df = pd.read_excel(FILEPATH, usecols=COLS_TO_USE)

        # Filtra filas con GEOMETRIA_WKT vacía o nula ANTES de intentar parsear
        initial_rows = len(df)
        df = df[df["GEOMETRIA_WKT"].notnull()]
        print(f"Filas con GEOMETRIA_WKT no nulas: {len(df)} (descartadas {initial_rows - len(df)})")

        # Aplica la función segura para cargar WKT
        df["geometry"] = df["GEOMETRIA_WKT"].apply(load_wkt_safe)
        
        # Filtra para asegurar que solo tenemos LineString y no None después de la conversión
        initial_parsed_rows = len(df)
        df = df[df["geometry"].apply(lambda g: g is not None and g.geom_type == "LineString")]
        print(f"Se encontraron {len(df)} geometrías LineString válidas (descartadas {initial_parsed_rows - len(df)} geometrías inválidas/no-LineString).")

        gdf = gpd.GeoDataFrame(df, geometry="geometry", crs=CRS_GEOGRAPHIC)
        print(f"GeoDataFrame creado con CRS: {gdf.crs}")

        gdf['geometry_proj'] = gdf.to_crs(CRS_PROJECTED).geometry

        columns = [col for col in gdf.columns if col != 'geometry' and col != 'geometry_proj'] + ['geometry', 'geometry_proj']
        gdf = gdf[columns]

        print(f"Guardando {len(gdf)} registros en la tabla '{TABLE_NAME}' de PostgreSQL...")
        gdf.to_postgis(TABLE_NAME, engine, if_exists='replace', index=False, schema='public')

        print(f"Datos de '{FILEPATH}' importados exitosamente a la tabla '{TABLE_NAME}' en PostgreSQL.")

    except Exception as e:
        print(f"Ocurrió un error durante la importación de datos: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import_data_to_postgresql()
