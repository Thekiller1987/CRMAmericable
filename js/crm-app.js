document.addEventListener("DOMContentLoaded", () => {

    // --- URL de tu script "Todo en Uno" ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    // --- Auth Guard (Protección de la página) ---
    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName"); // Ya lo estábamos guardando

    if (!userRole) {
        window.location.href = "index.html"; // Corregido a index.html
        return;
    }

    // --- Elementos del DOM ---
    const userNameDisplay = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");
    const loadingSpinner = document.getElementById("loading-spinner");
    const dashboardContent = document.getElementById("dashboard-content");
    const crmMessage = document.getElementById("crm-message");
    
    const crmTab = document.getElementById("crm-tab-button");
    const contactosTab = document.getElementById("contactos-tab-button");
    const reportesTab = document.getElementById("reportes-tab-button");
    
    const crmTBody = document.getElementById("crm-table-body");
    const contactosTBody = document.getElementById("contactos-table-body");
    const reportesTBody = document.getElementById("reportes-table-body");

    // --- Inicialización ---
    userNameDisplay.textContent = userName;
    setupPermissions();
    fetchData();

    // --- Cerrar Sesión ---
    logoutButton.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html"; // Corregido a index.html
    });
    
    // --- Configurar Permisos (Ocultar/Mostrar Pestañas) ---
    function setupPermissions() {
        if (userRole === "admin") {
            crmTab?.classList.remove("d-none");
            contactosTab?.classList.remove("d-none");
            reportesTab?.classList.remove("d-none");
        } else if (userRole === "oficina") {
            crmTab?.classList.remove("d-none");
            contactosTab?.classList.remove("d-none");
            reportesTab?.classList.add("d-none");
        } else if (userRole === "tecnico") {
            crmTab?.classList.remove("d-none");
            contactosTab?.classList.add("d-none");
            reportesTab?.classList.remove("d-none");
        }
    }

    // --- 1. Buscar Datos en Google Sheet ---
    function fetchData() {
        loadingSpinner.classList.remove("d-none");
        dashboardContent.classList.add("d-none");
        crmMessage.textContent = "";
        crmMessage.className = "";

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    renderData(res.data);
                    loadingSpinner.classList.add("d-none");
                    dashboardContent.classList.remove("d-none");
                } else {
                    throw new Error(res.message);
                }
            })
            .catch(error => {
                console.error("Error al cargar datos:", error);
                loadingSpinner.classList.add("d-none");
                crmMessage.textContent = `Error al cargar datos: ${error.message}`;
                crmMessage.classList.add("error", "alert", "alert-danger");
            });
    }

    // --- 2. Pintar los Datos en las Tablas ---
    function renderData(data) {
        crmTBody.innerHTML = "";
        if (contactosTBody) contactosTBody.innerHTML = "";
        if (reportesTBody) reportesTBody.innerHTML = "";

        // Llenar Tabla CRM
        data.crm.forEach((row, index) => {
            const tr = document.createElement("tr");
            const fecha = new Date(row.Fecha).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
            const sheetRowIndex = index + 2; 

            // CAMBIO AQUÍ: Añadida la columna "Gestionado por"
            tr.innerHTML = `
                <td>${fecha}</td>
                <td>${row.Nombre}</td>
                <td>${row.Telefono}</td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>
                    <select class="form-select form-select-sm status-select" 
                            data-row-index="${sheetRowIndex}" 
                            ${userRole === 'tecnico' ? 'disabled' : ''}>
                        <option value="Sin contactar" ${row.Estado === 'Sin contactar' ? 'selected' : ''}>Sin contactar</option>
                        <option value="En proceso" ${row.Estado === 'En proceso' ? 'selected' : ''}>En proceso</option>
                        <option value="Contactado" ${row.Estado === 'Contactado' ? 'selected' : ''}>Contactado</option>
                    </select>
                </td>
                <td>${row['Gestionado por'] || '---'}</td>
            `;
            
            const select = tr.querySelector(".status-select");
            updateSelectColor(select);
            select.addEventListener("change", (e) => updateStatus(e.target));

            crmTBody.appendChild(tr);
        });
        
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
    }
    
    // --- 3. Actualizar Estado en Google Sheet (CAMBIO IMPORTANTE) ---
    function updateStatus(selectElement) {
        const newStatus = selectElement.value;
        const rowIndex = selectElement.dataset.rowIndex;
        // Obtenemos el nombre del usuario de la sesión
        const userWhoUpdated = sessionStorage.getItem("userName"); 
        
        updateSelectColor(selectElement);
        
        crmMessage.textContent = "Guardando cambio...";
        crmMessage.className = "alert alert-info";

        // CAMBIO AQUÍ: Añadimos 'user' a la URL
        const fetchURL = `${SCRIPT_URL}?action=updateStatus&rol=${userRole}&rowIndex=${rowIndex}&newStatus=${newStatus}&user=${encodeURIComponent(userWhoUpdated)}`;

        fetch(fetchURL)
            .then(response => response.json())
            .then(res => {
                if (res.status === "success") {
                    crmMessage.textContent = "¡Estado actualizado con éxito!";
                    crmMessage.className = "alert alert-success";
                    // Actualizar visualmente la celda "Gestionado por"
                    const fila = selectElement.closest('tr');
                    fila.cells[5].textContent = userWhoUpdated; // La celda 5 es la 6ta columna
                } else {
                    throw new Error(res.message);
                }
                setTimeout(() => { crmMessage.textContent = ""; crmMessage.className = ""; }, 3000);
            })
            .catch(error => {
                console.error("Error al actualizar:", error);
                crmMessage.textContent = `Error al guardar: ${error.message}`;
                crmMessage.className = "alert alert-danger";
            });
    }

    // --- Función utilitaria para colorear los <select> ---
    function updateSelectColor(select) {
        select.classList.remove("status-sin-contactar", "status-en-proceso", "status-contactado");
        if (select.value === "Sin contactar") {
            select.classList.add("status-sin-contactar");
        } else if (select.value === "En proceso") {
            select.classList.add("status-en-proceso");
        } else {
            select.classList.add("status-contactado");
        }
    }
});