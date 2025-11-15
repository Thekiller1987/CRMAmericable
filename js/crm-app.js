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

    // --- Elementos del DOM ---
    const userNameDisplay = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");
    const reloadButton = document.getElementById("reload-button");
    const loadingSpinner = document.getElementById("loading-spinner");
    const crmMessage = document.getElementById("crm-message");
    const dashboardContent = document.getElementById("dashboard-content"); // Añadido para mostrar/ocultar

    // Pestañas
    const statsTab = document.getElementById("stats-tab-button");
    const crmTab = document.getElementById("crm-tab-button");
    const contactosTab = document.getElementById("contactos-tab-button");
    const reportesTab = document.getElementById("reportes-tab-button");
    
    // Cuerpos de las Tablas
    const crmTBody = document.getElementById("crm-table-body");
    const contactosTBody = document.getElementById("contactos-table-body");
    const reportesTBody = document.getElementById("reportes-table-body");

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
    let globalDataCache = {};

    // --- Elementos del Modal de Confirmación (¡NUEVO!) ---
    const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    let rowIdToDelete = null; // Para guardar el ID de la fila a eliminar
    
    // --- Inicialización ---
    userNameDisplay.textContent = userName;
    setupPermissions();
    fetchData(false); // Carga inicial (no silenciosa)

    // --- Event Listeners ---
    logoutButton.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
    
    reloadButton.addEventListener("click", () => fetchData(false)); 

    searchCRM.addEventListener("keyup", () => filterTable(searchCRM, crmTBody));
    searchContactos.addEventListener("keyup", () => filterTable(searchContactos, contactosTBody));
    searchReportes.addEventListener("keyup", () => filterTable(searchReportes, reportesTBody));
    
    exportCRM.addEventListener("click", () => exportToCSV(globalDataCache.crm, "reporte_crm.csv"));
    exportContactos.addEventListener("click", () => exportToCSV(globalDataCache.contactos, "reporte_contactos.csv"));
    exportReportes.addEventListener("click", () => exportToCSV(globalDataCache.reportes, "reporte_averias.csv"));

    // Listener para el botón de confirmar eliminación en el modal (¡NUEVO!)
    confirmDeleteButton.addEventListener('click', () => {
        if (rowIdToDelete) {
            executeDeleteRow(rowIdToDelete);
            rowIdToDelete = null; // Limpiar después de usar
        }
        confirmDeleteModal.hide(); // Ocultar el modal
    });

    // --- Auto-Recarga cada 2 minutos (120000 ms) ---
    setInterval(() => {
        fetchData(true); // Carga silenciosa
    }, 120000);
    
    
    // --- Configurar Permisos (Ocultar/Mostrar Pestañas) ---
    function setupPermissions() {
        // La lógica de eliminación de elementos del DOM ahora se hace aquí
        // para que las referencias a elementos ocultos no causen errores.
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

    // --- 1. Buscar Datos en Google Sheet (MODIFICADA) ---
    function fetchData(isSilent = false) {
        
        if (isSilent) {
            showMessage("Actualizando datos en segundo plano...", "info-silent");
        } else {
            loadingSpinner.classList.remove("d-none");
            dashboardContent.classList.add("d-none");
            crmMessage.textContent = "";
            crmMessage.className = "";
        }

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    globalDataCache = res.data; // Guardar datos en caché
                    renderData(res.data);
                    renderCharts(res.data.crm); // Renderizar gráficos
                    
                    if (isSilent) {
                        showMessage("Datos actualizados.", "success-silent");
                    } else {
                        loadingSpinner.classList.add("d-none");
                        dashboardContent.classList.remove("d-none");
                    }
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => {
                console.error("Error al cargar datos:", error);
                if (isSilent) {
                    showMessage(`Error al recargar: ${error.message}`, "error-silent");
                } else {
                    loadingSpinner.classList.add("d-none");
                    crmMessage.textContent = `Error al cargar datos: ${error.message}`;
                    crmMessage.classList.add("error", "alert", "alert-danger");
                }
            });
    }

    // --- 2. Pintar los Datos en las Tablas ---
    function renderData(data) {
        // Guardar la búsqueda y scroll actual
        const crmSearch = searchCRM?.value || "";
        const contactosSearch = searchContactos?.value || "";
        const reportesSearch = searchReportes?.value || "";

        crmTBody.innerHTML = "";
        if (contactosTBody) contactosTBody.innerHTML = "";
        if (reportesTBody) reportesTBody.innerHTML = "";

        // Llenar Tabla CRM
        data.crm.forEach(row => {
            const tr = document.createElement("tr");
            const fecha = new Date(row.Fecha).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
            
            // Determinar si el select de estado debe estar deshabilitado
            const isSelectDisabled = userRole === 'tecnico' && row['Tipo de Solicitud'] !== 'Reporte de Avería';

            tr.innerHTML = `
                <td>${fecha}</td>
                <td>${row.Nombre}</td>
                <td>${row.Telefono}</td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>
                    <select class="form-select form-select-sm status-select" 
                            data-row-id="${row.ID}"
                            ${isSelectDisabled ? 'disabled' : ''}>
                        <option value="Sin contactar" ${row.Estado === 'Sin contactar' ? 'selected' : ''}>Sin contactar</option>
                        <option value="En proceso" ${row.Estado === 'En proceso' ? 'selected' : ''}>En proceso</option>
                        <option value="Contactado" ${row.Estado === 'Contactado' ? 'selected' : ''}>Contactado</option>
                    </select>
                </td>
                <td>${row['Gestionado por'] || '---'}</td>
                <td class="text-end">
                    ${userRole === 'admin' ? 
                    `<button class="btn btn-sm btn-danger delete-btn" data-row-id="${row.ID}" title="Eliminar">
                        <i class="bi bi-trash-fill"></i>
                     </button>` : '---'}
                </td>
            `;
            
            const select = tr.querySelector(".status-select");
            updateSelectColor(select);
            // Solo añadir listener si el select no está deshabilitado
            if (!isSelectDisabled) {
                select.addEventListener("change", (e) => updateStatus(e.target));
            }
            crmTBody.appendChild(tr);
        });
        
        if (userRole === 'admin') {
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    rowIdToDelete = e.currentTarget.dataset.rowId; // Guarda el ID
                    confirmDeleteModal.show(); // Muestra el modal
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

        // Restaurar la búsqueda
        if (searchCRM) { searchCRM.value = crmSearch; filterTable(searchCRM, crmTBody); }
        if (searchContactos) { searchContactos.value = contactosSearch; filterTable(searchContactos, contactosTBody); }
        if (searchReportes) { searchReportes.value = reportesSearch; filterTable(searchReportes, reportesTBody); }
    }
    
    // --- 3. Renderizar Gráficos ---
    function renderCharts(crmData) {
        // Asegúrate de que los contextos existen antes de intentar crear gráficos
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
    
    // --- 4. Actualizar Estado ---
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
                    fetchData(true); // Recarga silenciosa para actualizar gráficos si el estado cambió
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => showMessage(`Error al guardar: ${error.message}`, "error"));
    }

    // --- 5. Eliminar Fila (AHORA SOLO MUESTRA EL MODAL) ---
    // La lógica de eliminación real está en executeDeleteRow
    // Esta función solo se encarga de mostrar el modal y preparar el ID
    // function deleteRow(buttonElement) ya no se usa directamente
    
    // --- NUEVA FUNCIÓN: Ejecutar la Eliminación Real ---
    function executeDeleteRow(rowId) {
        showMessage("Eliminando fila...", "info");
        
        fetch(SCRIPT_URL + `?action=deleteRow&rol=${userRole}&rowId=${rowId}`)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    showMessage("¡Solicitud eliminada!", "success");
                    fetchData(true); // Recarga silenciosa
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => showMessage(`Error al eliminar: ${error.message}`, "error"));
    }

    // --- 6. Filtrar Tabla ---
    function filterTable(searchInput, tableBody) {
        if (!tableBody) return;
        const searchTerm = searchInput.value.toLowerCase();
        const rows = tableBody.getElementsByTagName("tr");

        for (const row of rows) {
            row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
        }
    }

    // --- 7. Exportar a CSV ---
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
    
    // --- Función utilitaria para colorear los <select> ---
    function updateSelectColor(select) {
        select.classList.remove("status-sin-contactar", "status-en-proceso", "status-contactado");
        if (select.value === "Sin contactar") select.classList.add("status-sin-contactar");
        else if (select.value === "En proceso") select.classList.add("status-en-proceso");
        else select.classList.add("status-contactado");
    }
    
    // --- Función utilitaria para mostrar mensajes ---
    function showMessage(message, type) {
        crmMessage.textContent = message;
        
        crmMessage.classList.remove("alert-success", "alert-danger", "alert-info", "alert", "p-2", "small");

        if(type === 'success') {
            crmMessage.className = "alert alert-success";
        } else if(type === 'error') {
            crmMessage.className = "alert alert-danger";
        } else if(type === 'info') {
            crmMessage.className = "alert alert-info";
        } else if(type === 'success-silent') {
            crmMessage.className = "alert alert-success p-2 small"; // Mensaje sutil
        } else if(type === 'error-silent') {
            crmMessage.className = "alert alert-danger p-2 small";
        } else if(type === 'info-silent') {
            crmMessage.className = "alert alert-info p-2 small";
        }
        
        setTimeout(() => { crmMessage.textContent = ""; crmMessage.className = ""; }, 4000);
    }
});