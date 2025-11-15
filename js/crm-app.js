document.addEventListener("DOMContentLoaded", () => {

    // --- URL de tu script "Todo en Uno" ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    // --- Auth Guard ---
    // Verifica si el usuario está logueado, si no, lo regresa al index.html
    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");
    if (!userRole) {
        window.location.href = "index.html"; 
        return;
    }

    // --- Elementos del DOM ---
    // Guardamos todos los elementos que usaremos en variables
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
        dateRange: null,
        searchCRM: "",
        searchContactos: "",
        searchReportes: ""
    };

    // Modal de Confirmación
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmActionButton = document.getElementById('confirmActionButton');
    let rowIdToAction = null; 
    
    // --- Inicialización ---
    // Al cargar la página, mostramos el nombre y cargamos los datos
    userNameDisplay.textContent = userName;
    setupPermissions();
    fetchData(true); // Carga inicial y aplica filtro "Hoy" por defecto

    // --- Event Listeners ---
    // Asignamos las funciones a los botones
    
    logoutButton.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
    
    reloadButton.addEventListener("click", () => fetchData(false)); // Recarga manual (silenciosa)

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
    
    // Listeners de Exportar
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
        // [BUG 2 FIX]: Cambiado a 'false' para que la recarga automática
        // sea silenciosa y no muestre el spinner grande.
        fetchData(false); 
    }, 120000); // 120000 ms = 2 minutos
    
    
    // --- Configurar Permisos ---
    // Oculta pestañas según el rol del usuario
    function setupPermissions() {
        if (userRole === "oficina") {
            reportesTab?.classList.add("d-none"); // Oculta pestaña "Reportes"
            document.getElementById("pills-reportes")?.remove();
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none"); // Oculta gráfico de admin
        } else if (userRole === "tecnico") {
            contactosTab?.classList.add("d-none"); // Oculta pestaña "Solicitudes"
            document.getElementById("pills-contactos")?.remove();
            document.getElementById("type-chart")?.parentElement?.parentElement.classList.add("d-none"); // Oculta gráfico de admin
        }
    }

    // --- 1. Buscar Datos en Google Sheet ---
    function fetchData(applyTodayFilter = false) {
        
        // [BUG 1 FIX]: Se eliminó el 'if' que estaba aquí.
        // Ese 'if' causaba que la carga inicial (con applyTodayFilter=true)
        // se marcara como 'false', impidiendo que el spinner se ocultara.

        if (isSilent(applyTodayFilter)) {
            // Carga silenciosa (recarga automática o manual)
            showMessage("Actualizando datos...", "info-silent");
        } else {
            // Carga inicial (la primera vez que entra a la página)
            loadingSpinner.classList.remove("d-none");
            dashboardContent.classList.add("d-none");
        }
        
        crmMessage.textContent = "";
        crmMessage.className = "";

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    // Guardamos los datos en la caché global
                    globalDataCache.crm = res.data.crm.map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.contactos = res.data.contactos.map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    globalDataCache.reportes = res.data.reportes.map(row => ({...row, Fecha: new Date(row.Fecha)}));
                    
                    if (applyTodayFilter) {
                        applyDateFilter('today'); // Aplica filtro "Hoy" por defecto
                    } else {
                        renderAll(globalDataCache); // Renderiza con los filtros actuales
                    }
                    
                    if (isSilent(applyTodayFilter)) {
                        showMessage("Datos actualizados.", "success-silent");
                    } else {
                        // ¡Éxito! Ocultamos el spinner y mostramos el contenido
                        loadingSpinner.classList.add("d-none");
                        dashboardContent.classList.remove("d-none");
                    }
                } else { throw new Error(res.message); }
            })
            .catch(error => {
                console.error("Error al cargar datos:", error);
                loadingSpinner.classList.add("d-none"); // Oculta el spinner en caso de error
                showMessage(`Error al cargar datos: ${error.message}`, "error");
            });
    }

    // Función auxiliar para saber si la carga es silenciosa o no
    function isSilent(applyTodayFilter) {
        // Es silenciosa si NO es la carga inicial (applyTodayFilter = false)
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
            updateActiveButton(null); // Desactiva los botones rápidos
        } else if (type === 'all') {
            currentFilters.dateRange = null; // Borra el filtro de fecha
            dateStartInput.value = "";
            dateEndInput.value = "";
            updateActiveButton(null);
        }
        
        renderAll(globalDataCache); // Vuelve a renderizar todo con el nuevo filtro
    }

    // Filtra los datos de la caché global según los filtros activos
    function getFilteredData() {
        const { dateRange } = currentFilters;
        let filteredCRM = globalDataCache.crm;
        let filteredContactos = globalDataCache.contactos;
        let filteredReportes = globalDataCache.reportes;

        // 1. Filtrar por Fecha
        if (dateRange) {
            filteredCRM = filteredCRM.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredContactos = filteredContactos.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
            filteredReportes = filteredReportes.filter(row => row.Fecha >= dateRange.start && row.Fecha <= dateRange.end);
        }

        // 2. Filtrar por Búsqueda (la búsqueda se aplica en renderAllTables)
        
        return { crm: filteredCRM, contactos: filteredContactos, reportes: filteredReportes };
    }

    // Actualiza cuál botón de filtro rápido está activo
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
    
    // Llama a las funciones de renderizar tablas y gráficos
    function renderAll(fullDataCache) {
        const data = getFilteredData(); 
        renderAllTables(data);
        renderCharts(data.crm); // Los gráficos se basan solo en los datos de CRM
    }
    
    // Renderiza el contenido de las 3 tablas
    function renderAllTables(data) {
        
        // Restaurar búsquedas primero
        currentFilters.searchCRM = searchCRM?.value || "";
        currentFilters.searchContactos = searchContactos?.value || "";
        currentFilters.searchReportes = searchReportes?.value || "";

        // Llenar Tabla CRM
        if (crmTBody) {
            crmTBody.innerHTML = ""; // Limpiar
            const filteredData = data.crm.filter(row => 
                // Filtra por la búsqueda de texto
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
                updateSelectColor(select); // Pone el color correcto al select
                if (!isSelectDisabled) {
                    select.addEventListener("change", (e) => updateStatus(e.target));
                }
                crmTBody.appendChild(tr);
            });
        }
        
        // Llenar Tabla Contactos
        if (contactosTBody) {
            contactosTBody.innerHTML = ""; // Limpiar
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
            reportesTBody.innerHTML = ""; // Limpiar
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

        // Asignar listeners de archivar (solo admin)
        if (userRole === 'admin') {
            document.querySelectorAll('.archive-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    rowIdToAction = e.currentTarget.dataset.rowId; // Guarda el ID de la fila a archivar
                    confirmModal.show(); // Muestra el modal de confirmación
                });
            });
        }
    }
    
    // --- 4. Renderizar Gráficos ---
    function renderCharts(crmData) {
        if (!statusChartCtx) return; // Si no existe el canvas, no hace nada

        // Gráfico de Estado
        const statusCounts = { 'Sin contactar': 0, 'En proceso': 0, 'Contactado': 0 };
        crmData.forEach(row => {
            statusCounts[row.Estado]++;
        });

        if (statusChartInstance) statusChartInstance.destroy(); // Destruye el gráfico anterior
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

        // Gráfico de Tipo (Solo Admin)
        if (userRole === 'admin' && typeChartCtx) {
            const typeCounts = { 'Solicitud de Contacto': 0, 'Reporte de Avería': 0 };
            crmData.forEach(row => {
                if (typeCounts.hasOwnProperty(row['Tipo de Solicitud'])) {
                    typeCounts[row['Tipo de Solicitud']]++;
                }
            });

            if (typeChartInstance) typeChartInstance.destroy(); // Destruye el gráfico anterior
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
    // Se llama cuando un <select> cambia en la tabla CRM
    function updateStatus(selectElement) {
        const newStatus = selectElement.value;
        const rowId = selectElement.dataset.rowId;
        const userWhoUpdated = sessionStorage.getItem("userName"); 
        
        updateSelectColor(selectElement); // Actualiza el color del select
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
    // Se llama desde el modal de confirmación
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

    // --- 7. Filtrar Tabla (Lógica de Búsqueda) ---
    // Esta función ya no es necesaria, la lógica se movió a renderAllTables
    function filterTable(searchInput, tableBody) {
        // La lógica de filtrado ahora se maneja en getFilteredData y renderAllTables
        // Esta función ahora solo actualiza el estado del filtro y re-renderiza
        const filterKey = `search${searchInput.id.split('-')[1].charAt(0).toUpperCase() + searchInput.id.split('-')[1].slice(1)}`;
        currentFilters[filterKey] = searchInput.value.toLowerCase();
        renderAllTables(getFilteredData());
    }

    // --- 8. Exportar a CSV ---
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
                let cell = row[header] ? row[header].toString() : '';
                cell = cell.replace(/"/g, '""'); // Escapar comillas dobles
                if (cell.includes(",")) cell = `"${cell}"`; // Poner comillas si hay comas
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
        select.classList.remove("status-sin-contactar", "status-en-proceso", "status-contactado");
        if (select.value === "Sin contactar") select.classList.add("status-sin-contactar");
        else if (select.value === "En proceso") select.classList.add("status-en-proceso");
        else select.classList.add("status-contactado");
    }
    
    // Muestra mensajes de estado (éxito, error, info)
    function showMessage(message, type) {
        crmMessage.textContent = message;
        crmMessage.className = ""; // Limpia clases anteriores
        
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