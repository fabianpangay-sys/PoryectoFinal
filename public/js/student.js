// ===============================
// VERIFICAR AUTENTICACIÓN
// ===============================
let usuarioActual = null;
let estudianteData = null;
let asignaturasDelEstudiante = [];

async function verificarAuth() {
  try {
    const res = await fetch('/api/auth/verify');
    const data = await res.json();
    
    if (!data.authenticated || data.user.role !== 'estudiante') {
      window.location.href = '/';
      return;
    }
    
    usuarioActual = data.user;
    document.getElementById('userInfo').textContent = 
      `${data.user.fullname} (Estudiante)`;
    
    console.log('✅ Usuario verificado:', usuarioActual.fullname);
    
    await cargarDatosEstudiante();
    
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
// CARGAR DATOS DEL ESTUDIANTE
// ===============================
// ===============================
// CARGAR DATOS DEL ESTUDIANTE - VERSIÓN CORREGIDA
// ===============================
async function cargarDatosEstudiante() {
  try {
    console.log('📥 Cargando datos del estudiante...');
    console.log('Cédula actual:', usuarioActual.cedula);
    
    // ⭐ Usar el endpoint mejorado /api/estudiantes/registro
    const res = await fetch('/api/estudiantes/registro');
    const data = await res.json();
    
    console.log('📦 Response completo:', data);
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      mostrarErrorAsignaturas(data.error);
      return;
    }
    
    console.log(`📊 Total de estudiantes en el sistema: ${data.estudiantes.length}`);
    
    // Buscar al estudiante por cédula
    const estudiante = data.estudiantes.find(e => {
      console.log(`  Comparando: ${e.cedula} === ${usuarioActual.cedula}? ${e.cedula === usuarioActual.cedula}`);
      return e.cedula === usuarioActual.cedula;
    });
    
    if (!estudiante) {
      console.error('❌ Estudiante no encontrado');
      console.log('Cédulas disponibles:', data.estudiantes.map(e => e.cedula));
      mostrarErrorAsignaturas('Estudiante no encontrado en el sistema');
      return;
    }
    
    console.log('✅ Estudiante encontrado:', estudiante.nombre);
    console.log('Datos completos:', estudiante);
    
    estudianteData = estudiante;
    
    // Llenar información personal
    document.getElementById('studentName').textContent = estudiante.nombre;
    document.getElementById('studentCedula').textContent = estudiante.cedula;
    document.getElementById('studentGrade').textContent = estudiante.grado_actual || '-';
    document.getElementById('studentParalelo').textContent = estudiante.paralelo_actual || '-';
    
    // ⭐ USAR DIRECTAMENTE LAS CLASES QUE YA VIENEN EN EL OBJETO
    console.log('\n📚 Clases matriculadas:', estudiante.clases_matriculadas);
    
    if (!estudiante.clases_matriculadas || estudiante.clases_matriculadas.length === 0) {
      console.warn('⚠️ Sin clases matriculadas');
      mostrarErrorAsignaturas('No estás matriculado en ninguna clase');
      return;
    }
    
    // ⭐ CONVERTIR CLASES A ASIGNATURAS
    const asignaturas = estudiante.clases_matriculadas.map(clase => ({
      clase_id: clase.clase_id,
      asignatura_nombre: clase.asignatura_nombre,
      asignatura_id: clase.asignatura_id,
      grado: clase.grado,
      curso: clase.curso,
      paralelo: clase.paralelo,
      docente_nombre: clase.docente_nombre,
      periodo_lectivo: clase.periodo_lectivo
    }));
    
    console.log(`✅ ${asignaturas.length} asignatura(s) procesada(s):`);
    asignaturas.forEach((a, i) => {
      console.log(`   [${i+1}] ${a.asignatura_nombre} - Clase ID: ${a.clase_id}`);
    });
    
    asignaturasDelEstudiante = asignaturas;
    
    // Actualizar grado/paralelo desde primera asignatura
    const primerAsignatura = asignaturas[0];
    document.getElementById('studentGrade').textContent = `${primerAsignatura.grado} ${primerAsignatura.curso}`;
    document.getElementById('studentParalelo').textContent = primerAsignatura.paralelo;
    
    // Crear selector de asignaturas
    crearSelectorAsignaturas(asignaturas);
    
  } catch (error) {
    console.error('❌ Error cargando estudiante:', error);
    mostrarErrorAsignaturas('Error de conexión al cargar datos');
  }
}

// ===============================
// CARGAR ASIGNATURAS
// ===============================
async function cargarAsignaturas(estudianteId) {
  try {
    console.log(`\n📚 Cargando asignaturas del estudiante ${estudianteId}...`);
    
    const res = await fetch(`/api/estudiantes/${estudianteId}/asignaturas`);
    const data = await res.json();
    
    console.log('Response:', data);
    
    if (!data.success) {
      console.error('Error:', data.error);
      return;
    }
    
    if (data.total === 0) {
      console.warn('⚠️ Sin asignaturas');
      document.getElementById('asignaturasSelector').innerHTML = 
        '<p class="text-warning">No hay asignaturas disponibles</p>';
      return;
    }
    
    asignaturasDelEstudiante = data.asignaturas;
    
    console.log(`✅ ${data.total} asignatura(s) encontrada(s)`);
    data.asignaturas.forEach((a, i) => {
      console.log(`   [${i+1}] ${a.asignatura_nombre}`);
    });
    
    // Mostrar información del grado
    const primerAsignatura = data.asignaturas[0];
    document.getElementById('studentGrade').textContent = `${primerAsignatura.grado} ${primerAsignatura.nivel}`;
    document.getElementById('studentParalelo').textContent = primerAsignatura.paralelo;
    
    // Crear selector de asignaturas
    crearSelectorAsignaturas(data.asignaturas);
    
    // Cargar calificaciones de la primera asignatura
    await cargarCalificacionesAsignatura(estudianteId, data.asignaturas[0], 0);
    
  } catch (error) {
    console.error('❌ Error cargando asignaturas:', error);
  }
}

// ===============================
// CREAR SELECTOR DE ASIGNATURAS
// ===============================
function crearSelectorAsignaturas(asignaturas) {
  const selector = document.getElementById('asignaturasSelector');
  selector.innerHTML = '';
  
  asignaturas.forEach((asig, index) => {
    const btn = document.createElement('button');
    btn.className = `asignatura-tab ${index === 0 ? 'active' : ''}`;
    btn.innerHTML = `
      <i class="bi bi-book me-2"></i>${asig.asignatura_nombre}
      ${asig.docente_nombre ? `<br><small>${asig.docente_nombre}</small>` : ''}
    `;
    
    btn.addEventListener('click', async () => {
      // Actualizar botones activos
      document.querySelectorAll('.asignatura-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Cargar calificaciones
      await cargarCalificacionesAsignatura(estudianteData.id, asig, index);
    });
    
    selector.appendChild(btn);
  });
}

// ===============================
// CARGAR CALIFICACIONES DE ASIGNATURA
// ===============================
async function cargarCalificacionesAsignatura(estudianteId, asignatura, index) {
  try {
    console.log(`\n📊 Cargando calificaciones de ${asignatura.asignatura_nombre}...`);
    
    const res = await fetch(`/api/calificaciones/clase/${asignatura.clase_id}`);
    const data = await res.json();
    
    if (!data.success) {
      console.error('Error obteniendo calificaciones');
      mostrarTablaVacia();
      return;
    }
    
    const misCalificaciones = data.estudiantes.find(e => e.id === estudianteId);
    
    if (!misCalificaciones) {
      console.log('Sin calificaciones aún');
      mostrarTablaVacia();
      return;
    }
    
    console.log('✅ Calificaciones encontradas');
    
    // Actualizar título
    const titulo = document.querySelector('.main-content h2');
    if (titulo) {
      titulo.innerHTML = `Mis Calificaciones - <span class="text-info">${asignatura.asignatura_nombre}</span>`;
    }
    
    // Mostrar tablas de trimestres
    mostrarTablasAsignatura(misCalificaciones, asignatura.asignatura_nombre);
    
  } catch (error) {
    console.error('Error cargando calificaciones:', error);
    mostrarTablaVacia();
  }
}

// ===============================
// MOSTRAR TABLAS DE ASIGNATURA
// ===============================
function mostrarTablasAsignatura(calificaciones, nombreAsignatura) {
  const contenedor = document.getElementById('asignaturasContent');
  
  let html = '';
  
  // Trimestre 1
  html += crearTablaTrimestre(1, calificaciones.trimestres[1] || {});
  
  // Trimestre 2
  html += crearTablaTrimestre(2, calificaciones.trimestres[2] || {});
  
  // Trimestre 3
  html += crearTablaTrimestre(3, calificaciones.trimestres[3] || {});
  
  // Resumen anual
  html += crearResumenAnual(calificaciones);
  
  // Supletorio
  if (calificaciones.estado === 'Supletorio' || calificaciones.supletorio?.nota > 0) {
    html += crearTablaSupletorio(calificaciones);
  }
  
  contenedor.innerHTML = html;
}

// ===============================
// CREAR TABLA DE TRIMESTRE
// ===============================
function crearTablaTrimestre(numTrimestre, trimestre) {
  const tareas = trimestre.tareas || {};
  const examen = trimestre.examen || 0;
  const promedio = trimestre.promedio || 0;
  
  const notaAI = tareas[1] || 0;
  const notaAG = tareas[2] || 0;
  const notaRP = tareas[3] || 0;
  const notaPI = tareas[4] || 0;
  
  const promedioTareas = Object.values(tareas).length > 0
    ? Object.values(tareas).reduce((a, b) => a + b, 0) / Object.values(tareas).length
    : 0;
  
  const estado = promedio >= 7 ? 'Aprobado' : promedio >= 5 ? 'En riesgo' : 'Reprobado';
  const estadoClass = promedio >= 7 ? 'text-success' : promedio >= 5 ? 'text-warning' : 'text-danger';
  
  return `
    <div class="card p-4 mb-4">
      <h4>Trimestre ${numTrimestre}</h4>
      <div class="table-responsive">
        <table class="table table-bordered">
          <thead class="table-primary">
            <tr>
              <th>AI</th>
              <th>AG</th>
              <th>RP</th>
              <th>PI</th>
              <th>Formativa (70%)</th>
              <th>Examen (30%)</th>
              <th>Promedio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${notaAI.toFixed(2)}</td>
              <td>${notaAG.toFixed(2)}</td>
              <td>${notaRP.toFixed(2)}</td>
              <td>${notaPI.toFixed(2)}</td>
              <td>${promedioTareas.toFixed(2)}</td>
              <td>${examen.toFixed(2)}</td>
              <td><strong>${promedio.toFixed(2)}</strong></td>
              <td><span class="${estadoClass}">${estado}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===============================
// CREAR RESUMEN ANUAL
// ===============================
function crearResumenAnual(calificaciones) {
  const p1 = calificaciones.trimestres[1]?.promedio || 0;
  const p2 = calificaciones.trimestres[2]?.promedio || 0;
  const p3 = calificaciones.trimestres[3]?.promedio || 0;
  const promedioFinal = calificaciones.promedio_anual || 0;
  const estado = calificaciones.estado || 'Pendiente';
  
  const estadoClass = 
    estado === 'Aprobado' ? 'text-success' : 
    estado === 'Supletorio' ? 'text-warning' : 
    estado === 'Reprobado' ? 'text-danger' : 'text-secondary';
  
  return `
    <div class="card p-4 mb-4 border-success">
      <h4 class="text-success">Resumen Anual</h4>
      <div class="table-responsive">
        <table class="table table-bordered">
          <thead class="table-success">
            <tr>
              <th>Promedio T1</th>
              <th>Promedio T2</th>
              <th>Promedio T3</th>
              <th>Promedio Final</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${p1.toFixed(2)}</td>
              <td>${p2.toFixed(2)}</td>
              <td>${p3.toFixed(2)}</td>
              <td><strong>${promedioFinal.toFixed(2)}</strong></td>
              <td><strong><span class="${estadoClass}">${estado}</span></strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===============================
// CREAR TABLA SUPLETORIO
// ===============================
function crearTablaSupletorio(calificaciones) {
  const sup = calificaciones.supletorio || {};
  const promedioBase = calificaciones.promedio_anual || 0;
  const notaSupletorio = sup.nota || 0;
  const notaFinal = sup.nota_final || 0;
  const estadoFinal = sup.estado || 'Pendiente';
  
  const estadoClass = 
    estadoFinal === 'Aprobado (S)' ? 'text-success' : 
    estadoFinal === 'Reprobado (S)' ? 'text-danger' : 'text-secondary';
  
  return `
    <div class="card p-4 border-danger">
      <h4 class="text-danger">Evaluación Supletoria</h4>
      <div class="table-responsive">
        <table class="table table-bordered">
          <thead class="table-danger">
            <tr>
              <th>Promedio Anual Base</th>
              <th>Nota Supletorio</th>
              <th>Nota Final</th>
              <th>Estado Final</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${promedioBase.toFixed(2)}</td>
              <td>${notaSupletorio.toFixed(2)}</td>
              <td><strong>${notaFinal.toFixed(2)}</strong></td>
              <td><strong><span class="${estadoClass}">${estadoFinal}</span></strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===============================
// MOSTRAR TABLA VACÍA
// ===============================
function mostrarTablaVacia() {
  const contenedor = document.getElementById('asignaturasContent');
  
  contenedor.innerHTML = `
    <div class="alert alert-info">
      <i class="bi bi-info-circle me-2"></i>
      No hay calificaciones registradas aún para esta asignatura
    </div>
  `;
}

// ===============================
// DESCARGAR BOLETA PDF
// ===============================
document.getElementById('downloadBoletaBtn')?.addEventListener('click', () => {
  if (!estudianteData) {
    alert('⚠️ No hay datos para generar la boleta');
    return;
  }
  
  generarBoletaPDF();
});

function generarBoletaPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('BOLETA DE CALIFICACIONES', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Estudiante: ${estudianteData.nombre}`, 20, 40);
    doc.text(`Cédula: ${estudianteData.cedula}`, 20, 48);
    doc.text(`Grado: ${document.getElementById('studentGrade').textContent}`, 20, 56);
    doc.text(`Paralelo: ${document.getElementById('studentParalelo').textContent}`, 20, 64);
    
    doc.line(20, 70, 190, 70);
    
    let y = 80;
    
    doc.setFontSize(14);
    doc.text(`Asignaturas Matriculadas: ${asignaturasDelEstudiante.length}`, 20, y);
    y += 10;
    
    asignaturasDelEstudiante.forEach((asig, i) => {
      doc.setFontSize(11);
      doc.text(`${i+1}. ${asig.asignatura_nombre} - Docente: ${asig.docente_nombre || 'Sin asignar'}`, 25, y);
      y += 7;
    });
    
    doc.save(`Boleta_${estudianteData.cedula}_${new Date().getFullYear()}.pdf`);
    
    alert('✅ Boleta descargada exitosamente');
  } catch (error) {
    console.error('Error generando PDF:', error);
    alert('❌ Error al descargar la boleta');
  }
}

// ===============================
// INICIALIZAR
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  console.log('\n========================================');
  console.log('🚀 Inicializando portal de estudiante');
  console.log('========================================\n');
  
  verificarAuth();
});