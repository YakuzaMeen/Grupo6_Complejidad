// Variable global para el mapa Leaflet y las capas
let map;
let markersLayer;
let linesLayer;
let optimalRouteLayer;
let currentHoveredNodeData = null; // Almacena los datos del nodo actualmente "hovered"
let clickedNodeData = null; // Almacena los datos del nodo clickeado (para persistencia)

// Variables para el modal de simulación (declaradas aquí para que sean accesibles globalmente)
let simulationModal;
let simulationOptionsDiv;
let simulationProgressDiv;
let simulationProgressBar;
let progressPercentageSpan;
let simulationResultsDiv;
let co2BeforeSpan, ch4BeforeSpan, noxBeforeSpan;
let co2AfterSpan, ch4AfterSpan, noxAfterSpan;
let simulationTipsBox;
let simulationFeedbackPanel; // El div de feedback en el panel lateral

// NUEVAS VARIABLES PARA EL MÓDULO 6: Alertas Inteligentes
let pollutionAlertBox;
let alertMessageSpan;
let closeAlertButton;


// =================================================================================================
// === FUNCIONES DE UTILIDAD Y AYUDA (DEFINIDAS PRIMERO PARA ASEGURAR DISPONIBILIDAD GLOBAL) ===
// =================================================================================================

// Esta función ahora determina el "nivel de polución" general
function getPollutionLevel(co2, ch4, nox) {
    const max_co2 = 100; // umbral alto
    const max_ch4 = 20;  // umbral alto
    const max_nox = 10;  // umbral alto

    const norm_co2 = co2 / max_co2;
    const norm_ch4 = ch4 / max_ch4;
    const norm_nox = nox / max_nox;

    const avg_norm = (norm_co2 + norm_ch4 + norm_nox) / 3;

    if (avg_norm < 0.3) return 'Bajo';
    if (avg_norm < 0.6) return 'Moderado';
    return 'Alto';
}

function getGasColor(co2, ch4, nox) {
    const pollutionLevel = getPollutionLevel(co2, ch4, nox);
    if (pollutionLevel === 'Bajo') return '#4CAF50'; // Verde
    if (pollutionLevel === 'Moderado') return '#FFEB3B'; // Amarillo
    return '#F44336'; // Rojo
}

// Función para actualizar el color de un nodo específico en el mapa
function updateNodeOnMap(nodeId, newCo2, newCh4, newNox) {
    // Asegurarse de que markersLayer esté inicializado antes de intentar iterar
    if (!markersLayer) {
        console.error("updateNodeOnMap: markersLayer no está inicializado.");
        return;
    }

    markersLayer.eachLayer(function(layer) {
        // Acceder a las opciones del marcador directamente
        const layerOptions = layer.options; 

        // Verificar si el layer es un CircleMarker y tiene el ID correcto
        // Los clusters también son layers, pero no tienen 'id' directamente en options
        if (layerOptions && layerOptions.id === nodeId && layer instanceof L.CircleMarker) {
            const newFillColor = getGasColor(newCo2, newCh4, newNox);
            layer.setStyle({ fillColor: newFillColor });
            // Opcional: Si el popup está abierto, actualizar su contenido. Esto es más complejo
            // y generalmente se maneja re-abriendo el popup o actualizando su contenido dinámicamente.
            // Por ahora, solo actualizamos el color.
            return; // Salir del bucle una vez encontrado el nodo
        }
    });
}

// Función para generar tips/mejoras basados en la simulación
function generateSimulationTips(originalData, simulatedData, actionType) {
    let tips = '<ul>';
    const originalPollution = getPollutionLevel(originalData.co2_level, originalData.ch4_level, originalData.nox_level);
    const simulatedPollution = getPollutionLevel(simulatedData.co2_level, simulatedData.ch4_level, simulatedData.nox_level);

    tips += `<li>La simulación de <b>${actionType === 'panel_solar' ? 'Panel Solar' : 'Biodigestor'}</b> ha reducido los niveles de gases en la zona.</li>`;

    if (simulatedPollution !== originalPollution) {
        tips += `<li>¡La calidad del aire ha mejorado de <b>${originalPollution}</b> a <b>${simulatedPollution}</b>!</li>`;
    } else {
        tips += `<li>La calidad del aire se mantiene en nivel <b>${simulatedPollution}</b>. Se necesitan más acciones.</li>`;
    }

    // Tips específicos basados en la acción y el impacto
    if (actionType === 'panel_solar') {
        if (simulatedData.co2_level < originalData.co2_level) {
            tips += `<li>La energía solar es clave para reducir el CO₂. Considera aumentar la capacidad instalada.</li>`;
        }
        if (simulatedData.nox_level < originalData.nox_level) {
            tips += `<li>Los paneles solares ayudan a mitigar los NOx. Explora la integración con la red eléctrica.</li>`;
        }
    } else if (actionType === 'biodigestor') {
        if (simulatedData.ch4_level < originalData.ch4_level) {
            tips += `<li>Los biodigestores son excelentes para el metano. Evalúa la viabilidad de más unidades.</li>`;
        }
        tips += `<li>Además de reducir CH₄, los biodigestores pueden generar biogás para energía.</li>`;
    }

    // Tips generales según el nivel final de polución
    if (simulatedPollution === 'Alto') {
        tips += `<li>Aún hay un nivel de contaminación alto. Combina esta solución con otras medidas como reforestación o restricciones vehiculares.</li>`;
    } else if (simulatedPollution === 'Moderado') {
        tips += `<li>El nivel es moderado. Sigue buscando mejoras y monitorea constantemente.</li>`;
    } else { // Bajo
        tips += `<li>¡Excelente! Mantén el monitoreo y busca la sostenibilidad a largo plazo.</li>`;
    }

    tips += '</ul>';
    return tips;
}

// NUEVO: Función para mostrar la alerta de contaminación
function showPollutionAlert(districtName) {
    console.log(`showPollutionAlert: Intentando mostrar alerta para ${districtName}`);
    if (pollutionAlertBox && alertMessageSpan) {
        alertMessageSpan.textContent = `⚠️ Contaminación alta detectada en ${districtName}.`;
        pollutionAlertBox.classList.add('show'); // Añadir clase para mostrar con transición
        console.log("showPollutionAlert: Alerta mostrada.");
    } else {
        console.error("showPollutionAlert: Elementos de alerta no encontrados (pollutionAlertBox o alertMessageSpan es null).");
    }
}

// NUEVO: Función para ocultar la alerta de contaminación
function hidePollutionAlert() {
    console.log("hidePollutionAlert: Intentando ocultar alerta.");
    if (pollutionAlertBox) {
        pollutionAlertBox.classList.remove('show'); // Remover clase para ocultar con transición
        console.log("hidePollutionAlert: Alerta ocultada.");
    } else {
        console.error("hidePollutionAlert: Elemento pollutionAlertBox no encontrado (es null).");
    }
}


// =================================================================================================
// === FUNCIONES PRINCIPALES DE LA APLICACIÓN ===
// =================================================================================================

document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-graph');
    if (loadBtn) loadBtn.addEventListener('click', cargarGrafo);

    const calculateRouteBtn = document.getElementById('calculate-route-btn');
    if (calculateRouteBtn) calculateRouteBtn.addEventListener('click', calculateOptimalRoute);

    console.log("DOM Content Loaded. Initializing map...");
    initializeMap();
    console.log("Map initialization attempted.");

    // === Módulo 5: Inicialización del Modal y Event Listeners ===
    simulationModal = document.getElementById('simulation-modal');
    simulationOptionsDiv = document.getElementById('simulation-options');
    simulationProgressDiv = document.getElementById('simulation-progress');
    simulationProgressBar = simulationProgressDiv ? simulationProgressDiv.querySelector('.progress-bar') : null;
    progressPercentageSpan = document.getElementById('progress-percentage');
    simulationResultsDiv = document.getElementById('simulation-results');
    co2BeforeSpan = document.getElementById('co2-before');
    ch4BeforeSpan = document.getElementById('ch4-before');
    noxBeforeSpan = document.getElementById('nox-before');
    co2AfterSpan = document.getElementById('co2-after');
    ch4AfterSpan = document.getElementById('ch4-after');
    noxAfterSpan = document.getElementById('nox-after');
    simulationTipsBox = document.getElementById('simulation-tips');
    simulationFeedbackPanel = document.getElementById('simulation-feedback');

    const openSimulatorModalBtn = document.getElementById('open-simulator-modal-btn');
    if (openSimulatorModalBtn) {
        openSimulatorModalBtn.addEventListener('click', openSimulationModal);
    }

    const closeButton = simulationModal ? simulationModal.querySelector('.close-button') : null;
    if (closeButton) {
        closeButton.addEventListener('click', closeSimulationModal);
    }

    // Delegación de eventos para los botones de acción dentro del modal
    if (simulationOptionsDiv) {
        simulationOptionsDiv.addEventListener('click', async (event) => {
            if (event.target.classList.contains('simulate-action-btn')) {
                const actionType = event.target.dataset.action;
                if (clickedNodeData) {
                    await runSimulationFlow(clickedNodeData.id, actionType, clickedNodeData);
                } else {
                    if (simulationFeedbackPanel) {
                        simulationFeedbackPanel.innerHTML = '<span style="color: orange;">Por favor, selecciona un nodo en el mapa primero.</span>';
                    }
                    closeSimulationModal();
                }
            }
        });
    }

    // === Módulo 6: Inicialización de la Alerta Inteligente y Event Listener ===
    pollutionAlertBox = document.getElementById('pollution-alert');
    alertMessageSpan = document.getElementById('alert-message');
    closeAlertButton = pollutionAlertBox ? pollutionAlertBox.querySelector('.close-alert-btn') : null;

    console.log("Módulo 6: Inicializando elementos de alerta...");
    console.log("  pollutionAlertBox:", pollutionAlertBox);
    console.log("  alertMessageSpan:", alertMessageSpan);
    console.log("  closeAlertButton:", closeAlertButton);

    if (closeAlertButton) {
        closeAlertButton.addEventListener('click', hidePollutionAlert);
    }

    // NUEVO: Ocultar la alerta al cargar la página inicialmente
    hidePollutionAlert();


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

            // Almacenar los datos completos del nodo en el marcador Leaflet
            // Esto es crucial para acceder a ellos más tarde
            marker.options.nodeData = node; 
            marker.options.id = node.id; // También almacenar el ID para fácil referencia

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
                if (!currentHoveredNodeData || currentHoveredNodeData.id !== this.options.nodeData.id) {
                    displayNodeInfoInPanel(this.options.nodeData); // Usa la nueva función consolidad
                    currentHoveredNodeData = this.options.nodeData;
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
                clearNodeInfoPanel(); // Usa la nueva función consolidad
                currentHoveredNodeData = null;
                this.setStyle({ color: '#222', weight: 1.5 });
            }, 50));

            // CLICK: Gestiona el bloqueo de la información del nodo
            marker.on('click', function() {
                // Si el nodo clickeado es el que ya estaba bloqueado, desbloquearlo (toggle)
                if (clickedNodeData && clickedNodeData.id === this.options.nodeData.id) {
                    clickedNodeData = null; // Desbloquear
                    clearNodeInfoPanel(); // Limpiar y resetear el panel
                    // Resetear el estilo inmediatamente (ya que mouseout no lo hará si estaba bloqueado)
                    this.setStyle({ color: '#222', weight: 1.5 });
                } else {
                    // Bloquear este nuevo nodo
                    clickedNodeData = this.options.nodeData; // Almacenar los datos completos del nodo
                    displayNodeInfoInPanel(clickedNodeData); // Mostrar info y chart para el nodo clickeado
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
    const infoTextContent = document.getElementById('node-text-content');
    const educationalInfoPanel = document.getElementById('educational-info-panel');
    const zoneGasInfo = document.getElementById('zone-gas-info');
    const recommendationsInfo = document.getElementById('recommendations-info');
    const simulationFeedback = document.getElementById('simulation-feedback'); // Para mensajes de simulación

    if (!infoTextContent || !educationalInfoPanel || !zoneGasInfo || !recommendationsInfo || !simulationFeedback) {
        console.error("Error: Uno o más divs del panel de información no fueron encontrados.");
        return;
    }

    // Actualizar la información textual básica del nodo
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
            CO₂: ${nodeData.co2_level !== undefined && nodeData.co2_level !== null ? nodeData.co2_level.toFixed(2) : 'Sin dato'} ppm<br>
            CH₄: ${nodeData.ch4_level !== undefined && nodeData.ch4_level !== null ? nodeData.ch4_level.toFixed(2) : 'Sin dato'} ppm<br>
            NOx: ${nodeData.nox_level !== undefined && nodeData.nox_level !== null ? nodeData.nox_level.toFixed(2) : 'Sin dato'} ppm<br>
            <br>
            <b>Dijkstra (km):</b> ${nodeData.dijkstra !== undefined && nodeData.dijkstra !== null ? nodeData.dijkstra.toFixed(3) : 'Sin dato'}<br>
            <b>Bellman-Ford (km):</b> ${nodeData.bellman !== undefined && nodeData.bellman !== null ? nodeData.bellman.toFixed(3) : 'Sin dato'}
        </div>
    `;

    // --- Módulo 4: Rellenar el Panel Educativo e Informativo ---
    const pollutionLevel = getPollutionLevel(nodeData.co2_level, nodeData.ch4_level, nodeData.nox_level);
    const districtName = "Distrito " + (nodeData.kmeans !== undefined && nodeData.kmeans !== null ? nodeData.kmeans : 'Desconocido'); // Usamos KMeans como proxy de distrito/zona

    // Información de gases por zona
    zoneGasInfo.innerHTML = `
        <p>El ${districtName} presenta un nivel de contaminación general: <b class="pollution-${pollutionLevel.toLowerCase()}">${pollutionLevel}</b></p>
        <ul>
            <li>Nivel promedio de CO₂: ${nodeData.co2_level.toFixed(2)} ppm</li>
            <li>Nivel promedio de CH₄: ${nodeData.ch4_level.toFixed(2)} ppm</li>
            <li>Nivel promedio de NOx: ${nodeData.nox_level.toFixed(2)} ppm</li>
        </ul>
        <p>Estos valores son representativos de la calidad del aire en esta sección del ${districtName}.</p>
    `;

    // Recomendaciones basadas en el nivel de polución
    let recommendationsHtml = '<h4>Medidas sugeridas:</h4><ul>';
    if (pollutionLevel === 'Bajo') {
        recommendationsHtml += `
            <li>Mantener el monitoreo continuo de la calidad del aire.</li>
            <li>Fomentar el uso de vehículos eléctricos y transporte público.</li>
            <li>Promover la creación de más zonas verdes.</li>
        `;
    } else if (pollutionLevel === 'Moderado') {
        recommendationsHtml += `
            <li>Implementar programas de incentivo para energías renovables.</li>
            <li>Optimizar las rutas de transporte público para reducir emisiones.</li>
            <li>Fomentar la reforestación urbana y el uso de filtros industriales.</li>
        `;
    } else { // Alto
        recommendationsHtml += `
            <li>Inversión urgente en tecnologías de cero emisiones.</li>
            <li>Restricciones al tráfico de vehículos contaminantes.</li>
            <li>Plantación masiva de árboles y creación de parques ecológicos.</li>
            <li>Monitoreo y control estricto de emisiones industriales.</li>
        `;
    }
    recommendationsHtml += '</ul>';
    recommendationsInfo.innerHTML = recommendationsHtml;

    // Limpiar feedback de simulación anterior
    simulationFeedback.innerHTML = '';

    // === Módulo 6: Lógica de Alertas Inteligentes ===
    console.log(`displayNodeInfoInPanel: Nivel de polución calculado: ${pollutionLevel} para ${districtName}`);
    if (pollutionLevel === 'Alto') {
        showPollutionAlert(districtName);
    } else {
        hidePollutionAlert();
    }
}

function clearNodeInfoPanel() {
    const infoTextContent = document.getElementById('node-text-content');
    const zoneGasInfo = document.getElementById('zone-gas-info');
    const recommendationsInfo = document.getElementById('recommendations-info');
    const simulationFeedback = document.getElementById('simulation-feedback');

    if (infoTextContent) {
        infoTextContent.innerHTML = '';
    }
    if (zoneGasInfo) {
        zoneGasInfo.innerHTML = '<p>Cargando información...</p>'; // Reiniciar a estado inicial
    }
    if (recommendationsInfo) {
        recommendationsInfo.innerHTML = '<p>Cargando recomendaciones...</p>'; // Reiniciar a estado inicial
    }
    if (simulationFeedback) {
        simulationFeedback.innerHTML = ''; // Limpiar feedback de simulación
    }
    hidePollutionAlert(); // Ocultar la alerta al limpiar el panel
}

// === Módulo 5: Funciones para el Modal de Simulación ===

// Función para abrir el modal
function openSimulationModal() {
    if (!clickedNodeData) {
        if (simulationFeedbackPanel) { // Verificar antes de usar
            simulationFeedbackPanel.innerHTML = '<span style="color: orange;">Por favor, selecciona un nodo en el mapa primero para simular.</span>';
        }
        return;
    }
    // Reiniciar el estado del modal cada vez que se abre
    if (simulationOptionsDiv) simulationOptionsDiv.style.display = 'flex';
    if (simulationProgressDiv) simulationProgressDiv.style.display = 'none';
    if (simulationResultsDiv) simulationResultsDiv.style.display = 'none';
    if (simulationProgressBar) simulationProgressBar.style.width = '0%';
    if (progressPercentageSpan) progressPercentageSpan.textContent = '0%';
    if (simulationModal) simulationModal.style.display = 'flex'; // Mostrar el overlay del modal
}

// Función para cerrar el modal
function closeSimulationModal() {
    if (simulationModal) { // Añadir verificación aquí
        simulationModal.style.display = 'none'; // Ocultar el overlay del modal
    }
}

// Función principal para ejecutar la simulación y actualizar la interfaz
async function runSimulationFlow(nodeId, actionType, originalNodeData) {
    // 1. Mostrar opciones y ocultar resultados/progreso
    if (simulationOptionsDiv) simulationOptionsDiv.style.display = 'none';
    if (simulationResultsDiv) simulationResultsDiv.style.display = 'none';
    if (simulationProgressDiv) simulationProgressDiv.style.display = 'flex'; // Mostrar la barra de progreso

    // 2. Mostrar valores "Antes" en el modal
    if (co2BeforeSpan) co2BeforeSpan.textContent = originalNodeData.co2_level.toFixed(2);
    if (ch4BeforeSpan) ch4BeforeSpan.textContent = originalNodeData.ch4_level.toFixed(2);
    if (noxBeforeSpan) noxBeforeSpan.textContent = originalNodeData.nox_level.toFixed(2);

    // 3. Simular el progreso de la barra (animación visual)
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress > 100) progress = 100;
        if (simulationProgressBar) simulationProgressBar.style.width = `${progress}%`;
        if (progressPercentageSpan) progressPercentageSpan.textContent = `${progress}%`;
        if (progress === 100) {
            clearInterval(interval);
        }
    }, 100); // Actualiza cada 100ms para una animación de 1 segundo

    try {
        // 4. Enviar la petición al backend
        const response = await fetch('/api/simulate-impact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ node_id: nodeId, action_type: actionType }),
        });

        const result = await response.json();

        // Asegurarse de que la barra de progreso llegue al 100%
        clearInterval(interval);
        if (simulationProgressBar) simulationProgressBar.style.width = '100%';
        if (progressPercentageSpan) progressPercentageSpan.textContent = '100%';

        if (response.ok) {
            // 5. Actualizar clickedNodeData con los nuevos niveles de gases
            if (clickedNodeData && clickedNodeData.id === result.node_id) {
                clickedNodeData.co2_level = result.new_co2;
                clickedNodeData.ch4_level = result.new_ch4;
                clickedNodeData.nox_level = result.new_nox;
            }

            // 6. Actualizar la visualización del nodo en el mapa (color)
            updateNodeOnMap(result.node_id, result.new_co2, result.new_ch4, result.new_nox);
            
            // 7. Re-renderizar el panel de información del nodo con los datos actualizados
            displayNodeInfoInPanel(clickedNodeData); 

            // 8. Mostrar resultados "Después" en el modal
            if (co2AfterSpan) co2AfterSpan.textContent = clickedNodeData.co2_level.toFixed(2);
            if (ch4AfterSpan) ch4AfterSpan.textContent = clickedNodeData.ch4_level.toFixed(2);
            if (noxAfterSpan) noxAfterSpan.textContent = clickedNodeData.nox_level.toFixed(2);

            // 9. Generar tips/mejoras dinámicamente
            const tipsHtml = generateSimulationTips(originalNodeData, clickedNodeData, actionType);
            if (simulationTipsBox) simulationTipsBox.innerHTML = `<h4>Tips y Mejoras:</h4>${tipsHtml}`;

            // 10. Mostrar la sección de resultados y ocultar progreso
            if (simulationProgressDiv) simulationProgressDiv.style.display = 'none';
            if (simulationResultsDiv) simulationResultsDiv.style.display = 'block'; // Usar 'block' para que ocupe el espacio

            // Mensaje de feedback en el panel lateral
            let message = '';
            if (actionType === 'panel_solar') {
                message = `¡Simulación de Panel Solar aplicada! Reducción estimada de CO₂ y NOx.`;
            } else if (actionType === 'biodigestor') {
                message = `¡Simulación de Biodigestor aplicada! Reducción estimada de CH₄.`;
            }
            if (simulationFeedbackPanel) simulationFeedbackPanel.innerHTML = `<span style="color: #4CAF50;">${message}</span>`; // Mensaje de éxito

        } else {
            const errorMessage = result.message || 'Error desconocido al simular el impacto.';
            if (simulationFeedbackPanel) simulationFeedbackPanel.innerHTML = `<span style="color: red;">Error: ${errorMessage}</span>`;
            console.error("Error en la simulación:", result);
            if (simulationProgressDiv) simulationProgressDiv.style.display = 'none'; // Ocultar progreso
            if (simulationOptionsDiv) simulationOptionsDiv.style.display = 'flex'; // Mostrar opciones de nuevo
        }

    } catch (error) {
        clearInterval(interval); // Asegurarse de limpiar el intervalo en caso de error de red
        if (simulationFeedbackPanel) simulationFeedbackPanel.innerHTML = `<span style="color: red;">Error de conexión: ${error.message}</span>`;
        console.error("Error de red al simular impacto:", error);
        if (simulationProgressDiv) simulationProgressDiv.style.display = 'none'; // Ocultar progreso
        if (simulationOptionsDiv) simulationOptionsDiv.style.display = 'flex'; // Mostrar opciones de nuevo
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
        
        // Asegurarse de que el modal esté cerrado y sus variables existan antes de intentar acceder a style
        if (simulationModal) { 
            closeSimulationModal(); 
        }
        hidePollutionAlert(); // Ocultar la alerta al cambiar de pestaña

        // Resetear estilos de todos los marcadores
        if (markersLayer) {
            markersLayer.eachLayer(function(layer) {
                // Solo si el layer es un CircleMarker y no es un Cluster
                if (layer.options.color && layer.options.weight && layer.options.radius) {
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
                if (layer.options && layer.options.id === clickedNodeData.id) {
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
