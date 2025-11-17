document.addEventListener("DOMContentLoaded", () => {

    // --- URL de tu script (YA PUESTA CORRECTAMENTE) ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");
    
    // Auth Guard: Si no hay rol, mandar al login
    if (!userRole) { window.location.href = "index.html"; return; }

    // Elementos del DOM
    const userNameDisplay = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");
    const reloadButton = document.getElementById("reload-button");
    const loadingSpinner = document.getElementById("loading-spinner");
    const crmMessage = document.getElementById("crm-message");
    const dashboardContent = document.getElementById("dashboard-content");
    
    // Pestañas
    const reportesTab = document.getElementById("reportes-tab-button");
    const archivadosTab = document.getElementById("archivados-tab-button"); 
    const archivadosTabContent = document.getElementById("pills-archivados");

    // Tablas
    const crmTBody = document.getElementById("crm-table-body");
    const archivadosTBody = document.getElementById("archivados-table-body");

    // Filtros y Buscador
    const filterTodayBtn = document.getElementById("filter-today");
    const filterWeekBtn = document.getElementById("filter-week");
    const filterAllBtn = document.getElementById("filter-all");
    const searchCRM = document.getElementById("search-crm");
    const searchArchivados = document.getElementById("search-archivados");
    
    // Botones de Acción
    const exportCRM = document.getElementById("export-crm-button");
    const printReportBtn = document.getElementById("print-report-button");

    // Gráficos
    const statusChartCtx = document.getElementById('status-chart')?.getContext('2d');
    let statusChartInstance = null;
    
    // Datos y Estado
    let globalData = { crm: [], archivados: [] }; 
    let technicianList = []; 
    let currentFilterDate = 'today'; // 'today', 'week', 'all'
    let searchText = "";
    let rowIdToAction = null;

    // Modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmBtn = document.getElementById('confirmActionButton');
    
    // --- INICIALIZACIÓN ---
    userNameDisplay.textContent = userName;
    setupPermissions();
    
    // 1. Cargar lista de técnicos, luego cargar datos
    loadTechnicians().then(() => {
        loadData(true); 
    });

    // --- EVENT LISTENERS ---

    // Logout
    logoutButton.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
    
    // Recargar
    reloadButton.addEventListener("click", () => loadData(false)); 

    // Buscadores
    searchCRM.addEventListener("keyup", (e) => {
        searchText = e.target.value.toLowerCase();
        render(); 
    });

    if (searchArchivados) {
        searchArchivados.addEventListener("keyup", (e) => {
             const term = e.target.value.toLowerCase();
             renderArchivados(term);
        });
    }

    // Botones Exportar / Imprimir
    if (exportCRM) exportCRM.addEventListener("click", () => exportCSV(getFilteredData(), "Reporte_Diario.csv"));
    if (printReportBtn) printReportBtn.addEventListener("click", printReport);

    // Filtros de Fecha
    filterTodayBtn.addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate = 'today'; render(); });
    filterWeekBtn.addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate = 'week'; render(); });
    filterAllBtn.addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate = 'all'; render(); });

    // Acción del Modal (Archivar)
    confirmBtn.addEventListener('click', () => {
        if (!rowIdToAction) return;
        
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Archivando...';

        fetch(`${SCRIPT_URL}?action=archiveRow&rol=${userRole}&rowId=${rowIdToAction}`)
            .then(r => r.json())
            .then(res => {
                if (res.status === "success") {
                    msg("¡Caso archivado correctamente!", "success");
                    confirmModal.hide();
                    loadData(false); 
                } else { 
                    throw new Error(res.message); 
                }
            })
            .catch(error => {
                msg(`Error: ${error.message}`, "error");
                confirmModal.hide();
            })
            .finally(() => {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = 'Sí, Archivar';
                rowIdToAction = null;
            });
    });

    // --- DELEGACIÓN DE EVENTOS EN LA TABLA (Para elementos dinámicos) ---
    crmTBody.addEventListener('click', (e) => {
        // Detectar clic en botón Archivar
        const btn = e.target.closest('.archive-btn');
        if (btn) {
            rowIdToAction = btn.dataset.rowId;
            confirmModal.show();
        }
    });
    
    crmTBody.addEventListener('change', (e) => {
        // Detectar cambio de estado
        if (e.target.classList.contains('status-select')) {
            updateStatus(e.target);
        }
        // Detectar cambio de técnico
        if (e.target.classList.contains('tech-select')) {
            updateAssignment(e.target);
        }
    });

    // Auto-recarga cada 2 minutos
    setInterval(() => loadData(false), 120000);
    
    // --- FUNCIONES ---

    function setupPermissions() {
        // Si es oficina, ocultamos la pestaña "Archivados" (Historial) y Reportes crudos
        if (userRole === "oficina") {
            if (archivadosTab) archivadosTab.classList.add("d-none");
            if (archivadosTabContent) archivadosTabContent.remove(); // Eliminar del DOM para seguridad
            if (reportesTab) reportesTab.classList.add("d-none"); // Opcional
            
            // Ocultar gráfico de tipos si existe
            const chartContainer = document.getElementById("type-chart");
            if(chartContainer) chartContainer.closest('.card').parentElement.classList.add("d-none");
        } 
    }

    function loadTechnicians() {
        return fetch(SCRIPT_URL + "?action=getTechnicians")
            .then(res => res.json())
            .then(data => {
                if(data.status === "success") {
                    technicianList = data.tecnicos;
                }
            })
            .catch(err => console.error("Error cargando técnicos", err));
    }

    function loadData(showSpinner) {
        if (showSpinner) { 
            loadingSpinner.classList.remove("d-none"); 
            dashboardContent.classList.add("d-none"); 
        } else {
            msg("Sincronizando...", "info-silent");
        }

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole)
            .then(res => res.json())
            .then(res => {
                if (res.status === "success") {
                    // Convertir strings de fecha a objetos Date para poder ordenar/filtrar
                    globalData.crm = (res.data.crm || []).map(row => ({...row, FechaObj: new Date(row.Fecha)}));
                    globalData.archivados = (res.data.archivados || []).map(row => ({...row, FechaObj: new Date(row.Fecha)}));
                    
                    render(); 
                    if (userRole === 'admin') renderArchivados("");
                    updateStats();

                    if (showSpinner) { 
                        loadingSpinner.classList.add("d-none"); 
                        dashboardContent.classList.remove("d-none"); 
                    } else {
                        msg("Datos actualizados.", "success-silent");
                    }
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => {
                loadingSpinner.classList.add("d-none");
                msg(`Error de conexión: ${error.message}`, "error");
            });
    }

    // --- RENDERIZADO ---

    function getFilteredData() {
        let data = globalData.crm;
        
        // 1. Filtro de Fecha
        const today = new Date(); 
        today.setHours(0,0,0,0);
        
        if (currentFilterDate === 'today') {
            data = data.filter(r => r.FechaObj >= today);
        } else if (currentFilterDate === 'week') {
            const weekAgo = new Date(today); 
            weekAgo.setDate(today.getDate() - 7);
            data = data.filter(r => r.FechaObj >= weekAgo);
        }

        // 2. Buscador
        if (searchText) {
            data = data.filter(row => 
                String(row.Nombre).toLowerCase().includes(searchText) ||
                String(row.Telefono).includes(searchText) ||
                String(row['Gestionado por']).toLowerCase().includes(searchText)
            );
        }
        return data;
    }

    function render() {
        const data = getFilteredData();
        renderTable(data);
        renderCharts(data);
    }

    function renderTable(data) {
        crmTBody.innerHTML = "";

        // Crear las opciones del select de técnicos UNA VEZ
        let techOptionsHtml = `<option value="" disabled selected>Asignar...</option>`;
        technicianList.forEach(tech => {
            techOptionsHtml += `<option value="${tech}">${tech}</option>`;
        });

        if (data.length === 0) {
            crmTBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">No hay casos pendientes para este filtro.</td></tr>';
            return;
        }

        data.forEach(row => {
            const tr = document.createElement("tr");
            const fechaStr = row.FechaObj.toLocaleDateString() + ' <small class="text-muted">' + row.FechaObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + '</small>';
            
            // Configurar select de técnico con el valor actual seleccionado
            let rowTechOpts = techOptionsHtml;
            if (row['Gestionado por']) {
                rowTechOpts = rowTechOpts.replace(`value="${row['Gestionado por']}"`, `value="${row['Gestionado por']}" selected`);
                rowTechOpts = rowTechOpts.replace('selected>Asignar...', '>Asignar...'); // Quitar el selected del placeholder
            }

            tr.innerHTML = `
                <td>${fechaStr}</td>
                <td><div class="fw-bold">${row.Nombre}</div><small>${row.Telefono}</small></td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>
                    <select class="form-select form-select-sm status-select" data-row-id="${row.ID}">
                        <option value="Sin contactar" ${row.Estado === 'Sin contactar' ? 'selected' : ''}>🔴 Pendiente</option>
                        <option value="En proceso" ${row.Estado === 'En proceso' ? 'selected' : ''}>🟡 En Proceso</option>
                        <option value="Contactado" ${row.Estado === 'Contactado' ? 'selected' : ''}>🟢 Finalizado</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm tech-select" data-row-id="${row.ID}">
                        ${rowTechOpts}
                    </select>
                </td>
                <td class="text-end">
                    ${userRole === 'admin' ? 
                    `<button class="btn btn-sm btn-outline-warning archive-btn" data-row-id="${row.ID}" title="Archivar (Cerrar Caso)">
                        <i class="bi bi-archive"></i>
                    </button>` : ''}
                </td>
            `;
            
            // Colorear el select de estado
            updateSelectColor(tr.querySelector(".status-select"));
            crmTBody.appendChild(tr);
        });
    }
    
    function renderArchivados(term) {
        if (!archivadosTBody) return;
        archivadosTBody.innerHTML = "";
        
        let data = globalData.archivados;
        if (term) {
            data = data.filter(row => 
                String(row.Nombre).toLowerCase().includes(term) ||
                String(row.ID).toLowerCase().includes(term)
            );
        }

        // Mostrar solo los últimos 50 para no saturar
        data.slice(0, 50).forEach(row => {
             const tr = document.createElement("tr");
             tr.innerHTML = `
                <td>${row.FechaObj.toLocaleDateString()}</td>
                <td>${row.Nombre}</td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>${row.Estado}</td>
                <td>${row['Gestionado por']}</td>
                <td><small class="text-muted">${row.ID}</small></td>
             `;
             archivadosTBody.appendChild(tr);
        });
    }

    // --- ACCIONES API ---
    
    function updateStatus(select) {
        const newStatus = select.value;
        const rowId = select.dataset.rowId;
        updateSelectColor(select);
        msg("Guardando estado...", "info");

        fetch(`${SCRIPT_URL}?action=updateStatus&rowId=${rowId}&newStatus=${newStatus}`)
            .then(r => r.json())
            .then(res => {
                if(res.status === "success") msg("Estado actualizado", "success");
                else msg("Error al guardar", "error");
            });
    }

    function updateAssignment(select) {
        const newTech = select.value;
        const rowId = select.dataset.rowId;
        msg(`Asignando a ${newTech}...`, "info");

        fetch(`${SCRIPT_URL}?action=updateAssignment&rowId=${rowId}&technician=${encodeURIComponent(newTech)}`)
            .then(r => r.json())
            .then(res => {
                if(res.status === "success") msg(`Caso asignado a ${newTech}`, "success");
                else msg("Error al asignar", "error");
            });
    }

    // --- EXTRAS ---

    function updateStats() {
        // Calcula estadísticas basadas en el filtro actual (normalmente HOY)
        const data = getFilteredData();
        
        const total = data.length;
        const finalizados = data.filter(r => r.Estado === 'Contactado').length;
        const pendientes = total - finalizados;

        const elTotal = document.getElementById("stat-total");
        const elOk = document.getElementById("stat-contacted");
        const elPending = document.getElementById("stat-pending");

        if(elTotal) elTotal.textContent = total;
        if(elOk) elOk.textContent = finalizados;
        if(elPending) elPending.textContent = pendientes;
    }

    function printReport() {
        const data = getFilteredData();
        if (data.length === 0) return alert("No hay datos en pantalla para imprimir.");

        let printWin = window.open('', '', 'height=600,width=900');
        let html = `
            <html>
            <head>
                <title>Hoja de Ruta - Americable</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #005cbf; padding-bottom: 10px; }
                    h2 { color: #005cbf; margin: 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background-color: #f0f0f0; }
                    .firma { height: 40px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>AMERICABLE - Hoja de Ruta / Reporte Diario</h2>
                    <p>Fecha de Impresión: ${new Date().toLocaleString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha/Hora</th>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>Tipo Solicitud</th>
                            <th>Técnico Asignado</th>
                            <th>Estado</th>
                            <th>Firma / Obs</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(row => {
            html += `
                <tr>
                    <td>${row.FechaObj.toLocaleString()}</td>
                    <td>${row.Nombre}</td>
                    <td>${row.Telefono}</td>
                    <td>${row['Tipo de Solicitud']}</td>
                    <td><strong>${row['Gestionado por'] || '---'}</strong></td>
                    <td>${row.Estado}</td>
                    <td class="firma"></td>
                </tr>
            `;
        });

        html += `</tbody></table></body></html>`;

        printWin.document.write(html);
        printWin.document.close();
        printWin.print();
    }

    function exportCSV(data, filename) {
        if (!data.length) return alert("Sin datos para exportar");
        const headers = ["Fecha", "Nombre", "Telefono", "Tipo", "Estado", "Tecnico"];
        let csv = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
        
        data.forEach(r => {
            const row = [
                `"${r.FechaObj.toLocaleString()}"`,
                `"${r.Nombre}"`,
                `"${r.Telefono}"`,
                `"${r['Tipo de Solicitud']}"`,
                `"${r.Estado}"`,
                `"${r['Gestionado por'] || ''}"`
            ];
            csv += row.join(",") + "\n";
        });

        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function setActiveBtn(e) {
        document.querySelectorAll(".btn-group .btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
    }

    function updateSelectColor(select) {
        if(!select) return;
        select.classList.remove("status-sin-contactar", "status-en-proceso", "status-contactado");
        if (select.value === "Sin contactar") select.classList.add("status-sin-contactar");
        else if (select.value === "En proceso") select.classList.add("status-en-proceso");
        else select.classList.add("status-contactado");
    }

    function msg(txt, type) {
        crmMessage.textContent = txt;
        crmMessage.className = type === 'success' ? "alert alert-success" : (type === 'error' ? "alert alert-danger" : "alert alert-info");
        if (type.includes("silent")) crmMessage.className += " p-1 small";
        setTimeout(() => { crmMessage.textContent=""; crmMessage.className=""; }, 4000);
    }

    // Gráfico (Solo si existe el canvas)
    function renderCharts(data) {
        if (!statusChartCtx) return;
        
        const counts = { 'Sin contactar': 0, 'En proceso': 0, 'Contactado': 0 };
        data.forEach(r => { if(counts[r.Estado] !== undefined) counts[r.Estado]++; });

        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statusChartCtx, {
            type: 'doughnut',
            data: {
                labels: ['Pendiente', 'En Proceso', 'Finalizado'],
                datasets: [{
                    data: [counts['Sin contactar'], counts['En proceso'], counts['Contactado']],
                    backgroundColor: ['#dc3545', '#ffc107', '#198754']
                }]
            }
        });
    }
});