document.addEventListener("DOMContentLoaded", () => {

    // --- URL de tu script "Todo en Uno" ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    // --- Auth Guard (Protección de la página) ---
    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");

    if (!userRole) {
        window.location.href = "index.html"; // Redirige al login si no hay sesión
        return;
    }

    // --- Elementos del DOM (Navegación) ---
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
    
    // Cuerpos de las Tablas
    const crmTBody = document.getElementById("crm-table-body");
    const contactosTBody = document.getElementById("contactos-table-body");
    const reportesTBody = document.getElementById("reportes-table-body");

    // --- Elementos de Filtro ---
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
    
    // Botones de Exportar
    const exportCRM = document.getElementById("export-crm-button");
    const exportContactos = document.getElementById("export-contactos-button");
    const exportReportes = document.getElementById("export-reportes-button");

    // Gráficos
    const statusChartCtx = document.getElementById('status-chart')?.getContext('2d');
    const typeChartCtx = document.getElementById('type-chart')?.getContext('2d');
    let statusChartInstance = null;
    let typeChartInstance = null;
    
    // Caché de datos
    let globalDataCache = { crm: [], contactos: [], reportes: [] };
    
    // Estado de Filtros
    let currentFilters = {
        dateRange: null, // { start, end }
        searchCRM: "",
        searchContactos: "",
        searchReportes: ""
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
    
    reloadButton.addEventListener("click", () => fetchData(false)); // Recarga manual

    // Listeners de Búsqueda
    searchCRM.addEventListener("keyup", () => {
        currentFilters.searchCRM = searchCRM.value.toLowerCase();
        renderAllTables(globalDataCache); // Re-renderizar solo tablas
    });
    searchContactos.addEventListener("keyup", () => {
        currentFilters.searchContactos = searchContactos.value.toLowerCase();
        renderAllTables(globalDataCache);
    });
    searchReportes.addEventListener("keyup", () => {
        currentFilters.searchReportes = searchReportes.value.toLowerCase();
        renderAllTables(globalDataCache);
    });
    
    // Listeners de Exportar (Ahora usan los datos filtrados)
    exportCRM.addEventListener("click", () => exportToCSV(getFilteredData().crm, "reporte_crm.csv"));
    exportContactos.addEventListener("click", () => exportToCSV(getFilteredData().contactos, "reporte_contactos.csv"));
    exportReportes.addEventListener("click", () => exportToCSV(getFilteredData().reportes, "reporte_averias.csv"));

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

    // --- Auto-Recarga cada 2 minutos ---
    setInterval(() => {
        fetchData(true); // Carga silenciosa
    }, 120000);
    
    
    // --- Configurar Permisos ---
    function setupPermissions() {
        if (userRole === "oficina") {
            reportesTab?.classList.add("d-none");
            document.getElementById("pills-reportes")?.remove();
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none");
        } else if (userRole === "tecnico") {
            contactosTab?.classList.add("d-none");
            document.getElementById("pills-contactos")?.remove();
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none");
        }
    }

    // --- 1. Buscar Datos en Google Sheet ---
    function fetchData(applyTodayFilter = false) {
        // Carga silenciosa (auto-refresh) vs Carga normal (spinner)
        if (applyTodayFilter) {
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
                    // Convertir todas las fechas a objetos Date al recibirlas
                    globalDataCache.crm = res.data.crm.map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.contactos = res.data.contactos.map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.reportes = res.data.reportes.map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    
                    if (applyTodayFilter) {
                        applyDateFilter('today'); // Aplicar filtro "Hoy" por defecto
                    } else {
                        renderAll(globalDataCache); // Renderizar todo con filtros actuales
                    }
                    
                    if (applyTodayFilter) {
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
                showMessage(`Error al cargar datos: ${error.message}`, "error");
            });
    }

    // --- 2. Lógica de Filtros (El Cerebro) ---
    
    function applyDateFilter(type) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Inicio del día

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); // Fin del día

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
            const start = new Date(dateStartInput.value + 'T00:00:00'); // Corregir zona horaria
            const end = new Date(dateEndInput.value + 'T23:59:59'); // Corregir zona horaria
            currentFilters.dateRange = { start, end };
            updateActiveButton(null); // Ningún botón rápido está activo
        } else if (type === 'all') {
            currentFilters.dateRange = null; // Limpiar filtro
            dateStartInput.value = "";
            dateEndInput.value = "";
            updateActiveButton(null);
        }
        
        renderAll(globalDataCache); // Re-renderizar todo con los nuevos filtros
    }

    function getFilteredData() {
        const { dateRange, searchCRM, searchContactos, searchReportes } = currentFilters;

        // 1. Filtrar por Fecha
        let filteredCRM = globalDataCache.crm;
        let filteredContactos = globalDataCache.contactos;
        let filteredReportes = globalDataCache.reportes;

        if (dateRange) {
            filteredCRM = globalDataCache.crm.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredContactos = globalDataCache.contactos.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredReportes = globalDataCache.reportes.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
        }
        
        // 2. Filtrar por Búsqueda (Se aplica sobre los datos ya filtrados por fecha)
        if (searchCRM) {
            filteredCRM = filteredCRM.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(searchCRM))
            );
        }
        if (searchContactos) {
            filteredContactos = filteredContactos.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(searchContactos))
            );
        }
        if (searchReportes) {
            filteredReportes = filteredReportes.filter(row => 
                Object.values(row).some(val => val.toString().toLowerCase().includes(searchReportes))
            );
        }

        return { crm: filteredCRM, contactos: filteredContactos, reportes: filteredReportes };
    }

    function updateActiveButton(activeButton) {
        filterBtnGroup.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
        if (activeButton) {
            activeButton.classList.add('active');
        }
        // Si no hay botón activo (rango o limpiar), limpiar las fechas
        if(!activeButton) {
            if (currentFilters.dateRange === null) {
                dateStartInput.value = "";
                dateEndInput.value = "";
            }
        }
    }

    // --- 3. Renderizado "Maestro" ---
    
    function renderAll(fullDataCache) {
        const data = getFilteredData(); // Obtener solo los datos filtrados
        renderAllTables(data);
        renderCharts(data.crm); // Los gráficos SÍ se basan en los filtros
    }
    
    function renderAllTables(data) {
        crmTBody.innerHTML = "";
        if (contactosTBody) contactosTBody.innerHTML = "";
        if (reportesTBody) reportesTBody.innerHTML = "";

        // Llenar Tabla CRM
        data.crm.forEach(row => {
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
                select.addEventListener("change", (e) => updateStatus(e.target));
            }
            crmTBody.appendChild(tr);
        });
        
        if (userRole === 'admin') {
            document.querySelectorAll('.archive-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    rowIdToAction = e.currentTarget.dataset.rowId; 
                    confirmModal.show(); 
                });
            });
        }
        
        // Llenar Tabla Contactos
        if (data.contactos && contactosTBody) {
            data.contactos.forEach(row => {
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
        if (data.reportes && reportesTBody) {
             data.reportes.forEach(row => {
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

        // Restaurar búsquedas después de re-renderizar
        searchCRM.value = currentFilters.searchCRM;
        searchContactos.value = currentFilters.searchContactos;
        searchReportes.value = currentFilters.searchReportes;
    }
    
    // --- 4. Renderizar Gráficos ---
    function renderCharts(crmData) {
        if (!statusChartCtx) return; 

        // Gráfico 1: Conteo por Estado
        const statusCounts = { 'Sin contactar': 0, 'En proceso': 0, 'Contactado': 0 };
        crmData.forEach(row => {
            statusCounts[row.Estado]++;
        });

        if (statusChartInstance) statusChartInstance.destroy();
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

        // Gráfico 2: Conteo por Tipo (Solo para Admin)
        if (userRole === 'admin' && typeChartCtx) {
            const typeCounts = { 'Solicitud de Contacto': 0, 'Reporte de Avería': 0 };
            crmData.forEach(row => {
                typeCounts[row['Tipo de Solicitud']]++;
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
        
        updateSelectColor(selectElement);
        showMessage("Guardando cambio...", "info");

        const fetchURL = `${SCRIPT_URL}?action=updateStatus&rol=${userRole}&rowId=${rowId}&newStatus=${newStatus}&user=${encodeURIComponent(userWhoUpdated)}`;

        fetch(fetchURL)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    showMessage("¡Estado actualizado con éxito!", "success");
                    const fila = selectElement.closest('tr');
                    fila.cells[5].textContent = userWhoUpdated;
                    // Actualizar caché y re-renderizar gráficos
                    const rowInCache = globalDataCache.crm.find(row => row.ID === rowId);
                    if (rowInCache) {
                        rowInCache.Estado = newStatus;
                        rowInCache['Gestionado por'] = userWhoUpdated;
                    }
                    renderCharts(getFilteredData().crm);
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

    // --- 7. Filtrar Tabla (Lógica de Búsqueda en vivo) ---
    function filterTable(searchInput, tableBody) {
        if (!tableBody) return;
        // La búsqueda ahora está integrada en getFilteredData()
        // Esta función solo necesita disparar el re-renderizado.
        // Pero el listener de keyup ya lo hace, así que podemos refactorizar.
        // Por ahora, lo dejamos para que la lógica de renderAllTables funcione.
        currentFilters[searchInput.id.replace('search-','search')] = searchInput.value.toLowerCase();
        renderAllTables(getFilteredData());
    }

    // --- 8. Exportar a CSV ---
    function exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        const headers = Object.keys(data[0]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

        data.forEach(row => {
            const values = headers.map(header => {
                let cell = row[header] ? row[header].toString() : '';
                cell = cell.replace(/"/g, '""'); // Escapar comillas dobles
                if (cell.includes(",")) cell = `"${cell}"`; // Poner comillas si hay comas
                return cell;
            });
            csvContent += values.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // --- Funciones Utilitarias (color y mensajes) ---
    function updateSelectColor(select) {
        select.classList.remove("status-sin-contactar", "status-en-proceso", "status-contactado");
        if (select.value === "Sin contactar") select.classList.add("status-sin-contactar");
        else if (select.value === "En proceso") select.classList.add("status-en-proceso");
        else select.classList.add("status-contactado");
    }
    
    function showMessage(message, type) {
        crmMessage.textContent = message;
        crmMessage.className = ""; // Limpiar clases
        
        if(type === 'success') crmMessage.className = "alert alert-success";
        else if(type === 'error') crmMessage.className = "alert alert-danger";
        else if(type === 'info') crmMessage.className = "alert alert-info";
        else if(type === 'success-silent') crmMessage.className = "alert alert-success p-2 small";
        else if(type === 'error-silent') crmMessage.className = "alert alert-danger p-2 small";
        else if(type === 'info-silent') crmMessage.className = "alert alert-info p-2 small";
        
        setTimeout(() => { crmMessage.textContent = ""; crmMessage.className = ""; }, 4000);
    }
});