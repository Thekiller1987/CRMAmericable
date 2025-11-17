document.addEventListener("DOMContentLoaded", () => {

    // ¡¡¡ PEGA TU NUEVA URL DE APPS SCRIPT AQUÍ !!!
    const SCRIPT_URL = "PEGAR_LA_NUEVA_URL_DE_IMPLEMENTACION_AQUI";

    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");
    if (!userRole) { window.location.href = "index.html"; return; }

    // Elementos
    const userNameDisplay = document.getElementById("user-name");
    const loadingSpinner = document.getElementById("loading-spinner");
    const crmMessage = document.getElementById("crm-message");
    const dashboardContent = document.getElementById("dashboard-content");
    const crmTBody = document.getElementById("crm-table-body");
    const archivadosTBody = document.getElementById("archivados-table-body");
    const archivadosTabBtn = document.getElementById("archivados-tab-button");

    // Cache y Estado
    let globalData = { crm: [], archivados: [] };
    let technicianList = [];
    let currentFilterDate = 'today'; // 'today', 'week', 'all'
    let searchText = "";
    let rowIdToAction = null;

    // Modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmBtn = document.getElementById('confirmActionButton');

    // INIT
    userNameDisplay.textContent = userName;
    if (userRole !== 'admin') {
        if(archivadosTabBtn) archivadosTabBtn.classList.add("d-none");
    }

    // Cargar Técnicos y luego Datos
    loadTechnicians().then(() => loadData(true));

    // --- EVENT LISTENERS ---
    
    document.getElementById("logout-button").addEventListener("click", () => {
        sessionStorage.clear(); window.location.href = "index.html";
    });
    document.getElementById("reload-button").addEventListener("click", () => loadData(false));

    // Filtros de Fecha
    document.getElementById("filter-today").addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='today'; render(); });
    document.getElementById("filter-week").addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='week'; render(); });
    document.getElementById("filter-all").addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='all'; render(); });

    // Buscador
    document.getElementById("search-crm").addEventListener("keyup", (e) => {
        searchText = e.target.value.toLowerCase();
        render();
    });

    // Botón Imprimir PDF
    document.getElementById("print-report-button").addEventListener("click", printReport);
    
    // Botón Excel
    document.getElementById("export-crm-button").addEventListener("click", () => exportCSV(getFilteredData(), "Reporte_CRM.csv"));

    // Delegación Tabla (Cambios en Selects y Botón Archivar)
    crmTBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('status-select')) updateStatus(e.target);
        if (e.target.classList.contains('tech-select')) updateTech(e.target);
    });

    crmTBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.archive-btn');
        if (btn) {
            rowIdToAction = btn.dataset.rowId;
            confirmModal.show();
        }
    });

    // Acción Modal Archivar
    confirmBtn.addEventListener('click', () => {
        if(!rowIdToAction) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = "Procesando...";
        
        fetch(`${SCRIPT_URL}?action=archiveRow&rol=${userRole}&rowId=${rowIdToAction}`)
            .then(r => r.json())
            .then(res => {
                if(res.status === "success") {
                    msg("Caso archivado correctamente", "success");
                    confirmModal.hide();
                    loadData(false);
                } else { alert(res.message); }
            })
            .finally(() => {
                confirmBtn.disabled = false; 
                confirmBtn.innerHTML = "Sí, Archivar";
                rowIdToAction = null;
            });
    });

    // Auto-refresh
    setInterval(() => loadData(false), 120000);


    // --- FUNCIONES PRINCIPALES ---

    function loadTechnicians() {
        return fetch(SCRIPT_URL + "?action=getTechnicians")
            .then(r => r.json())
            .then(data => {
                if(data.status === "success") technicianList = data.tecnicos;
            })
            .catch(e => console.error(e));
    }

    function loadData(showSpinner) {
        if(showSpinner) { loadingSpinner.classList.remove("d-none"); dashboardContent.classList.add("d-none"); }
        else msg("Sincronizando...", "info-silent");

        fetch(`${SCRIPT_URL}?action=getData&rol=${userRole}`)
            .then(r => r.json())
            .then(res => {
                if(res.status === "success") {
                    // Procesar fechas
                    globalData.crm = (res.data.crm||[]).map(r => ({...r, FechaObj: new Date(r.Fecha)}));
                    globalData.archivados = (res.data.archivados||[]).map(r => ({...r, FechaObj: new Date(r.Fecha)}));
                    
                    render();
                    updateStats();
                    
                    if(showSpinner) { loadingSpinner.classList.add("d-none"); dashboardContent.classList.remove("d-none"); }
                    else msg("Actualizado", "success-silent");
                }
            })
            .catch(e => msg("Error de conexión", "error"));
    }

    function getFilteredData() {
        let data = globalData.crm;
        
        // 1. Filtro Fecha
        const today = new Date(); today.setHours(0,0,0,0);
        if (currentFilterDate === 'today') {
            data = data.filter(r => r.FechaObj >= today);
        } else if (currentFilterDate === 'week') {
            const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
            data = data.filter(r => r.FechaObj >= weekAgo);
        }

        // 2. Búsqueda Texto (Nombre, Telefono o Tecnico)
        if (searchText) {
            data = data.filter(r => 
                String(r.Nombre).toLowerCase().includes(searchText) ||
                String(r.Telefono).includes(searchText) ||
                String(r['Gestionado por']).toLowerCase().includes(searchText)
            );
        }
        return data;
    }

    function render() {
        const data = getFilteredData();
        crmTBody.innerHTML = "";

        // Opciones de Tecnicos
        let techOpts = '<option value="" disabled selected>Asignar...</option>';
        technicianList.forEach(t => techOpts += `<option value="${t}">${t}</option>`);

        data.forEach(row => {
            const tr = document.createElement("tr");
            
            // Pre-seleccionar técnico
            let myOpts = techOpts;
            if (row['Gestionado por']) {
                myOpts = myOpts.replace(`value="${row['Gestionado por']}"`, `value="${row['Gestionado por']}" selected`);
                myOpts = myOpts.replace('selected>Asignar...', '>Asignar...');
            }

            // Color estado
            let statusClass = row.Estado === 'Sin contactar' ? 'status-sin-contactar' : (row.Estado === 'En proceso' ? 'status-en-proceso' : 'status-contactado');

            tr.innerHTML = `
                <td>${row.FechaObj.toLocaleDateString()} <small class="text-muted">${row.FechaObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small></td>
                <td><div class="fw-bold">${row.Nombre}</div><small>${row.Telefono}</small></td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>
                    <select class="form-select form-select-sm status-select ${statusClass}" data-row-id="${row.ID}">
                        <option value="Sin contactar" ${row.Estado=='Sin contactar'?'selected':''}>🔴 Pendiente</option>
                        <option value="En proceso" ${row.Estado=='En proceso'?'selected':''}>🟡 En Proceso</option>
                        <option value="Contactado" ${row.Estado=='Contactado'?'selected':''}>🟢 Finalizado</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm tech-select" data-row-id="${row.ID}">
                        ${myOpts}
                    </select>
                </td>
                <td class="text-end">
                    ${userRole === 'admin' ? `<button class="btn btn-sm btn-outline-warning archive-btn" data-row-id="${row.ID}" title="Archivar"><i class="bi bi-archive"></i></button>` : ''}
                </td>
            `;
            crmTBody.appendChild(tr);
        });
        
        // Render Archivados (Solo Admin)
        if(userRole === 'admin' && archivadosTBody) {
             archivadosTBody.innerHTML = "";
             globalData.archivados.slice(0, 50).forEach(row => { // Limitado a 50 para velocidad
                 const tr = document.createElement("tr");
                 tr.innerHTML = `<td>${row.FechaObj.toLocaleDateString()}</td><td>${row.Nombre}</td><td>${row['Tipo de Solicitud']}</td><td>${row.Estado}</td><td>${row['Gestionado por']}</td><td><small>${row.ID}</small></td>`;
                 archivadosTBody.appendChild(tr);
             });
        }
    }

    // --- API ACTIONS ---
    function updateStatus(el) {
        // Cambiar color visualmente inmediato
        el.className = "form-select form-select-sm status-select";
        if(el.value === 'Sin contactar') el.classList.add('status-sin-contactar');
        else if(el.value === 'En proceso') el.classList.add('status-en-proceso');
        else el.classList.add('status-contactado');

        fetch(`${SCRIPT_URL}?action=updateStatus&rowId=${el.dataset.rowId}&newStatus=${el.value}`)
            .then(r=>r.json()).then(d=>{ if(d.status!='success') alert("Error al guardar estado"); });
    }

    function updateTech(el) {
        msg(`Asignando a ${el.value}...`, "info");
        fetch(`${SCRIPT_URL}?action=updateAssignment&rowId=${el.dataset.rowId}&technician=${el.value}`)
            .then(r=>r.json()).then(d=>{ 
                if(d.status=='success') msg("Técnico asignado", "success");
                else alert("Error asignando técnico");
            });
    }

    // --- UTILS & REPORTING ---

    function updateStats() {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayData = globalData.crm.filter(r => r.FechaObj >= today);
        
        document.getElementById("stat-total").textContent = todayData.length;
        document.getElementById("stat-contacted").textContent = todayData.filter(r => r.Estado === 'Contactado').length;
        document.getElementById("stat-pending").textContent = todayData.filter(r => r.Estado !== 'Contactado').length;
    }

    // *** FUNCIÓN MAGICA PARA IMPRIMIR PDF ***
    function printReport() {
        const dataToPrint = getFilteredData();
        if(dataToPrint.length === 0) return alert("No hay datos para imprimir en la vista actual.");

        let printWindow = window.open('', '', 'height=600,width=800');
        let html = `
            <html>
            <head>
                <title>Hoja de Ruta - Americable</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    h2 { text-align: center; color: #005cbf; }
                    p { text-align: center; font-size: 0.9rem; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .footer { margin-top: 30px; font-size: 10px; text-align: right; border-top: 1px solid #ccc; padding-top: 5px;}
                </style>
            </head>
            <body>
                <h2>Reporte de Operaciones - Americable</h2>
                <p>Fecha de emisión: ${new Date().toLocaleString()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>Solicitud</th>
                            <th>Técnico Asignado</th>
                            <th>Estado</th>
                            <th>Firma Cliente</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        dataToPrint.forEach(row => {
            html += `
                <tr>
                    <td>${row.FechaObj.toLocaleDateString()}</td>
                    <td>${row.Nombre}</td>
                    <td>${row.Telefono}</td>
                    <td>${row['Tipo de Solicitud']}</td>
                    <td><strong>${row['Gestionado por'] || 'SIN ASIGNAR'}</strong></td>
                    <td>${row.Estado}</td>
                    <td style="width:100px;"></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
                <div class="footer">Generado por CRM Americable - Oficina</div>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    }

    function exportCSV(data, filename) {
        if(!data.length) return alert("Sin datos");
        const headers = ["Fecha","Nombre","Telefono","Tipo","Estado","Tecnico"];
        let csv = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" +
            data.map(r => `"${r.FechaObj.toLocaleDateString()}","${r.Nombre}","${r.Telefono}","${r['Tipo de Solicitud']}","${r.Estado}","${r['Gestionado por']||''}"`).join("\n");
        
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    function setActiveBtn(e) {
        document.querySelectorAll(".btn-group .btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
    }

    function msg(txt, type) {
        crmMessage.textContent = txt;
        crmMessage.className = type.includes("error") ? "alert alert-danger" : (type.includes("success") ? "alert alert-success" : "alert alert-info");
        if(type.includes("silent")) crmMessage.className += " p-1 small";
        setTimeout(() => { crmMessage.textContent=""; crmMessage.className="";}, 4000);
    }
});