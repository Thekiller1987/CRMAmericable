document.addEventListener("DOMContentLoaded", () => {

    // --- URL de tu script "Todo en Uno" ---
    // ¡¡¡ RECUERDA PEGAR TU NUEVA URL DE IMPLEMENTACIÓN AQUÍ !!!
    const SCRIPT_URL = "PEGAR_LA_NUEVA_URL_DE_IMPLEMENTACION_AQUI";

    // --- Auth Guard ---
    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");
    if (!userRole) {
        window.location.href = "index.html"; 
        return;
    }

    // --- Elementos del DOM ---
    const userNameDisplay = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");
    const reloadButton = document.getElementById("reload-button");
    const loadingSpinner = document.getElementById("loading-spinner");
    const crmMessage = document.getElementById("crm-message");
    const dashboardContent = document.getElementById("dashboard-content");
    
    // Pestañas
    const statsTab = document.getElementById("stats-tab-button");
    const crmTab = document.getElementById("crm-tab-button");
    const contactosTab = document.getElementById("contactos-tab-button");
    const reportesTab = document.getElementById("reportes-tab-button");
    const archivadosTab = document.getElementById("archivados-tab-button"); // NUEVO
    
    // Cuerpos de las Tablas
    const crmTBody = document.getElementById("crm-table-body");
    const contactosTBody = document.getElementById("contactos-table-body");
    const reportesTBody = document.getElementById("reportes-table-body");
    const archivadosTBody = document.getElementById("archivados-table-body"); // NUEVO

    // Filtros de Fecha
    const filterTodayBtn = document.getElementById("filter-today");
    const filterWeekBtn = document.getElementById("filter-week");
    const filterMonthBtn = document.getElementById("filter-month");
    const dateStartInput = document.getElementById("date-start");
    const dateEndInput = document.getElementById("date-end");
    const filterRangeBtn = document.getElementById("filter-range-btn");
    const filterClearBtn = document.getElementById("filter-clear-btn");
    const filterBtnGroup = document.querySelector(".btn-group");

    // Barras de Búsqueda
    const searchCRM = document.getElementById("search-crm");
    const searchContactos = document.getElementById("search-contactos");
    const searchReportes = document.getElementById("search-reportes");
    const searchArchivados = document.getElementById("search-archivados"); // NUEVO
    
    // Botones de Exportar
    const exportCRM = document.getElementById("export-crm-button");
    const exportContactos = document.getElementById("export-contactos-button");
    const exportReportes = document.getElementById("export-reportes-button");
    const exportArchivados = document.getElementById("export-archivados-button"); // NUEVO

    // Gráficos
    const statusChartCtx = document.getElementById('status-chart')?.getContext('2d');
    const typeChartCtx = document.getElementById('type-chart')?.getContext('2d');
    let statusChartInstance = null;
    let typeChartInstance = null;
    
    // Caché de datos
    let globalDataCache = { crm: [], contactos: [], reportes: [], archivados: [] }; // NUEVO
    
    // Estado de Filtros
    let currentFilters = {
        dateRange: null,
        searchCRM: "",
        searchContactos: "",
        searchReportes: "",
        searchArchivados: "" // NUEVO
    };

    // Modal de Confirmación
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmActionButton = document.getElementById('confirmActionButton');
    let rowIdToAction = null; 
    
    // --- Inicialización ---
    userNameDisplay.textContent = userName;
    setupPermissions();
    fetchData(true); // Carga inicial y aplica filtro "Hoy" por defecto

    // --- Event Listeners ---
    logoutButton.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
    
    reloadButton.addEventListener("click", () => fetchData(false)); 

    // Listeners de Búsqueda
    searchCRM.addEventListener("keyup", () => {
        currentFilters.searchCRM = searchCRM.value.toLowerCase();
        renderAllTables(getFilteredData()); 
    });
    searchContactos.addEventListener("keyup", () => {
        currentFilters.searchContactos = searchContactos.value.toLowerCase();
        renderAllTables(getFilteredData());
    });
    searchReportes.addEventListener("keyup", () => {
        currentFilters.searchReportes = searchReportes.value.toLowerCase();
        renderAllTables(getFilteredData());
    });
    // Listener para el nuevo buscador de archivados
    searchArchivados?.addEventListener("keyup", () => { // NUEVO
        currentFilters.searchArchivados = searchArchivados.value.toLowerCase();
        renderAllTables(getFilteredData());
    });
    
    // Listeners de Exportar
    exportCRM.addEventListener("click", () => exportToCSV(getFilteredData().crm, "reporte_crm.csv"));
    exportContactos.addEventListener("click", () => exportToCSV(getFilteredData().contactos, "reporte_contactos.csv"));
    exportReportes.addEventListener("click", () => exportToCSV(getFilteredData().reportes, "reporte_averias.csv"));
    exportArchivados?.addEventListener("click", () => exportToCSV(getFilteredData().archivados, "reporte_archivados.csv")); // NUEVO

    // Listeners de Filtros de Fecha
    filterTodayBtn.addEventListener("click", () => applyDateFilter('today'));
    filterWeekBtn.addEventListener("click", () => applyDateFilter('week'));
    filterMonthBtn.addEventListener("click", () => applyDateFilter('month'));
    filterRangeBtn.addEventListener("click", () => applyDateFilter('range'));
    filterClearBtn.addEventListener("click", () => applyDateFilter('all'));

    // Listener del Modal
    confirmActionButton.addEventListener('click', () => {
        if (rowIdToAction) {
            executeArchiveRow(rowIdToAction);
            rowIdToAction = null;
        }
        confirmModal.hide();
    });

    // --- [BUG FIX] DELEGACIÓN DE EVENTOS PARA BOTONES ---
    // Este método es más robusto y arregla el bug del "botón de archivar no funciona después de un clic".
    // Escucha clics en el *cuerpo de la tabla* del CRM.
    crmTBody.addEventListener('click', (e) => {
        const target = e.target;
        
        // 1. Clic en el botón de Archivar
        // Busca el botón '.archive-btn' más cercano al elemento clickeado
        const archiveButton = target.closest('.archive-btn');
        if (archiveButton && userRole === 'admin') {
            e.preventDefault(); // Evita cualquier acción por defecto
            rowIdToAction = archiveButton.dataset.rowId; // Obtiene el ID del botón
            confirmModal.show(); // Muestra el modal
            return; // Detiene la ejecución
        }
    });

    // --- Auto-Recarga cada 2 minutos ---
    setInterval(() => {
        fetchData(false); // Carga silenciosa
    }, 120000);
    
    
    // --- Configurar Permisos ---
    function setupPermissions() {
        // Oculta las pestañas que no son para el rol
        if (userRole === "oficina") {
            reportesTab?.classList.add("d-none");
            document.getElementById("pills-reportes")?.remove();
            archivadosTab?.classList.add("d-none"); // NUEVO
            document.getElementById("pills-archivados")?.remove(); // NUEVO
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none");
        } else if (userRole === "tecnico") {
            contactosTab?.classList.add("d-none");
            document.getElementById("pills-contactos")?.remove();
            archivadosTab?.classList.add("d-none"); // NUEVO
            document.getElementById("pills-archivados")?.remove(); // NUEVO
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none");
        }
        // Si es admin, no se oculta nada.
    }

    // --- 1. Buscar Datos en Google Sheet ---
    function fetchData(applyTodayFilter = false) {

        if (isSilent(applyTodayFilter)) {
            showMessage("Actualizando datos...", "info-silent");
        } else {
            loadingSpinner.classList.remove("d-none");
            dashboardContent.classList.add("d-none");
        }
        
        crmMessage.textContent = "";
        crmMessage.className = "";

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    // Carga todos los datos en la caché global
                    globalDataCache.crm = (res.data.crm || []).map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.contactos = (res.data.contactos || []).map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.reportes = (res.data.reportes || []).map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.archivados = (res.data.archivados || []).map(row => ({...row, Fecha: new Date(row.Fecha)})); // NUEVO
                    
                    if (applyTodayFilter) {
                        applyDateFilter('today'); // Aplica filtro "Hoy"
                    } else {
                        renderAll(globalDataCache); // Renderiza con filtros actuales
                    }
                    
                    if (isSilent(applyTodayFilter)) {
                        showMessage("Datos actualizados.", "success-silent");
                    } else {
                        loadingSpinner.classList.add("d-none");
                        dashboardContent.classList.remove("d-none");
                    }
                } else { throw new Error(res.message); }
            })
            .catch(error => {
                console.error("Error al cargar datos:", error);
                loadingSpinner.classList.add("d-none");
                showMessage(`Error al cargar datos: ${error.message}. Asegúrate de que la URL del script sea correcta.`, "error");
            });
    }

    function isSilent(applyTodayFilter) {
        return !applyTodayFilter;
    }

    // --- 2. Lógica de Filtros ---
    
    function applyDateFilter(type) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); 

        if (type === 'today') {
            currentFilters.dateRange = { start: today, end: endOfToday };
            updateActiveButton(filterTodayBtn);
        } else if (type === 'week') {
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
            lastDayOfWeek.setHours(23, 59, 59, 999);
            currentFilters.dateRange = { start: firstDayOfWeek, end: lastDayOfWeek };
            updateActiveButton(filterWeekBtn);
        } else if (type === 'month') {
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            lastDayOfMonth.setHours(23, 59, 59, 999);
            currentFilters.dateRange = { start: firstDayOfMonth, end: lastDayOfMonth };
            updateActiveButton(filterMonthBtn);
        } else if (type === 'range') {
            if (!dateStartInput.value || !dateEndInput.value) {
                alert("Por favor selecciona una fecha de inicio y una de fin.");
                return;
            }
            const start = new Date(dateStartInput.value + 'T00:00:00'); 
            const end = new Date(dateEndInput.value + 'T23:59:59'); 
            currentFilters.dateRange = { start, end };
            updateActiveButton(null); 
        } else if (type === 'all') {
            currentFilters.dateRange = null; 
            dateStartInput.value = "";
            dateEndInput.value = "";
            updateActiveButton(null);
        }
        
        renderAll(globalDataCache); 
    }

    // Filtra los datos de la caché
    function getFilteredData() {
        const { dateRange } = currentFilters;
        let filteredCRM = globalDataCache.crm;
        let filteredContactos = globalDataCache.contactos;
        let filteredReportes = globalDataCache.reportes;
        let filteredArchivados = globalDataCache.archivados; // NUEVO

        // Filtra por rango de fecha
        if (dateRange) {
            filteredCRM = filteredCRM.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredContactos = filteredContactos.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredReportes = filteredReportes.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredArchivados = filteredArchivados.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end); // NUEVO
        }

        // Devuelve los datos pre-filtrados por fecha
        return { crm: filteredCRM, contactos: filteredContactos, reportes: filteredReportes, archivados: filteredArchivados }; // NUEVO
    }

    // Actualiza el botón de filtro de fecha activo
    function updateActiveButton(activeButton) {
        filterBtnGroup.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
        if (activeButton) {
            activeButton.classList.add('active');
        }
        if(!activeButton) {
            if (currentFilters.dateRange === null) {
                dateStartInput.value = "";
                dateEndInput.value = "";
            }
        }
    }

    // --- 3. Renderizado "Maestro" ---
    
    function renderAll(fullDataCache) {
        const data = getFilteredData(); 
        renderAllTables(data); // Dibuja las tablas
        renderCharts(data.crm); // Dibuja los gráficos (basados solo en CRM)
    }
    
    // Dibuja el contenido de TODAS las tablas
    function renderAllTables(data) {
        
        // Actualiza los valores de búsqueda
        currentFilters.searchCRM = searchCRM?.value || "";
        currentFilters.searchContactos = searchContactos?.value || "";
        currentFilters.searchReportes = searchReportes?.value || "";
        currentFilters.searchArchivados = searchArchivados?.value || ""; // NUEVO

        // Llenar Tabla CRM
        if (crmTBody) {
            crmTBody.innerHTML = ""; // Limpiar
            const filteredData = data.crm.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(currentFilters.searchCRM))
            );
            
            filteredData.forEach(row => {
                const tr = document.createElement("tr");
                const fecha = new Date(row.Fecha).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
                const isSelectDisabled = userRole === 'tecnico' && row['Tipo de Solicitud'] !== 'Reporte de Avería';
                tr.innerHTML = `
                    <td>${fecha}</td>
                    <td>${row.Nombre}</td>
                    <td>${row.Telefono}</td>
                    <td>${row['Tipo de Solicitud']}</td>
                    <td>
                        <select class="form-select form-select-sm status-select" data-row-id="${row.ID}" ${isSelectDisabled ? 'disabled' : ''}>
                            <option value="Sin contactar" ${row.Estado === 'Sin contactar' ? 'selected' : ''}>Sin contactar</option>
                            <option value="En proceso" ${row.Estado === 'En proceso' ? 'selected' : ''}>En proceso</option>
                            <option value="Contactado" ${row.Estado === 'Contactado' ? 'selected' : ''}>Contactado</option>
                        </select>
                    </td>
                    <td>${row['Gestionado por'] || '---'}</td>
                    <td class="text-end">
                        ${userRole === 'admin' ? 
                        `<button class="btn btn-sm btn-warning archive-btn text-dark" data-row-id="${row.ID}" title="Archivar">
                            <i class="bi bi-archive-fill"></i>
                         </button>` : '---'}
                    </td>
                `;
                const select = tr.querySelector(".status-select");
                updateSelectColor(select);
                if (!isSelectDisabled) {
                    // Se agrega el listener de 'change' aquí, porque 'select' es un elemento nuevo
                    select.addEventListener("change", (e) => updateStatus(e.target));
                }
                crmTBody.appendChild(tr);
            });
        }
        
        // Llenar Tabla Contactos
        if (contactosTBody) {
            contactosTBody.innerHTML = ""; 
            const filteredData = data.contactos.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(currentFilters.searchContactos))
            );
            
            filteredData.forEach(row => {
                const tr = document.createElement("tr");
                const fecha = new Date(row.Fecha).toLocaleString('es-NI', { dateStyle: 'short' });
                tr.innerHTML = `
                    <td>${fecha}</td>
                    <td>${row.Nombre}</td>
                    <td>${row.Telefono}</td>
                    <td>${row.Direccion}</td>
                    <td>${row.Mensaje}</td>
                `;
                contactosTBody.appendChild(tr);
            });
        }
        
        // Llenar Tabla Reportes
        if (reportesTBody) {
            reportesTBody.innerHTML = "";
            const filteredData = data.reportes.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(currentFilters.searchReportes))
            );
            
            filteredData.forEach(row => {
                const tr = document.createElement("tr");
                const fecha = new Date(row.Fecha).toLocaleString('es-NI', { dateStyle: 'short' });
                tr.innerHTML = `
                    <td>${fecha}</td>
                    <td>${row.Nombre}</td>
                    <td>${row.Telefono}</td>
                    <td>${row["Zona/Barrio"]}</td>
                    <td>${row.Detalles}</td>
                `;
                reportesTBody.appendChild(tr);
            });
        }

        // Llenar Tabla Archivados (NUEVO)
        if (archivadosTBody && userRole === 'admin') {
            archivadosTBody.innerHTML = ""; // Limpiar
            const filteredData = data.archivados.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(currentFilters.searchArchivados))
            );
            
            filteredData.forEach(row => {
                const tr = document.createElement("tr");
                const fecha = new Date(row.Fecha).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
                tr.innerHTML = `
                    <td>${fecha}</td>
                    <td>${row.Nombre}</td>
                    <td>${row.Telefono}</td>
                    <td>${row['Tipo de Solicitud']}</td>
                    <td>${row.Estado}</td>
                    <td>${row['Gestionado por'] || '---'}</td>
                    <td>${row.ID}</td>
                `;
                archivadosTBody.appendChild(tr);
            });
        }

        // [BUG FIX] Ya no se asignan listeners de 'archivar' aquí.
        // Se manejan por delegación de eventos al inicio.
    }
    
    // --- 4. Renderizar Gráficos ---
    function renderCharts(crmData) {
        if (!statusChartCtx) return; // Si el canvas no existe, no hace nada

        // Gráfico de Estados
        const statusCounts = { 'Sin contactar': 0, 'En proceso': 0, 'Contactado': 0 };
        crmData.forEach(row => {
            if (statusCounts.hasOwnProperty(row.Estado)) {
                statusCounts[row.Estado]++;
            }
        });

        if (statusChartInstance) statusChartInstance.destroy(); // Destruye el gráfico viejo
        statusChartInstance = new Chart(statusChartCtx, {
            type: 'doughnut',
            data: {
                labels: ['Sin contactar', 'En proceso', 'Contactado'],
                datasets: [{
                    label: 'Solicitudes por Estado',
                    data: [statusCounts['Sin contactar'], statusCounts['En proceso'], statusCounts['Contactado']],
                    backgroundColor: [ '#dc3545', '#ffc107', '#198754' ],
                    hoverOffset: 4
                }]
            }
        });

        // Gráfico de Tipos (Solo Admin)
        if (userRole === 'admin' && typeChartCtx) {
            const typeCounts = { 'Solicitud de Contacto': 0, 'Reporte de Avería': 0 };
            crmData.forEach(row => {
                if (typeCounts.hasOwnProperty(row['Tipo de Solicitud'])) {
                    typeCounts[row['Tipo de Solicitud']]++;
                }
            });

            if (typeChartInstance) typeChartInstance.destroy();
            typeChartInstance = new Chart(typeChartCtx, {
                type: 'bar',
                data: {
                    labels: ['Solicitud de Contacto', 'Reporte de Avería'],
                    datasets: [{
                        label: 'Tipos de Solicitud',
                        data: [typeCounts['Solicitud de Contacto'], typeCounts['Reporte de Avería']],
                        backgroundColor: [ '#005cbf', '#198754' ]
                    }]
                },
                options: { scales: { y: { beginAtZero: true, stepSize: 1 } } }
            });
        }
    }
    
    // --- 5. Actualizar Estado ---
    function updateStatus(selectElement) {
        const newStatus = selectElement.value;
        const rowId = selectElement.dataset.rowId;
        const userWhoUpdated = sessionStorage.getItem("userName"); 
        
        updateSelectColor(selectElement); // Cambia el color del select
        showMessage("Guardando cambio...", "info");

        const fetchURL = `${SCRIPT_URL}?action=updateStatus&rol=${userRole}&rowId=${rowId}&newStatus=${newStatus}&user=${encodeURIComponent(userWhoUpdated)}`;

        fetch(fetchURL)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    showMessage("¡Estado actualizado con éxito!", "success");
                    const fila = selectElement.closest('tr');
                    fila.cells[5].textContent = userWhoUpdated; // Actualiza la celda "Gestionado por"
                    
                    // Actualiza la caché para que los gráficos se recarguen
                    const rowInCache = globalDataCache.crm.find(row => row.ID == rowId);
                    if (rowInCache) {
                        rowInCache.Estado = newStatus;
                        rowInCache['Gestionado por'] = userWhoUpdated;
                    }
                    renderCharts(getFilteredData().crm); // Vuelve a dibujar los gráficos
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => showMessage(`Error al guardar: ${error.message}`, "error"));
    }

    // --- 6. Archivar Fila ---
    function executeArchiveRow(rowId) {
        showMessage("Archivando solicitud...", "info");
        
        fetch(SCRIPT_URL + `?action=archiveRow&rol=${userRole}&rowId=${rowId}`)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    showMessage("¡Solicitud archivada con éxito!", "success");
                    fetchData(false); // Recarga COMPLETA para actualizar todo
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => showMessage(`Error al archivar: ${error.message}`, "error"));
    }

    // --- 7. Exportar a CSV ---
    function exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }
        
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        if (headers.length === 0) {
             alert("No hay datos para exportar.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

        data.forEach(row => {
            const values = headers.map(header => {
                // Maneja valores nulos o indefinidos, y convierte todo a string
                let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
                cell = cell.replace(/"/g, '""'); // Escapa comillas dobles
                if (cell.includes(",")) cell = `"${cell}"`; // Pone comillas si hay comas
                return cell;
            });
            csvContent += values.join(",") + "\n";
        });

        // Crear y descargar el archivo
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // --- Funciones Utilitarias (color y mensajes) ---
    
    // Cambia el color del <select> según su valor
    function updateSelectColor(select) {
        // Usa las clases de tu CSS
        select.classList.remove("status-sin-contactar", "status-en-proceso", "status-contactado");
        if (select.value === "Sin contactar") {
            select.classList.add("status-sin-contactar");
        } else if (select.value === "En proceso") {
            select.classList.add("status-en-proceso");
        } else { // Contactado
            select.classList.add("status-contactado");
        }
    }
    
    // Muestra mensajes de estado (éxito, error, info)
    function showMessage(message, type) {
        crmMessage.textContent = message;
        crmMessage.className = ""; // Limpia clases anteriores
        
        // Asigna la clase de Bootstrap Alert correcta
        if(type === 'success') crmMessage.className = "alert alert-success";
        else if(type === 'error') crmMessage.className = "alert alert-danger";
        else if(type === 'info') crmMessage.className = "alert alert-info";
        else if(type === 'success-silent') crmMessage.className = "alert alert-success p-2 small";
        else if(type === 'error-silent') crmMessage.className = "alert alert-danger p-2 small";
        else if(type === 'info-silent') crmMessage.className = "alert alert-info p-2 small";
        
        // Borra el mensaje después de 4 segundos
        setTimeout(() => { crmMessage.textContent = ""; crmMessage.className = ""; }, 4000);
    }
});