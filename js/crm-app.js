document.addEventListener("DOMContentLoaded", () => {

    // --- URL DEL SCRIPT (LA QUE ME DISTE) ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    const userRole = sessionStorage.getItem("userRole");
    const userName = sessionStorage.getItem("userName");
    if (!userRole) { window.location.href = "index.html"; return; }

    // Elementos
    const userNameDisplay = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");
    const reloadButton = document.getElementById("reload-button");
    const loadingSpinner = document.getElementById("loading-spinner");
    const crmMessage = document.getElementById("crm-message");
    const dashboardContent = document.getElementById("dashboard-content");
    const crmTBody = document.getElementById("crm-table-body");
    const archivadosTBody = document.getElementById("archivados-table-body");

    // Modales
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const editModal = new bootstrap.Modal(document.getElementById('editModal'));
    const notesModal = new bootstrap.Modal(document.getElementById('notesModal'));

    // Estado
    let globalData = { crm: [], archivados: [] };
    let technicianList = [];
    let currentFilterDate = 'today';
    let searchText = "";
    let rowIdToAction = null; 

    // INIT
    userNameDisplay.textContent = userName;
    setupPermissions();
    loadTechnicians().then(() => loadData(true));

    // --- LISTENERS GLOBALES ---
    document.getElementById("logout-button").addEventListener("click", () => { sessionStorage.clear(); window.location.href = "index.html"; });
    document.getElementById("reload-button").addEventListener("click", () => loadData(false));
    document.getElementById("search-crm").addEventListener("keyup", (e) => { searchText = e.target.value.toLowerCase(); render(); });
    if(document.getElementById("search-archivados")) document.getElementById("search-archivados").addEventListener("keyup", (e) => renderArchivados(e.target.value.toLowerCase()));
    
    document.getElementById("export-crm-button").addEventListener("click", () => exportCSV(getFilteredData(), "Reporte_CRM.csv"));
    document.getElementById("print-report-button").addEventListener("click", printReport);

    // Filtros
    document.getElementById("filter-today").addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='today'; render(); });
    document.getElementById("filter-week").addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='week'; render(); });
    document.getElementById("filter-all").addEventListener("click", (e) => { setActiveBtn(e); currentFilterDate='all'; render(); });

    // --- DELEGACIÓN DE EVENTOS TABLA ---
    crmTBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('status-select')) updateField(e.target.dataset.rowId, 'status', e.target.value);
        if (e.target.classList.contains('tech-select')) updateField(e.target.dataset.rowId, 'tech', e.target.value);
        if (e.target.classList.contains('priority-select')) updateField(e.target.dataset.rowId, 'priority', e.target.value);
    });

    crmTBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.rowId;
        
        if (btn.classList.contains('archive-btn')) {
            rowIdToAction = id;
            confirmModal.show();
        } else if (btn.classList.contains('edit-btn')) {
            openEditModal(id);
        } else if (btn.classList.contains('notes-btn')) {
            openNotesModal(id);
        }
    });

    // --- ACCIONES DE MODALES ---
    
    // 1. Archivar
    document.getElementById('confirmActionButton').addEventListener('click', () => {
        if(!rowIdToAction) return;
        const btn = document.getElementById('confirmActionButton');
        btn.disabled = true; btn.innerHTML = "Procesando...";
        fetch(`${SCRIPT_URL}?action=archiveRow&rol=${userRole}&rowId=${rowIdToAction}`)
            .then(r=>r.json()).then(res => {
                if(res.status === "success") { msg("Caso cerrado", "success"); confirmModal.hide(); loadData(false); }
                else alert(res.message);
            }).finally(() => { btn.disabled = false; btn.innerHTML = "Archivar"; rowIdToAction = null; });
    });

    // 2. Guardar Edición
    document.getElementById('saveEditButton').addEventListener('click', () => {
        const id = document.getElementById('edit-row-id').value;
        const nombre = document.getElementById('edit-nombre').value;
        const telefono = document.getElementById('edit-telefono').value;
        const direccion = document.getElementById('edit-direccion').value;
        const detalles = document.getElementById('edit-detalles').value;

        const btn = document.getElementById('saveEditButton');
        btn.disabled = true; btn.innerText = "Guardando...";

        fetch(`${SCRIPT_URL}?action=editRowData&rowId=${id}&nombre=${encodeURIComponent(nombre)}&telefono=${encodeURIComponent(telefono)}&direccion=${encodeURIComponent(direccion)}&detalles=${encodeURIComponent(detalles)}`)
            .then(r=>r.json()).then(res => {
                if(res.status==="success") { msg("Datos actualizados", "success"); editModal.hide(); loadData(false); }
                else alert("Error al guardar");
            }).finally(() => { btn.disabled = false; btn.innerText = "Guardar Cambios"; });
    });

    // 3. Guardar Nota
    document.getElementById('saveNoteButton').addEventListener('click', () => {
        const note = document.getElementById('new-note-input').value;
        if(!note) return;
        const id = rowIdToAction; 
        
        const btn = document.getElementById('saveNoteButton');
        btn.disabled = true; btn.innerText = "...";

        fetch(`${SCRIPT_URL}?action=saveNote&rowId=${id}&user=${userName}&note=${encodeURIComponent(note)}`)
            .then(r=>r.json()).then(res => {
                if(res.status==="success") { 
                    msg("Nota agregada", "success"); 
                    document.getElementById('new-note-input').value = "";
                    notesModal.hide();
                    loadData(false); 
                }
            }).finally(() => { btn.disabled = false; btn.innerText = "Agregar"; });
    });

    setInterval(() => loadData(false), 120000);

    // --- FUNCIONES CARGA ---
    function loadTechnicians() {
        return fetch(SCRIPT_URL + "?action=getTechnicians")
            .then(r=>r.json())
            .then(d=>{ if(d.status==="success") technicianList = d.tecnicos; })
            .catch(e => console.error("Error fetching technicians", e));
    }

    function loadData(spinner) {
        if(spinner) { loadingSpinner.classList.remove("d-none"); dashboardContent.classList.add("d-none"); }
        else msg("Sincronizando...", "info-silent");

        fetch(SCRIPT_URL + "?action=getData&rol=" + userRole).then(r=>r.json()).then(res => {
            if(res.status === "success") {
                globalData.crm = (res.data.crm||[]).map(r => ({...r, FechaObj: new Date(r.Fecha)}));
                globalData.archivados = (res.data.archivados||[]).map(r => ({...r, FechaObj: new Date(r.Fecha)}));
                render();
                if(userRole==='admin') renderArchivados("");
                updateStats();
                if(spinner) { loadingSpinner.classList.add("d-none"); dashboardContent.classList.remove("d-none"); }
                else msg("Actualizado", "success-silent");
            }
        }).catch(e => {
             console.error(e);
             loadingSpinner.classList.add("d-none");
             msg("Error de conexión. Verifica la URL.", "error");
        });
    }

    // --- RENDERIZADO ---
    function render() {
        let data = globalData.crm;
        const today = new Date(); today.setHours(0,0,0,0);
        if (currentFilterDate === 'today') data = data.filter(r => r.FechaObj >= today);
        else if (currentFilterDate === 'week') { const w = new Date(today); w.setDate(today.getDate()-7); data = data.filter(r => r.FechaObj >= w); }
        
        if(searchText) data = data.filter(r => String(r.Nombre).toLowerCase().includes(searchText) || String(r.Telefono).includes(searchText));

        crmTBody.innerHTML = "";
        if(data.length === 0) { crmTBody.innerHTML = '<tr><td colspan="7" class="text-center py-3">No hay datos.</td></tr>'; return; }

        let techOpts = '<option value="" disabled selected>Asignar...</option>';
        technicianList.forEach(t => techOpts += `<option value="${t}">${t}</option>`);

        data.forEach(row => {
            const tr = document.createElement("tr");
            
            let pColor = row.Prioridad === 'Urgente' ? 'bg-danger text-white' : (row.Prioridad === 'Alta' ? 'bg-warning' : 'bg-success text-white');
            let pBadge = `<select class="form-select form-select-sm priority-select" style="width:auto; font-size:0.8rem" data-row-id="${row.ID}">
                            <option value="Normal" ${row.Prioridad=='Normal'?'selected':''}>🟢 Normal</option>
                            <option value="Alta" ${row.Prioridad=='Alta'?'selected':''}>🟡 Alta</option>
                            <option value="Urgente" ${row.Prioridad=='Urgente'?'selected':''}>🔴 Urgente</option>
                          </select>`;

            let sClass = row.Estado === 'Sin contactar' ? 'status-sin-contactar' : (row.Estado==='En proceso'?'status-en-proceso':'status-contactado');
            
            let tOpts = techOpts;
            if(row['Gestionado por']) { tOpts = tOpts.replace(`value="${row['Gestionado por']}"`, `value="${row['Gestionado por']}" selected`); }

            let noteBtnClass = row.Notas && row.Notas.length > 5 ? "btn-info text-white" : "btn-outline-secondary";

            tr.innerHTML = `
                <td>${pBadge}</td>
                <td><small>${row.FechaObj.toLocaleDateString()} ${row.FechaObj.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></td>
                <td><div class="fw-bold">${row.Nombre}</div><small>${row.Telefono}</small></td>
                <td>${row['Tipo de Solicitud']}</td>
                <td>
                    <select class="form-select form-select-sm status-select ${sClass}" data-row-id="${row.ID}">
                        <option value="Sin contactar" ${row.Estado=='Sin contactar'?'selected':''}>Pendiente</option>
                        <option value="En proceso" ${row.Estado=='En proceso'?'selected':''}>En Proceso</option>
                        <option value="Contactado" ${row.Estado=='Contactado'?'selected':''}>Finalizado</option>
                    </select>
                </td>
                <td><select class="form-select form-select-sm tech-select" data-row-id="${row.ID}">${tOpts}</select></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn ${noteBtnClass} notes-btn" data-row-id="${row.ID}" title="Notas"><i class="bi bi-journal-text"></i></button>
                        <button class="btn btn-outline-primary edit-btn" data-row-id="${row.ID}" title="Editar"><i class="bi bi-pencil"></i></button>
                        ${userRole === 'admin' ? `<button class="btn btn-outline-warning archive-btn" data-row-id="${row.ID}" title="Cerrar"><i class="bi bi-archive"></i></button>` : ''}
                    </div>
                </td>
            `;
            crmTBody.appendChild(tr);
        });
        renderCharts(data);
    }

    // --- HELPERS ---
    function openEditModal(id) {
        const row = globalData.crm.find(r => r.ID == id);
        if(!row) return;
        document.getElementById('edit-row-id').value = id;
        document.getElementById('edit-nombre').value = row.Nombre;
        document.getElementById('edit-telefono').value = row.Telefono;
        document.getElementById('edit-direccion').value = row['Direccion_Zona'] || row['Direccion'] || row['Zona'] || '';
        document.getElementById('edit-detalles').value = row['Detalles'] || row['Mensaje'] || '';
        editModal.show();
    }

    function openNotesModal(id) {
        rowIdToAction = id;
        const row = globalData.crm.find(r => r.ID == id);
        const history = document.getElementById('notes-history');
        history.value = row.Notas || "No hay notas registradas.";
        history.scrollTop = history.scrollHeight; 
        notesModal.show();
    }

    function updateField(id, field, value) {
        msg("Guardando...", "info-silent");
        fetch(`${SCRIPT_URL}?action=updateField&rowId=${id}&field=${field}&value=${encodeURIComponent(value)}`)
            .then(r=>r.json()).then(d=>{
                if(d.status==='success') {
                    msg("Guardado", "success-silent");
                    const row = globalData.crm.find(r => r.ID == id);
                    if(row) {
                        if(field === 'status') row.Estado = value;
                        if(field === 'tech') row['Gestionado por'] = value;
                        if(field === 'priority') row.Prioridad = value;
                        render(); 
                    }
                } else alert("Error al guardar");
            });
    }

    function renderArchivados(term) {
        if(!archivadosTBody) return;
        archivadosTBody.innerHTML = "";
        let data = globalData.archivados;
        if(term) data = data.filter(r => String(r.Nombre).toLowerCase().includes(term));
        data.slice(0,50).forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${r.FechaObj.toLocaleDateString()}</td><td>${r.Nombre}</td><td>${r['Tipo de Solicitud']}</td><td>${r.Estado}</td><td>${r['Gestionado por']}</td><td>${r.ID}</td>`;
            archivadosTBody.appendChild(tr);
        });
    }

    function updateStats() {
        const data = globalData.crm; 
        document.getElementById("stat-total").textContent = data.length;
        document.getElementById("stat-contacted").textContent = data.filter(r => r.Estado === 'Contactado').length;
        document.getElementById("stat-pending").textContent = data.filter(r => r.Estado !== 'Contactado').length;
    }

    function printReport() {
         const data = globalData.crm.filter(r => {
            const today = new Date(); today.setHours(0,0,0,0);
            if (currentFilterDate === 'today') return r.FechaObj >= today;
            return true; 
        }); 

        if(data.length === 0) return alert("No hay datos");
        const logoUrl = window.location.origin + '/logo.svg';
        let w = window.open('', '', 'height=700,width=1000');
        let h = `<html><head><title>Hoja de Ruta</title><style>body{font-family:sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px}th{background:#eee}.urgente{background:#ffeeba}</style></head><body>
        <div style="text-align:center;margin-bottom:20px"><img src="${logoUrl}" height="40"><br><h3>Hoja de Ruta - ${new Date().toLocaleDateString()}</h3></div>
        <table><thead><tr><th>Prio</th><th>Cliente</th><th>Direccion</th><th>Detalles</th><th>Tecnico</th><th>Estado</th><th>Firma</th></tr></thead><tbody>`;
        
        data.forEach(r => {
            let bg = r.Prioridad==='Urgente' ? 'class="urgente"' : '';
            h += `<tr ${bg}><td>${r.Prioridad||'Normal'}</td><td><b>${r.Nombre}</b><br>${r.Telefono}</td><td>${r['Direccion_Zona']||''}</td><td>${r['Detalles']||''}</td><td>${r['Gestionado por']||''}</td><td>${r.Estado}</td><td></td></tr>`;
        });
        h += `</tbody></table></body></html>`;
        w.document.write(h); w.document.close(); setTimeout(()=>w.print(), 500);
    }
    
    function exportCSV(data, name) {
        if(!data.length) return alert("Sin datos");
        let csv = "Fecha,Nombre,Telefono,Direccion,Detalle,Tecnico,Prioridad,Notas\n" + 
            data.map(r => `"${r.FechaObj.toLocaleDateString()}","${r.Nombre}","${r.Telefono}","${r['Direccion_Zona']||''}","${r['Detalles']||''}","${r['Gestionado por']||''}","${r.Prioridad||''}","${r.Notas||''}"`).join("\n");
        const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8,"+csv); link.download = name; link.click();
    }

    function setActiveBtn(e) { document.querySelectorAll(".btn-group .btn").forEach(b=>b.classList.remove("active")); e.target.classList.add("active"); }
    function msg(txt, type) { crmMessage.textContent = txt; crmMessage.className = `alert alert-${type.includes('error')?'danger':type.includes('success')?'success':'info'} p-1 small`; setTimeout(()=>crmMessage.textContent="",4000); }
    function setupPermissions() { if(userRole==="oficina") { document.getElementById("archivados-tab-button")?.classList.add("d-none"); document.getElementById("pills-archivados")?.remove(); } }
    function renderCharts(data) { if(!statusChartCtx) return; const c={'Sin contactar':0,'En proceso':0,'Contactado':0}; data.forEach(r=>{if(c[r.Estado]!==undefined)c[r.Estado]++}); if(statusChartInstance)statusChartInstance.destroy(); statusChartInstance=new Chart(statusChartCtx,{type:'doughnut',data:{labels:['Pendiente','En Proceso','Finalizado'],datasets:[{data:[c['Sin contactar'],c['En proceso'],c['Contactado']],backgroundColor:['#dc3545','#ffc107','#198754']}]}}); }
});