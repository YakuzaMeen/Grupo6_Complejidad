import pandas as pd
import geopandas as gpd
import networkx as nx
from sklearn.cluster import KMeans
from shapely import wkt
from sqlalchemy import create_engine
import psycopg2 
from pyproj import CRS, Transformer 
from shapely.geometry import Point 
import random # Necesario para la simulación de gases
import math # Necesario para cálculos de distancia

import logging # Asegurarse de que logging esté importado
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s') # Cambiado a INFO para menos verbosidad en consola

# Configuración de la base de datos
DB_USER = 'yakuza'
DB_PASSWORD = '1305'
DB_HOST = 'localhost'
DB_PORT = '5432'
DB_NAME = 'ecoregula_db'

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
ENGINE = create_engine(DATABASE_URL) 

# Transformadores de Coordenadas
CRS_GEOGRAPHIC = "EPSG:4326" 
CRS_PROJECTED = "EPSG:32718" 

transformer_geo_to_proj = Transformer.from_crs(CRS_GEOGRAPHIC, CRS_PROJECTED, always_xy=True)
transformer_proj_to_geo = Transformer.from_crs(CRS_PROJECTED, CRS_GEOGRAPHIC, always_xy=True) 


def cargar_tramos_gas(logprint, max_rows=None):
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
            query += f" LIMIT {max_rows}" # Esta sintaxis es correcta para gpd.read_postgis
            logprint(f"   Limitando la carga a {max_rows} filas.")
        
        gdf = gpd.read_postgis(query, ENGINE, geom_col='geometry', crs="EPSG:4326")

        initial_count = len(gdf)
        gdf = gdf[gdf['geometry'].notnull()]
        gdf = gdf[gdf['geometry'].apply(lambda g: g.geom_type == "LineString")]
        
        logprint(f"   Tramos de gas cargados: {len(gdf)} filas válidas. ({initial_count - len(gdf)} descartadas por ser nulas o no LineString).")
        return gdf
    except Exception as e:
        logprint(f"   Error al cargar datos desde PostgreSQL: {e}")
        logging.error(f"Error al cargar datos desde PostgreSQL: {e}", exc_info=True)
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
                # Asegurarse de que 'LONGITUD' exista y sea un número. Si no, usar la distancia euclidiana.
                # Tu código original usaba la distancia euclidiana entre los puntos proyectados
                # Esto es consistente con cómo se calculaban los pesos antes.
                dist = ((u[0] - v[0])**2 + (u[1] - v[1])**2) ** 0.5
                G.add_edge(u, v, weight=dist) # El peso es la distancia euclidiana en metros proyectados
    logprint(f"   Grafo construido. Nodos: {G.number_of_nodes()}, Aristas: {G.number_of_edges()}.")
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
        logprint(f"   Nodo inicial encontrado: ({nodo_inicial[0]:.8f}, {nodo_inicial[1]:.8f})")
    else:
        logprint("   No se encontró un nodo inicial. El grafo podría estar vacío o el centro no está cerca de ningún nodo.")
    return nodo_inicial


def ejecutar_dijkstra(G, nodo_inicial, logprint):
    logprint("Ejecutando Dijkstra ...")
    try:
        if nodo_inicial not in G:
            logprint(f"   El nodo inicial {nodo_inicial} no se encuentra en el grafo. No se ejecutará Dijkstra.")
            return {}
        lengths = nx.single_source_dijkstra_path_length(G, nodo_inicial, weight='weight') # Asegurar weight='weight'
        logprint("   Dijkstra calculado. Rutas encontradas a {} nodos.".format(len(lengths)))
        return {node: round(length / 1000, 3) for node, length in lengths.items()} # Convertir a km
    except Exception as e:
        logprint(f"   Error en Dijkstra: {e}")
        logging.error(f"Error en Dijkstra: {e}", exc_info=True)
        return {}

def ejecutar_bellman_ford(G, nodo_inicial, logprint):
    logprint("Ejecutando Bellman-Ford ...")
    try:
        if nodo_inicial not in G:
            logprint(f"   El nodo inicial {nodo_inicial} no se encuentra en el grafo. No se ejecutará Bellman-Ford.")
            return {}
        lengths = nx.single_source_bellman_ford_path_length(G, nodo_inicial, weight='weight') # Asegurar weight='weight'
        logprint("   Bellman-Ford calculado. Rutas encontradas a {} nodos.".format(len(lengths)))
        return {node: round(length / 1000, 3) for node, length in lengths.items()} # Convertir a km
    except Exception as e:
        logprint(f"   Error en Bellman-Ford: {e}")
        logging.error(f"Error en Bellman-Ford: {e}", exc_info=True)
        return {}

def calcular_mst(G, logprint):
    logprint("Calculando Árbol de Expansión Mínima (MST) ...")
    try:
        if G.number_of_nodes() == 0 or G.number_of_edges() == 0:
            logprint("   Grafo vacío o sin aristas. No se puede calcular MST.")
            return nx.Graph(), 0

        # Si el grafo no es conexo, minimum_spanning_tree lo manejará por componentes
        if not nx.is_connected(G):
            logprint("   Advertencia: El grafo no es conexo. El MST solo conectará los componentes.")
            
        mst = nx.minimum_spanning_tree(G, weight='weight') # Asegurar weight='weight'
        total_weight = sum(data['weight'] for u, v, data in mst.edges(data=True))
        logprint(f"   MST calculado. Peso total: {total_weight:.2f} m.")
        return mst, round(total_weight / 1000, 3) # Convertir a km
    except Exception as e:
        logprint(f"   Error en MST: {e}")
        logging.error(f"Error en MST: {e}", exc_info=True)
        return nx.Graph(), 0 

def ejecutar_kmeans(nodes, logprint, n_clusters=10): # Aumentado n_clusters por defecto a 10
    logprint("Ejecutando KMeans ...")
    try:
        if not nodes: 
            logprint("   No hay nodos para ejecutar KMeans.")
            return []
        
        num_points = len(nodes)
        actual_n_clusters = min(n_clusters, num_points)
        if actual_n_clusters <= 1: 
            logprint(f"   Número insuficiente de puntos ({num_points}) o clusters ({actual_n_clusters}) para ejecutar KMeans. Retornando etiquetas predeterminadas.")
            return [0] * num_points # Retornar 0 para todos si pocos nodos
        
        X = [[n[0], n[1]] for n in nodes]
        kmeans = KMeans(n_clusters=actual_n_clusters, n_init=10, random_state=0) 
        labels = kmeans.fit_predict(X)
        logprint(f"   KMeans calculado. {actual_n_clusters} clusters encontrados.")
        return labels.tolist() # Asegurarse de que devuelve una lista
    except Exception as e:
        logprint(f"   Error en KMeans: {e}")
        logging.error(f"Error en KMeans: {e}", exc_info=True)
        return [0] * len(nodes) # Retornar 0 para todos si hay error


# NUEVO: Lógica de simulación de impacto (Módulo 5)
def simulate_node_impact(graph, actual_proj_coord_tuple, action_type):
    """
    Simula el impacto de una acción en los niveles de gases de un nodo en el grafo.
    Modifica los atributos del nodo directamente en el grafo en memoria.
    Devuelve los datos actualizados del nodo.
    """
    logging.info(f"Simulando impacto '{action_type}' en el nodo {actual_proj_coord_tuple}")
    
    # Acceder a los atributos del nodo directamente en el grafo
    # Asegúrate de que el nodo exista en el grafo y tenga los atributos de gases.
    if actual_proj_coord_tuple not in graph.nodes:
        logging.error(f"Nodo {actual_proj_coord_tuple} no encontrado en el grafo para simulación.")
        return None # O levantar un error

    node_attrs = graph.nodes[actual_proj_coord_tuple]

    # Definir los porcentajes de reducción para cada acción
    reduction_percentages = {
        'panel_solar': {
            'co2': 0.15, # 15% de reducción de CO2
            'nox': 0.10  # 10% de reducción de NOx
        },
        'biodigestor': {
            'ch4': 0.30   # 30% de reducción de CH4
        }
    }

    # Aplicar la simulación
    if action_type in reduction_percentages:
        for gas, reduction_percent in reduction_percentages[action_type].items():
            attr_name = f'{gas}_level'
            if attr_name in node_attrs:
                current_level = node_attrs[attr_name]
                # Reducir el nivel, asegurándose de que no sea negativo
                node_attrs[attr_name] = round(max(0, current_level * (1 - reduction_percent)), 2)
                logging.info(f"Nivel de {gas} del nodo {actual_proj_coord_tuple} reducido en {reduction_percent*100}% a {node_attrs[attr_name]:.2f}")
            else:
                logging.warning(f"Atributo '{attr_name}' no encontrado para el nodo {actual_proj_coord_tuple}. No se aplicó reducción para {gas}.")
    else:
        logging.warning(f"Tipo de acción de simulación desconocido: {action_type}")

    # Devolver los atributos actualizados del nodo
    # Se devuelve una copia para evitar problemas si el frontend modifica el objeto.
    return node_attrs.copy()

