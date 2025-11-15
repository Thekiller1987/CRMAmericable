document.addEventListener("DOMContentLoaded", () => {

    // --- URL de tu script "Todo en Uno" ---
    // Esta es la URL que me diste, ¡parece estar funcionando!
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

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
    const archivadosTab = document.getElementById("archivados-tab-button"); 
    
    // Cuerpos de las Tablas
    const crmTBody = document.getElementById("crm-table-body");
    const contactosTBody = document.getElementById("contactos-table-body");
    const reportesTBody = document.getElementById("reportes-table-body");
    const archivadosTBody = document.getElementById("archivados-table-body"); 

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
    const searchArchivados = document.getElementById("search-archivados"); 
    
    // Botones de Exportar
    const exportCRM = document.getElementById("export-crm-button");
    const exportContactos = document.getElementById("export-contactos-button");
    const exportReportes = document.getElementById("export-reportes-button");
    const exportArchivados = document.getElementById("export-archivados-button"); 

    // Gráficos
    const statusChartCtx = document.getElementById('status-chart')?.getContext('2d');
    const typeChartCtx = document.getElementById('type-chart')?.getContext('2d');
    let statusChartInstance = null;
    let typeChartInstance = null;
    
    // Caché de datos
    let globalDataCache = { crm: [], contactos: [], reportes: [], archivados: [] }; 
    
    // Estado de Filtros
    let currentFilters = {
        dateRange: null,
        searchCRM: "",
        searchContactos: "",
        searchReportes: "",
        searchArchivados: "" 
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
    searchArchivados?.addEventListener("keyup", () => { 
        currentFilters.searchArchivados = searchArchivados.value.toLowerCase();
        renderAllTables(getFilteredData());
    });
    
    // Listeners de Exportar
    exportCRM.addEventListener("click", () => exportToCSV(getFilteredData().crm, "reporte_crm.csv"));
    exportContactos.addEventListener("click", () => exportToCSV(getFilteredData().contactos, "reporte_contactos.csv"));
    exportReportes.addEventListener("click", () => exportToCSV(getFilteredData().reportes, "reporte_averias.csv"));
    exportArchivados?.addEventListener("click", () => exportToCSV(getFilteredData().archivados, "reporte_archivados.csv")); 

    // Listeners de Filtros de Fecha
    filterTodayBtn.addEventListener("click", () => applyDateFilter('today'));
    filterWeekBtn.addEventListener("click", () => applyDateFilter('week'));
    filterMonthBtn.addEventListener("click", () => applyDateFilter('month'));
    filterRangeBtn.addEventListener("click", () => applyDateFilter('range'));
    filterClearBtn.addEventListener("click", () => applyDateFilter('all'));

    // --- [CORRECCIÓN DEFINITIVA] ---
    // --- Listener del Botón "Archivar" del Modal ---
    confirmActionButton.addEventListener('click', () => {
        if (rowIdToAction) {
            const currentId = rowIdToAction;
            rowIdToAction = null; // Limpia el ID para evitar doble clic

            // Muestra un spinner en el botón y lo deshabilita
            confirmActionButton.disabled = true;
            confirmActionButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Archivando...';

            executeArchiveRow(currentId)
                .then(() => {
                    // Si la promesa se resuelve (éxito), cierra el modal
                    confirmModal.hide();
                })
                .catch(() => {
                    // Si la promesa se rechaza (error), NO cierra el modal.
                    // El error ya se mostró en la función executeArchiveRow.
                    // Esto permite al usuario ver el error.
                })
                .finally(() => {
                    // Se ejecuta siempre (éxito o error)
                    // Vuelve a habilitar el botón y restaura su texto
                    confirmActionButton.disabled = false;
                    confirmActionButton.innerHTML = 'Archivar';
                });

        } else {
             // Si no hay ID (caso raro), simplemente cierra el modal
             confirmModal.hide();
        }
    });

    // --- Delegación de Eventos para botones de la tabla CRM ---
    crmTBody.addEventListener('click', (e) => {
        const target = e.target;
        
        // 1. Clic en el botón de Archivar
        const archiveButton = target.closest('.archive-btn');
        if (archiveButton && userRole === 'admin') {
            e.preventDefault(); 
            rowIdToAction = archiveButton.dataset.rowId; // Guarda el ID
            confirmModal.show(); // Muestra el modal
            return; 
        }
    });

    // --- Auto-Recarga cada 2 minutos ---
    setInterval(() => {
        fetchData(false); // Carga silenciosa
    }, 120000);
    
    
    // --- Configurar Permisos ---
    function setupPermissions() {
        if (userRole === "oficina") {
            reportesTab?.classList.add("d-none");
            document.getElementById("pills-reportes")?.remove();
            archivadosTab?.classList.add("d-none"); 
            document.getElementById("pills-archivados")?.remove(); 
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none");
        } else if (userRole === "tecnico") {
            contactosTab?.classList.add("d-none");
            document.getElementById("pills-contactos")?.remove();
            archivadosTab?.classList.add("d-none"); 
            document.getElementById("pills-archivados")?.remove(); 
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none");
        }
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
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error de red: ${response.statusText}`);
                }
                return response.json(); 
            })
            .then(res => {
                if (res.status === "success") {
                    globalDataCache.crm = (res.data.crm || []).map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.contactos = (res.data.contactos || []).map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.reportes = (res.data.reportes || []).map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.archivados = (res.data.archivados || []).map(row => ({...row, Fecha: new Date(row.Fecha)})); 
                    
                    if (applyTodayFilter) {
                        applyDateFilter('today'); 
                    } else {
                        renderAll(globalDataCache); 
                    }
                    
                    if (isSilent(applyTodayFilter)) {
                        showMessage("Datos actualizados.", "success-silent");
                    } else {
                        loadingSpinner.classList.add("d-none");
                        dashboardContent.classList.remove("d-none");
                    }
                } else { 
                    throw new Error(res.message || "Error del script"); 
                }
            })
            .catch(error => {
                console.error("Error en fetchData:", error);
                loadingSpinner.classList.add("d-none");
                if (error.message.includes("valid JSON")) {
                    showMessage("Error: El script devolvió HTML. Asegúrate de que la URL es correcta y la implementación tiene permisos para 'Cualquier persona'.", "error");
                } else {
                    showMessage(`Error al cargar datos: ${error.message}`, "error");
                }
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

    function getFilteredData() {
        const { dateRange } = currentFilters;
        let filteredCRM = globalDataCache.crm;
        let filteredContactos = globalDataCache.contactos;
        let filteredReportes = globalDataCache.reportes;
        let filteredArchivados = globalDataCache.archivados; 

        if (dateRange) {
            filteredCRM = filteredCRM.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredContactos = filteredContactos.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredReportes = filteredReportes.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredArchivados = filteredArchivados.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end); 
        }

        return { crm: filteredCRM, contactos: filteredContactos, reportes: filteredReportes, archivados: filteredArchivados }; 
    }

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
        renderAllTables(data); 
        renderCharts(data.crm); 
    }
    
    function renderAllTables(data) {
        
        currentFilters.searchCRM = searchCRM?.value || "";
        currentFilters.searchContactos = searchContactos?.value || "";
        currentFilters.searchReportes = searchReportes?.value || "";
        currentFilters.searchArchivados = searchArchivados?.value || ""; 

        // Llenar Tabla CRM
        if (crmTBody) {
            crmTBody.innerHTML = ""; 
            const filteredData = data.crm.filter(row => 
                Object.values(row).some(val => String(val).toLowerCase().includes(currentFilters.searchCRM))
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
                    select.addEventListener("change", (e) => updateStatus(e.target));
                }
                crmTBody.appendChild(tr);
            });
        }
        
        // Llenar Tabla Contactos
        if (contactosTBody) {
            contactosTBody.innerHTML = ""; 
            const filteredData = data.contactos.filter(row => 
                Object.values(row).some(val => String(val).toLowerCase().includes(currentFilters.searchContactos))
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
                Object.values(row).some(val => String(val).toLowerCase().includes(currentFilters.searchReportes))
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

        // Llenar Tabla Archivados
        if (archivadosTBody && userRole === 'admin') {
            archivadosTBody.innerHTML = ""; 
            const filteredData = data.archivados.filter(row => 
                Object.values(row).some(val => String(val).toLowerCase().includes(currentFilters.searchArchivados))
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
    }
    
    // --- 4. Renderizar Gráficos ---
    function renderCharts(crmData) {
        if (!statusChartCtx) return; 

        const statusCounts = { 'Sin contactar': 0, 'En proceso': 0, 'Contactado': 0 };
        crmData.forEach(row => {
            if (statusCounts.hasOwnProperty(row.Estado)) {
                statusCounts[row.Estado]++;
            }
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
                    
                    const rowInCache = globalDataCache.crm.find(row => row.ID == rowId);
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
    // --- [CORRECCIÓN] Esta función ahora DEVUELVE la promesa de fetch ---
    function executeArchiveRow(rowId) {
        showMessage("Archivando solicitud...", "info");
        
        // Devuelve la promesa para que el listener del modal pueda manejarla
        return fetch(SCRIPT_URL + `?action=archiveRow&rol=${userRole}&rowId=${rowId}`)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    showMessage("¡Solicitud archivada con éxito!", "success");
                    fetchData(false); // Recarga COMPLETA para actualizar todo
                    // La promesa se resuelve aquí (éxito)
                } else {
                    throw new Error(res.message); // Esto será un rechazo
                }
            })
            .catch(error => {
                showMessage(`Error al archivar: ${error.message}`, "error");
                // Importante: Vuelve a lanzar el error para que el .catch() 
                // del listener del modal lo reciba
                throw error; 
            });
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
                let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
                cell = cell.replace(/"/g, '""'); 
                if (cell.includes(",")) cell = `"${cell}"`; 
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
        if (select.value === "Sin contactar") {
            select.classList.add("status-sin-contactar");
        } else if (select.value === "En proceso") {
            select.classList.add("status-en-proceso");
        } else { // Contactado
            select.classList.add("status-contactado");
        }
    }
    
    function showMessage(message, type) {
        crmMessage.textContent = message;
        crmMessage.className = ""; 
        
        if(type === 'success') crmMessage.className = "alert alert-success";
        else if(type === 'error') crmMessage.className = "alert alert-danger";
        else if(type === 'info') crmMessage.className = "alert alert-info";
        else if(type === 'success-silent') crmMessage.className = "alert alert-success p-2 small";
        else if(type === 'error-silent') crmMessage.className = "alert alert-danger p-2 small";
        else if(type === 'info-silent') crmMessage.className = "alert alert-info p-2 small";
        
        // Borra el mensaje después de 4 segundos
        // PERO si es un error, déjalo por más tiempo (8 segundos)
        const duration = type === 'error' ? 8000 : 4000;
        setTimeout(() => { crmMessage.textContent = ""; crmMessage.className = ""; }, duration);
    }
});