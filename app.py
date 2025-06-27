from flask import Flask, render_template, jsonify
import grafo_logic as erg
import logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(
    __name__,
    static_folder='src/static',
    template_folder='src/templates'
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analisis')
def api_analisis():
    print("LLEGA AL ENDPOINT") 
    log = []
    try:
        print("ENTRA AL TRY")
        def logprint(msg):
            log.append(msg)
            print(msg)

        # Parámetros de carga
        filepath = "ly_osi_tramos.xlsx"
        cols_to_use = ["CODTRAMO", "LONGITUD", "GEOMETRIA_WKT"]
        crs_geo = "EPSG:4326"
        crs_proj = "EPSG:32718"
        max_rows = 300

        # 1. Carga y proyecta datos
        gdf_gas = erg.cargar_tramos_gas(filepath, cols_to_use, crs_geo, logprint, max_rows=max_rows)
        gdf_gas_proj = gdf_gas.to_crs(crs_proj)
        logprint(f"  Geometrías proyectadas a {crs_proj} para cálculos métricos precisos.")
        log.append("")

        # 2. Construye el grafo
        G = erg.construir_grafo_red(gdf_gas, gdf_gas_proj, logprint)
        log.append("")

        # 3. Nodo inicial (puedes ajustar el centro de referencia)
        center_point_latlon = (-77.044723, -11.828449)
        nodo_inicial = erg.encontrar_nodo_inicial(G, center_point_latlon, logprint)
        log.append("")

        # 4. Algoritmos
        dijkstra = erg.ejecutar_dijkstra(G, nodo_inicial, logprint)
        bellman = erg.ejecutar_bellman_ford(G, nodo_inicial, logprint)
        mst_graph, mst_weight = erg.calcular_mst(G, logprint)
        kmeans_labels = erg.ejecutar_kmeans(list(G.nodes()), logprint)
        log.append("")

        # --- Mapeo de coordenadas a datos originales del Excel ---
        # Usamos las coordenadas proyectadas para asociar cada nodo a su fila
        coord_to_data = {}
        for idx, row in gdf_gas_proj.iterrows():
            x, y = row.geometry.xy[0][0], row.geometry.xy[1][0]
            key = (round(x, 6), round(y, 6))
            coord_to_data[key] = {
                "codtramo": str(row["CODTRAMO"]) if "CODTRAMO" in row else "",
                "longitud": float(row["LONGITUD"]) if "LONGITUD" in row else None,
                # Agrega aquí más campos si quieres
            }

        # 5. Prepara los datos para el frontend
        nodes = []
        for i, n in enumerate(G.nodes()):
            key = (round(n[0], 6), round(n[1], 6))
            excel_data = coord_to_data.get(key, {})
            nodes.append({
                "id": f"{n[0]:.6f},{n[1]:.6f}",
                "x": n[0],
                "y": n[1],
                "kmeans": int(kmeans_labels[i]) if len(kmeans_labels) == G.number_of_nodes() else -1,
                "dijkstra": dijkstra.get(n, None),
                "bellman": bellman.get(n, None),
                "codtramo": excel_data.get("codtramo", ""),
                "longitud": excel_data.get("longitud", None),
                # Puedes agregar más campos si quieres
            })

        edges = [
            {
                "source": f"{u[0]:.6f},{u[1]:.6f}",
                "target": f"{v[0]:.6f},{v[1]:.6f}",
                "weight": float(G[u][v]['weight'])
            }
            for u, v in G.edges()
        ]

        return jsonify({
            "nodes": nodes,
            "edges": edges,
            "mst_weight": round(mst_weight, 3),
            "log": log
        })
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(tb)  # Esto sí lo verás en la terminal
        log.append("ERROR: " + str(e))
        log.append(tb)
        return jsonify({"nodes": [], "edges": [], "mst_weight": 0, "log": log}), 500

if __name__ == '__main__':
    app.run(debug=True)