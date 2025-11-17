document.addEventListener("DOMContentLoaded", () => {

    // ¡¡¡ RECUERDA PEGAR TU NUEVA URL AQUÍ !!!
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");
    if (!userRole) { window.location.href = "index.html"; return; }

    // --- VARIABLES GLOBALES ---
    const userNameDisplay = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");
    const reloadButton = document.getElementById("reload-button");
    const loadingSpinner = document.getElementById("loading-spinner");
    const crmMessage = document.getElementById("crm-message");
    const dashboardContent = document.getElementById("dashboard-content");
    
    // Tablas
    const crmTBody = document.getElementById("crm-table-body");
    const archivadosTBody = document.getElementById("archivados-table-body");

    // Filtros
    const filterTodayBtn = document.getElementById("filter-today");
    const filterWeekBtn = document.getElementById("filter-week");
    const filterAllBtn = document.getElementById("filter-all");
    const searchCRM = document.getElementById("search-crm");
    const searchArchivados = document.getElementById("search-archivados");
    
    // Botones Acción
    const exportCRM = document.getElementById("export-crm-button");
    const printReportBtn = document.getElementById("print-report-button");

    // Modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const confirmBtn = document.getElementById('confirmActionButton');
    
    // Datos
    let globalData = { crm: [], archivados: [] }; 
    let technicianList = []; 
    let currentFilterDate = 'today'; 
    let searchText = "";
    let rowIdToAction = null;

    // --- INICIALIZAR ---
    userNameDisplay.textContent = userName;
    setupPermissions();
    loadTechnicians().then(() => loadData(true));

    // --- LISTENERS ---
    logoutButton.addEventListener("click", () => { sessionStorage.clear(); window.location.href = "index.html"; });
    reloadButton.addEventListener("click", () => loadData(false)); 

    // Buscador
    searchCRM.addEventListener("keyup", (e) => { searchText = e.target.value.toLowerCase(); render(); });
    if (searchArchivados) searchArchivados.addEventListener("keyup", (e) => { renderArchivados(e.target.value.toLowerCase()); });

    // Exportar / Imprimir
    if (exportCRM) exportCRM.addEventListener("click", () => exportCSV(getFilteredData(), "Reporte_Diario.csv"));
    if (printReportBtn) printReportBtn.addEventListener("click", printReport);

    // Filtros Fecha
    filterTodayBtn.addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='today'; render(); });
    filterWeekBtn.addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='week'; render(); });
    filterAllBtn.addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='all'; render(); });

    // Acción Tabla (Delegación)
    crmTBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.archive-btn');
        if (btn) { rowIdToAction = btn.dataset.rowId; confirmModal.show(); }
    });
    crmTBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('status-select')) updateStatus(e.target);
        if (e.target.classList.contains('tech-select')) updateAssignment(e.target);
    });

    // Confirmar Archivo
    confirmBtn.addEventListener('click', () => {
        if(!rowIdToAction) return;
        confirmBtn.disabled = true; confirmBtn.innerHTML = "Procesando...";
        fetch(`${SCRIPT_URL}?action=archiveRow&rol=${userRole}&rowId=${rowIdToAction}`)
            .then(r => r.json()).then(res => {
                if(res.status === "success") { msg("Archivado con éxito", "success"); confirmModal.hide(); loadData(false); }
                else throw new Error(res.message);
            })
            .catch(e => { msg(`Error: ${e.message}`, "error"); confirmModal.hide(); })
            .finally(() => { confirmBtn.disabled = false; confirmBtn.innerHTML = "Sí, Archivar"; rowIdToAction = null; });
    });

    // Auto-refresco
    setInterval(() => loadData(false), 120000);

    // --- FUNCIONES DE DATOS ---
    function setupPermissions() {
        if (userRole === "oficina") {
            document.getElementById("archivados-tab-button")?.classList.add("d-none");
            document.getElementById("pills-archivados")?.remove();
            document.getElementById("reportes-tab-button")?.classList.add("d-none");
            document.getElementById("type-chart")?.parentElement.parentElement.classList.add("d-none");
        }
    }

    function loadTechnicians() {
        return fetch(SCRIPT_URL + "?action=getTechnicians")
            .then(r => r.json())
            .then(d => { if(d.status==="success") technicianList = d.tecnicos; });
    }

    function loadData(spinner) {
        if(spinner) { loadingSpinner.classList.remove("d-none"); dashboardContent.classList.add("d-none"); }
        else msg("Sincronizando...", "info-silent");

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole)
            .then(r => r.json())
            .then(res => {
                if(res.status === "success") {
                    globalData.crm = (res.data.crm||[]).map(r => ({...r, FechaObj: new Date(r.Fecha)}));
                    globalData.archivados = (res.data.archivados||[]).map(r => ({...r, FechaObj: new Date(r.Fecha)}));
                    render();
                    if(userRole==='admin') renderArchivados("");
                    if(spinner) { loadingSpinner.classList.add("d-none"); dashboardContent.classList.remove("d-none"); }
                    else msg("Actualizado", "success-silent");
                }
            })
            .catch(e => { loadingSpinner.classList.add("d-none"); msg("Error de conexión", "error"); });
    }

    // --- RENDERIZADO ---
    function getFilteredData() {
        let data = globalData.crm;
        const today = new Date(); today.setHours(0,0,0,0);
        
        if (currentFilterDate === 'today') data = data.filter(r => r.FechaObj >= today);
        else if (currentFilterDate === 'week') {
            const weekAgo = new Date(today); weekAgo.setDate(today.getDate()-7);
            data = data.filter(r => r.FechaObj >= weekAgo);
        }

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
        
        let techOptions = `<option value="" disabled selected>Asignar...</option>`;
        technicianList.forEach(t => techOptions += `<option value="${t}">${t}</option>`);

        if(data.length === 0) {
            crmTBody.innerHTML = '<tr><td colspan="7" class="text-center py-3">No hay casos pendientes.</td></tr>';
            return;
        }

        data.forEach(row => {
            const tr = document.createElement("tr");
            let rowTech = techOptions;
            if(row['Gestionado por']) {
                rowTech = rowTech.replace(`value="${row['Gestionado por']}"`, `value="${row['Gestionado por']}" selected`);
                rowTech = rowTech.replace('selected>Asignar...', '>Asignar...');
            }

            let statusColor = row.Estado === 'Sin contactar' ? 'status-sin-contactar' : (row.Estado==='En proceso'?'status-en-proceso':'status-contactado');

            tr.innerHTML = `
                <td>${row.FechaObj.toLocaleDateString()}</td>
                <td><div class="fw-bold">${row.Nombre}</div><small>${row.Telefono}</small></td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>
                    <select class="form-select form-select-sm status-select ${statusColor}" data-row-id="${row.ID}">
                        <option value="Sin contactar" ${row.Estado=='Sin contactar'?'selected':''}>🔴 Pendiente</option>
                        <option value="En proceso" ${row.Estado=='En proceso'?'selected':''}>🟡 En Proceso</option>
                        <option value="Contactado" ${row.Estado=='Contactado'?'selected':''}>🟢 Finalizado</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm tech-select" data-row-id="${row.ID}">
                        ${rowTech}
                    </select>
                </td>
                <td class="text-end">
                     ${userRole === 'admin' ? `<button class="btn btn-sm btn-outline-warning archive-btn" data-row-id="${row.ID}"><i class="bi bi-archive"></i></button>` : ''}
                </td>
            `;
            crmTBody.appendChild(tr);
        });
        renderCharts(data);
    }

    function renderArchivados(term) {
        if(!archivadosTBody) return;
        archivadosTBody.innerHTML = "";
        let data = globalData.archivados;
        if(term) data = data.filter(r => String(r.Nombre).toLowerCase().includes(term) || String(r.ID).includes(term));
        
        data.slice(0,50).forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${row.FechaObj.toLocaleDateString()}</td><td>${row.Nombre}</td><td>${row.Telefono}</td><td>${row['Tipo de Solicitud']}</td><td>${row.Estado}</td><td>${row['Gestionado por']}</td><td>${row.ID}</td>`;
            archivadosTBody.appendChild(tr);
        });
    }

    // --- IMPRIMIR REPORTE (HOJA DE RUTA) ---
    function printReport() {
        const data = getFilteredData();
        if(data.length === 0) return alert("No hay datos para imprimir.");
        
        // Obtenemos la ruta absoluta del logo
        const logoUrl = window.location.origin + '/logo.svg';

        let win = window.open('', '', 'height=700,width=1000');
        let html = `
            <html>
            <head>
                <title>Hoja de Ruta - Americable</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
                    .header { display: flex; align-items: center; border-bottom: 2px solid #005cbf; padding-bottom: 10px; margin-bottom: 20px; }
                    .logo { height: 50px; margin-right: 20px; }
                    .info { flex-grow: 1; }
                    h1 { margin: 0; color: #005cbf; font-size: 24px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; text-align: left; }
                    th { background-color: #f0f0f0; font-weight: bold; }
                    .firma { height: 50px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="${logoUrl}" class="logo" alt="Americable">
                    <div class="info">
                        <h1>Hoja de Ruta Técnica</h1>
                        <p>Fecha: ${new Date().toLocaleDateString()} | Generado por: Oficina</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 10%">Fecha</th>
                            <th style="width: 15%">Cliente / Tel</th>
                            <th style="width: 20%">Dirección / Zona</th>
                            <th style="width: 25%">Detalles Avería / Mensaje</th>
                            <th style="width: 10%">Técnico</th>
                            <th style="width: 20%">Firma Cliente / Obs</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(row => {
            // Usamos las nuevas columnas 'Direccion_Zona' y 'Detalles'
            // Si son antiguas y no tienen el dato, mostramos un guion
            const direccion = row['Direccion_Zona'] || row['Direccion'] || row['Zona'] || '---';
            const detalles = row['Detalles'] || row['Mensaje'] || '---';
            
            html += `
                <tr>
                    <td>${row.FechaObj.toLocaleDateString()}</td>
                    <td><strong>${row.Nombre}</strong><br>${row.Telefono}</td>
                    <td>${direccion}</td>
                    <td>${detalles}</td>
                    <td>${row['Gestionado por'] || 'Sin Asignar'}</td>
                    <td></td>
                </tr>
            `;
        });

        html += `</tbody></table></body></html>`;
        
        win.document.write(html);
        win.document.close();
        
        // Esperar a que cargue la imagen del logo antes de imprimir
        setTimeout(() => {
            win.print();
        }, 500);
    }

    // --- UTILS API ---
    function updateStatus(el) {
        el.className = `form-select form-select-sm status-select ${el.value === 'Sin contactar' ? 'status-sin-contactar' : (el.value === 'En proceso' ? 'status-en-proceso' : 'status-contactado')}`;
        msg("Guardando...", "info-silent");
        fetch(`${SCRIPT_URL}?action=updateStatus&rowId=${el.dataset.rowId}&newStatus=${el.value}`)
            .then(r=>r.json()).then(d=>{ if(d.status!=='success') alert("Error"); });
    }

    function updateAssignment(el) {
        msg(`Asignando a ${el.value}...`, "info");
        fetch(`${SCRIPT_URL}?action=updateAssignment&rowId=${el.dataset.rowId}&technician=${el.value}`)
            .then(r=>r.json()).then(d=>{ if(d.status==='success') msg("Asignado", "success"); });
    }

    function exportCSV(data, name) {
        if(!data.length) return alert("Sin datos");
        let csv = "Fecha,Nombre,Telefono,Direccion,Detalle,Tecnico\n" + 
            data.map(r => `"${r.FechaObj.toLocaleDateString()}","${r.Nombre}","${r.Telefono}","${r['Direccion_Zona']||''}","${r['Detalles']||''}","${r['Gestionado por']||''}"`).join("\n");
        const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8,"+csv); link.download = name; link.click();
    }

    function setActiveBtn(e) { document.querySelectorAll(".btn-group .btn").forEach(b=>b.classList.remove("active")); e.target.classList.add("active"); }
    
    function msg(txt, type) {
        crmMessage.textContent = txt;
        crmMessage.className = `alert alert-${type.includes('error')?'danger':(type.includes('success')?'success':'info')} ${type.includes('silent')?'p-1 small':''}`;
        setTimeout(()=>crmMessage.textContent="", 4000);
    }

    function renderCharts(data) {
        if (!statusChartCtx) return;
        const c = { 'Sin contactar': 0, 'En proceso': 0, 'Contactado': 0 };
        data.forEach(r => { if(c[r.Estado] !== undefined) c[r.Estado]++; });
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statusChartCtx, {
            type: 'doughnut',
            data: { labels: ['Pendiente', 'En Proceso', 'Finalizado'], datasets: [{ data: [c['Sin contactar'], c['En proceso'], c['Contactado']], backgroundColor: ['#dc3545', '#ffc107', '#198754'] }] }
        });
    }
});