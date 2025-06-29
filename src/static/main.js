// Variable global para el mapa Leaflet y las capas
let map;
let markersLayer;
let linesLayer;
let optimalRouteLayer;
let gasChart; // Variable global para la instancia de Chart.js
let currentHoveredNodeData = null; // Almacena los datos del nodo actualmente "hovered"
let clickedNodeData = null; // Almacena los datos del nodo clickeado (para persistencia)


document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-graph');
    if (loadBtn) loadBtn.addEventListener('click', cargarGrafo);

    const calculateRouteBtn = document.getElementById('calculate-route-btn');
    if (calculateRouteBtn) calculateRouteBtn.addEventListener('click', calculateOptimalRoute);

    console.log("DOM Content Loaded. Initializing map...");
    initializeMap();
    console.log("Map initialization attempted.");

    // === Lógica de Tabs/Pestañas (Módulo 4) ===
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const panelId = button.dataset.panelId;
            showPanel(panelId); // Muestra el panel correspondiente al botón clicado
        });
    });

    // Mostrar la Bitácora por defecto al cargar la página
    showPanel('log-panel-content');
});

function initializeMap() {
    console.log("Inside initializeMap function.");

    if (map && map.remove) {
        console.log("Map already exists, removing old map.");
        map.remove();
        map = null;
        markersLayer = null;
        linesLayer = null;
        optimalRouteLayer = null;
        // Destruir la instancia de Chart.js si existe al re-inicializar el mapa
        if (gasChart) {
            gasChart.destroy();
            gasChart = null;
        }
        currentHoveredNodeData = null; // Resetear el estado al reiniciar el mapa
        clickedNodeData = null; // Resetear el estado al reiniciar el mapa
    }

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
        console.error("ERROR: El div con id 'map-container' no fue encontrado en el DOM.");
        return;
    }
    console.log("Div 'map-container' encontrado.");

    try {
        map = L.map('map-container').setView([-12.0464, -77.0428], 10);
        console.log("Leaflet map object created successfully.");

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        console.log("Tile layer (OpenStreetMap) added to map.");

        markersLayer = L.markerClusterGroup().addTo(map);
        linesLayer = L.featureGroup().addTo(map);
        optimalRouteLayer = L.featureGroup().addTo(map);
        console.log("Feature layers (markersLayer, linesLayer, optimalRouteLayer) initialized and added to map.");

    } catch (e) {
        console.error("ERROR CRÍTICO durante la inicialización del mapa Leaflet:", e);
        mapContainer.innerHTML = "<p style='color: red; text-align: center;'>Error al cargar el mapa. Por favor, revisa la consola del navegador.</p>";
    }
}

async function cargarGrafo() {
    mostrarCargando(true);
    try {
        console.log("Fetching graph data from /api/analisis...");
        const response = await fetch('/api/analisis');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log("Graph data received. Nodes count:", data.nodes.length, "Edges count:", data.edges.length);

        window.mst_weight = data.mst_weight;
        renderLog(data.log);
        renderMST(data.mst_weight);

        if (!markersLayer || !linesLayer || !optimalRouteLayer) {
            console.error("ERROR: Una o más capas no están inicializadas. No se puede renderizar el grafo.");
            renderLog(["ERROR: El mapa no se inicializó correctamente. No se puede dibujar el grafo."]);
            mostrarCargando(false);
            return;
        }

        renderGraphOnMap(data.nodes, data.edges);
        console.log("Graph rendering on map completed.");

        mostrarCargando(false);
    } catch (err) {
        console.error("Error in cargarGrafo:", err);
        renderLog([
            "Error al cargar los datos del grafo.",
            err.message || err.toString(),
            "Por favor, revisa la consola del navegador (F12) y la consola del servidor (VS Code) para más detalles."
        ]);
        mostrarCargando(false);
    }
}

async function calculateOptimalRoute() {
    document.getElementById('route-info').innerHTML = 'Calculando ruta...';
    optimalRouteLayer.clearLayers();

    const originNodeId = document.getElementById('origin-node-id').value;
    const destinationNodeId = document.getElementById('destination-node-id').value;

    if (!originNodeId || !destinationNodeId) {
        document.getElementById('route-info').innerHTML = '<span style="color: red;">Por favor, ingresa tanto el ID de Origen como el de Destino.</span>';
        return;
    }

    console.log(`Calculando ruta de ${originNodeId} a ${destinationNodeId}...`);

    try {
        const response = await fetch('/api/ruta-optima', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ origin_id: originNodeId, destination_id: destinationNodeId }),
        });

        const data = await response.json();
        console.log("Ruta óptima recibida (raw data):", data);

        if (!response.ok) {
            if (data && data.type === "euclidean") {
                 document.getElementById('route-info').innerHTML = `
                    <span style="color: orange;">${data.message}</span> Distancia en línea recta: <b>${data.distance.toFixed(3)} km</b>
                `;
            } else {
                const errorMessage = data.message || `Error HTTP: ${response.status} - ${response.statusText || 'Error desconocido del servidor.'}`;
                throw new Error(errorMessage);
            }
        } else {
            if (data.type === "network" && data.path && data.path.length > 1) {
                const routePolyline = L.polyline(data.path, {
                    color: 'blue',
                    weight: 5,
                    opacity: 0.8
                }).addTo(optimalRouteLayer);

                map.fitBounds(routePolyline.getBounds());

                document.getElementById('route-info').innerHTML = `
                    Ruta de red calculada con éxito. Distancia: <b>${data.distance.toFixed(3)} km</b>
                `;
            } else if (data.type === "euclidean") {
                 document.getElementById('route-info').innerHTML = `
                    <span style="color: orange;">${data.message}</span> Distancia en línea recta: <b>${data.distance.toFixed(3)} km</b>
                `;
            }
            else {
                document.getElementById('route-info').innerHTML = '<span style="color: orange;">No se encontró una ruta entre los nodos especificados (respuesta válida, pero sin ruta).</span>';
            }
        }

        // Después de calcular la ruta, asegura que el panel de Rutas esté visible
        showPanel('route-panel-content');

    } catch (error) {
        console.error("Error al calcular la ruta:", error);
        document.getElementById('route-info').innerHTML = `<span style="color: red;">Error al calcular la ruta: ${error.message}</span>`;
    }
}


function mostrarCargando(show) {
    let btn = document.getElementById('load-graph');
    if (btn) btn.disabled = show;
}

function renderLog(log) {
    const logOutput = document.getElementById('log-output');
    if (!logOutput) {
        console.error("Error: log-output div not found for rendering logs.");
        return;
    }
    logOutput.innerHTML = '';
    const colors = ['log-blue', 'log-red', 'log-yellow', 'log-green', 'log-brown'];
    let block = [];
    let colorIdx = 0;
    log.forEach(line => {
        if (line === "") {
            if (block.length > 0) {
                logOutput.appendChild(crearLogBlock(block, colors[colorIdx % colors.length]));
                block = [];
                colorIdx++;
            }
        } else {
            block.push(line);
        }
    });
    if (block.length > 0) {
        logOutput.appendChild(crearLogBlock(block, colors[colorIdx % colors.length]));
    }
    logOutput.scrollTop = logOutput.scrollHeight;
}

function crearLogBlock(lines, colorClass) {
    const div = document.createElement('div');
    div.className = `log-block ${colorClass}`;
    div.innerHTML = lines.map(l => escapeHTML(l)).join('<br>');
    return div;
}

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[m];
    });
}

function renderMST(mst_weight) {
    const mstInfo = document.getElementById('mst-info');
    if (!mstInfo) {
        console.error("Error: mst-info div not found for rendering MST.");
        return;
    }
    mstInfo.innerHTML = `
        <div class="mst-block">
            <b>Peso total del Árbol de Expansión Mínima (MST):</b> ${mst_weight} km
        </div>
    `;
}

function getGasColor(co2, ch4, nox) {
    const max_co2 = 100;
    const max_ch4 = 20;
    const max_nox = 10;

    const norm_co2 = Math.min(1, co2 / max_co2);
    const norm_ch4 = Math.min(1, ch4 / max_ch4);
    const norm_nox = Math.min(1, nox / max_nox);

    const pollution_index = (norm_co2 * 0.5) + (norm_ch4 * 0.3) + (norm_nox * 0.2);

    if (pollution_index < 0.3) return '#4CAF50';
    if (pollution_index < 0.6) return '#FFEB3B';
    return '#F44336';
}


function renderGraphOnMap(nodes, edges) {
    console.log("Inside renderGraphOnMap function. Nodes to render:", nodes.length, "Edges to render:", edges.length);

    if (!markersLayer || !markersLayer.clearLayers) {
        console.error("ERROR: markersLayer no está inicializada o no tiene clearLayers.");
        return;
    }
    if (!linesLayer || !linesLayer.clearLayers) {
        console.error("ERROR: linesLayer no está inicializada o no tiene clearLayers.");
        return;
    }
    if (!optimalRouteLayer || !optimalRouteLayer.clearLayers) {
        console.error("ERROR: optimalRouteLayer no está inicializada o no tiene clearLayers.");
        return;
    }


    markersLayer.clearLayers();
    linesLayer.clearLayers();
    optimalRouteLayer.clearLayers();
    console.log("Layers cleared.");

    nodes.forEach(node => {
        if (typeof node.lat === 'number' && typeof node.lon === 'number' && !isNaN(node.lat) && !isNaN(node.lon)) {
            const fillColor = getGasColor(node.co2_level, node.ch4_level, node.nox_level);

            const marker = L.circleMarker([node.lat, node.lon], {
                radius: 8,
                fillColor: fillColor,
                color: '#222',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.8
            });

            const popupContent = `
                <b>Nodo (ID):</b> ${node.id || 'Sin dato'}<br>
                <b>Latitud:</b> ${node.lat !== undefined && node.lat !== null ? node.lat.toFixed(6) : 'Sin dato'}<br>
                <b>Longitud:</b> ${node.lon !== undefined && node.lon !== null ? node.lon.toFixed(6) : 'Sin dato'}<br>
                <b>CODTRAMO Original:</b> ${node.codtramo || 'Sin dato'}<br>
                <b>Cluster KMeans:</b> ${node.kmeans !== undefined && node.kmeans !== null ? node.kmeans : 'Sin dato'}<br>
                <b>LONGITUD (tramo):</b> ${node.longitud !== undefined && node.longitud !== null ? node.longitud.toFixed(2) : 'Sin dato'} km<br>
                <br>
                <b>Niveles de Gases:</b><br>
                CO₂: ${node.co2_level !== undefined && node.co2_level !== null ? node.co2_level.toFixed(2) : 'Sin dato'}<br>
                CH₄: ${node.ch4_level !== undefined && node.ch4_level !== null ? node.ch4_level.toFixed(2) : 'Sin dato'}<br>
                NOx: ${node.nox_level !== undefined && node.nox_level !== null ? node.nox_level.toFixed(2) : 'Sin dato'}<br>
                <br>
                <b>Dijkstra (km):</b> ${node.dijkstra !== undefined && node.dijkstra !== null ? node.dijkstra.toFixed(3) : 'Sin dato'}<br>
                <b>Bellman-Ford (km):</b> ${node.bellman !== undefined && node.bellman !== null ? node.bellman.toFixed(3) : 'Sin dato'}
            `;
            marker.bindPopup(popupContent);

            markersLayer.addLayer(marker);

            // Debounce function (re-defined locally for clarity, or can be global)
            const debounce = (func, delay) => {
                let timeout;
                return function(...args) {
                    const context = this;
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(context, args), delay);
                };
            };

            // MOUSEOVER (hover): Solo actualizar el panel si NO hay un nodo clickeado/bloqueado
            marker.on('mouseover', debounce(function() {
                // Si hay un nodo clickeado, ignorar el hover para evitar interferencia
                if (clickedNodeData !== null) {
                    this.setStyle({ color: '#ff9800', weight: 3 }); // Solo cambiar estilo
                    return;
                }

                // Si la pestaña Nodo Info no está visible, tampoco hacer nada en el panel
                const nodeInfoPanel = document.getElementById('node-info-panel-content');
                if (nodeInfoPanel.style.display === 'none') {
                    this.setStyle({ color: '#ff9800', weight: 3 }); // Solo cambiar estilo
                    return;
                }
                
                // Actualizar panel solo si el nodo es diferente al actual hover o no hay hovered
                if (!currentHoveredNodeData || currentHoveredNodeData.id !== node.id) {
                    displayNodeInfoInPanel(node); // Usa la nueva función consolidada
                    currentHoveredNodeData = node;
                }
                this.setStyle({ color: '#ff9800', weight: 3 });
            }, 50));

            // MOUSEOUT (sale del hover): Solo limpiar el panel si NO hay un nodo clickeado/bloqueado
            marker.on('mouseout', debounce(function() {
                // Si hay un nodo clickeado, ignorar el mouseout para evitar interferencia
                if (clickedNodeData !== null) {
                    this.setStyle({ color: '#222', weight: 1.5 }); // Solo cambiar estilo
                    return;
                }

                // Si la pestaña Nodo Info no está visible, tampoco hacer nada en el panel
                const nodeInfoPanel = document.getElementById('node-info-panel-content');
                if (nodeInfoPanel.style.display === 'none') {
                    this.setStyle({ color: '#222', weight: 1.5 }); // Solo cambiar estilo
                    return;
                }
                
                // Limpiar panel
                clearNodeInfoPanel(); // Usa la nueva función consolidada
                currentHoveredNodeData = null;
                this.setStyle({ color: '#222', weight: 1.5 });
            }, 50));

            // CLICK: Gestiona el bloqueo de la información del nodo
            marker.on('click', function() {
                // Si el nodo clickeado es el que ya estaba bloqueado, desbloquearlo (toggle)
                if (clickedNodeData && clickedNodeData.id === node.id) {
                    clickedNodeData = null; // Desbloquear
                    clearNodeInfoPanel(); // Limpiar y resetear el panel
                    // Resetear el estilo inmediatamente (ya que mouseout no lo hará si estaba bloqueado)
                    this.setStyle({ color: '#222', weight: 1.5 });
                } else {
                    // Bloquear este nuevo nodo
                    clickedNodeData = node; 
                    displayNodeInfoInPanel(node); // Mostrar info y chart para el nodo clickeado
                    showPanel('node-info-panel-content'); // Asegurarse de que el panel esté visible
                    this.setStyle({ color: '#ff9800', weight: 3 }); // Resaltar el nodo clickeado
                }
            });

        } else {
            console.warn(`Nodo con coordenadas inválidas o NaN: ${JSON.stringify(node)}`);
        }
    });

    if (markersLayer.getLayers().length > 0) {
        map.fitBounds(markersLayer.getBounds());
        console.log("Map bounds adjusted to fit markers.");
    } else {
        console.log("No markers to fit bounds to.");
    }
}

// === Funciones consolidadas para manejar el panel de información del nodo ===
function displayNodeInfoInPanel(nodeData) {
    const infoTextContent = document.getElementById('node-text-content'); // Ahora se actualiza solo el div de texto
    if (!infoTextContent) {
        console.error("Error: node-text-content div not found for displaying node info.");
        return;
    }

    // Actualizar el contenido HTML del div de texto
    infoTextContent.innerHTML = `
        <div class="node-details-content">
            <b>Nodo (ID):</b> ${nodeData.id || 'Sin dato'}<br>
            <b>Latitud:</b> ${nodeData.lat !== undefined && nodeData.lat !== null ? nodeData.lat.toFixed(6) : 'Sin dato'}<br>
            <b>Longitud:</b> ${nodeData.lon !== undefined && nodeData.lon !== null ? nodeData.lon.toFixed(6) : 'Sin dato'}<br>
            <b>CODTRAMO Original:</b> ${nodeData.codtramo || 'Sin dato'}<br>
            <b>Cluster KMeans:</b> ${nodeData.kmeans !== undefined && nodeData.kmeans !== null ? nodeData.kmeans : 'Sin dato'}<br>
            <b>LONGITUD (tramo):</b> ${nodeData.longitud !== undefined && nodeData.longitud !== null ? nodeData.longitud.toFixed(2) : 'Sin dato'} km<br>
            <br>
            <b>Niveles de Gases:</b><br>
            CO₂: ${nodeData.co2_level !== undefined && nodeData.co2_level !== null ? nodeData.co2_level.toFixed(2) : 'Sin dato'}<br>
            CH₄: ${nodeData.ch4_level !== undefined && nodeData.ch4_level !== null ? nodeData.ch4_level.toFixed(2) : 'Sin dato'}<br>
            NOx: ${nodeData.nox_level !== undefined && nodeData.nox_level !== null ? nodeData.nox_level.toFixed(2) : 'Sin dato'}<br>
            <br>
            <b>Dijkstra (km):</b> ${nodeData.dijkstra !== undefined && nodeData.dijkstra !== null ? nodeData.dijkstra.toFixed(3) : 'Sin dato'}<br>
            <b>Bellman-Ford (km):</b> ${nodeData.bellman !== undefined && nodeData.bellman !== null ? nodeData.bellman.toFixed(3) : 'Sin dato'}
        </div>
    `;

    renderGasChart(nodeData); // Renderiza el gráfico de gases
}

function clearNodeInfoPanel() {
    const infoTextContent = document.getElementById('node-text-content'); // Limpiar solo el div de texto
    if (infoTextContent) {
        infoTextContent.innerHTML = '';
    }
    if (gasChart) { // Destruir el gráfico si existe
        gasChart.destroy();
        gasChart = null;
    }
}

// === Módulo 4: Lógica de visualización de paneles con pestañas ===
function showPanel(panelId) {
    // Ocultar todos los paneles de contenido
    document.querySelectorAll('.tab-content').forEach(panel => {
        panel.style.display = 'none';
    });

    // Remover la clase 'active' de todos los botones de pestaña
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Mostrar el panel seleccionado
    const selectedPanel = document.getElementById(panelId);
    if (selectedPanel) {
        selectedPanel.style.display = 'flex';
        selectedPanel.style.flexDirection = 'column';

        // Añadir la clase 'active' al botón correspondiente
        document.querySelector(`.tab-button[data-panel-id="${panelId}"]`).classList.add('active');
    }

    // Lógica específica al cambiar de pestaña
    if (panelId !== 'node-info-panel-content') {
        // Si no estamos en la pestaña "Nodo Info", limpiar todo lo relacionado con nodos
        clearNodeInfoPanel();
        currentHoveredNodeData = null;
        clickedNodeData = null; // Desbloquear cualquier nodo si nos vamos de la pestaña
        
        // Resetear estilos de todos los marcadores
        if (markersLayer) {
            markersLayer.eachLayer(function(layer) {
                // Solo si el layer es un CircleMarker y no es un Cluster
                if (layer.options.color && layer.options.weight && layer.options.radius) { // Añadir .options.radius para asegurar que es un circleMarker
                    layer.setStyle({ color: '#222', weight: 1.5 });
                }
            });
        }

    } else {
        // Si activamos la pestaña "Nodo Info"
        if (clickedNodeData !== null) {
            // Si ya hay un nodo clickeado, mostrar su información de nuevo
            displayNodeInfoInPanel(clickedNodeData);
            // Asegurarse de que el marcador clickeado esté resaltado
            markersLayer.eachLayer(function(layer) {
                if (layer.options && layer.options.id === clickedNodeData.id) { // Usar layer.options.id para el CircleMarker
                     layer.setStyle({ color: '#ff9800', weight: 3 });
                } else if (layer.options && layer.options.color === '#ff9800') {
                    // Desactivar resaltado de otros marcadores si estaban activos
                    layer.setStyle({ color: '#222', weight: 1.5 });
                }
            });
        } else {
            // Si no hay nodo clickeado, limpiar el panel para que esté vacío al abrir la pestaña
            clearNodeInfoPanel();
            currentHoveredNodeData = null; // Asegurarse de que el hover se reinicie al abrir la pestaña vacía
        }
    }
}
// === Módulo 4: Funciones para el Gráfico de Gases en el panel de información del nodo ===
function renderGasChart(nodeData) {
    const canvasElement = document.getElementById('node-gas-chart');
    if (!canvasElement) {
        console.error("Canvas element 'node-gas-chart' not found!");
        return;
    }

    // ************ CAMBIO CLAVE AQUÍ ************
    // Asegurarse de que las dimensiones internas del canvas coincidan con sus dimensiones CSS
    // Esto es CRUCIAL para que Chart.js dibuje correctamente
    canvasElement.width = canvasElement.clientWidth;
    canvasElement.height = canvasElement.clientHeight;
    // ********************************************

    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
        console.error("Could not get 2D context from canvas!");
        return;
    }

    // Destruir el gráfico anterior si existe para evitar duplicados
    if (gasChart) {
        gasChart.destroy();
    }

    const data = {
        labels: ['CO₂', 'CH₄', 'NOx'],
        datasets: [{
            label: 'Nivel de Gas',
            data: [nodeData.co2_level, nodeData.ch4_level, nodeData.nox_level],
            backgroundColor: [
                'rgba(255, 99, 132, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(255, 205, 86, 0.7)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(255, 205, 86, 1)'
            ],
            borderWidth: 1
        }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Nivel (ppm)'
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Niveles de Gases en este Nodo'
            }
        }
    };

    gasChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: options
    });
}
