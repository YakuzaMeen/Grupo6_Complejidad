import pandas as pd
import geopandas as gpd
import networkx as nx
from sklearn.cluster import KMeans
from shapely import wkt

def cargar_tramos_gas(filepath, cols_to_use, crs_geo, logprint, max_rows=None):
    logprint(f"Cargando tramos de gas desde '{filepath}' ...")
    df = pd.read_excel(filepath, usecols=cols_to_use, nrows=max_rows)
    # Filtra filas con GEOMETRIA_WKT vacía o nula
    df = df[df["GEOMETRIA_WKT"].notnull()]
    # Convierte a geometría y filtra solo LINESTRING
    df["geometry"] = df["GEOMETRIA_WKT"].apply(wkt.loads)
    df = df[df["geometry"].apply(lambda g: g.geom_type == "LineString")]
    gdf = gpd.GeoDataFrame(df, geometry="geometry", crs=crs_geo)
    logprint(f"  Tramos de gas cargados: {len(gdf)} filas válidas, {max_rows - len(gdf) if max_rows else 0} descartadas.")
    return gdf

def construir_grafo_red(gdf_gas, gdf_gas_proj, logprint):
    logprint("Construyendo el grafo de la red ...")
    G = nx.Graph()
    for idx, row in gdf_gas_proj.iterrows():
        coords = list(row.geometry.coords)
        for i in range(len(coords) - 1):
            u = coords[i]
            v = coords[i + 1]
            dist = ((u[0] - v[0])**2 + (u[1] - v[1])**2) ** 0.5
            G.add_edge(u, v, weight=dist)
    logprint(f"  Grafo construido. Nodos: {G.number_of_nodes()}, Aristas: {G.number_of_edges()}.")
    return G

def encontrar_nodo_inicial(G, center_point_latlon, logprint):
    logprint("Buscando nodo inicial más cercano al centro de referencia ...")
    min_dist = float('inf')
    nodo_inicial = None
    for n in G.nodes:
        dist = ((n[0] - center_point_latlon[0])**2 + (n[1] - center_point_latlon[1])**2) ** 0.5
        if dist < min_dist:
            min_dist = dist
            nodo_inicial = n
    logprint(f"  Nodo inicial encontrado: ({nodo_inicial[0]:.8f}, {nodo_inicial[1]:.8f})")
    return nodo_inicial

def ejecutar_dijkstra(G, nodo_inicial, logprint):
    logprint("Ejecutando Dijkstra ...")
    try:
        lengths = nx.single_source_dijkstra_path_length(G, nodo_inicial)
        logprint("  Dijkstra calculado. Rutas encontradas a {} nodos.".format(len(lengths)))
        return lengths
    except Exception as e:
        logprint(f"  Error en Dijkstra: {e}")
        return {}

def ejecutar_bellman_ford(G, nodo_inicial, logprint):
    logprint("Ejecutando Bellman-Ford ...")
    try:
        lengths = nx.single_source_bellman_ford_path_length(G, nodo_inicial)
        logprint("  Bellman-Ford calculado. Rutas encontradas a {} nodos.".format(len(lengths)))
        return lengths
    except Exception as e:
        logprint(f"  Error en Bellman-Ford: {e}")
        return {}

def calcular_mst(G, logprint):
    logprint("Calculando Árbol de Expansión Mínima (MST) ...")
    mst = nx.minimum_spanning_tree(G)
    total_weight = sum(data['weight'] for u, v, data in mst.edges(data=True))
    logprint(f"  MST calculado. Peso total: {total_weight:.2f} km.")
    return mst, total_weight

def ejecutar_kmeans(nodes, logprint, n_clusters=3):
    logprint("Ejecutando KMeans ...")
    try:
        X = [[n[0], n[1]] for n in nodes]
        kmeans = KMeans(n_clusters=n_clusters, n_init=10)
        labels = kmeans.fit_predict(X)
        logprint(f"  KMeans calculado. {n_clusters} clusters encontrados.")
        return labels
    except Exception as e:
        logprint(f"  Error en KMeans: {e}")
        return [-1] * len(nodes)