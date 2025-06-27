document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-graph');
    if (loadBtn) loadBtn.addEventListener('click', cargarGrafo);
});

async function cargarGrafo() {
    mostrarCargando(true);
    try {
        const response = await fetch('/api/analisis');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        window.mst_weight = data.mst_weight; // <--- Guarda el MST globalmente
        renderLog(data.log);
        renderMST(data.mst_weight);
        renderGraph(data.nodes, data.edges);
        mostrarCargando(false);
    } catch (err) {
        renderLog([
            "Error al cargar los datos del grafo.",
            err.message || err.toString()
        ]);
        mostrarCargando(false);
    }
}

function mostrarCargando(show) {
    let btn = document.getElementById('load-graph');
    if (btn) btn.disabled = show;
    // Puedes agregar un spinner si lo deseas
}

function renderLog(log) {
    const logOutput = document.getElementById('log-output');
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
    mstInfo.innerHTML = `
        <div class="mst-block">
            <b>Peso total del Árbol de Expansión Mínima (MST):</b> ${mst_weight} km
        </div>
    `;
}

function renderGraph(nodes, edges) {
    // Limpia el contenedor
    const container = document.getElementById('graph-container');
    container.innerHTML = '';
    // Configuración de SVG
    const width = container.offsetWidth || 700;
    const height = 500;
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Escalado para ajustar los nodos al SVG
    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);
    const xScale = d3.scaleLinear().domain(xExtent).range([40, width - 40]);
    const yScale = d3.scaleLinear().domain(yExtent).range([40, height - 40]);

    // Dibuja aristas
    svg.selectAll('line')
        .data(edges)
        .enter()
        .append('line')
        .attr('x1', d => xScale(getNode(nodes, d.source).x))
        .attr('y1', d => yScale(getNode(nodes, d.source).y))
        .attr('x2', d => xScale(getNode(nodes, d.target).x))
        .attr('y2', d => yScale(getNode(nodes, d.target).y))
        .attr('stroke', '#bbb')
        .attr('stroke-width', 1);

    // Dibuja nodos
    svg.selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 6)
        .attr('fill', d => clusterColor(d.kmeans))
        .attr('stroke', '#222')
        .attr('stroke-width', 1.5)
        .on('mouseover', function (event, d) {
            mostrarInfoNodo(d);
            d3.select(this).attr('stroke', '#ff9800').attr('stroke-width', 3);
        })
        .on('mouseout', function () {
            ocultarInfoNodo();
            d3.select(this).attr('stroke', '#222').attr('stroke-width', 1.5);
        });

    // Etiquetas opcionales
    // svg.selectAll('text')
    //     .data(nodes)
    //     .enter()
    //     .append('text')
    //     .attr('x', d => xScale(d.x) + 8)
    //     .attr('y', d => yScale(d.y) + 4)
    //     .text(d => d.id)
    //     .attr('font-size', '10px')
    //     .attr('fill', '#333');
}

function getNode(nodes, id) {
    return nodes.find(n => n.id === id);
}

function clusterColor(cluster) {
    const palette = ['#2196f3', '#e91e63', '#ffeb3b', '#4caf50', '#ff9800', '#9c27b0', '#795548'];
    if (cluster === -1) return '#888';
    return palette[cluster % palette.length];
}

function mostrarInfoNodo(d) {
    const info = document.getElementById('node-info');
    info.innerHTML = `
        <div class="node-block">
            <b>Nodo:</b> ${d.id || 'Sin dato'}<br>
            <b>Cluster KMeans:</b> ${d.kmeans !== undefined && d.kmeans !== null ? d.kmeans : 'Sin dato'}<br>
            <b>CODTRAMO:</b> ${d.codtramo !== undefined && d.codtramo !== null && d.codtramo !== '' ? d.codtramo : 'Sin dato'}<br>
            <b>LONGITUD:</b> ${d.longitud !== undefined && d.longitud !== null ? d.longitud : 'Sin dato'}<br>
            <b>Dijkstra (km):</b> ${d.dijkstra !== undefined && d.dijkstra !== null ? d.dijkstra.toFixed(3) : 'Sin dato'}<br>
            <b>Bellman-Ford (km):</b> ${d.bellman !== undefined && d.bellman !== null ? d.bellman.toFixed(3) : 'Sin dato'}
        </div>
    `;
}

function ocultarInfoNodo() {
    document.getElementById('node-info').innerHTML = '';
}