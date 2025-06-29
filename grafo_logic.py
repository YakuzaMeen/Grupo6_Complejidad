import pandas as pd
import geopandas as gpd
import networkx as nx
from sklearn.cluster import KMeans
from shapely import wkt
from sqlalchemy import create_engine
import psycopg2 
from pyproj import CRS, Transformer 
from shapely.geometry import Point 


# Configuración de la base de datos
DB_USER = 'yakuza'
DB_PASSWORD = '1305'
DB_HOST = 'localhost'
DB_PORT = '5432'
DB_NAME = 'ecoregula_db'

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
ENGINE = create_engine(DATABASE_URL) 

# Eliminamos la variable REGION_COLUMN_NAME ya que no filtraremos por ella.

def cargar_tramos_gas(logprint, max_rows=None): # Volvemos a usar max_rows
    """
    Carga tramos de gas desde la tabla 'tramos_gas' de PostgreSQL.
    Permite limitar el número de filas cargadas.
    """
    logprint(f"Cargando tramos de gas desde la tabla 'tramos_gas' de PostgreSQL ...")
    try:
        # Consulta SQL base: ya no seleccionamos la columna de región ni filtramos por ella.
        query = f"SELECT \"CODTRAMO\", \"LONGITUD\", geometry FROM tramos_gas" 

        # Añadir límite de filas si se especifica
        if max_rows:
            query += f" LIMIT {max_rows}"
            logprint(f"  Limitando la carga a {max_rows} filas.")
        
        gdf = gpd.read_postgis(query, ENGINE, geom_col='geometry', crs="EPSG:4326")

        initial_count = len(gdf)
        gdf = gdf[gdf['geometry'].notnull()]
        gdf = gdf[gdf['geometry'].apply(lambda g: g.geom_type == "LineString")]
        
        logprint(f"  Tramos de gas cargados: {len(gdf)} filas válidas. ({initial_count - len(gdf)} descartadas por ser nulas o no LineString).")
        return gdf
    except Exception as e:
        logprint(f"  Error al cargar datos desde PostgreSQL: {e}")
        raise 

def construir_grafo_red(gdf_gas, gdf_gas_proj, logprint):
    logprint("Construyendo el grafo de la red ...")
    G = nx.Graph()
    for idx, row in gdf_gas_proj.iterrows():
        if row.geometry and row.geometry.geom_type == "LineString":
            coords = list(row.geometry.coords)
            for i in range(len(coords) - 1):
                u = coords[i]
                v = coords[i + 1]
                dist = ((u[0] - v[0])**2 + (u[1] - v[1])**2) ** 0.5
                G.add_edge(u, v, weight=dist)
    logprint(f"  Grafo construido. Nodos: {G.number_of_nodes()}, Aristas: {G.number_of_edges()}.")
    return G

def encontrar_nodo_inicial(G, center_point_proj, logprint):
    logprint("Buscando nodo inicial más cercano al centro de referencia ...")
    min_dist = float('inf')
    nodo_inicial = None
    
    for n in G.nodes:
        dist = ((n[0] - center_point_proj[0])**2 + (n[1] - center_point_proj[1])**2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            nodo_inicial = n
    
    if nodo_inicial:
        logprint(f"  Nodo inicial encontrado: ({nodo_inicial[0]:.8f}, {nodo_inicial[1]:.8f})")
    else:
        logprint("  No se encontró un nodo inicial. El grafo podría estar vacío o el centro no está cerca de ningún nodo.")
    return nodo_inicial


def ejecutar_dijkstra(G, nodo_inicial, logprint):
    logprint("Ejecutando Dijkstra ...")
    try:
        if nodo_inicial not in G:
            logprint(f"  El nodo inicial {nodo_inicial} no se encuentra en el grafo. No se ejecutará Dijkstra.")
            return {}
        lengths = nx.single_source_dijkstra_path_length(G, nodo_inicial)
        logprint("  Dijkstra calculado. Rutas encontradas a {} nodos.".format(len(lengths)))
        return lengths
    except Exception as e:
        logprint(f"  Error en Dijkstra: {e}")
        return {}

def ejecutar_bellman_ford(G, nodo_inicial, logprint):
    logprint("Ejecutando Bellman-Ford ...")
    try:
        if nodo_inicial not in G:
            logprint(f"  El nodo inicial {nodo_inicial} no se encuentra en el grafo. No se ejecutará Bellman-Ford.")
            return {}
        lengths = nx.single_source_bellman_ford_path_length(G, nodo_inicial)
        logprint("  Bellman-Ford calculado. Rutas encontradas a {} nodos.".format(len(lengths)))
        return lengths
    except Exception as e:
        logprint(f"  Error en Bellman-Ford: {e}")
        return {}

def calcular_mst(G, logprint):
    logprint("Calculando Árbol de Expansión Mínima (MST) ...")
    try:
        if G.number_of_nodes() == 0 or G.number_of_edges() == 0:
            logprint("  Grafo vacío o sin aristas. No se puede calcular MST.")
            return nx.Graph(), 0

        if not nx.is_connected(G):
            logprint("  Advertencia: El grafo no es conexo. El MST solo conectará los componentes.")
            
        mst = nx.minimum_spanning_tree(G)
        total_weight = sum(data['weight'] for u, v, data in mst.edges(data=True))
        logprint(f"  MST calculado. Peso total: {total_weight:.2f} km.")
        return mst, total_weight
    except Exception as e:
        logprint(f"  Error en MST: {e}")
        return nx.Graph(), 0 

def ejecutar_kmeans(nodes, logprint, n_clusters=3):
    logprint("Ejecutando KMeans ...")
    try:
        if not nodes: 
            logprint("  No hay nodos para ejecutar KMeans.")
            return []
        
        num_points = len(nodes)
        actual_n_clusters = min(n_clusters, num_points)
        if actual_n_clusters <= 1: 
            logprint(f"  Número insuficiente de puntos ({num_points}) o clusters ({actual_n_clusters}) para ejecutar KMeans. Retornando etiquetas predeterminadas.")
            return [-1] * num_points 

        X = [[n[0], n[1]] for n in nodes]
        kmeans = KMeans(n_clusters=actual_n_clusters, n_init=10, random_state=0) 
        labels = kmeans.fit_predict(X)
        logprint(f"  KMeans calculado. {actual_n_clusters} clusters encontrados.")
        return labels
    except Exception as e:
        logprint(f"  Error en KMeans: {e}")
        return [-1] * len(nodes) 
