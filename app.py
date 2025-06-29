from flask import Flask, render_template, jsonify, request 
import grafo_logic as erg
import logging
from pyproj import CRS, Transformer
from shapely.geometry import Point
import networkx as nx 
import random 
import math 


logging.basicConfig(level=logging.DEBUG)

app = Flask(
    __name__,
    static_folder='src/static',
    template_folder='src/templates'
)

CRS_GEOGRAPHIC = "EPSG:4326" 
CRS_PROJECTED = "EPSG:32718" 

transformer_geo_to_proj = Transformer.from_crs(CRS_GEOGRAPHIC, CRS_PROJECTED, always_xy=True)
transformer_proj_to_geo = Transformer.from_crs(CRS_PROJECTED, CRS_GEOGRAPHIC, always_xy=True) 


GLOBAL_GRAPH = None
# CAMBIO CLAVE: Este mapeo ahora mapeará el string ID a la TUPLA DE COORDENADAS REDONDEADAS
# que se usarán como claves en un nuevo mapeo para los nodos del grafo real.
GLOBAL_NODE_ID_STRING_TO_ROUNDED_PROJ_COORD = {} 
GLOBAL_ROUNDED_PROJ_COORD_TO_ACTUAL_PROJ_COORD = {} # Nuevo mapeo: (redondeado) -> (real del grafo)
GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD = {} # Mapeo de (real del grafo) a (lat_geo, lon_geo)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analisis')
def api_analisis():
    print("LLEGA AL ENDPOINT /api/analisis") 
    log = [] 
    try:
        print("ENTRA AL TRY del /api/analisis")
        def logprint(msg):
            log.append(msg)
            print(msg)

        max_rows_for_display = 10000 


        gdf_gas = erg.cargar_tramos_gas(logprint, max_rows=max_rows_for_display) 
        if gdf_gas.empty:
            raise ValueError("No se cargaron tramos de gas válidos desde la base de datos.")
        
        gdf_gas_proj = gdf_gas.to_crs(CRS_PROJECTED)
        logprint(f"  Geometrías proyectadas a {CRS_PROJECTED} para cálculos métricos precisos.")
        log.append("")

        G = erg.construir_grafo_red(gdf_gas, gdf_gas_proj, logprint)
        if G.number_of_nodes() == 0:
            raise ValueError("No se pudo construir un grafo con nodos válidos.")
        log.append("")

        # === Actualizar variables globales del grafo y mapeos ===
        global GLOBAL_GRAPH
        global GLOBAL_NODE_ID_STRING_TO_ROUNDED_PROJ_COORD 
        global GLOBAL_ROUNDED_PROJ_COORD_TO_ACTUAL_PROJ_COORD 
        global GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD 

        GLOBAL_GRAPH = G
        GLOBAL_NODE_ID_STRING_TO_ROUNDED_PROJ_COORD = {} 
        GLOBAL_ROUNDED_PROJ_COORD_TO_ACTUAL_PROJ_COORD = {} 
        GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD = {} 

        # Llenar los mapeos globales directamente desde los nodos del grafo real
        for actual_proj_coord_tuple in G.nodes(): # Estos son los nodos EXACTOS del grafo
            # Redondear para la creación del ID string y para el mapeo intermedio
            rounded_proj_coord_tuple = (round(actual_proj_coord_tuple[0], 6), round(actual_proj_coord_tuple[1], 6))
            node_id_str = f"{rounded_proj_coord_tuple[0]:.6f}_{rounded_proj_coord_tuple[1]:.6f}".replace('.', '_').replace('-', 'minus') 

            # Mapear el ID string al nodo redondeado (para búsqueda desde el frontend)
            GLOBAL_NODE_ID_STRING_TO_ROUNDED_PROJ_COORD[node_id_str] = rounded_proj_coord_tuple
            # Mapear el nodo redondeado al nodo real del grafo (para usarlo en NetworkX)
            GLOBAL_ROUNDED_PROJ_COORD_TO_ACTUAL_PROJ_COORD[rounded_proj_coord_tuple] = actual_proj_coord_tuple
            
            # Mapear el nodo real del grafo a sus coordenadas geográficas (para Leaflet)
            lon_geo_temp, lat_geo_temp = transformer_proj_to_geo.transform(actual_proj_coord_tuple[0], actual_proj_coord_tuple[1])
            GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD[actual_proj_coord_tuple] = (lat_geo_temp, lon_geo_temp)


        # 4. Definir y encontrar el nodo inicial más cercano (ej. centro de Lima)
        center_lon_geo, center_lat_geo = -77.0428, -12.0464 
        center_x_proj, center_y_proj = transformer_geo_to_proj.transform(center_lon_geo, center_lat_geo)
        center_point_proj = (center_x_proj, center_y_proj)

        nodo_inicial = erg.encontrar_nodo_inicial(G, center_point_proj, logprint)
        if nodo_inicial is None:
            log.append("  Advertencia: No se encontró un nodo inicial cercano para los algoritmos. El grafo puede estar vacío o muy disperso.")
            dijkstra = {}
            bellman = {}
            mst_graph = nx.Graph()
            mst_weight = 0
            kmeans_labels = [] 
        else:
            # 5. Ejecutar algoritmos de grafos
            dijkstra = erg.ejecutar_dijkstra(G, nodo_inicial, logprint)
            bellman = erg.ejecutar_bellman_ford(G, nodo_inicial, logprint)
            mst_graph, mst_weight = erg.calcular_mst(G, logprint)
            kmeans_labels = erg.ejecutar_kmeans(list(G.nodes()), logprint)
        
        log.append("")

        # 6. Preparar propiedades adicionales para los nodos del frontend (gases, codtramo, longitud)
        # Esto se hace iterando sobre gdf_gas_proj para obtener CODTRAMO y longitud
        # y generar los gases simulados en base a los KMeans (si aplica).
        # Usaremos el nodo REAL (no redondeado) como clave aquí.
        temp_node_properties = {} 
        for idx, row_proj in gdf_gas_proj.iterrows():
            row_geo = gdf_gas.loc[idx] 
            for i in range(len(row_proj.geometry.coords)):
                actual_proj_coord_point = (row_proj.geometry.coords[i][0], row_proj.geometry.coords[i][1]) # Tupla exacta del punto

                node_kmeans_label = -1 
                try:
                    # Buscar el nodo exacto en la lista de nodos del grafo para obtener su etiqueta KMeans
                    node_index_in_G_nodes = list(G.nodes()).index(actual_proj_coord_point) 
                    if node_index_in_G_nodes < len(kmeans_labels):
                        node_kmeans_label = int(kmeans_labels[node_index_in_G_nodes])
                except ValueError:
                    pass 

                base_co2 = 50 + node_kmeans_label * 10 if node_kmeans_label != -1 else 50 
                base_ch4 = 10 + node_kmeans_label * 2 if node_kmeans_label != -1 else 10 
                base_nox = 5 + node_kmeans_label * 1 if node_kmeans_label != -1 else 5 

                co2_level = round(max(0, base_co2 + random.uniform(-10, 10)), 2)
                ch4_level = round(max(0, base_ch4 + random.uniform(-3, 3)), 2)
                nox_level = round(max(0, base_nox + random.uniform(-1, 1)), 2)

                # Almacenar propiedades con la clave de la tupla REAL del nodo del grafo
                if actual_proj_coord_point not in temp_node_properties:
                    temp_node_properties[actual_proj_coord_point] = {
                        "codtramo": str(row_geo["CODTRAMO"]) if "CODTRAMO" in row_geo else "",
                        "longitud": float(row_geo["LONGITUD"]) if "LONGITUD" in row_geo else None,
                        "co2_level": co2_level,
                        "ch4_level": ch4_level,
                        "nox_level": nox_level,
                    }


        # 7. Preparar los datos de nodos para el frontend
        nodes_for_frontend = []
        for actual_proj_coord_tuple in G.nodes(): # Iterar sobre los nodos REALES del grafo
            rounded_proj_coord_tuple = (round(actual_proj_coord_tuple[0], 6), round(actual_proj_coord_tuple[1], 6))
            
            # Obtener las propiedades adicionales y las coordenadas geográficas del mapeo global
            node_properties = temp_node_properties.get(actual_proj_coord_tuple, {}) # Usar el nodo REAL aquí
            lat_geo, lon_geo = GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD.get(actual_proj_coord_tuple, (None, None)) 

            node_kmeans_label = -1
            try:
                node_index_in_G_nodes = list(G.nodes()).index(actual_proj_coord_tuple)
                if node_index_in_G_nodes < len(kmeans_labels):
                    node_kmeans_label = int(kmeans_labels[node_index_in_G_nodes])
            except ValueError:
                pass 

            nodes_for_frontend.append({
                # El ID del nodo para el frontend sigue siendo el string de las coordenadas proyectadas redondeadas
                "id": f"{rounded_proj_coord_tuple[0]:.6f}_{rounded_proj_coord_tuple[1]:.6f}".replace('.', '_').replace('-', 'minus'),
                "lat": lat_geo, 
                "lon": lon_geo,
                "x_proj": actual_proj_coord_tuple[0], # Coordenadas X, Y reales (sin redondear) del nodo del grafo
                "y_proj": actual_proj_coord_tuple[1],
                "kmeans": node_kmeans_label, 
                "dijkstra": dijkstra.get(actual_proj_coord_tuple, None),
                "bellman": bellman.get(actual_proj_coord_tuple, None),
                "codtramo": node_properties.get("codtramo", "N/A"), 
                "longitud": node_properties.get("longitud", None), 
                "co2_level": node_properties.get("co2_level", 0), 
                "ch4_level": node_properties.get("ch4_level", 0),
                "nox_level": node_properties.get("nox_level", 0),
            })
        
        edges_for_frontend = []
        for u, v in G.edges():
            lat_u, lon_u = GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD.get(u, (None, None))
            lat_v, lon_v = GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD.get(v, (None, None))

            # Los 'source' y 'target' de las aristas usan los IDs (coordenadas proyectadas redondeadas)
            # para que coincidan con los IDs de los nodos.
            rounded_u_id = (round(u[0], 6), round(u[1], 6))
            rounded_v_id = (round(v[0], 6), round(v[1], 6))

            edges_for_frontend.append({
                "source": f"{rounded_u_id[0]:.6f}_{rounded_u_id[1]:.6f}".replace('.', '_').replace('-', 'minus'),
                "target": f"{rounded_v_id[0]:.6f}_{rounded_v_id[1]:.6f}".replace('.', '_').replace('-', 'minus'),
                "source_lat": lat_u, 
                "source_lon": lon_u,
                "target_lat": lat_v,
                "target_lon": lon_v,
                "weight": float(G[u][v]['weight']) 
            })

        return jsonify({
            "nodes": nodes_for_frontend,
            "edges": edges_for_frontend,
            "mst_weight": round(mst_weight, 3), 
            "log": log 
        })
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(tb) 
        log.append("ERROR: " + str(e))
        log.append(tb)
        return jsonify({"nodes": [], "edges": [], "mst_weight": 0, "log": log}), 500


@app.route('/api/ruta-optima', methods=['POST'])
def calculate_optimal_route_api():
    if GLOBAL_GRAPH is None:
        return jsonify({"message": "El grafo no ha sido cargado. Por favor, carga el grafo primero."}), 503

    data = request.get_json()
    origin_id_str = data.get('origin_id') 
    destination_id_str = data.get('destination_id')

    if not origin_id_str or not destination_id_str:
        return jsonify({"message": "IDs de origen y destino son requeridos."}), 400

    print(f"Solicitud de ruta óptima: Origen='{origin_id_str}', Destino='{destination_id_str}'")

    try:
        # Obtener las coordenadas PROYECTADAS REDONDEADAS del ID string del frontend
        rounded_origin_proj_coord = GLOBAL_NODE_ID_STRING_TO_ROUNDED_PROJ_COORD.get(origin_id_str.strip()) # .strip() para eliminar espacios
        rounded_destination_proj_coord = GLOBAL_NODE_ID_STRING_TO_ROUNDED_PROJ_COORD.get(destination_id_str.strip()) # .strip()

        if rounded_origin_proj_coord is None:
             return jsonify({"message": f"Nodo de origen con ID '{origin_id_str.strip()}' no encontrado. Posible error en el ID."}), 404
        if rounded_destination_proj_coord is None:
             return jsonify({"message": f"Nodo de destino con ID '{destination_id_str.strip()}' no encontrado. Posible error en el ID."}), 404

        # Ahora, obtener las coordenadas EXACTAS del grafo a partir de las redondeadas
        actual_origin_proj_coord = GLOBAL_ROUNDED_PROJ_COORD_TO_ACTUAL_PROJ_COORD.get(rounded_origin_proj_coord)
        actual_destination_proj_coord = GLOBAL_ROUNDED_PROJ_COORD_TO_ACTUAL_PROJ_COORD.get(rounded_destination_proj_coord)

        if actual_origin_proj_coord is None or actual_origin_proj_coord not in GLOBAL_GRAPH.nodes:
            return jsonify({"message": f"Nodo de origen '{origin_id_str.strip()}' no es un nodo válido en el grafo (problema de mapeo interno)."}), 404
        if actual_destination_proj_coord is None or actual_destination_proj_coord not in GLOBAL_GRAPH.nodes:
            return jsonify({"message": f"Nodo de destino '{destination_id_str.strip()}' no es un nodo válido en el grafo (problema de mapeo interno)."}), 404

        try:
            # === Intenta calcular la ruta a través de la red (Dijkstra) usando los nodos REALES del grafo ===
            path_proj = nx.shortest_path(GLOBAL_GRAPH, source=actual_origin_proj_coord, target=actual_destination_proj_coord, weight='weight')
            
            total_distance_network = 0
            path_geo = [] 
            for i in range(len(path_proj)): 
                current_actual_proj_node = path_proj[i]
                
                if i < len(path_proj) - 1:
                    next_actual_proj_node = path_proj[i+1]
                    if GLOBAL_GRAPH.has_edge(current_actual_proj_node, next_actual_proj_node):
                        total_distance_network += GLOBAL_GRAPH[current_actual_proj_node][next_actual_proj_node]['weight']
                
                # Convertir coordenadas reales a geográficas para el frontend
                if current_actual_proj_node in GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD:
                    path_geo.append(list(GLOBAL_ACTUAL_PROJ_COORD_TO_GEO_COORD[current_actual_proj_node]))
                else:
                    lon_curr, lat_curr = transformer_proj_to_geo.transform(current_actual_proj_node[0], current_actual_proj_node[1])
                    path_geo.append([lat_curr, lon_curr])
            
            return jsonify({
                "path": path_geo, 
                "distance": total_distance_network,
                "type": "network" 
            }), 200

        except nx.NetworkXNoPath:
            # === Fallback: Si no hay camino en la red, calcula la distancia euclidiana ===
            print(f"No se encontró ruta de red entre {origin_id_str} y {destination_id_str}. Calculando distancia euclidiana.")
            
            # Usar las coordenadas proyectadas REALES para el cálculo euclidiano
            dist_x = actual_origin_proj_coord[0] - actual_destination_proj_coord[0]
            dist_y = actual_origin_proj_coord[1] - actual_destination_proj_coord[1]
            euclidean_distance_meters = math.hypot(dist_x, dist_y)
            euclidean_distance_km = euclidean_distance_meters / 1000 

            return jsonify({
                "path": [], 
                "distance": euclidean_distance_km,
                "type": "euclidean", 
                "message": "No se encontró una ruta de red. Distancia euclidiana calculada."
            }), 200 

    except Exception as e:
        print(f"Error inesperado al calcular la ruta (o euclidiana): {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
