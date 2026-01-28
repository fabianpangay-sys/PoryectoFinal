// ===============================
// VARIABLES GLOBALES
// ===============================
let columnasActividades = ['T1', 'T2', 'T3', 'T4'];
let configTareasDocente = []; // Para guardar tareas reales del servidor
const MAX_TAREAS_BASE = 4; // Límite de tareas base antes de expandir

// ===============================
// VERIFICAR AUTENTICACIÓN
// ===============================
async function verificarAuth() {
  try {
    const res = await fetch('/api/auth/verify');
    const data = await res.json();
    if (!data.authenticated || data.user.role !== 'docente') {
      window.location.href = '/';
      return;
    }
    document.getElementById('userInfo').textContent = `${data.user.fullname} (Docente)`;
  } catch (error) {
    console.error('Error verificando auth:', error);
    window.location.href = '/';
  }
}

// ===============================
// LOGOUT
// ===============================
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  window.location.href = '/logout';
});

// ===============================
// CARGAR CLASES DEL DOCENTE
// ===============================
async function cargarClasesDocente() {
  try {
    const res = await fetch('/api/clases');
    const data = await res.json();
    if (data.success) {
      llenarSelectoresClases(data.clases);
    }
  } catch (error) {
    console.error('Error cargando clases:', error);
  }
}

function llenarSelectoresClases(clases) {
  const selectors = ['claseSelector', 'claseCalificacionesSelector', 'claseAsistenciaSelector', 'taskClass'];
  selectors.forEach(selectorId => {
    const select = document.getElementById(selectorId);
    if (select) {
      select.innerHTML = '<option value="">Seleccione una clase</option>';
      clases.forEach(clase => {
        const texto = `${clase.grado} ${clase.curso} - ${clase.paralelo} (${clase.asignatura_nombre || 'Sin asignatura'})`;
        select.innerHTML += `<option value="${clase.id}">${texto}</option>`;
      });
    }
  });
}

// ===============================
// CARGAR ESTUDIANTES POR CLASE
// ===============================
document.getElementById('claseSelector')?.addEventListener('change', async (e) => {
  const claseId = e.target.value;
  const tbody = document.getElementById('studentsTableBody');
  if (!claseId) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Seleccione una clase</td></tr>';
    return;
  }
  try {
    const res = await fetch(`/api/estudiantes/clase/${claseId}`);
    const data = await res.json();
    if (data.success) {
      mostrarEstudiantes(data.estudiantes);
    }
  } catch (error) {
    console.error('Error cargando estudiantes:', error);
  }
});

function mostrarEstudiantes(estudiantes) {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  estudiantes.forEach(est => {
    tbody.innerHTML += `
      <tr>
        <td>${est.cedula}</td>
        <td>${est.nombre}</td>
        <td>${est.genero}</td>
        <td><span class="badge bg-success">Matriculado</span></td>
        <td><button class="btn btn-sm btn-info" onclick="verDetalles(${est.id})"><i class="bi bi-eye"></i> Ver</button></td>
      </tr>`;
  });
}

// ===============================
// GESTIÓN DE CALIFICACIONES
// ===============================

document.getElementById('claseCalificacionesSelector')?.addEventListener('change', cargarVistaCalificaciones);
document.getElementById('trimestreSelector')?.addEventListener('change', cargarVistaCalificaciones);

async function cargarVistaCalificaciones() {
  const claseId = document.getElementById('claseCalificacionesSelector').value;
  const trimestreId = document.getElementById('trimestreSelector').value;
  const container = document.getElementById('trimestresContainer');
  const recContainer = document.getElementById('recuperacionContainer');
  const labelTrim = document.getElementById('labelTrimestre');

  if (!claseId) {
    container.innerHTML = '<p class="text-muted text-center">Seleccione una clase para cargar calificaciones</p>';
    if (recContainer) recContainer.style.display = 'none';
    return;
  }

  if (labelTrim) labelTrim.textContent = trimestreId;
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div><p>Cargando calificaciones...</p></div>';

  try {
    // PASO 1: Obtener calificaciones de estudiantes
    const resCalificaciones = await fetch(`/api/calificaciones/clase/${claseId}`);
    const dataCalificaciones = await resCalificaciones.json();
    
    // PASO 2: Obtener tareas configuradas para este trimestre (NUEVO)
    const resTareas = await fetch(`/api/actividades/configuradas/${claseId}/${trimestreId}`);
    const dataTareas = await resTareas.json();
    
    if (dataCalificaciones.success && dataTareas.success) {
      configTareasDocente = dataTareas.tareas || [];
      console.log(`✅ Tareas cargadas: ${configTareasDocente.length}`);
      renderizarTablaTrimestre(dataCalificaciones.estudiantes, claseId, trimestreId);
      if (recContainer) recContainer.style.display = 'block';
    } else {
      container.innerHTML = '<p class="text-danger text-center">Error cargando datos</p>';
    }
  } catch (error) {
    console.error('Error cargando vista calificaciones:', error);
    container.innerHTML = '<p class="text-danger text-center">Error de conexión</p>';
  }
}

function renderizarTablaTrimestre(estudiantes, claseId, trimestre) {
  const container = document.getElementById('trimestresContainer');
  const tbodyRec = document.getElementById('bodyRecuperacion');
  if (tbodyRec) tbodyRec.innerHTML = '';

  // Filtrar tareas configuradas para este trimestre
  const tareasConfiguradas = configTareasDocente.filter(t => parseInt(t.trimestre) === parseInt(trimestre));
  
  // Crear array de columnas: mezclar tareas configuradas con slots vacíos
  let columnasAMostrar = [];
  
  // Rellenar primero con las tareas configuradas
  tareasConfiguradas.slice(0, MAX_TAREAS_BASE).forEach((tarea) => {
    columnasAMostrar.push({
      numero_tarea: tarea.numero_tarea,
      nombre_tarea: tarea.nombre_tarea,
      descripcion: tarea.descripcion || '',
      fecha_entrega: tarea.fecha_entrega || '',
      configurada: true,
      id_configuracion: tarea.id
    });
  });

  // Completar con slots vacíos hasta tener 4
  while (columnasAMostrar.length < MAX_TAREAS_BASE) {
    const numeroSlot = columnasAMostrar.length + 1;
    columnasAMostrar.push({
      numero_tarea: numeroSlot,
      nombre_tarea: `T${numeroSlot}`,
      configurada: false
    });
  }
  
  // Si hay más de 4 tareas configuradas, agregar las extras
  if (tareasConfiguradas.length > MAX_TAREAS_BASE) {
    tareasConfiguradas.slice(MAX_TAREAS_BASE).forEach(tarea => {
      columnasAMostrar.push({
        numero_tarea: tarea.numero_tarea,
        nombre_tarea: tarea.nombre_tarea,
        configurada: true,
        id_actividad: tarea.id
      });
    });
  }

  let html = `
    <div class="card p-4 mb-4 shadow-sm">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="text-primary mb-0">
          <i class="bi bi-journal-bookmark-fill me-2"></i> Trimestre ${trimestre}
        </h4>
        <span class="badge bg-info text-dark">
          <i class="bi bi-list-check me-1"></i>${tareasConfiguradas.length} de ${columnasAMostrar.length} Configuradas
        </span>
      </div>
      <div class="table-responsive">
        <table class="table table-bordered table-hover align-middle text-center mb-0">
          <thead class="table-dark">
            <tr>
              <th rowspan="2" class="text-start align-middle">Estudiante</th>
              <th colspan="${columnasAMostrar.length}">Formativa (70%)</th>
              <th rowspan="2" class="align-middle bg-secondary text-white">Prom.<br>Tareas</th>
              <th rowspan="2" class="align-middle bg-secondary text-white border-start-0">Aporte<br>(70%)</th>
              <th colspan="2" class="bg-primary text-white">Sumativa (30%)</th>
              <th rowspan="2" class="align-middle bg-primary text-white">Aporte<br>(30%)</th>
              <th rowspan="2" class="align-middle bg-success text-white">Nota Final</th>
            </tr>
            <tr>
              ${columnasAMostrar.map(col => {
              const esVacio = !col.configurada;
              const estilo = esVacio ? 'style="cursor: pointer; background-color: #ffe8cc;"' : '';
              const titulo = esVacio ? 'title="Actividades"' : `title="${col.nombre_tarea} - ${col.descripcion || 'Sin descripción'}"`;
              const onclick = esVacio ? `onclick="irAConfigurarActividad(${claseId}, ${trimestre}, ${col.numero_tarea})"` : '';
              const textoMostrar = col.nombre_tarea.length > 15 ? col.nombre_tarea.substring(0,15) + '...' : col.nombre_tarea;
              const icono = esVacio ? ' 🔧' : ' ✅';
              return `<th class="small py-1" ${estilo} ${titulo} ${onclick}>${textoMostrar}${icono}</th>`;
            }).join('')}
              <th class="small py-1">Examen</th>
              <th class="small py-1">Proyecto</th>
            </tr>
          </thead>
          <tbody id="mainGradesBody">`;

  estudiantes.forEach(est => {
    const t = (est.trimestres && est.trimestres[trimestre]) || { tareas: {}, examen: 0, proyecto: 0 };
    const tareas = t.tareas || {};
    
    html += `
      <tr data-est-id="${est.id}">
        <td class="text-start fw-bold">${est.nombre}</td>
        ${columnasAMostrar.map(col => {
          const num = col.numero_tarea;
          const valor = tareas[num] || 0;
          return `<td><input type="number" class="form-control form-control-sm nota-act" value="${valor}" min="0" max="10" step="0.01" data-numero-tarea="${num}" onchange="recalcularFila(this, ${est.id}, ${claseId}, ${trimestre}, ${num})"></td>`;
        }).join('')}
        <td class="prom-act-val fw-bold bg-light">0.00</td>
        <td class="aporte-70-val fw-bold text-secondary bg-light">0.00</td>
        <td><input type="number" class="form-control form-control-sm nota-eval" value="${t.examen || 0}" min="0" max="10" step="0.01" onchange="recalcularFila(this, ${est.id}, ${claseId}, ${trimestre}, 'examen')"></td>
        <td><input type="number" class="form-control form-control-sm nota-proj" value="${t.proyecto || 0}" min="0" max="10" step="0.01" onchange="recalcularFila(this, ${est.id}, ${claseId}, ${trimestre}, 'proyecto')"></td>
        <td class="aporte-30-val fw-bold text-primary bg-light">0.00</td>
        <td class="nota-final-val fw-bold text-success bg-light">0.00</td>
      </tr>`;

    if (tbodyRec) {
      tbodyRec.innerHTML += `
        <tr id="rec-fila-${est.id}">
          <td class="text-start">${est.nombre}</td><td class="rec-orig">0.00</td>
          <td><input type="number" class="form-control form-control-sm mx-auto input-rec" style="width: 85px" min="0" max="10" step="0.01" oninput="calcularRecuperacion(${est.id})"></td>
          <td class="rec-final fw-bold text-primary">0.00</td>
        </tr>`;
    }
  });

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;

  document.querySelectorAll('#mainGradesBody tr').forEach(tr => {
    recalcularFila(tr.querySelector('input'), tr.dataset.estId, claseId, trimestre, null, false);
  });
}

// ===============================
// IR A CONFIGURAR ACTIVIDAD
// ===============================
function irAConfigurarActividad(claseId, trimestre, numeroTarea) {
  const tabActividades = document.querySelector('[data-bs-toggle="pill"][data-bs-target="#nav-actividades"]');
  if (tabActividades) {
    tabActividades.click();
    
    setTimeout(() => {
      document.getElementById('taskClass').value = claseId;
      document.getElementById('taskTrimestre').value = trimestre;
      
      // Buscar si ya existe tarea configurada y prellenar
      const tareaExistente = configTareasDocente.find(t => 
        parseInt(t.trimestre) === parseInt(trimestre) && 
        parseInt(t.numero_tarea) === parseInt(numeroTarea)
      );
      
      if (tareaExistente) {
        // EDITAR: Prellenar con datos existentes
        document.getElementById('taskTitle').value = tareaExistente.nombre_tarea;
        document.getElementById('taskDesc').value = tareaExistente.descripcion || '';
        document.getElementById('taskDate').value = tareaExistente.fecha_entrega || '';
        document.getElementById('taskForm').dataset.numeroTarea = numeroTarea;
        document.getElementById('taskForm').dataset.accion = 'actualizar';
        
        const btnSubmit = document.querySelector('#taskForm button[type="submit"]');
        btnSubmit.innerHTML = '<i class="bi bi-pencil-fill me-2"></i>Actualizar Actividad';
        btnSubmit.classList.remove('btn-success');
        btnSubmit.classList.add('btn-warning');
      } else {
        // CREAR: Formulario vacío
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDesc').value = '';
        document.getElementById('taskDate').value = '';
        document.getElementById('taskForm').dataset.numeroTarea = numeroTarea;
        document.getElementById('taskForm').dataset.accion = 'crear';
        
        const btnSubmit = document.querySelector('#taskForm button[type="submit"]');
        btnSubmit.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Crear Actividad';
        btnSubmit.classList.remove('btn-warning');
        btnSubmit.classList.add('btn-success');
      }
      
      document.getElementById('taskTitle').focus();
    }, 300);
  }
}

// ===============================
// LÓGICA DE CÁLCULO (70/30 INTELIGENTE)
// ===============================
function recalcularFila(input, estId, claseId, trimestre, tipo, autoSave = true) {
  const fila = input.closest('tr');
  
  const inputsAct = Array.from(fila.querySelectorAll('.nota-act')).map(i => parseFloat(i.value) || 0);
  const vEval = parseFloat(fila.querySelector('.nota-eval').value) || 0;
  const vProj = parseFloat(fila.querySelector('.nota-proj').value) || 0;

  const validas = inputsAct.filter(v => v > 0);
  const promAct = validas.length > 0 ? (validas.reduce((a,b)=>a+b,0) / validas.length) : 0;
  const aporte70 = promAct * 0.7;
  
  let aporte30 = 0;
  if (vEval > 0 && vProj > 0) {
    aporte30 = (vEval * 0.15) + (vProj * 0.15);
  } else if (vEval > 0 || vProj > 0) {
    aporte30 = (vEval + vProj) * 0.30;
  }
  
  const total = (aporte70 + aporte30).toFixed(2);
  
  fila.querySelector('.prom-act-val').textContent = promAct.toFixed(2);
  fila.querySelector('.aporte-70-val').textContent = aporte70.toFixed(2);
  fila.querySelector('.aporte-30-val').textContent = aporte30.toFixed(2);
  fila.querySelector('.nota-final-val').textContent = total;

  const recFila = document.getElementById(`rec-fila-${estId}`);
  if (recFila) {
    recFila.querySelector('.rec-orig').textContent = total;
    calcularRecuperacion(estId);
  }

  if (autoSave && tipo !== null) {
    const valor = parseFloat(input.value);
    if (typeof tipo === 'number') guardarNota(estId, claseId, trimestre, tipo, valor);
    else if (tipo === 'examen') guardarExamen(estId, claseId, trimestre, valor);
    else if (tipo === 'proyecto') guardarProyecto(estId, claseId, trimestre, valor);
  }
}

function calcularRecuperacion(estId) {
  const fila = document.getElementById(`rec-fila-${estId}`);
  if(!fila) return;
  const orig = parseFloat(fila.querySelector('.rec-orig').textContent) || 0;
  const rec = parseFloat(fila.querySelector('.input-rec').value) || 0;
  let final = (rec > 7) ? (orig + rec) / 2 : orig;
  fila.querySelector('.rec-final').textContent = final.toFixed(2);
}

// ===============================
// GUARDAR DATOS
// ===============================
async function guardarNota(estudianteId, claseId, trimestre, numeroTarea, nota) {
  try {
    await fetch('/api/calificaciones/tarea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estudiante_id: estudianteId, clase_id: claseId, trimestre, numero_tarea: numeroTarea, nota: parseFloat(nota) })
    });
  } catch (e) { console.error("Error guardando tarea"); }
}

async function guardarExamen(estudianteId, claseId, trimestre, nota) {
  try {
    await fetch('/api/calificaciones/examen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estudiante_id: estudianteId, clase_id: claseId, trimestre, nota: parseFloat(nota) })
    });
  } catch (e) { console.error("Error guardando examen"); }
}

async function guardarProyecto(estudianteId, claseId, trimestre, nota) {
  try {
    await fetch('/api/calificaciones/proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estudiante_id: estudianteId, clase_id: claseId, trimestre, nota: parseFloat(nota) })
    });
  } catch (e) { console.error("Error guardando proyecto"); }
}

// ===============================
// ACTIVIDADES (ANTES TAREAS)
// ===============================
document.getElementById('taskForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const claseId = parseInt(document.getElementById('taskClass').value);
  const trimestre = parseInt(document.getElementById('taskTrimestre').value || 1);
  const numeroTarea = parseInt(document.getElementById('taskForm').dataset.numeroTarea || '');
  
  const payload = {
    titulo: document.getElementById('taskTitle').value.trim(),
    descripcion: document.getElementById('taskDesc').value.trim(),
    fecha: document.getElementById('taskDate').value,
    clase_id: claseId,
    trimestre: trimestre,
    numero_tarea: numeroTarea || undefined  // Solo si está editando
  };
  
  console.log('📤 Guardando actividad:', payload);
  
  try {
    const res = await fetch('/api/actividades', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    const result = await res.json();
    
    if (result.success) { 
      const accion = result.accion || 'creada';
      const mensajeExito = `✅ Actividad "${payload.titulo}" ${accion} exitosamente\n📚 Clase: ${document.getElementById('taskClass').selectedOptions[0].text}\n📅 Trimestre: ${trimestre}\n\n¿Desea ir a ver las calificaciones?`;
      
      if (confirm(mensajeExito)) {
        const tabCalificaciones = document.querySelector('[data-bs-toggle="pill"][data-bs-target="#nav-calificaciones"]');
        if (tabCalificaciones) {
          tabCalificaciones.click();
          document.getElementById('claseCalificacionesSelector').value = claseId;
          document.getElementById('trimestreSelector').value = trimestre;
          setTimeout(() => { cargarVistaCalificaciones(); }, 300);
        }
      } else {
        // Recargar la misma vista de calificaciones si está abierta
        const claseActual = parseInt(document.getElementById('claseCalificacionesSelector').value);
        const trimestreActual = parseInt(document.getElementById('trimestreSelector').value);
        if (claseActual === claseId && trimestreActual === trimestre) {
          cargarVistaCalificaciones();
        }
      }
      
      e.target.reset();
      document.getElementById('taskForm').dataset.numeroTarea = '';
      document.getElementById('taskForm').dataset.accion = '';
    } else {
      alert('❌ Error al guardar la actividad: ' + (result.message || 'Error desconocido'));
    }
  } catch (error) { 
    console.error('Error completo:', error);
    alert('❌ Error de conexión al guardar la actividad');
  }
});

// ===============================
// DESCARGAR PDF DE CALIFICACIONES - VERSIÓN MEJORADA Y ELEGANTE
// ===============================
async function descargarPDFCalificaciones() {
  const claseId = document.getElementById('claseCalificacionesSelector').value;
  const trimestreId = document.getElementById('trimestreSelector').value;

  if (!claseId || !trimestreId) {
    alert('⚠️ Por favor seleccione una clase y un trimestre');
    return;
  }

  try {
    const res = await fetch(`/api/calificaciones/clase/${claseId}`);
    const data = await res.json();
    
    if (!data.success) {
      alert('❌ Error al obtener calificaciones');
      return;
    }

    const estudiantes = data.estudiantes;
    const tareasConfiguradas = (data.config || []).filter(t => t.trimestre == trimestreId);
    
    // Obtener información de la clase seleccionada
    const selectClase = document.getElementById('claseCalificacionesSelector');
    const claseTexto = selectClase.options[selectClase.selectedIndex].text;
    
    let columnasAMostrar = [];
    tareasConfiguradas.forEach((tarea, index) => {
      if (index < MAX_TAREAS_BASE) {
        columnasAMostrar.push({ numero_tarea: tarea.numero_tarea, nombre_tarea: tarea.nombre_tarea });
      }
    });
    while (columnasAMostrar.length < MAX_TAREAS_BASE) {
      const numeroSlot = columnasAMostrar.length + 1;
      columnasAMostrar.push({ numero_tarea: numeroSlot, nombre_tarea: `T${numeroSlot}` });
    }
    if (tareasConfiguradas.length > MAX_TAREAS_BASE) {
      tareasConfiguradas.slice(MAX_TAREAS_BASE).forEach(tarea => {
        columnasAMostrar.push({ numero_tarea: tarea.numero_tarea, nombre_tarea: tarea.nombre_tarea });
      });
    }

    const fechaActual = new Date();
    const fechaFormateada = fechaActual.toLocaleDateString('es-EC', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const horaFormateada = fechaActual.toLocaleTimeString('es-EC');

    let htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registro de Calificaciones - Trimestre ${trimestreId}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #2d3748;
          }
          
          .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            max-width: 1400px;
            margin: 0 auto;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 15s ease-in-out infinite;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          
          .header-content {
            position: relative;
            z-index: 1;
          }
          
          .logo {
            font-size: 48px;
            margin-bottom: 10px;
          }
          
          h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          
          .subtitle {
            font-size: 18px;
            opacity: 0.9;
            font-weight: 300;
          }
          
          .info-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: linear-gradient(to bottom, #f7fafc, #edf2f7);
            border-bottom: 3px solid #667eea;
          }
          
          .info-card {
            background: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
            transition: transform 0.2s;
          }
          
          .info-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
          }
          
          .info-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #718096;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-size: 16px;
            color: #2d3748;
            font-weight: 600;
          }
          
          .table-container {
            padding: 30px;
          }
          
          .section-title {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 22px;
            color: #2d3748;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
          }
          
          .section-icon {
            font-size: 28px;
          }
          
          table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 11px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-radius: 12px;
            overflow: hidden;
          }
          
          thead th {
            background: linear-gradient(135deg, #434343 0%, #000000 100%);
            color: white;
            font-weight: 600;
            padding: 12px 8px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
            position: sticky;
            top: 0;
            z-index: 10;
          }
          
          thead th.student-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            text-align: left;
            padding-left: 15px;
          }
          
          thead th.formativa-header {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          }
          
          thead th.sumativa-header {
            background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          }
          
          thead th.final-header {
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          }
          
          tbody td {
            padding: 10px 8px;
            border: 1px solid #e2e8f0;
            text-align: center;
            background: white;
          }
          
          tbody tr:nth-child(even) td {
            background: #f7fafc;
          }
          
          tbody tr:hover td {
            background: #edf2f7;
          }
          
          .student-name {
            text-align: left !important;
            font-weight: 600;
            color: #2d3748;
            padding-left: 15px !important;
          }
          
          .promedio-cell {
            background: linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%) !important;
            font-weight: 700;
            color: #2d3748;
          }
          
          .nota-final-cell {
            background: linear-gradient(135deg, #c6f6d5 0%, #9ae6b4 100%) !important;
            font-weight: 700;
            font-size: 13px;
            color: #22543d;
          }
          
          .nota-alta {
            color: #22543d;
          }
          
          .nota-media {
            color: #744210;
          }
          
          .nota-baja {
            color: #742a2a;
          }
          
          .recuperacion-section {
            margin-top: 40px;
          }
          
          .footer {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px 30px;
            text-align: center;
            color: white;
          }
          
          .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
          }
          
          .footer-text {
            font-size: 12px;
            opacity: 0.9;
          }
          
          .estadisticas {
            display: flex;
            gap: 30px;
            padding: 20px 30px;
            background: #f7fafc;
            border-radius: 12px;
            margin: 20px 30px;
          }
          
          .stat-item {
            text-align: center;
          }
          
          .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
          }
          
          .stat-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            
            .container {
              box-shadow: none;
            }
            
            table {
              page-break-inside: auto;
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            thead {
              display: table-header-group;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-content">
              <div class="logo">📊</div>
              <h1>REGISTRO DE CALIFICACIONES</h1>
              <p class="subtitle">Sistema de Gestión Académica</p>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-card">
              <div class="info-label">📚 Clase</div>
              <div class="info-value">${claseTexto}</div>
            </div>
            <div class="info-card">
              <div class="info-label">📅 Trimestre</div>
              <div class="info-value">Trimestre ${trimestreId}</div>
            </div>
            <div class="info-card">
              <div class="info-label">👥 Estudiantes</div>
              <div class="info-value">${estudiantes.length}</div>
            </div>
            <div class="info-card">
              <div class="info-label">📝 Actividades</div>
              <div class="info-value">${tareasConfiguradas.length} configuradas</div>
            </div>
            <div class="info-card">
              <div class="info-label">📆 Fecha</div>
              <div class="info-value">${fechaFormateada}</div>
            </div>
            <div class="info-card">
              <div class="info-label">🕐 Hora</div>
              <div class="info-value">${horaFormateada}</div>
            </div>
          </div>
          
          <div class="table-container">
            <div class="section-title">
              <span class="section-icon">📋</span>
              <span>CALIFICACIONES DEL TRIMESTRE</span>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th rowspan="2" class="student-header">Estudiante</th>
                  <th colspan="${columnasAMostrar.length}" class="formativa-header">Formativa (70%)</th>
                  <th rowspan="2">Prom.<br>Tareas</th>
                  <th rowspan="2">Aporte<br>70%</th>
                  <th colspan="2" class="sumativa-header">Sumativa (30%)</th>
                  <th rowspan="2">Aporte<br>30%</th>
                  <th rowspan="2" class="final-header">Nota<br>Final</th>
                </tr>
                <tr>
                  ${columnasAMostrar.map(t => `<th class="formativa-header">${t.nombre_tarea}</th>`).join('')}
                  <th class="sumativa-header">Examen</th>
                  <th class="sumativa-header">Proyecto</th>
                </tr>
              </thead>
              <tbody>`;

    // Calcular estadísticas
    let sumaNotas = 0;
    let aprobados = 0;
    let notaMaxima = 0;
    let notaMinima = 10;

    estudiantes.forEach(est => {
      const t = (est.trimestres && est.trimestres[trimestreId]) || { tareas: {}, examen: 0, proyecto: 0 };
      const tareas = t.tareas || {};
      const notasTareas = columnasAMostrar.map(tConf => parseFloat(tareas[tConf.numero_tarea]) || 0);
      const validas = notasTareas.filter(v => v > 0);
      const promAct = validas.length > 0 ? (validas.reduce((a,b)=>a+b,0) / validas.length) : 0;
      const aporte70 = promAct * 0.7;
      const vEval = parseFloat(t.examen) || 0;
      const vProj = parseFloat(t.proyecto) || 0;
      let aporte30 = 0;
      if (vEval > 0 && vProj > 0) { aporte30 = (vEval * 0.15) + (vProj * 0.15); }
      else if (vEval > 0 || vProj > 0) { aporte30 = (vEval + vProj) * 0.30; }
      const notaFinal = parseFloat((aporte70 + aporte30).toFixed(2));

      sumaNotas += notaFinal;
      if (notaFinal >= 7) aprobados++;
      if (notaFinal > notaMaxima) notaMaxima = notaFinal;
      if (notaFinal < notaMinima) notaMinima = notaFinal;

      const claseNota = notaFinal >= 7 ? 'nota-alta' : (notaFinal >= 5 ? 'nota-media' : 'nota-baja');

      htmlContent += `
        <tr>
          <td class="student-name">${est.nombre}</td>
          ${notasTareas.map(n => `<td>${n.toFixed(2)}</td>`).join('')}
          <td class="promedio-cell">${promAct.toFixed(2)}</td>
          <td class="promedio-cell">${aporte70.toFixed(2)}</td>
          <td>${vEval.toFixed(2)}</td>
          <td>${vProj.toFixed(2)}</td>
          <td class="promedio-cell">${aporte30.toFixed(2)}</td>
          <td class="nota-final-cell ${claseNota}">${notaFinal.toFixed(2)}</td>
        </tr>`;
    });

    const promedioCurso = estudiantes.length > 0 ? (sumaNotas / estudiantes.length).toFixed(2) : '0.00';

    htmlContent += `
              </tbody>
            </table>
          </div>
          
          <div class="estadisticas">
            <div class="stat-item">
              <div class="stat-value">${promedioCurso}</div>
              <div class="stat-label">Promedio del Curso</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${aprobados}</div>
              <div class="stat-label">Estudiantes Aprobados</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${notaMaxima.toFixed(2)}</div>
              <div class="stat-label">Nota Más Alta</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${notaMinima.toFixed(2)}</div>
              <div class="stat-label">Nota Más Baja</div>
            </div>
          </div>
          
          <div class="table-container recuperacion-section">
            <div class="section-title">
              <span class="section-icon">🔄</span>
              <span>SECCIÓN DE RECUPERACIÓN</span>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th class="student-header">Estudiante</th>
                  <th>Nota Original</th>
                  <th>Nota Recuperación</th>
                  <th class="final-header">Nota Final</th>
                </tr>
              </thead>
              <tbody>`;

    estudiantes.forEach(est => {
      const t = (est.trimestres && est.trimestres[trimestreId]) || { tareas: {}, examen: 0, proyecto: 0 };
      const tareas = t.tareas || {};
      const notasTareas = columnasAMostrar.map(tConf => parseFloat(tareas[tConf.numero_tarea]) || 0);
      const validas = notasTareas.filter(v => v > 0);
      const promAct = validas.length > 0 ? (validas.reduce((a,b)=>a+b,0) / validas.length) : 0;
      const aporte70 = promAct * 0.7;
      const vEval = parseFloat(t.examen) || 0;
      const vProj = parseFloat(t.proyecto) || 0;
      let aporte30 = 0;
      if (vEval > 0 && vProj > 0) { aporte30 = (vEval * 0.15) + (vProj * 0.15); }
      else if (vEval > 0 || vProj > 0) { aporte30 = (vEval + vProj) * 0.30; }
      const notaOriginal = (aporte70 + aporte30).toFixed(2);

      htmlContent += `
        <tr>
          <td class="student-name">${est.nombre}</td>
          <td>${notaOriginal}</td>
          <td>-</td>
          <td class="nota-final-cell">${notaOriginal}</td>
        </tr>`;
    });

    htmlContent += `
              </tbody>
            </table>
          </div>
          
          <div class="footer">
            <div class="footer-content">
              <div class="footer-text">
                <strong>Sistema de Gestión Académica</strong><br>
                Documento generado automáticamente
              </div>
              <div class="footer-text">
                📅 ${fechaFormateada}<br>
                🕐 ${horaFormateada}
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>`;

    const ventana = window.open('', '_blank', 'width=1200,height=800');
    ventana.document.write(htmlContent);
    ventana.document.close();
    
    setTimeout(() => { 
      ventana.print(); 
    }, 500);

  } catch (error) {
    console.error('Error generando PDF:', error);
    alert('❌ Error al generar el PDF');
  }
}

// ===============================
// DESCARGAR BOLETA (FUNCIÓN EXISTENTE)
// ===============================
async function descargarBoleta(estudianteId, claseId) {
  try {
    const res = await fetch(`/api/calificaciones/boleta/${estudianteId}/${claseId}`);
    const data = await res.json();
    
    if (data.success) {
      console.log('Datos de la boleta:', data);
      generarPDFBoleta(data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function verDetalles(id) { 
  alert(`Detalles del estudiante ID: ${id}`); 
}


// ===============================
// GESTIÓN DE ASISTENCIA (ESTRUCTURA VISUAL - SIN LÓGICA POR AHORA)
// ===============================
document.getElementById('claseAsistenciaSelector')?.addEventListener('change', cargarVistaAsistencia);
document.getElementById('trimestreAsistenciaSelector')?.addEventListener('change', cargarVistaAsistencia);

async function cargarVistaAsistencia() {
  const claseId = document.getElementById('claseAsistenciaSelector').value;
  const trimestreId = document.getElementById('trimestreAsistenciaSelector').value;
  const container = document.getElementById('asistenciaContainer');
  const resumenContainer = document.getElementById('resumenAsistenciaContainer');
  const labelTrimAsistencia = document.getElementById('labelTrimestreAsistencia');

  if (!claseId) {
    container.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-calendar2-check display-1"></i><p class="mt-3 fs-5">Seleccione una clase y trimestre para cargar la asistencia</p></div>';
    if (resumenContainer) resumenContainer.style.display = 'none';
    return;
  }

  if (labelTrimAsistencia) labelTrimAsistencia.textContent = trimestreId;
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div><p>Cargando asistencia...</p></div>';

  try {
    renderizarTablaAsistencia(claseId, trimestreId);
    if (resumenContainer) resumenContainer.style.display = 'block';
    
  } catch (error) {
    console.error('Error cargando vista asistencia:', error);
    container.innerHTML = '<p class="text-danger text-center">Error de conexión</p>';
  }
}

function renderizarTablaAsistencia(claseId, trimestre) {
  const container = document.getElementById('asistenciaContainer');
  
  // ESTRUCTURA VISUAL - SIN LÓGICA POR AHORA
  let html = `
    <div class="card shadow-sm">
      <div class="card-header bg-info text-white fw-bold">
        <i class="bi bi-calendar2-check me-2"></i> Registro de Asistencia - Trimestre ${trimestre}
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Estudiante</th>
              <th class="text-center">Total Horas</th>
              <th class="text-center">Asistencias</th>
              <th class="text-center">Inasistencias Justificadas</th>
              <th class="text-center">Inasistencias Injustificadas</th>
              <th class="text-center">% Inasistencias</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody id="bodyAsistencia">
            <tr>
              <td colspan="7" class="text-center text-muted py-5">
                <i class="bi bi-info-circle me-2"></i>
                Próximamente: Módulo de asistencia en desarrollo
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}
// ===============================
// INICIALIZAR
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  verificarAuth();
  cargarClasesDocente();
});