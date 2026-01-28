// ===============================
// FUNCIÓN FETCH MEJORADA
// ===============================
// ===============================
// FUNCIÓN FETCH MEJORADA (ANTI-HTML)
// ===============================
async function fetchSafe(url, options = {}) {
  try {
    console.log(`📡 Fetch: ${url}`);
    const res = await fetch(url, options);
    
    // Verificar estado HTTP
    if (!res.ok) {
      let errorText = 'Error en el servidor';
      try {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          errorText = errorData.error || errorData.message || errorText;
        } else {
          errorText = await res.text();
          console.error('❌ Respuesta HTML en lugar de JSON:', errorText.substring(0, 300));
        }
      } catch (e) {
        console.error('No se pudo leer el error');
      }
      console.error(`❌ HTTP ${res.status}:`, errorText.substring(0, 200));
      return { 
        success: false, 
        error: `Error ${res.status}: ${res.statusText}` 
      };
    }
    
    // ⭐ VERIFICAR QUE SEA JSON ANTES DE PARSEAR
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const htmlText = await res.text();
      console.error(`❌ El servidor devolvió HTML en lugar de JSON:`);
      console.error(`   URL: ${url}`);
      console.error(`   Content-Type: ${contentType}`);
      console.error(`   Contenido:`, htmlText.substring(0, 500));
      
      // Intentar extraer el error del HTML
      let errorMsg = 'El servidor devolvió HTML en lugar de JSON';
      if (htmlText.includes('<title>Error</title>')) {
        errorMsg = 'Error del servidor (ver consola para detalles)';
      }
      
      return { 
        success: false, 
        error: errorMsg
      };
    }
    
    const data = await res.json();
    console.log(`✅ Respuesta OK:`, data.success ? 'Éxito' : 'Error');
    return data;
    
  } catch (error) {
    console.error(`🔥 Error fetch:`, error.message);
    return { 
      success: false, 
      error: `Error de conexión: ${error.message}` 
    };
  }
}
// ===============================
// VERIFICAR AUTENTICACIÓN
// ===============================
async function verificarAuth() {
  try {
    const res = await fetch('/api/auth/verify');
    const data = await res.json();
    
    if (!data.authenticated) {
      window.location.href = '/';
      return;
    }
    
    document.getElementById('userInfo').textContent = 
      `${data.user.fullname} (${data.user.role})`;
    
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
// CARGAR USUARIOS SEPARADOS POR ROL
// ===============================
async function cargarUsuarios() {
  try {
    const res = await fetch('/api/admin/usuarios');
    const data = await res.json();
    
    if (data.success) {
      mostrarUsuariosSeparados(data.usuarios);
    }
  } catch (error) {
    console.error('Error cargando usuarios:', error);
  }
}

function mostrarUsuariosSeparados(usuarios) {
  // Separar por roles
  const admins = usuarios.filter(u => u.role === 'admin');
  const docentes = usuarios.filter(u => u.role === 'docente');
  const estudiantes = usuarios.filter(u => u.role === 'estudiante');
  
  mostrarTablaUsuarios('adminTableBody', admins);
  mostrarTablaUsuarios('docenteTableBody', docentes);
  mostrarTablaUsuarios('estudianteTableBody', estudiantes);
}

function mostrarTablaUsuarios(tbodyId, usuarios) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay usuarios de este tipo</td></tr>';
    return;
  }
  
  usuarios.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td>${user.fullname}</td>
      <td>${user.email}</td>
      <td><span class="badge bg-${user.active ? 'success' : 'danger'}">${user.active ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editarUsuario(${user.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${user.id})" ${user.id === 1 ? 'disabled' : ''}>
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===============================
// CREAR USUARIO
// ===============================
document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userData = {
    username: document.getElementById('newUsername').value.trim(),
    password: document.getElementById('newPassword').value.trim(),
    fullname: document.getElementById('newFullName').value.trim(),
    email: document.getElementById('newEmail').value.trim(),
    role: document.getElementById('newRole').value
  };
  
  try {
    const res = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Usuario creado exitosamente');
      e.target.reset();
      cargarUsuarios();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error creando usuario:', error);
    alert('❌ Error de conexión');
  }
});

// ===============================
// ELIMINAR USUARIO
// ===============================
async function eliminarUsuario(userId) {
  // Protección del administrador principal
  if (userId === 1) {
    alert('❌ No se puede eliminar el usuario administrador principal');
    return;
  }
  
  // Obtener información del usuario
  try {
    const resUsuarios = await fetch('/api/admin/usuarios');
    const dataUsuarios = await resUsuarios.json();
    
    if (!dataUsuarios.success) {
      alert('❌ Error cargando información del usuario');
      return;
    }
    
    const usuario = dataUsuarios.usuarios.find(u => u.id === userId);
    
    if (!usuario) {
      alert('❌ Usuario no encontrado');
      return;
    }
    
    // Confirmación según el rol
    let mensajeConfirmacion = `⚠️ ¿Está seguro de eliminar este usuario?\n\n`;
    mensajeConfirmacion += `Usuario: ${usuario.username}\n`;
    mensajeConfirmacion += `Nombre: ${usuario.fullname}\n`;
    mensajeConfirmacion += `Rol: ${usuario.role}\n\n`;
    
    if (usuario.role === 'docente') {
      mensajeConfirmacion += `⚠️ ADVERTENCIA: Este usuario es DOCENTE.\n`;
      mensajeConfirmacion += `Si tiene clases asignadas, quedarán sin docente.\n\n`;
    } else if (usuario.role === 'estudiante') {
      mensajeConfirmacion += `⚠️ ADVERTENCIA: Este usuario es ESTUDIANTE.\n`;
      mensajeConfirmacion += `Se eliminarán sus matrículas y calificaciones.\n\n`;
    }
    
    mensajeConfirmacion += `Esta acción NO se puede deshacer.`;
    
    if (!confirm(mensajeConfirmacion)) return;
    
    // Segunda confirmación para roles críticos
    if (usuario.role === 'admin' || usuario.role === 'docente') {
      const confirmacion2 = confirm(`🚨 SEGUNDA CONFIRMACIÓN\n\n¿Realmente desea eliminar este ${usuario.role}?`);
      if (!confirmacion2) return;
    }
    
    // Proceder con la eliminación
    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Usuario eliminado exitosamente');
      cargarUsuarios();
    } else {
      alert('❌ Error: ' + data.error);
    }
    
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    alert('❌ Error de conexión');
  }
}

async function editarUsuario(userId) {
  try {
    // Obtener datos actuales del usuario
    const res = await fetch('/api/admin/usuarios');
    const data = await res.json();
    
    if (!data.success) {
      alert('❌ Error cargando usuarios');
      return;
    }
    
    const usuario = data.usuarios.find(u => u.id === userId);
    
    if (!usuario) {
      alert('❌ Usuario no encontrado');
      return;
    }
    
    // Crear modal de edición
    const modalHtml = `
      <div class="modal fade" id="modalEditarUsuario" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Usuario
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="formEditarUsuario">
                <div class="mb-3">
                  <label class="form-label">Usuario (no editable)</label>
                  <input type="text" class="form-control" value="${usuario.username}" disabled>
                  <small class="text-muted">El nombre de usuario no se puede modificar</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Nombre Completo</label>
                  <input type="text" class="form-control" id="editUserFullname" value="${usuario.fullname}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" id="editUserEmail" value="${usuario.email}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Rol (no editable)</label>
                  <input type="text" class="form-control" value="${usuario.role}" disabled>
                  <small class="text-muted">El rol no se puede modificar</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Estado</label>
                  <select class="form-select" id="editUserActive">
                    <option value="1" ${usuario.active ? 'selected' : ''}>Activo</option>
                    <option value="0" ${!usuario.active ? 'selected' : ''}>Inactivo</option>
                  </select>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionUsuario(${userId})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalEditarUsuario');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalEditarUsuario'));
    modal.show();
    
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

async function guardarEdicionUsuario(userId) {
  const fullname = document.getElementById('editUserFullname').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const active = parseInt(document.getElementById('editUserActive').value);
  
  if (!fullname || !email) {
    alert('⚠️ Nombre y email son obligatorios');
    return;
  }
  
  try {
    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname, email, active })
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Usuario actualizado exitosamente');
      
      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
      modal.hide();
      
      // Recargar lista de usuarios
      cargarUsuarios();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}
// ===============================
// CARGAR CLASES
// ===============================
async function cargarClases() {
  try {
    const res = await fetch('/api/clases');
    const data = await res.json();
    
    if (data.success) {
      mostrarClases(data.clases);
    }
  } catch (error) {
    console.error('Error cargando clases:', error);
  }
}


function mostrarClases(clases) {
  const tbody = document.getElementById('classesTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (clases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay clases registradas</td></tr>';
    return;
  }
  
  clases.forEach(clase => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${clase.id}</td>
      <td>${clase.asignatura_nombre || 'N/A'}</td>
      <td>${clase.grado}</td>
      <td>${clase.curso}</td>
      <td>${clase.paralelo}</td>
      <td>${clase.docente_nombre || 'Sin asignar'}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editarClase(${clase.id}, '${clase.asignatura_nombre}', '${clase.grado}', '${clase.curso}', '${clase.paralelo}', ${clase.docente_id || 'null'})" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarClase(${clase.id})" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===============================
// CARGAR DOCENTES PARA SELECT
// ===============================
// Esta función ya debería existir, verifica que esté completa:
async function cargarDocentes() {
  try {
    const res = await fetch('/api/docentes');
    const data = await res.json();
    
    if (data.success) {
      // Selector para crear clase
      const selectCrear = document.getElementById('newDocenteId');
      if (selectCrear) {
        selectCrear.innerHTML = '<option value="">Sin docente asignado</option>';
        data.docentes.forEach(doc => {
          selectCrear.innerHTML += `<option value="${doc.id}">${doc.fullname}</option>`;
        });
      }

      // Selector para asignar docente a grado (NUEVO)
      const selectAsignar = document.getElementById('docenteAsignatura');
      if (selectAsignar) {
        selectAsignar.innerHTML = '<option value="">Seleccionar Docente</option>';
        data.docentes.forEach(doc => {
          selectAsignar.innerHTML += `<option value="${doc.id}">${doc.fullname}</option>`;
        });
      }
    }
  } catch (error) {
    console.error('Error cargando docentes:', error);
  }
}

// ===============================
// CREAR CLASE
document.getElementById('createClassForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nombreMateria = document.getElementById('newAsignaturaNombre')?.value.trim();
  const grado = document.getElementById('newGrado')?.value.trim();
  const curso = document.getElementById('newCurso')?.value.trim();
  const paralelo = document.getElementById('newParalelo')?.value.trim();
  const docente_id = document.getElementById('newDocenteId')?.value || null;

  if (!nombreMateria || !grado || !curso || !paralelo) {
    alert('⚠️ Por favor complete todos los campos obligatorios');
    return;
  }

  const claseData = {
    nombreMateria: nombreMateria,
    grado: grado,
    curso: curso,
    paralelo: paralelo,
    docente_id: docente_id,
    subnivel_id: 4
  };
  
  console.log('📤 Enviando al servidor:', claseData);
  
  try {
    const res = await fetch('/api/clases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claseData)
    });
    
    const data = await res.json();
    console.log('📥 Respuesta del servidor:', data);
    
    if (data.success) {
      alert('✅ Clase creada exitosamente');
      e.target.reset();
      cargarClases();
      cargarClasesParaEstudiantes();
      cargarClasesParaCalificaciones();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
});

// ===============================
// ELIMINAR CLASE
// ===============================
async function eliminarClase(claseId) {
  try {
    // Verificar si hay estudiantes matriculados
    const resEstudiantes = await fetch(`/api/estudiantes/clase/${claseId}`);
    const dataEstudiantes = await resEstudiantes.json();
    
    let mensajeConfirmacion = '⚠️ ¿Está seguro de eliminar esta clase?\n\n';
    
    if (dataEstudiantes.success && dataEstudiantes.estudiantes.length > 0) {
      mensajeConfirmacion += `🚨 ADVERTENCIA: Esta clase tiene ${dataEstudiantes.estudiantes.length} estudiante(s) matriculado(s).\n\n`;
      mensajeConfirmacion += 'Al eliminar la clase se eliminarán:\n';
      mensajeConfirmacion += '• Todas las matrículas\n';
      mensajeConfirmacion += '• Todas las calificaciones\n';
      mensajeConfirmacion += '• Todas las tareas y actividades\n';
      mensajeConfirmacion += '• La configuración de tareas\n\n';
      mensajeConfirmacion += 'Esta acción NO se puede deshacer.\n\n';
      mensajeConfirmacion += '¿Desea continuar?';
      
      if (!confirm(mensajeConfirmacion)) return;
      
      // Segunda confirmación para clases con estudiantes
      const confirmacion2 = confirm('🚨 SEGUNDA CONFIRMACIÓN\n\n¿Realmente desea eliminar esta clase y TODOS sus datos asociados?');
      if (!confirmacion2) return;
      
    } else {
      mensajeConfirmacion += 'Esta clase no tiene estudiantes matriculados.\n\n';
      mensajeConfirmacion += '¿Desea eliminarla?';
      
      if (!confirm(mensajeConfirmacion)) return;
    }
    
    // Proceder con la eliminación
    const res = await fetch(`/api/clases/${claseId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Clase eliminada exitosamente');
      cargarClases();
      cargarClasesParaEstudiantes();
      cargarClasesParaCalificaciones();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error eliminando clase:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// INVENTARIO
// ===============================
async function cargarInventario() {
  try {
    const res = await fetch('/api/inventario');
    const data = await res.json();
    
    if (data.success) {
      mostrarInventario(data.inventario);
    }
  } catch (error) {
    console.error('Error cargando inventario:', error);
  }
}

function mostrarInventario(inventario) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  inventario.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.tipo}</td>
      <td>${item.ubicacion}</td>
      <td><span class="badge bg-${getEstadoBadge(item.estado)}">${item.estado}</span></td>
      <td>${item.descripcion || '-'}</td>
      <td>
        <!-- Botones nuevos + el de eliminar -->
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-info" 
                  onclick="verActivo(${item.id})" 
                  title="Ver detalle">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-warning" 
                  onclick="editarActivo(${item.id})" 
                  title="Editar activo">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger" 
                  onclick="eliminarActivo(${item.id})" 
                  title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function getEstadoBadge(estado) {
  const badges = {
    'Operativo': 'success',
    'Mantenimiento': 'warning',
    'Desuso': 'danger'
  };
  return badges[estado] || 'secondary';
}

document.getElementById('assetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const assetData = {
    codigo: document.getElementById('codActivo').value.trim(),
    tipo: document.getElementById('tipoEquipo').value,
    ubicacion: document.getElementById('ubicacion').value.trim(),
    estado: document.getElementById('estado').value,
    descripcion: document.getElementById('descripcion').value.trim()
  };
  
  try {
    const res = await fetch('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetData)
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Activo registrado exitosamente');
      e.target.reset();
      cargarInventario();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error creando activo:', error);
    alert('❌ Error de conexión');
  }
});

async function eliminarActivo(id) {
  if (!confirm('¿Está seguro de eliminar este activo?')) return;
  
  try {
    const res = await fetch(`/api/inventario/${id}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Activo eliminado');
      cargarInventario();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error eliminando activo:', error);
  }
}

// ===============================
// ACCESIBILIDAD
// ===============================


// ===============================
// ACCESIBILIDAD - VERSIÓN MEJORADA CON TABLA
// ===============================



document.getElementById('saveAccessibilityBtn')?.addEventListener('click', async () => {
  const politicasData = {
    // Sección 1: Políticas Institucionales
    politica_general: document.getElementById('politica_general').value,
    adaptaciones_tecnologicas: document.getElementById('adaptaciones_tecnologicas').value,
    plan_capacitacion: document.getElementById('plan_capacitacion').value,
    revision_fecha: document.getElementById('revision_fecha').value,
    responsable: document.getElementById('responsable').value,
    
    // Sección 2: Infraestructura ⭐ ESTOS FALTABAN
    rampas: document.getElementById('rampas').value,
    banos: document.getElementById('banos').value,
    elevadores: document.getElementById('elevadores').value,
    inventario_recursos: document.getElementById('inventario_recursos').value,
    
    // Sección 3: Organización ⭐ ESTOS FALTABAN
    comite: document.getElementById('comite').value,
    contacto: document.getElementById('contacto').value
  };
  
  try {
    const res = await fetch('/api/accesibilidad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(politicasData)
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Políticas de accesibilidad guardadas exitosamente');
      cargarAccesibilidad(); // Recargar para actualizar la tabla
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error guardando políticas:', error);
    alert('❌ Error de conexión');
  }
});

// ===============================
// GESTIÓN DE ESTUDIANTES POR CLASE
// ===============================
async function cargarClasesParaEstudiantes() {
  try {
    const res = await fetch('/api/clases');
    const data = await res.json();
    
    if (data.success) {
      const select = document.getElementById('adminClaseEstudiantesSelector');
      if (select) {
        select.innerHTML = '<option value="">Seleccione una clase para gestionar estudiantes</option>';
        data.clases.forEach(clase => {
          const texto = `${clase.grado} ${clase.curso} - ${clase.paralelo} | ${clase.asignatura_nombre} | ${clase.docente_nombre || 'Sin docente'}`;
          select.innerHTML += `<option value="${clase.id}">${texto}</option>`;
        });
      }
    }
  } catch (error) {
    console.error('Error cargando clases:', error);
  }
}

document.getElementById('adminClaseEstudiantesSelector')?.addEventListener('change', async (e) => {
  const claseId = e.target.value;
  const formulario = document.getElementById('adminFormEstudiante');
  
  if (!claseId) {
    formulario.style.display = 'none';
    return;
  }
  
  formulario.style.display = 'block';
  
  try {
    const res = await fetch(`/api/estudiantes/clase/${claseId}`);
    const data = await res.json();
    
    if (data.success) {
      mostrarEstudiantesAdmin(data.estudiantes);
    }
  } catch (error) {
    console.error('Error cargando estudiantes:', error);
  }
});

function mostrarEstudiantesAdmin(estudiantes) {
  const tbody = document.getElementById('adminStudentsTableBody');
  if (!tbody) return;
  
  // Guardar clase seleccionada globalmente
  claseSeleccionada = document.getElementById('adminClaseEstudiantesSelector').value;
  
  tbody.innerHTML = '';
  
  if (estudiantes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay estudiantes matriculados</td></tr>';
    return;
  }
  
  estudiantes.forEach(est => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${est.cedula}</td>
      <td>${est.nombre}</td>
      <td>${est.genero}</td>
      <td><span class="badge bg-success">Matriculado</span></td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editarEstudiante(${est.id}, '${est.nombre.replace(/'/g, "\\'")}', '${est.genero}', '${est.adaptacion_curricular || 'Ninguna'}')" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger me-1" onclick="desmatricularEstudiante(${est.id}, ${claseSeleccionada})" title="Desmatricular de esta clase">
          <i class="bi bi-x-circle"></i>
        </button>
        <button class="btn btn-sm btn-dark" onclick="eliminarEstudianteCompleto(${est.id})" title="Eliminar completamente">
          <i class="bi bi-trash3"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('adminAddStudentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const claseId = document.getElementById('adminClaseEstudiantesSelector').value;
  
  if (!claseId) {
    alert('⚠️ Primero seleccione una clase');
    return;
  }
  
  // Capturar TODOS los datos incluyendo el nuevo campo período
  const estudianteData = {
    cedula: document.getElementById('adminStudentCedula').value.trim(),
    nombre: document.getElementById('adminStudentName').value.trim(),
    genero: document.getElementById('adminStudentGender').value,
    periodo_lectivo: document.getElementById('adminStudentPeriodo')?.value?.trim() || '2025-2026', // ⭐ Con valor por defecto
    adaptacion_curricular: 'Ninguna',
    clase_id: claseId // ⭐ NUEVO: Enviamos la clase directamente
  };
  
  try {
    // ⭐ AHORA SOLO UNA LLAMADA - El backend hace todo automáticamente
    const res = await fetch('/api/estudiantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estudianteData)
    });
    
    const data = await res.json();
    
    if (data.success) {
      // ⭐ Mostrar mensaje con credenciales generadas
      alert(`✅ ${data.message}\n\n🔑 Credenciales generadas:\nUsuario: ${data.credenciales.usuario}\nContraseña: ${data.credenciales.contraseña}`);
      e.target.reset();
      document.getElementById('adminClaseEstudiantesSelector').dispatchEvent(new Event('change'));
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
});

function verDetallesEstudiante(id) {
  alert(`Ver detalles del estudiante ID: ${id}\n(Función por implementar)`);
}

// ===============================
// CALIFICACIONES CON SELECTOR DE PARÁMETROS
// ===============================
let datosCalificacionesActuales = null;
let claseSeleccionadaId = null;

async function cargarClasesParaCalificaciones() {
  try {
    const res = await fetch('/api/clases');
    const data = await res.json();
    
    if (data.success) {
      const select = document.getElementById('adminClaseCalificacionesSelector');
      if (select) {
        select.innerHTML = '<option value="">Seleccione una clase</option>';
        data.clases.forEach(clase => {
          const texto = `${clase.grado} ${clase.curso} - ${clase.paralelo} | ${clase.asignatura_nombre} | ${clase.docente_nombre || 'Sin docente'}`;
          select.innerHTML += `<option value="${clase.id}">${texto}</option>`;
        });
      }
    }
  } catch (error) {
    console.error('Error cargando clases:', error);
  }
}

document.getElementById('adminClaseCalificacionesSelector')?.addEventListener('change', async (e) => {
  claseSeleccionadaId = e.target.value;
  const selectorParam = document.getElementById('adminSelectorParametros');
  const container = document.getElementById('adminCalificacionesContainer');
  
  if (!claseSeleccionadaId) {
    selectorParam.style.display = 'none';
    container.innerHTML = '<p class="text-muted text-center">Seleccione una clase y un parámetro para ver los datos</p>';
    datosCalificacionesActuales = null;
    return;
  }
  
  container.innerHTML = '<div class="text-center"><div class="spinner-border"></div><p>Cargando datos...</p></div>';
  
  try {
    const res = await fetch(`/api/calificaciones/clase/${claseSeleccionadaId}`);
    const data = await res.json();
    
    if (data.success) {
      datosCalificacionesActuales = data.estudiantes;
      selectorParam.style.display = 'block';
      container.innerHTML = '<p class="text-muted text-center">Seleccione un parámetro para visualizar</p>';
      
      // Limpiar selección anterior
      document.querySelectorAll('.btn-param').forEach(btn => {
        btn.classList.remove('active');
      });
    } else {
      container.innerHTML = `<p class="text-danger text-center">Error: ${data.error}</p>`;
    }
  } catch (error) {
    console.error('Error cargando calificaciones:', error);
    container.innerHTML = '<p class="text-danger text-center">Error de conexión</p>';
  }
});

// Manejo de botones de parámetros
document.querySelectorAll('.btn-param').forEach(btn => {
  btn.addEventListener('click', function() {
    if (!datosCalificacionesActuales) {
      alert('⚠️ Primero seleccione una clase');
      return;
    }
    
    // Quitar clase active de todos
    document.querySelectorAll('.btn-param').forEach(b => b.classList.remove('active'));
    // Agregar active al clickeado
    this.classList.add('active');
    
    const parametro = this.getAttribute('data-param');
    mostrarParametroSeleccionado(parametro);
  });
});

function mostrarParametroSeleccionado(parametro) {
  const container = document.getElementById('adminCalificacionesContainer');
  
  switch(parametro) {
    case 'trimestre1':
      container.innerHTML = generarTablaTrimestre(1, datosCalificacionesActuales);
      break;
    case 'trimestre2':
      container.innerHTML = generarTablaTrimestre(2, datosCalificacionesActuales);
      break;
    case 'trimestre3':
      container.innerHTML = generarTablaTrimestre(3, datosCalificacionesActuales);
      break;
    case 'anual':
      container.innerHTML = generarTablaAnual(datosCalificacionesActuales);
      break;
    case 'supletorios':
      container.innerHTML = generarTablaSupletorios(datosCalificacionesActuales);
      break;
    default:
      container.innerHTML = '<p class="text-muted text-center">Parámetro no reconocido</p>';
  }
}

function generarTablaTrimestre(trimestre, estudiantes) {
  let html = `
    <div class="card p-4">
      <h4 class="text-primary mb-3">
        <i class="bi bi-journal-bookmark-fill me-2"></i>
        Trimestre ${trimestre}
      </h4>
      <div class="table-responsive">
        <table class="table table-bordered table-hover">
          <thead class="table-dark">
            <tr>
              <th>Estudiante</th>
              <th class="text-center">T1</th>
              <th class="text-center">T2</th>
              <th class="text-center">T3</th>
              <th class="text-center">T4</th>
              <th class="text-center">Prom. Tareas</th>
              <th class="text-center">Examen</th>
              <th class="text-center">Proyecto</th>
              <th class="text-center">Promedio Final</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  estudiantes.forEach(est => {
    const t = est.trimestres[trimestre] || { tareas: {}, examen: 0, proyecto: 0, promedio: 0 };
    const tareas = t.tareas || {};
    
    const promedioTareas = Object.values(tareas).length > 0
      ? (Object.values(tareas).reduce((a, b) => a + b, 0) / Object.values(tareas).length).toFixed(2)
      : '0.00';
    
    const badgeClass = t.promedio >= 7 ? 'success' : t.promedio >= 5 ? 'warning' : 'danger';
    
    html += `
      <tr>
        <td><strong>${est.nombre}</strong></td>
        <td class="text-center">${(tareas[1] || 0).toFixed(2)}</td>
        <td class="text-center">${(tareas[2] || 0).toFixed(2)}</td>
        <td class="text-center">${(tareas[3] || 0).toFixed(2)}</td>
        <td class="text-center">${(tareas[4] || 0).toFixed(2)}</td>
        <td class="text-center"><strong>${promedioTareas}</strong></td>
        <td class="text-center">${(t.examen || 0).toFixed(2)}</td>
        <td class="text-center">${(t.proyecto || 0).toFixed(2)}</td>
        <td class="text-center">
          <span class="badge bg-${badgeClass} fs-6">${(t.promedio || 0).toFixed(2)}</span>
        </td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
      <div class="alert alert-info mt-2">
        <small>
          <i class="bi bi-info-circle me-1"></i>
          <strong>Fórmula:</strong> Promedio = (Tareas × 0.70) + (Examen × 0.15) + (Proyecto × 0.15)
        </small>
      </div>
    </div>
  `;
  
  return html;
}

function generarTablaAnual(estudiantes) {
  let html = `
    <div class="card p-4 border-success">
      <h4 class="text-success mb-3">
        <i class="bi bi-trophy-fill me-2"></i>
        Promedio Anual
      </h4>
      <div class="table-responsive">
        <table class="table table-bordered table-hover">
          <thead class="table-success">
            <tr>
              <th>Estudiante</th>
              <th class="text-center">Promedio T1</th>
              <th class="text-center">Promedio T2</th>
              <th class="text-center">Promedio T3</th>
              <th class="text-center">Promedio Anual</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  estudiantes.forEach(est => {
    const p1 = (est.trimestres[1]?.promedio || 0).toFixed(2);
    const p2 = (est.trimestres[2]?.promedio || 0).toFixed(2);
    const p3 = (est.trimestres[3]?.promedio || 0).toFixed(2);
    const promAnual = (est.promedio_anual || 0).toFixed(2);
    const estado = est.estado || 'Pendiente';
    
    const badgeClass = 
      estado === 'Aprobado' ? 'success' : 
      estado === 'Supletorio' ? 'warning' : 
      estado === 'Reprobado' ? 'danger' : 'secondary';
    
    html += `
      <tr>
        <td><strong>${est.nombre}</strong></td>
        <td class="text-center">${p1}</td>
        <td class="text-center">${p2}</td>
        <td class="text-center">${p3}</td>
        <td class="text-center"><strong class="fs-5">${promAnual}</strong></td>
        <td class="text-center">
          <span class="badge bg-${badgeClass} fs-6">${estado}</span>
        </td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return html;
}

function generarTablaSupletorios(estudiantes) {
  const estudiantesSupletorio = estudiantes.filter(e => {
    const promAnual = e.promedio_anual || 0;
    return promAnual >= 5 && promAnual < 7;
  });
  
  if (estudiantesSupletorio.length === 0) {
    return `<div class="card p-4 border-success">
        <h4 class="text-success">
          <i class="bi bi-check-circle-fill me-2"></i>
          Supletorios
        </h4>
        <p class="text-muted text-center mb-0">
          ✅ No hay estudiantes que requieran examen supletorio
        </p>
      </div>
    `;
  }
  
  let html = `
    <div class="card p-4 border-warning">
      <h4 class="text-warning mb-3">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        Estudiantes a Supletorio (Promedio 5.00 - 6.99)
      </h4>
      <div class="table-responsive">
        <table class="table table-bordered table-hover">
          <thead class="table-warning">
            <tr>
              <th>Estudiante</th>
              <th class="text-center">Promedio Anual</th>
              <th class="text-center">Nota Supletorio</th>
              <th class="text-center">Nota Final</th>
              <th class="text-center">Estado Final</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  estudiantesSupletorio.forEach(est => {
    const promAnual = (est.promedio_anual || 0).toFixed(2);
    const sup = est.supletorio || {};
    const notaSup = (sup.nota || 0).toFixed(2);
    const notaFinal = (sup.nota_final || 0).toFixed(2);
    const estadoFinal = sup.estado || 'Pendiente';
    
    const badgeClass = 
      estadoFinal === 'Aprobado (S)' ? 'success' : 
      estadoFinal === 'Reprobado (S)' ? 'danger' : 'secondary';
    
    html += `
      <tr>
        <td><strong>${est.nombre}</strong></td>
        <td class="text-center">${promAnual}</td>
        <td class="text-center">${notaSup}</td>
        <td class="text-center"><strong>${notaFinal}</strong></td>
        <td class="text-center">
          <span class="badge bg-${badgeClass}">${estadoFinal}</span>
        </td>
      </tr>
    `;
  });
  
  html += `
          </tbody>
        </table>
      </div>
      <div class="alert alert-warning mt-2">
        <small>
          <i class="bi bi-info-circle me-1"></i>
          <strong>Fórmula Supletorio:</strong> Nota Final = (Promedio Anual × 0.50) + (Supletorio × 0.50)
        </small>
      </div>
    </div>
  `;
  
  return html;
}

// ===============================
// EDITAR ESTUDIANTE
// ===============================
let estudianteEditandoId = null;
let claseSeleccionada = null;

function editarEstudiante(id, nombre, genero, adaptacion) {
  estudianteEditandoId = id;
  
  // Crear modal de edición
  const modalHtml = `
    <div class="modal fade" id="modalEditarEstudiante" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-warning">
            <h5 class="modal-title">
              <i class="bi bi-pencil-square me-2"></i>Editar Estudiante
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="formEditarEstudiante">
              <div class="mb-3">
                <label class="form-label">Nombre completo</label>
                <input type="text" class="form-control" id="editNombre" value="${nombre}" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Género</label>
                <select class="form-select" id="editGenero" required>
                  <option value="Masculino" ${genero === 'Masculino' ? 'selected' : ''}>Masculino</option>
                  <option value="Femenino" ${genero === 'Femenino' ? 'selected' : ''}>Femenino</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Adaptación Curricular</label>
                <input type="text" class="form-control" id="editAdaptacion" value="${adaptacion}">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-warning" onclick="guardarEdicionEstudiante()">
              <i class="bi bi-save me-1"></i>Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Eliminar modal anterior si existe
  const modalAnterior = document.getElementById('modalEditarEstudiante');
  if (modalAnterior) modalAnterior.remove();
  
  // Agregar modal al DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('modalEditarEstudiante'));
  modal.show();
}

async function guardarEdicionUsuario(userId) {
  const fullname = document.getElementById('editUserFullname').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const active = parseInt(document.getElementById('editUserActive').value);
  
  if (!fullname || !email) {
    alert('⚠️ Nombre y email son obligatorios');
    return;
  }
  
  try {
    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname, email, active })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Usuario actualizado exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await cargarUsuarios();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ===============================
// DESMATRICULAR ESTUDIANTE
// ===============================
async function desmatricularEstudiante(estudianteId, claseId) {
  if (!confirm('⚠️ ¿Desea DESMATRICULAR a este estudiante de esta clase?\n\nEl estudiante y su usuario seguirán existiendo en el sistema, solo se eliminará de esta clase específica.')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/estudiantes/${estudianteId}/clase/${claseId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Estudiante desmatriculado de esta clase');
      document.getElementById('adminClaseEstudiantesSelector').dispatchEvent(new Event('change'));
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// EDITAR CLASE
// ===============================
async function editarClase(claseId, materia, grado, curso, paralelo, docenteId) {
  try {
    // Cargar lista de docentes
    const resDocentes = await fetch('/api/docentes');
    const dataDocentes = await resDocentes.json();
    
    if (!dataDocentes.success) {
      alert('❌ Error cargando docentes');
      return;
    }
    
    // Construir opciones de docentes
    let opcionesDocentes = '<option value="">Sin docente asignado</option>';
    dataDocentes.docentes.forEach(doc => {
      const selected = doc.id === docenteId ? 'selected' : '';
      opcionesDocentes += `<option value="${doc.id}" ${selected}>${doc.fullname}</option>`;
    });
    
    // Crear modal de edición
    const modalHtml = `
      <div class="modal fade" id="modalEditarClase" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Clase
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                <strong>Materia actual:</strong> ${materia}
                <br><small class="text-muted">La materia no se puede cambiar. Si necesita cambiarla, elimine esta clase y cree una nueva.</small>
              </div>
              <form id="formEditarClase">
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label">Grado</label>
                    <input type="text" class="form-control" id="editClaseGrado" list="editGradosList" value="${grado}" required>
                    <datalist id="editGradosList">
                      <option value="1ro">
                      <option value="2do">
                      <option value="3ro">
                      <option value="4to">
                      <option value="5to">
                      <option value="6to">
                      <option value="7mo">
                      <option value="8vo">
                      <option value="9no">
                      <option value="10mo">
                      <option value="1ro de Bachillerato">
                      <option value="2do de Bachillerato">
                      <option value="3ro de Bachillerato">
                    </datalist>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Curso</label>
                    <input type="text" class="form-control" id="editClaseCurso" list="editCursosList" value="${curso}" required>
                    <datalist id="editCursosList">
                      <option value="EGB">
                      <option value="BGU">
                    </datalist>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Paralelo</label>
                    <input type="text" class="form-control" id="editClaseParalelo" list="editParalelosList" value="${paralelo}" required>
                    <datalist id="editParalelosList">
                      <option value="A">
                      <option value="B">
                      <option value="C">
                      <option value="D">
                    </datalist>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Docente Asignado</label>
                    <select class="form-select" id="editClaseDocente">
                      ${opcionesDocentes}
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionClase(${claseId})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalEditarClase');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalEditarClase'));
    modal.show();
    
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

async function guardarEdicionClase(claseId) {
  const grado = document.getElementById('editClaseGrado').value.trim();
  const curso = document.getElementById('editClaseCurso').value.trim();
  const paralelo = document.getElementById('editClaseParalelo').value.trim();
  const docenteId = document.getElementById('editClaseDocente').value || null;
  
  if (!grado || !curso || !paralelo) {
    alert('⚠️ Grado, curso y paralelo son obligatorios');
    return;
  }
  
  try {
    const res = await fetch(`/api/clases/${claseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grado: grado,
        curso: curso,
        paralelo: paralelo,
        docente_id: docenteId
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Clase actualizada exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarClase'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await cargarClases();
      await cargarClasesParaEstudiantes();
      await cargarClasesParaCalificaciones();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error: ' + error.message);
  }
}
// ===============================
// ELIMINAR ESTUDIANTE COMPLETO
// ===============================
async function eliminarEstudianteCompleto(estudianteId) {
  const confirmacion1 = confirm('⚠️ ¿Está seguro que desea ELIMINAR COMPLETAMENTE a este estudiante?\n\nEsta acción eliminará:\n- El estudiante\n- Su usuario de acceso\n- Todas sus matrículas\n- Todas sus calificaciones\n- Todo su historial\n\nEsta acción NO se puede deshacer.');
  
  if (!confirmacion1) return;
  
  const confirmacion2 = confirm('🚨 CONFIRMACIÓN FINAL\n\n¿Realmente desea eliminar PERMANENTEMENTE este estudiante y TODA su información?\n\nEscriba OK en el siguiente cuadro para confirmar.');
  
  if (!confirmacion2) return;
  
  const confirmacionTexto = prompt('Escriba OK (en mayúsculas) para confirmar la eliminación:');
  
  if (confirmacionTexto !== 'OK') {
    alert('❌ Eliminación cancelada');
    return;
  }
  
  try {
    const res = await fetch(`/api/estudiantes/${estudianteId}/completo`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Estudiante eliminado completamente del sistema');
      document.getElementById('adminClaseEstudiantesSelector').dispatchEvent(new Event('change'));
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Realizado');
  }
}


// ===============================
// MANTENIMIENTO - GESTIÓN COMPLETA
// ===============================

// ============================================
// 1. CARGAR TAREAS DE MANTENIMIENTO (Cronograma)
// ============================================
async function cargarTareasMantenimiento() {
  try {
    const res = await fetch('/api/mantenimiento/tareas');
    const data = await res.json();
    
    if (data.success) {
      mostrarTareasMantenimiento(data.tareas);
      // También cargar en el selector para registrar mantenimiento
      cargarTareasEnSelector(data.tareas);
    }
  } catch (error) {
    console.error('Error cargando tareas:', error);
  }
}

function mostrarTareasMantenimiento(tareas) {
  const tbody = document.getElementById('tablaTareasMantenimiento');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (tareas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay tareas configuradas</td></tr>';
    return;
  }

  tareas.forEach(tarea => {
    const frecuenciaTexto = {
      'M': 'Mensual',
      'B': 'Bimestral',
      'S': 'Semestral',
      'N': 'Nunca/Única'
    }[tarea.frecuencia] || tarea.frecuencia;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tarea.id}</td>
      <td>${tarea.nombre}</td>
      <td>
        <span class="badge bg-${getFrecuenciaBadge(tarea.frecuencia)}">${frecuenciaTexto}</span>
      </td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-info"
                  onclick="verTareaMantenimiento(${tarea.id})"
                  title="Ver detalle">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-warning"
                  onclick="editarTareaMantenimiento(${tarea.id})"
                  title="Editar tarea">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger"
                  onclick="eliminarTareaMantenimiento(${tarea.id}, '${tarea.nombre.replace(/'/g, "\\'")}')"
                  title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function getFrecuenciaBadge(frecuencia) {
  const badges = {
    'M': 'primary',
    'B': 'info',
    'S': 'success',
    'N': 'secondary'
  };
  return badges[frecuencia] || 'secondary';
}

// ============================================
// 2. CREAR TAREA DE MANTENIMIENTO
// ============================================
document.getElementById('formNuevaTareaMantenimiento')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nombre = document.getElementById('nombreTareaMantenimiento').value.trim();
  const frecuencia = document.getElementById('frecuenciaTareaMantenimiento').value;
  
  if (!nombre || !frecuencia) {
    alert('⚠️ Complete todos los campos');
    return;
  }
  
  try {
    const res = await fetch('/api/mantenimiento/tareas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, frecuencia })
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Tarea de mantenimiento creada exitosamente');
      e.target.reset();
      cargarTareasMantenimiento();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
});

// ============================================
// 3. ELIMINAR TAREA DE MANTENIMIENTO
// ============================================
async function eliminarTareaMantenimiento(id, nombre) {
  if (!confirm(`⚠️ ¿Está seguro de eliminar la tarea "${nombre}"?\n\nNota: No se puede eliminar si tiene mantenimientos registrados.`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/mantenimiento/tareas/${id}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Tarea eliminada exitosamente');
      cargarTareasMantenimiento();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ============================================
// 4. CARGAR EQUIPOS Y TAREAS EN SELECTORES
// ============================================
async function cargarEquiposEnSelectores() {
  try {
    const res = await fetch('/api/inventario');
    const data = await res.json();
    
    if (data.success) {
      // Selector para registrar mantenimiento
      const selectEquipo = document.getElementById('equipoMantenimiento');
      if (selectEquipo) {
        selectEquipo.innerHTML = '<option value="">Seleccionar equipo</option>';
        data.inventario.forEach(equipo => {
          selectEquipo.innerHTML += `<option value="${equipo.id}">${equipo.codigo} - ${equipo.tipo} (${equipo.ubicacion})</option>`;
        });
      }
      
      // Selector para filtros
      const selectFiltro = document.getElementById('filtroEquipoHistorial');
      if (selectFiltro) {
        selectFiltro.innerHTML = '<option value="">Todos los equipos</option>';
        data.inventario.forEach(equipo => {
          selectFiltro.innerHTML += `<option value="${equipo.id}">${equipo.codigo} - ${equipo.tipo}</option>`;
        });
      }
    }
  } catch (error) {
    console.error('Error cargando equipos:', error);
  }
}

function cargarTareasEnSelector(tareas) {
  const select = document.getElementById('tipoTareaMantenimiento');
  if (!select) return;
  
  select.innerHTML = '<option value="">Seleccionar tarea</option>';
  tareas.forEach(tarea => {
    select.innerHTML += `<option value="${tarea.id}">${tarea.nombre}</option>`;
  });
}

// ============================================
// 5. REGISTRAR MANTENIMIENTO REALIZADO
// ============================================
document.getElementById('formRegistrarMantenimiento')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const inventario_id = document.getElementById('equipoMantenimiento').value;
  const tarea_mantenimiento_id = document.getElementById('tipoTareaMantenimiento').value;
  const fecha_realizada = document.getElementById('fechaMantenimiento').value;
  const observaciones = document.getElementById('observacionesMantenimiento').value.trim();
  
  if (!inventario_id || !tarea_mantenimiento_id || !fecha_realizada) {
    alert('⚠️ Complete todos los campos obligatorios');
    return;
  }
  
  try {
    const res = await fetch('/api/mantenimiento/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventario_id,
        tarea_mantenimiento_id,
        fecha_realizada,
        observaciones
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Mantenimiento registrado exitosamente');
      e.target.reset();
      cargarHistorialMantenimiento();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
});

// ============================================
// 6. CARGAR HISTORIAL DE MANTENIMIENTOS
// ============================================
async function cargarHistorialMantenimiento(filtros = {}) {
  try {
    // Construir query params
    const params = new URLSearchParams();
    if (filtros.equipo_id) params.append('equipo_id', filtros.equipo_id);
    if (filtros.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
    
    const url = `/api/mantenimiento/historial${params.toString() ? '?' + params.toString() : ''}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.success) {
      mostrarHistorialMantenimiento(data.mantenimientos);
    }
  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}

function mostrarHistorialMantenimiento(mantenimientos) {
  const tbody = document.getElementById('tablaHistorialMantenimiento');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (mantenimientos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay mantenimientos registrados</td></tr>';
    return;
  }

  mantenimientos.forEach(mant => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatearFecha(mant.fecha_realizada)}</td>
      <td>${mant.equipo_tipo}</td>
      <td><span class="badge bg-secondary">${mant.equipo_codigo}</span></td>
      <td>${mant.tarea_nombre}</td>
      <td>${mant.observaciones || '-'}</td>
      <td>${mant.realizado_por_nombre || 'N/A'}</td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-info" 
                  onclick="verMantenimiento(${mant.id})" 
                  title="Ver detalle completo">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-warning" 
                  onclick="editarMantenimiento(${mant.id})" 
                  title="Editar registro">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger" 
                  onclick="eliminarMantenimiento(${mant.id})" 
                  title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
// 7. APLICAR FILTROS AL HISTORIAL
// ============================================
function aplicarFiltrosHistorial() {
  const equipo_id = document.getElementById('filtroEquipoHistorial').value;
  const fecha_desde = document.getElementById('filtroFechaDesde').value;
  const fecha_hasta = document.getElementById('filtroFechaHasta').value;
  
  const filtros = {};
  if (equipo_id) filtros.equipo_id = equipo_id;
  if (fecha_desde) filtros.fecha_desde = fecha_desde;
  if (fecha_hasta) filtros.fecha_hasta = fecha_hasta;
  
  cargarHistorialMantenimiento(filtros);
}

// ============================================
// 8. ELIMINAR REGISTRO DE MANTENIMIENTO
// ============================================
async function eliminarMantenimiento(id) {
  if (!confirm('⚠️ ¿Está seguro de eliminar este registro de mantenimiento?')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/mantenimiento/historial/${id}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Registro eliminado exitosamente');
      cargarHistorialMantenimiento();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ============================================
// VER DETALLE DE UN MANTENIMIENTO (modal de lectura)
// ============================================
async function verMantenimiento(id) {
  try {
    console.log(`👀 Ver mantenimiento ${id}`);
    
    const data = await fetchSafe(`/api/mantenimiento/historial/${id}`);

    if (!data.success) {
      alert('❌ Error: ' + (data.error || 'No se pudo cargar el mantenimiento'));
      return;
    }

    const mant = data.mantenimiento;

    const modalHtml = `
      <div class="modal fade" id="modalVerMantenimiento" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-eye me-2"></i>Detalle del Mantenimiento
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">Información del equipo</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Código:</strong></td><td>${mant.equipo_codigo}</td></tr>
                    <tr><td><strong>Tipo:</strong></td><td>${mant.equipo_tipo}</td></tr>
                    <tr><td><strong>Ubicación:</strong></td><td>${mant.ubicacion || 'N/A'}</td></tr>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">Mantenimiento realizado</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Fecha:</strong></td><td>${formatearFecha(mant.fecha_realizada)}</td></tr>
                    <tr><td><strong>Tarea:</strong></td><td>${mant.tarea_nombre}</td></tr>
                    <tr><td><strong>Realizado por:</strong></td><td>${mant.realizado_por_nombre || 'N/A'}</td></tr>
                  </table>
                </div>
              </div>
              <hr>
              <h6 class="text-muted">Observaciones:</h6>
              <p class="border p-3 bg-light rounded">${mant.observaciones || 'Sin observaciones registradas'}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const old = document.getElementById('modalVerMantenimiento');
    if (old) old.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('modalVerMantenimiento')).show();

  } catch (err) {
    console.error('❌ Error:', err);
    alert('❌ Error al cargar detalle del mantenimiento');
  }
}

// ============================================
// EDITAR REGISTRO DE MANTENIMIENTO
// ============================================
async function editarMantenimiento(id) {
  try {
    console.log(`✏️ Editar mantenimiento ${id}`);
    
    // 1. Obtener datos actuales
    const data = await fetchSafe(`/api/mantenimiento/historial/${id}`);

    if (!data.success) {
      alert('❌ Error: ' + data.error);
      return;
    }

    const mant = data.mantenimiento;

    // 2. Cargar equipos
    const equipos = await fetchSafe('/api/inventario');
    
    // 3. Cargar tareas
    const tareas = await fetchSafe('/api/mantenimiento/tareas');

    // 4. Construir modal
    const modalHtml = `
      <div class="modal fade" id="modalEditarMantenimiento" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Registro de Mantenimiento
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="formEditarMantenimiento">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Equipo</label>
                    <select class="form-select" id="editEquipoMantenimiento" required>
                      <option value="">Seleccione equipo</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Tarea realizada</label>
                    <select class="form-select" id="editTipoTareaMantenimiento" required>
                      <option value="">Seleccione tarea</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Fecha realizada</label>
                    <input type="date" class="form-control" id="editFechaMantenimiento" 
                           value="${mant.fecha_realizada.split('T')[0]}" required>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Observaciones</label>
                    <textarea class="form-control" id="editObservacionesMantenimiento" rows="4">${mant.observaciones || ''}</textarea>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionMantenimiento(${id})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const oldModal = document.getElementById('modalEditarMantenimiento');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Llenar select de equipos
    const selectEquipo = document.getElementById('editEquipoMantenimiento');
    if (equipos.success) {
      equipos.inventario.forEach(eq => {
        const selected = eq.id === mant.inventario_id ? 'selected' : '';
        selectEquipo.innerHTML += `<option value="${eq.id}" ${selected}>${eq.codigo} - ${eq.tipo} (${eq.ubicacion})</option>`;
      });
    }

    // Llenar select de tareas
    const selectTarea = document.getElementById('editTipoTareaMantenimiento');
    if (tareas.success) {
      tareas.tareas.forEach(t => {
        const selected = t.id === mant.tarea_mantenimiento_id ? 'selected' : '';
        selectTarea.innerHTML += `<option value="${t.id}" ${selected}>${t.nombre}</option>`;
      });
    }

    const modal = new bootstrap.Modal(document.getElementById('modalEditarMantenimiento'));
    modal.show();

  } catch (err) {
    console.error('❌ Error:', err);
    alert('❌ Error al cargar datos para edición');
  }
}

// ============================================
// GUARDAR EDICIÓN DE MANTENIMIENTO
// ============================================
async function guardarEdicionMantenimiento(id) {
  const inventario_id = document.getElementById('editEquipoMantenimiento')?.value;
  const tarea_mantenimiento_id = document.getElementById('editTipoTareaMantenimiento')?.value;
  const fecha_realizada = document.getElementById('editFechaMantenimiento')?.value;
  const observaciones = document.getElementById('editObservacionesMantenimiento')?.value.trim();

  if (!inventario_id || !tarea_mantenimiento_id || !fecha_realizada) {
    alert('⚠️ Complete los campos obligatorios');
    return;
  }

  try {
    console.log(`💾 Guardando mantenimiento ${id}...`);
    
    const data = await fetchSafe(`/api/mantenimiento/historial/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventario_id,
        tarea_mantenimiento_id,
        fecha_realizada,
        observaciones
      })
    });

    if (data.success) {
      alert('✅ Registro de mantenimiento actualizado');
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarMantenimiento'));
      if (modal) modal.hide();
      await cargarHistorialMantenimiento();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (err) {
    console.error('❌ Error:', err);
    alert('❌ Error de conexión al guardar');
  }
}

// ============================================
// 9. FUNCIÓN AUXILIAR PARA FORMATEAR FECHAS
// ============================================
function formatearFecha(fecha) {
  if (!fecha) return '-';
  const f = new Date(fecha + 'T00:00:00'); // Evitar problemas de zona horaria
  const dia = String(f.getDate()).padStart(2, '0');
  const mes = String(f.getMonth() + 1).padStart(2, '0');
  const anio = f.getFullYear();
  return `${dia}/${mes}/${anio}`;
}
// ===============================
// INICIALIZAR
// ===============================
// ENCUESTA DE ACCESIBILIDAD
// ===============================

// Cargar preguntas de la encuesta
async function cargarEncuestaAccesibilidad() {
  try {
    const res = await fetch('/api/accesibilidad/preguntas');
    const data = await res.json();
    
    if (data.success && data.preguntas) {
      mostrarPreguntasEncuesta(data.preguntas);
    } else {
      document.getElementById('preguntasAccesibilidadContainer').innerHTML = 
        '<p class="text-danger">No se pudieron cargar las preguntas</p>';
    }
  } catch (error) {
    console.error('Error cargando encuesta:', error);
    document.getElementById('preguntasAccesibilidadContainer').innerHTML = 
      '<p class="text-danger">Error de conexión al cargar preguntas</p>';
  }
}

// REEMPLAZA esta función completa en admin.js (busca "generarInputPregunta")

function generarInputPregunta(pregunta) {
  console.log('🔍 Generando input para pregunta:', pregunta.id, pregunta.pregunta);
  
  if (pregunta.tipo_respuesta === 'escala') {
    // Escala 1-5 para Acuerdo/Desacuerdo
    const html = `
      <div class="d-flex flex-column">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <small class="text-muted fw-bold">Muy en desacuerdo</small>
          <small class="text-muted fw-bold">Muy de acuerdo</small>
        </div>
        <div class="btn-group d-flex" role="group" style="gap: 5px;">
          ${[1, 2, 3, 4, 5].map(valor => `
            <input type="radio" 
                   class="btn-check" 
                   name="pregunta_${pregunta.id}" 
                   id="pregunta_${pregunta.id}_${valor}" 
                   value="${valor}" 
                   required>
            <label class="btn btn-outline-primary flex-grow-1 text-center" 
                   for="pregunta_${pregunta.id}_${valor}" 
                   style="font-weight: 600;">
              ${valor}
            </label>
          `).join('')}
        </div>
      </div>
    `;
    
    console.log('✅ Input de escala generado para:', pregunta.id);
    return html;
    
  } else if (pregunta.tipo_respuesta === 'opcion_unica') {
    // Opciones múltiples (si las hay)
    const opciones = pregunta.opciones ? pregunta.opciones.split(',').map(o => o.trim()) : [];
    
    const html = `
      <select class="form-select" name="pregunta_${pregunta.id}" required>
        <option value="">Seleccione una opción</option>
        ${opciones.map(op => `<option value="${op}">${op}</option>`).join('')}
      </select>
    `;
    
    console.log('✅ Input de opción múltiple generado para:', pregunta.id);
    return html;
  }
  
  console.warn('⚠️ Tipo de pregunta no reconocido:', pregunta.tipo_respuesta);
  return '<p class="text-muted">Tipo de pregunta no reconocido</p>';
}


// TAMBIÉN REEMPLAZA la función mostrarPreguntasEncuesta:

function mostrarPreguntasEncuesta(preguntas) {
  console.log('📋 Mostrando', preguntas.length, 'preguntas de accesibilidad');
  
  const container = document.getElementById('preguntasAccesibilidadContainer');
  
  // Agrupar preguntas por módulo
  const modulos = {
    'Física': preguntas.filter(p => p.modulo === 'Física'),
    'Tecnológica': preguntas.filter(p => p.modulo === 'Tecnológica'),
    'Pedagógica': preguntas.filter(p => p.modulo === 'Pedagógica')
  };
  
  console.log('📊 Preguntas agrupadas:', {
    Física: modulos['Física'].length,
    Tecnológica: modulos['Tecnológica'].length,
    Pedagógica: modulos['Pedagógica'].length
  });
  
  let html = '';
  
  Object.keys(modulos).forEach(modulo => {
    const colorModulo = {
      'Física': 'primary',
      'Tecnológica': 'info',
      'Pedagógica': 'success'
    }[modulo];
    
    const iconoModulo = {
      'Física': 'bi-door-open',
      'Tecnológica': 'bi-cpu',
      'Pedagógica': 'bi-book'
    }[modulo];
    
    console.log(`📌 Procesando módulo: ${modulo} (${modulos[modulo].length} preguntas)`);
    
    html += `
      <div class="card mb-3 border-${colorModulo}">
        <div class="card-header bg-${colorModulo} text-white">
          <h5 class="mb-0">
            <i class="bi ${iconoModulo} me-2"></i>${modulo}
          </h5>
        </div>
        <div class="card-body">
    `;
    
    modulos[modulo].forEach((pregunta, index) => {
      console.log(`  ✅ [${index + 1}] ${pregunta.id} - ${pregunta.pregunta.substring(0, 50)}...`);
      
      html += `
        <div class="mb-4 pb-3 border-bottom">
          <label class="form-label fw-bold d-block mb-2">
            ${pregunta.pregunta}
          </label>
          ${generarInputPregunta(pregunta)}
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  console.log('✅ Preguntas renderizadas en el HTML correctamente');
}

// Enviar encuesta
document.getElementById('formEncuestaAccesibilidad')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Recopilar respuestas
  const formData = new FormData(e.target);
  const respuestas = [];
  
  for (let [pregunta_id, valor] of formData.entries()) {
    respuestas.push({ pregunta_id, valor });
  }
  
  if (respuestas.length === 0) {
    alert('⚠️ Por favor responda al menos una pregunta');
    return;
  }
  
  try {
    const res = await fetch('/api/accesibilidad/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuestas })
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Encuesta guardada exitosamente');
      e.target.reset();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
});


// ============================================
// ESTRUCTURA ACADÉMICA
// ============================================

async function cargarEstructuraAcademica(filtros = {}) {
  try {
    const params = new URLSearchParams();
    if (filtros.ano_lectivo) params.append('ano_lectivo', filtros.ano_lectivo);
    if (filtros.grado) params.append('grado', filtros.grado);
    if (filtros.curso) params.append('curso', filtros.curso);
    
    const url = `/api/estructura/academica${params.toString() ? '?' + params.toString() : ''}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.success) {
      mostrarEstructuraAcademica(data.estructura);
      actualizarEstadisticasEstructura(data.estadisticas);
    } else {
      document.getElementById('tablaEstructuraBody').innerHTML = 
        '<tr><td colspan="7" class="text-center text-danger">Error cargando estructura</td></tr>';
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('tablaEstructuraBody').innerHTML = 
      '<tr><td colspan="7" class="text-center text-danger">Error de conexión</td></tr>';
  }
}

function mostrarEstructuraAcademica(estructura) {
  const tbody = document.getElementById('tablaEstructuraBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (estructura.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay datos</td></tr>';
    return;
  }
  
  estructura.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.grado}</td>
      <td>${item.curso}</td>
      <td>${item.paralelo}</td>
      <td>${item.asignatura_nombre}</td>
      <td>${item.docente_nombre || '<span class="text-muted">Sin asignar</span>'}</td>
      <td class="text-center">
        <span class="badge bg-primary">${item.num_estudiantes || 0}</span>
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-info" onclick="verDetalleClase(${item.clase_id})" title="Ver detalles">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-warning" onclick="editarClase(${item.clase_id}, '${item.asignatura_nombre}', '${item.grado}', '${item.curso}', '${item.paralelo}', ${item.docente_id || 'null'})" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarEstadisticasEstructura(stats) {
  if (!stats) return;
  
  document.getElementById('totalClases').textContent = stats.total_clases || 0;
  document.getElementById('totalEstudiantesEstructura').textContent = stats.total_estudiantes || 0;
  document.getElementById('totalDocentesEstructura').textContent = stats.total_docentes || 0;
  document.getElementById('promedioEstudiantesPorClase').textContent = stats.promedio_estudiantes || 0;
}

function aplicarFiltrosEstructura() {
  const filtros = {
    ano_lectivo: document.getElementById('filtroAnoLectivo').value,
    grado: document.getElementById('filtroGrado').value,
    curso: document.getElementById('filtroCurso').value
  };
  
  cargarEstructuraAcademica(filtros);
}

function verDetalleClase(claseId) {
  // Cambiar a la pestaña de gestión de clases
  const tab = new bootstrap.Tab(document.querySelector('[data-bs-target="#nav-clases"]'));
  tab.show();
  
  // Seleccionar la clase en el selector de estudiantes
  setTimeout(() => {
    const selector = document.getElementById('adminClaseEstudiantesSelector');
    if (selector) {
      selector.value = claseId;
      selector.dispatchEvent(new Event('change'));
    }
  }, 500);
}

// ============================================
// REGISTRO GENERAL DE ESTUDIANTES
// ============================================

// CARGAR REGISTRO DE ESTUDIANTES
// REEMPLAZAR la función cargarRegistroEstudiantes en admin.js:
async function cargarRegistroEstudiantes(filtros = {}) {
  try {
    const params = new URLSearchParams();
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
    if (filtros.genero) params.append('genero', filtros.genero);
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.periodo) params.append('periodo', filtros.periodo);
    
    const url = `/api/estudiantes/registro${params.toString() ? '?' + params.toString() : ''}`;
    
    console.log('📥 Cargando registro de estudiantes...');
    const data = await fetchSafe(url);
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    // Usar actualización silenciosa
    const tbody = document.getElementById('tablaRegistroEstudiantesBody');
    if (tbody) {
      datosAnteriorEstudiantes = actualizarSilencioso(
        data.estudiantes || [],
        datosAnteriorEstudiantes,
        tbody,
        mostrarRegistroEstudiantes
      );
    }
    
    actualizarEstadisticasEstudiantes(data.estadisticas || {});
    
  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
}
function actualizarEstadisticasEstudiantes(stats) {
  if (!stats) return;
  
  document.getElementById('totalEstudiantesActivos').textContent = stats.total_activos || 0;
  document.getElementById('totalMasculinos').textContent = stats.total_masculinos || 0;
  document.getElementById('totalFemeninos').textContent = stats.total_femeninos || 0;
}

async function verPerfilEstudiante(estudianteId) {
  try {
    const res = await fetch(`/api/estudiantes/${estudianteId}/perfil`);
    const data = await res.json();
    
    if (!data.success) {
      alert('❌ Error cargando perfil');
      return;
    }
    
    const est = data.estudiante;
    const clases = est.clases_matriculadas || [];
    
    let clasesHTML = '<ul class="list-group">';
    if (clases.length === 0) {
      clasesHTML += '<li class="list-group-item text-muted">Sin matrículas activas</li>';
    } else {
      clases.forEach(c => {
        clasesHTML += `
          <li class="list-group-item">
            <strong>${c.asignatura}</strong><br>
            <small>${c.grado} ${c.curso} - ${c.paralelo}</small><br>
            <small class="text-muted">Docente: ${c.docente || 'Sin asignar'}</small>
          </li>
        `;
      });
    }
    clasesHTML += '</ul>';
    
    // Crear modal
    const modalHtml = `
      <div class="modal fade" id="modalPerfilEstudiante" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-person-badge me-2"></i>Perfil del Estudiante
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted">Información Personal</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Cédula:</strong></td><td>${est.cedula}</td></tr>
                    <tr><td><strong>Nombre:</strong></td><td>${est.nombre}</td></tr>
                    <tr><td><strong>Género:</strong></td><td>${est.genero}</td></tr>
                    <tr><td><strong>Adaptación:</strong></td><td>${est.adaptacion_curricular}</td></tr>
                    <tr><td><strong>Usuario:</strong></td><td>${est.username || 'N/A'}</td></tr>
                    <tr><td><strong>Email:</strong></td><td>${est.email || 'No vinculado'}</td></tr>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted">Clases Matriculadas</h6>
                  ${clasesHTML}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalPerfilEstudiante');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalPerfilEstudiante'));
    modal.show();
    
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// Agregar event listeners para filtros


// ===============================
// ===============================

// ===============================
// CARGAR GRADOS COMPLETOS
// ===============================
// ===============================
// CARGAR GRADOS COMPLETOS
// ===============================
// ===============================
// CARGAR GRADOS COMPLETOS (CORREGIDO)
// ===============================
async function cargarGrados() {
  try {
    console.log('📥 Cargando grados...');
    
    const data = await fetchSafe('/api/grados/completos');
    
    if (!data.success) {
      console.error('❌ Error en respuesta:', data.error);
      const tbody = document.getElementById('gradosAsignaturasTableBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${data.error}</td></tr>`;
      }
      return;
    }
    
    console.log('✅ Grados cargados:', data.grados?.length || 0);
    
    mostrarGrados(data.grados || []);
    await cargarGradosEnSelectores();
    
  } catch (error) {
    console.error('❌ Error cargando grados:', error);
    const tbody = document.getElementById('gradosAsignaturasTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error de conexión: ${error.message}</td></tr>`;
    }
  }
}

// ===============================
// FUNCIONES PARA GRADOS - CORREGIDAS
// ===============================

// VER DETALLE DE GRADO
async function verDetalleGrado(gradoId) {
  try {
    console.log(`🔍 Ver detalle grado ID: ${gradoId}`);
    
    const data = await fetchSafe(`/api/grados/${gradoId}/detalle`);
    
    if (!data.success) {
      alert(`❌ ${data.error}`);
      return;
    }
    
    const grado = data.grado;
    
    // Crear modal de detalle
    const modalHtml = `
      <div class="modal fade" id="modalDetalleGrado" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-info-circle me-2"></i>
                Detalle del Grado
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <h4>${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo}</h4>
              
              <div class="row mt-4">
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-header bg-primary text-white">
                      <h6 class="mb-0">Asignaturas</h6>
                    </div>
                    <div class="card-body">
                      ${grado.asignaturas && grado.asignaturas.length > 0 
                        ? grado.asignaturas.map(asig => `
                          <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                            <span>${asig.nombre}</span>
                            <span class="badge bg-${asig.docente_nombre ? 'success' : 'secondary'}">
                              ${asig.docente_nombre || 'Sin docente'}
                            </span>
                          </div>
                        `).join('')
                        : '<p class="text-muted">No hay asignaturas</p>'
                      }
                    </div>
                  </div>
                </div>
                
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-header bg-success text-white">
                      <h6 class="mb-0">Estadísticas</h6>
                    </div>
                    <div class="card-body">
                      <div class="row text-center">
                        <div class="col-6">
                          <div class="p-3">
                            <h2 class="text-primary">${grado.asignaturas?.length || 0}</h2>
                            <small class="text-muted">Asignaturas</small>
                          </div>
                        </div>
                        <div class="col-6">
                          <div class="p-3">
                            <h2 class="text-success">${grado.total_estudiantes || 0}</h2>
                            <small class="text-muted">Estudiantes</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalDetalleGrado');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalDetalleGrado'));
    modal.show();
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error cargando detalles del grado');
  }
}

// EDITAR GRADO
// ===============================
// EDITAR GRADO COMPLETO (CON ASIGNATURAS Y DOCENTES) - VERSIÓN CORREGIDA
// ===============================

let gradoEnEdicion = null;

async function editarGradoCompleto(gradoId) {
  try {
    console.log(`✏️ Editar grado completo ID: ${gradoId}`);
    
    // Obtener datos del grado específico
    const dataGrado = await fetchSafe(`/api/grados/${gradoId}/detalle`);
    if (!dataGrado.success) {
      alert(`❌ ${dataGrado.error}`);
      return;
    }
    
    // Obtener lista de docentes
    const resDocentes = await fetch('/api/docentes');
    const dataDocentes = await resDocentes.json();
    
    if (!dataDocentes.success) {
      alert('❌ Error cargando docentes');
      return;
    }
    
    const grado = dataGrado.grado;
    gradoEnEdicion = grado.id;
    
    console.log('📊 Datos del grado:', {
      id: grado.id,
      grado: grado.grado,
      nivel: grado.nivel,
      paralelo: grado.paralelo,
      asignaturas: grado.asignaturas
    });
    
    // Construir opciones de docentes
    let opcionesDocentes = '<option value="">Sin docente</option>';
    dataDocentes.docentes.forEach(doc => {
      opcionesDocentes += `<option value="${doc.id}">${doc.fullname}</option>`;
    });
    
    // Construir HTML de asignaturas - CORREGIDO para mostrar TODAS
    let asignaturasHTML = '';
    if (grado.asignaturas && grado.asignaturas.length > 0) {
      console.log(`📚 Asignaturas encontradas: ${grado.asignaturas.length}`);
      
      grado.asignaturas.forEach(asig => {
        console.log(`  - ${asig.nombre} (Docente ID: ${asig.docente_id})`);
        
        const docenteId = asig.docente_id || '';
        const docenteNombre = dataDocentes.docentes.find(d => d.id === docenteId)?.fullname || 'Sin docente';
        
        // Construir select de docentes con el actual seleccionado
        let selectDocente = '<select class="form-select form-select-sm" id="docente_' + asig.id + '" onchange="cambiarDocenteAsignatura(' + asig.id + ', this.value)">';
        selectDocente += '<option value="">Sin docente</option>';
        
        dataDocentes.docentes.forEach(doc => {
          const selected = doc.id === docenteId ? 'selected' : '';
          selectDocente += `<option value="${doc.id}" ${selected}>${doc.fullname}</option>`;
        });
        
        selectDocente += '</select>';
        
        asignaturasHTML += `
          <div class="card mb-3 border-info">
            <div class="card-body p-3">
              <div class="row align-items-center">
                <div class="col-md-4">
                  <strong>${asig.nombre}</strong>
                  <br><small class="text-muted">ID: ${asig.id}</small>
                </div>
                <div class="col-md-5">
                  ${selectDocente}
                  <small class="text-muted">Docente actual: ${docenteNombre}</small>
                </div>
                <div class="col-md-3 text-end">
                  <button type="button" class="btn btn-sm btn-danger" onclick="eliminarAsignaturaDelGrado(${asig.id}, '${asig.nombre.replace(/'/g, "\\'")}')">
                    <i class="bi bi-trash"></i> Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      console.log('⚠️ Sin asignaturas configuradas');
      asignaturasHTML = '<p class="text-muted text-center">Sin asignaturas configuradas</p>';
    }
    
    // Crear modal
    const modalHtml = `
      <div class="modal fade" id="modalEditarGradoCompleto" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Grado y Asignaturas
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- SECCIÓN 1: DATOS DEL GRADO -->
              <div class="card p-3 mb-4 border-warning">
                <h6 class="text-warning mb-3">
                  <i class="bi bi-gear me-2"></i>Configuración del Grado
                </h6>
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label small">Grado</label>
                    <input type="text" class="form-control" id="editGradoCompleto" value="${grado.grado}" required>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small">Nivel Educativo</label>
                    <select class="form-select" id="editNivelCompleto" required>
                      <option value="EGB" ${grado.nivel === 'EGB' ? 'selected' : ''}>EGB</option>
                      <option value="BGU" ${grado.nivel === 'BGU' ? 'selected' : ''}>BGU</option>
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small">Paralelo</label>
                    <select class="form-select" id="editParaleloCompleto" required>
                      <option value="A" ${grado.paralelo === 'A' ? 'selected' : ''}>A</option>
                      <option value="B" ${grado.paralelo === 'B' ? 'selected' : ''}>B</option>
                      <option value="C" ${grado.paralelo === 'C' ? 'selected' : ''}>C</option>
                      <option value="D" ${grado.paralelo === 'D' ? 'selected' : ''}>D</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- SECCIÓN 2: ASIGNATURAS Y DOCENTES -->
              <div class="card p-3 border-info">
                <h6 class="text-info mb-3">
                  <i class="bi bi-book me-2"></i>Asignaturas y Docentes Configurados (${grado.asignaturas ? grado.asignaturas.length : 0})
                </h6>
                
                <!-- Lista de asignaturas actuales -->
                <div class="mb-4" style="max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; padding: 10px; border-radius: 5px;">
                  ${asignaturasHTML}
                </div>

              <!-- INFORMACIÓN ADICIONAL -->
              <div class="alert alert-info mt-3">
                <small>
                  <i class="bi bi-info-circle me-2"></i>
                  <strong>Nota:</strong> Los cambios se guardarán cuando hagas clic en "Guardar Cambios". 
                  Puedes editar docentes directamente desde los selectores de cada asignatura.
                </small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionGradoCompleto(${gradoId})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalEditarGradoCompleto');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    console.log('✅ Modal creado correctamente');
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalEditarGradoCompleto'));
    modal.show();
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión: ' + error.message);
  }
}

// ===============================
// CAMBIAR DOCENTE A ASIGNATURA (MEJORADO)
// ===============================

// ===============================
// AGREGAR NUEVA ASIGNATURA AL GRADO (VERSIÓN MEJORADA)
// ===============================
async function agregarAsignaturaAlGrado() {
  const nombreAsignatura = document.getElementById('nuevaAsignatura').value.trim();
  const docenteId = document.getElementById('nuevoDocenteAsignatura').value || null;
  
  if (!nombreAsignatura) {
    alert('⚠️ Ingrese el nombre de la asignatura');
    return;
  }
  
  try {
    console.log(`➕ Agregando nueva asignatura: "${nombreAsignatura}"`);
    
    // Obtener datos actuales del modal
    const nivelInput = document.getElementById('editNivelCompleto');
    const nivel = nivelInput ? nivelInput.value : 'EGB';
    
    // Mostrar indicador de carga
    const btnAgregar = event.target;
    const textoOriginal = btnAgregar.innerHTML;
    btnAgregar.disabled = true;
    btnAgregar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Agregando...';
    
    console.log(`📊 Agregando con: grado_id=${gradoEnEdicion}, nivel=${nivel}, nombre=${nombreAsignatura}, docente_id=${docenteId}`);
    
    const data = await fetchSafe('/api/grados/asignaturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grado_id: gradoEnEdicion,
        nivel: nivel,
        nombre: nombreAsignatura,
        docente_id: docenteId
      })
    });
    
    if (data.success) {
      console.log('✅ Asignatura agregada con ID:', data.claseId);
      alert('✅ Asignatura agregada exitosamente');
      
      // Limpiar campos
      document.getElementById('nuevaAsignatura').value = '';
      document.getElementById('nuevoDocenteAsignatura').value = '';
      
      // Rehabilitar botón
      btnAgregar.disabled = false;
      btnAgregar.innerHTML = textoOriginal;
      
      // ESPERAR un poco antes de recargar el modal
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🔄 Recargando modal con datos actualizados...');
      
      // Cerrar modal actual
      const modalElement = document.getElementById('modalEditarGradoCompleto');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
        
        // Remover evento anterior si existe
        const handler = () => {
          modalElement.remove();
          modalElement.removeEventListener('hidden.bs.modal', handler);
        };
        modalElement.addEventListener('hidden.bs.modal', handler, { once: true });
      }
      
      // Esperar a que se cierre el modal
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Reabrir el modal con datos actualizados
      console.log('🔄 Reabriendo modal con datos actualizados...');
      await editarGradoCompleto(gradoEnEdicion);
      
    } else {
      console.error('❌ Error:', data.error);
      alert(`❌ Error: ${data.error}`);
      
      // Rehabilitar botón en caso de error
      btnAgregar.disabled = false;
      btnAgregar.innerHTML = textoOriginal;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión: ' + error.message);
    
    // Rehabilitar botón en caso de error
    const btnAgregar = event.target;
    btnAgregar.disabled = false;
    btnAgregar.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Agregar Asignatura';
  }
}

// ===============================
// ELIMINAR ASIGNATURA DEL GRADO (VERSIÓN MEJORADA)
// ===============================
async function eliminarAsignaturaDelGrado(claseId, nombreAsignatura) {
  if (!confirm(`⚠️ ¿Está seguro de eliminar la asignatura "${nombreAsignatura}"?\n\nEsta acción es irreversible.`)) {
    return;
  }
  
  try {
    console.log(`🗑️ Eliminando asignatura (Clase ID: ${claseId})`);
    
    // Mostrar indicador de carga
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingEliminar';
    loadingDiv.innerHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div class="spinner-border text-danger" role="status">
          <span class="visually-hidden">Eliminando...</span>
        </div>
        <p class="mt-2 mb-0 text-center">Eliminando asignatura...</p>
      </div>
    `;
    document.body.appendChild(loadingDiv);
    
    const data = await fetchSafe(`/api/clases/${claseId}`, {
      method: 'DELETE'
    });
    
    // Remover indicador de carga
    const loadingEl = document.getElementById('loadingEliminar');
    if (loadingEl) loadingEl.remove();
    
    if (data.success) {
      console.log('✅ Asignatura eliminada');
      alert('✅ Asignatura eliminada exitosamente');
      
      // Cerrar modal actual
      const modalElement = document.getElementById('modalEditarGradoCompleto');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
        
        // Remover evento anterior si existe
        const handler = () => {
          modalElement.remove();
          modalElement.removeEventListener('hidden.bs.modal', handler);
        };
        modalElement.addEventListener('hidden.bs.modal', handler, { once: true });
      }
      
      // Esperar a que se cierre el modal
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Reabrir el modal con datos actualizados
      console.log('🔄 Reabriendo modal con datos actualizados...');
      await editarGradoCompleto(gradoEnEdicion);
      
    } else {
      console.error('❌ Error:', data.error);
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión: ' + error.message);
    
    // Remover indicador de carga si existe
    const loadingEl = document.getElementById('loadingEliminar');
    if (loadingEl) loadingEl.remove();
  }
}

// ===============================
// CAMBIAR DOCENTE A ASIGNATURA
// ===============================
async function cambiarDocenteAsignatura(asignaturaId, docenteId) {
  try {
    console.log(`🔄 Cambiando docente para asignatura ${asignaturaId} a docente ${docenteId || 'Sin docente'}`);
    
    const res = await fetch(`/api/grados/asignaturas/${asignaturaId}/docente`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docente_id: docenteId || null })
    });
    
    const data = await res.json();
    
    if (data.success) {
      console.log('✅ Docente asignado correctamente');
    } else {
      console.error('❌ Error:', data.error);
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// GUARDAR EDICIÓN DEL GRADO COMPLETO
// ===============================
async function guardarEdicionGradoCompleto(gradoId) {
  try {
    // Deshabilitar botón para evitar múltiples clicks
    const btnGuardar = document.getElementById('btnGuardarGrado');
    if (btnGuardar) {
      btnGuardar.disabled = true;
      btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
    }

    const grado = document.getElementById('editGradoCompleto').value.trim();
    const nivel = document.getElementById('editNivelCompleto').value;
    const paralelo = document.getElementById('editParaleloCompleto').value;
    
    if (!grado || !nivel || !paralelo) {
      alert('⚠️ Complete todos los campos');
      // Rehabilitar botón
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<i class="bi bi-save me-1"></i>Guardar Cambios';
      }
      return;
    }
    
    console.log(`💾 Guardando grado ${gradoId}...`);
    
    const data = await fetchSafe(`/api/grados/${gradoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grado, nivel, paralelo })
    });
    
    if (data.success) {
      console.log('✅ Grado actualizado exitosamente');
      alert('✅ Grado actualizado exitosamente');
      
      // Esperar un poco antes de cerrar
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Obtener la instancia del modal y cerrarlo
      const modalElement = document.getElementById('modalEditarGradoCompleto');
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
        
        // Eliminar el modal del DOM después de cerrarlo
        const handler = () => {
          modalElement.remove();
          modalElement.removeEventListener('hidden.bs.modal', handler);
        };
        modalElement.addEventListener('hidden.bs.modal', handler, { once: true });
      }
      
      // Recargar datos después de cerrar el modal
      await new Promise(resolve => setTimeout(resolve, 600));
      console.log('🔄 Recargando datos...');
      await cargarGrados();
      await cargarAsignaturasRegistradas();
      console.log('✅ Datos recargados');
      
    } else {
      console.error('❌ Error:', data.error);
      alert(`❌ ${data.error}`);
      // Rehabilitar botón
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = '<i class="bi bi-save me-1"></i>Guardar Cambios';
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
    // Rehabilitar botón
    const btnGuardar = document.getElementById('btnGuardarGrado');
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = '<i class="bi bi-save me-1"></i>Guardar Cambios';
    }
  }
}

// ===============================
// ELIMINAR ASIGNATURA DEL GRADO
// ===============================
async function eliminarAsignaturaDelGrado(asignaturaId, nombreAsignatura) {
  if (!confirm(`⚠️ ¿Está seguro de eliminar la asignatura "${nombreAsignatura}"?`)) {
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/clases/${asignaturaId}`, {
      method: 'DELETE'
    });
    
    if (data.success) {
      console.log('✅ Asignatura eliminada');
      // Recargar el modal
      await editarGradoCompleto(gradoEnEdicion);
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// AGREGAR NUEVA ASIGNATURA AL GRADO
// ===============================
async function agregarAsignaturaAlGrado() {
  const nombreAsignatura = document.getElementById('nuevaAsignatura').value.trim();
  const docenteId = document.getElementById('nuevoDocenteAsignatura').value || null;
  
  if (!nombreAsignatura) {
    alert('⚠️ Ingrese el nombre de la asignatura');
    return;
  }
  
  try {
    const data = await fetchSafe('/api/grados/asignaturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grado_id: gradoEnEdicion,
        nivel: document.getElementById('editNivelCompleto').value,
        nombre: nombreAsignatura,
        docente_id: docenteId
      })
    });
    
    if (data.success) {
      console.log('✅ Asignatura agregada');
      document.getElementById('nuevaAsignatura').value = '';
      document.getElementById('nuevoDocenteAsignatura').value = '';
      // Recargar el modal
      await editarGradoCompleto(gradoEnEdicion);
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// GUARDAR EDICIÓN DEL GRADO COMPLETO
// ===============================
async function guardarEdicionGradoCompleto(gradoId) {
  const grado = document.getElementById('editGradoCompleto').value.trim();
  const nivel = document.getElementById('editNivelCompleto').value;
  const paralelo = document.getElementById('editParaleloCompleto').value;
  
  if (!grado || !nivel || !paralelo) {
    alert('⚠️ Complete todos los campos');
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/grados/${gradoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grado, nivel, paralelo })
    });
    
    if (data.success) {
      alert('✅ Grado actualizado exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarGradoCompleto'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recargar tablas
      await cargarGrados();
      await cargarAsignaturasRegistradas();
    } else {
      alert(`❌ ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// GUARDAR EDICIÓN DE GRADO
async function guardarEdicionGrado(gradoId) {
  const grado = document.getElementById('editGrado').value.trim();
  const nivel = document.getElementById('editNivel').value;
  const paralelo = document.getElementById('editParalelo').value;
  
  if (!grado || !nivel || !paralelo) {
    alert('⚠️ Complete todos los campos');
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/grados/${gradoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grado, nivel, paralelo })
    });
    
    if (data.success) {
      alert('✅ Grado actualizado exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarGrado'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await cargarGrados();
    } else {
      alert(`❌ ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ELIMINAR GRADO (FUNCIÓN COMPLETA)
async function eliminarGrado(gradoId) {
  try {
    // Primero obtener detalles para confirmación
    const dataDetalle = await fetchSafe(`/api/grados/${gradoId}/detalle`);
    
    if (!dataDetalle.success) {
      alert(`❌ ${dataDetalle.error}`);
      return;
    }
    
    const grado = dataDetalle.grado;
    const nombreGrado = `${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo}`;
    
    let mensaje = `⚠️ ¿Está seguro de eliminar este grado?\n\n`;
    mensaje += `Grado: ${nombreGrado}\n`;
    mensaje += `Asignaturas: ${grado.asignaturas?.length || 0}\n`;
    mensaje += `Estudiantes: ${grado.total_estudiantes || 0}\n\n`;
    
    if (grado.total_estudiantes > 0) {
      mensaje += `🚨 ADVERTENCIA: Hay ${grado.total_estudiantes} estudiante(s) matriculado(s).\n`;
      mensaje += `Al eliminar el grado, se eliminarán todas las matrículas asociadas.\n\n`;
    }
    
    mensaje += `Esta acción NO se puede deshacer.`;
    
    if (!confirm(mensaje)) return;
    
    // Segunda confirmación para grados con estudiantes
    if (grado.total_estudiantes > 0) {
      const confirmacion2 = confirm(`🚨 CONFIRMACIÓN FINAL\n\n¿Realmente desea eliminar el grado ${nombreGrado} y sus ${grado.total_estudiantes} estudiante(s)?`);
      if (!confirmacion2) return;
    }
    
    // Proceder con eliminación
    const data = await fetchSafe(`/api/grados/${gradoId}/completo`, {
      method: 'DELETE'
    });
    
    if (data.success) {
      alert('✅ Grado eliminado exitosamente');
      cargarGrados();
    } else {
      alert(`❌ ${data.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// MOSTRAR GRADOS EN TABLA
// ===============================
// MOSTRAR GRADOS EN TABLA - VERSIÓN CORREGIDA (SIN DUPLICADOS)
// ===============================
// ===============================
// FRONTEND - CORREGIR mostrarGrados() en admin.js
// Busca y reemplaza la función mostrarGrados
// ===============================

function mostrarGrados(grados) {
  const tbody = document.getElementById('gradosAsignaturasTableBody');
  if (!tbody) {
    console.error('❌ No se encontró elemento con id="gradosAsignaturasTableBody"');
    return;
  }
  
  console.log(`📊 mostrarGrados() llamado con ${grados.length} grados`);
  
  tbody.innerHTML = '';
  
  if (!grados || grados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">
          <i class="bi bi-inbox"></i> No hay grados configurados
        </td>
      </tr>
    `;
    return;
  }

  grados.forEach((grado, index) => {
    console.log(`[${index + 1}/${grados.length}] ${grado.grado} ${grado.nivel} ${grado.paralelo}`);
    console.log(`   - ${grado.asignaturas?.length || 0} asignatura(s)`);
    console.log(`   - ${grado.total_estudiantes || 0} estudiante(s)`);
    
    // ⭐ CONSTRUIR HTML DE ASIGNATURAS CON MEJOR FORMATO
    let asignaturasHTML = '';
    
    if (grado.asignaturas && grado.asignaturas.length > 0) {
      asignaturasHTML = '<div style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; padding: 10px; border-radius: 5px;">';
      
      grado.asignaturas.forEach(asig => {
        asignaturasHTML += `
          <div class="mb-2 p-2 border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <span class="badge bg-primary me-2">${asig.nombre}</span>
              <small class="text-muted">
                👨‍🏫 ${asig.docente_nombre || 'Sin docente'}
              </small>
            </div>
          </div>
        `;
      });
      
      asignaturasHTML += '</div>';
    } else {
      asignaturasHTML = '<span class="text-muted">Sin asignaturas configuradas</span>';
    }
    
    // Crear fila de la tabla
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${grado.grado}</strong>
        <br>
        <small class="text-muted">${grado.nivel}</small>
      </td>
      <td class="text-center">
        <span class="badge bg-secondary fs-6">${grado.paralelo}</span>
      </td>
      <td class="text-center">
        <span class="badge bg-${grado.total_estudiantes > 0 ? 'success' : 'secondary'} fs-6">
          ${grado.total_estudiantes || 0} 
          <i class="bi bi-people-fill ms-1"></i>
        </span>
      </td>
      <td>
        ${asignaturasHTML}
        <div class="mt-2">
          <small class="text-muted">
            <i class="bi bi-book me-1"></i>
            ${grado.asignaturas?.length || 0} asignatura(s) configurada(s)
          </small>
        </div>
      </td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-info" 
                  onclick="verDetalleGrado(${grado.id || grado.asignaturas?.[0]?.id})" 
                  title="Ver detalle completo">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-warning" 
                  onclick="editarGradoCompleto(${grado.id || grado.asignaturas?.[0]?.id})" 
                  title="Editar grado y asignaturas">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger" 
                  onclick="eliminarGrado(${grado.id || grado.asignaturas?.[0]?.id})" 
                  title="Eliminar grado">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  console.log(`✅ Tabla renderizada con ${grados.length} grados`);
}

// CARGAR GRADOS EN SELECTORES
// ===============================
// CARGAR GRADOS EN SELECTORES (DESDE BD - GRADOS REALES)
// ===============================

// ===============================
// CARGAR GRADOS EN SELECTORES - VERSIÓN CORREGIDA
// ===============================
// BUSCA Y REEMPLAZA ESTA FUNCIÓN COMPLETA EN admin.js

async function cargarGradosEnSelectores() {
  try {
    console.log('📥 Cargando grados reales desde la base de datos...');
    
    // Traer grados reales desde /api/grados/completos
    const resGrados = await fetch('/api/grados/completos');
    
    if (!resGrados.ok) {
      console.warn('⚠️ Error cargando grados, usando lista por defecto');
      cargarGradosPorDefecto();
      return;
    }
    
    const dataGrados = await resGrados.json();
    
    if (!dataGrados.success || !dataGrados.grados || dataGrados.grados.length === 0) {
      console.warn('⚠️ No hay grados configurados, usando lista por defecto');
      cargarGradosPorDefecto();
      return;
    }
    
    console.log(`✅ Se encontraron ${dataGrados.grados.length} grados configurados`);
    
    // Obtener grados únicos (evitar duplicados)
    const gradosUnicos = {};
    dataGrados.grados.forEach(grado => {
      // Usar grado como clave única
      const key = `${grado.grado}-${grado.nivel}-${grado.paralelo}`;
      if (!gradosUnicos[key]) {
        gradosUnicos[key] = {
          id: grado.id,
          grado: grado.grado,
          nivel: grado.nivel,
          paralelo: grado.paralelo,
          asignaturas: grado.asignaturas || []
        };
      }
    });
    
    console.log(`✅ Grados únicos: ${Object.keys(gradosUnicos).length}`);
    
    // Poblar selector de grado para matrículas
    const selectGrado = document.getElementById('matriculaGrado');
    if (selectGrado) {
      selectGrado.innerHTML = '<option value="">Seleccionar Grado</option>';
      
      Object.values(gradosUnicos).forEach(grado => {
        const option = document.createElement('option');
        option.value = grado.id;
        option.textContent = `${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo}`;
        
        // ⭐ IMPORTANTE: Agregar nivel y paralelo como atributos data
        option.setAttribute('data-nivel', grado.nivel);
        option.setAttribute('data-paralelo', grado.paralelo);
        
        console.log(`   ✅ Grado agregado: ${grado.grado} ${grado.nivel} - ${grado.paralelo}`);
        console.log(`      - data-nivel: ${grado.nivel}`);
        console.log(`      - data-paralelo: ${grado.paralelo}`);
        
        selectGrado.appendChild(option);
      });
      
      console.log(`✅ Selector de grados poblado correctamente`);
    } else {
      console.warn('⚠️ No se encontró elemento con id="matriculaGrado"');
    }
    
    // Cargar asignaturas desde los grados configurados
    const asignaturasUniques = new Map();
    
    dataGrados.grados.forEach(grado => {
      if (grado.asignaturas && grado.asignaturas.length > 0) {
        grado.asignaturas.forEach(asig => {
          // Usar ID de asignatura como clave
          if (!asignaturasUniques.has(asig.asignatura_id)) {
            asignaturasUniques.set(asig.asignatura_id, {
              id: asig.asignatura_id,
              nombre: asig.nombre
            });
          }
        });
      }
    });
    
    // Poblar selector de asignaturas
    const selectAsignatura = document.getElementById('selectAsignaturaDocente');
    if (selectAsignatura) {
      selectAsignatura.innerHTML = '<option value="">Seleccionar asignatura</option>';
      
      // Ordenar asignaturas alfabéticamente
      const asignaturasOrdenadas = Array.from(asignaturasUniques.values())
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      
      asignaturasOrdenadas.forEach(asig => {
        const option = document.createElement('option');
        option.value = asig.id;
        option.textContent = asig.nombre;
        selectAsignatura.appendChild(option);
      });
      
      console.log(`✅ Selector de asignaturas poblado con ${asignaturasOrdenadas.length} opciones`);
    }
    
  } catch (error) {
    console.error('❌ Error cargando grados:', error);
    console.log('📋 Usando lista de grados por defecto...');
    cargarGradosPorDefecto();
  }
}

// ===============================
// FUNCIÓN DE RESPALDO
// ===============================

function cargarGradosPorDefecto() {
  console.log('⚠️ Cargando grados por defecto (lista predefinida)');
  
  const selectGrado = document.getElementById('matriculaGrado');
  if (selectGrado) {
    const gradosCompletos = [
      { id: '1', grado: '1ro', nivel: 'EGB', paralelo: 'A' },
      { id: '2', grado: '2do', nivel: 'EGB', paralelo: 'A' },
      { id: '3', grado: '3ro', nivel: 'EGB', paralelo: 'A' },
      { id: '4', grado: '4to', nivel: 'EGB', paralelo: 'A' },
      { id: '5', grado: '5to', nivel: 'EGB', paralelo: 'A' },
      { id: '6', grado: '6to', nivel: 'EGB', paralelo: 'A' },
      { id: '7', grado: '7mo', nivel: 'EGB', paralelo: 'A' },
      { id: '8', grado: '8vo', nivel: 'EGB', paralelo: 'A' },
      { id: '9', grado: '9no', nivel: 'EGB', paralelo: 'A' },
      { id: '10', grado: '10mo', nivel: 'EGB', paralelo: 'A' },
      { id: '11', grado: '1ro', nivel: 'BGU', paralelo: 'A' },
      { id: '12', grado: '2do', nivel: 'BGU', paralelo: 'A' },
      { id: '13', grado: '3ro', nivel: 'BGU', paralelo: 'A' }
    ];
    
    selectGrado.innerHTML = '<option value="">Seleccionar Grado</option>';
    gradosCompletos.forEach(grado => {
      const option = document.createElement('option');
      option.value = grado.id;
      option.textContent = `${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo}`;
      option.setAttribute('data-nivel', grado.nivel);
      option.setAttribute('data-paralelo', grado.paralelo);
      selectGrado.appendChild(option);
    });
    
    console.log(`✅ Grados por defecto cargados: ${gradosCompletos.length}`);
  }
}

// ===============================
// EVENT LISTENER PARA VERIFICAR VALORES
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  // Este código verifica que los datos se estén cargando correctamente
  
  const selectGrado = document.getElementById('matriculaGrado');
  
  if (selectGrado) {
    selectGrado.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      
      console.log('🔄 Grado seleccionado:', selectedOption.text);
      console.log('   ID:', selectedOption.value);
      console.log('   data-nivel:', selectedOption.getAttribute('data-nivel'));
      console.log('   data-paralelo:', selectedOption.getAttribute('data-paralelo'));
      
      // Verificar que los atributos existan
      if (!selectedOption.getAttribute('data-nivel')) {
        console.warn('⚠️ ADVERTENCIA: data-nivel NO EXISTE en la opción');
      }
      if (!selectedOption.getAttribute('data-paralelo')) {
        console.warn('⚠️ ADVERTENCIA: data-paralelo NO EXISTE en la opción');
      }
    });
  }
});

// ===============================
// FUNCIÓN DE RESPALDO: CARGAR GRADOS POR DEFECTO
// ===============================
function cargarGradosPorDefecto() {
  console.log('⚠️ Cargando grados por defecto (lista predefinida)');
  
  const selectGrado = document.getElementById('matriculaGrado');
  if (selectGrado) {
    const gradosCompletos = [
      { id: '1ro', nombre: '1ro EGB' },
      { id: '2do', nombre: '2do EGB' },
      { id: '3ro', nombre: '3ro EGB' },
      { id: '4to', nombre: '4to EGB' },
      { id: '5to', nombre: '5to EGB' },
      { id: '6to', nombre: '6to EGB' },
      { id: '7mo', nombre: '7mo EGB' },
      { id: '8vo', nombre: '8vo EGB' },
      { id: '9no', nombre: '9no EGB' },
      { id: '10mo', nombre: '10mo EGB' },
      { id: '1ro_bach', nombre: '1ro de Bachillerato' },
      { id: '2do_bach', nombre: '2do de Bachillerato' },
      { id: '3ro_bach', nombre: '3ro de Bachillerato' }
    ];
    
    selectGrado.innerHTML = '<option value="">Seleccionar Grado</option>';
    gradosCompletos.forEach(grado => {
      const option = document.createElement('option');
      option.value = grado.id;
      option.textContent = grado.nombre;
      selectGrado.appendChild(option);
    });
  }
}

// ===============================
// EVENT LISTENER PARA ACTUALIZAR NIVEL Y PARALELO
// ===============================
// Este código ya debería estar en tu DOMContentLoaded
// Pero lo incluyo aquí para que veas dónde va

// ===============================
// EVENTO PARA LLENAR CAMPOS OCULTOS AUTOMÁTICAMENTE
// ===============================
// BUSCA Y REEMPLAZA ESTA SECCIÓN en admin.js

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOMContentLoaded - Inicializando eventos de matrícula');
  
  const selectGrado = document.getElementById('matriculaGrado');
  const inputNivel = document.getElementById('matriculaNivel');
  const inputParalelo = document.getElementById('matriculaParalelo');
  
  // Verificar que los elementos existan
  console.log('🔍 Verificando elementos:');
  console.log('   selectGrado:', selectGrado ? '✅ Encontrado' : '❌ NO ENCONTRADO');
  console.log('   inputNivel:', inputNivel ? '✅ Encontrado' : '❌ NO ENCONTRADO');
  console.log('   inputParalelo:', inputParalelo ? '✅ Encontrado' : '❌ NO ENCONTRADO');
  
  if (!selectGrado) {
    console.error('❌ ERROR: No se encontró elemento con id="matriculaGrado"');
    console.error('   Verifica que exista en admin-dashboard.html');
    return;
  }
  
  if (!inputNivel) {
    console.error('❌ ERROR: No se encontró elemento con id="matriculaNivel"');
    console.error('   Verifica que exista: <input type="hidden" id="matriculaNivel">');
    return;
  }
  
  if (!inputParalelo) {
    console.error('❌ ERROR: No se encontró elemento con id="matriculaParalelo"');
    console.error('   Verifica que exista: <input type="hidden" id="matriculaParalelo">');
    return;
  }
  
  console.log('✅ Todos los elementos encontrados correctamente');
  
  // Evento cuando cambia el select de grado
  selectGrado.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    
    console.log('🔄 Cambio de grado detectado');
    console.log('   Texto del grado:', selectedOption.text);
    console.log('   Valor:', selectedOption.value);
    
    if (selectedOption.value && selectedOption.value !== '') {
      // Obtener nivel y paralelo del atributo data
      const nivel = selectedOption.getAttribute('data-nivel');
      const paralelo = selectedOption.getAttribute('data-paralelo');
      
      console.log('   data-nivel:', nivel);
      console.log('   data-paralelo:', paralelo);
      
      if (nivel && paralelo) {
        // Rellenar los campos ocultos
        inputNivel.value = nivel;
        inputParalelo.value = paralelo;
        
        console.log('✅ Campos rellenados automáticamente:');
        console.log('   inputNivel.value =', inputNivel.value);
        console.log('   inputParalelo.value =', inputParalelo.value);
      } else {
        console.warn('⚠️ ADVERTENCIA: No se encontraron data-nivel o data-paralelo');
        console.warn('   data-nivel:', nivel);
        console.warn('   data-paralelo:', paralelo);
      }
    } else {
      // Si no hay grado seleccionado, limpiar los campos
      inputNivel.value = '';
      inputParalelo.value = '';
      console.log('✅ Campos limpiados (sin grado seleccionado)');
    }
  });
  
  console.log('✅ Event listener de cambio de grado agregado correctamente');
});
// CONFIGURAR ASIGNATURAS POR GRADO
// ===============================
// CONFIGURAR ASIGNATURAS POR GRADO
// ===============================
// REEMPLAZAR el event listener existente con esta versión mejorada:
document.getElementById('configAsignaturasForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const grado = document.getElementById('gradoAsignatura').value.trim();
  const nivel = document.getElementById('nivelAsignatura').value;
  const paralelo = document.getElementById('paraleloAsignatura').value; // ⭐ NUEVO
  const nombre = document.getElementById('nombreAsignatura').value.trim();
  const docenteId = document.getElementById('docenteAsignatura').value || null;
  
  if (!grado || !nivel || !paralelo || !nombre) {
    alert('⚠️ Complete todos los campos obligatorios');
    return;
  }

  console.log('📤 Enviando:', { 
    grado_id: grado, 
    nivel, 
    paralelo,  // ⭐ NUEVO
    nombre, 
    docente_id: docenteId 
  });

  try {
    const data = await fetchSafe('/api/grados/asignaturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        grado_id: grado, 
        nivel: nivel,
        paralelo: paralelo, // ⭐ NUEVO
        nombre: nombre,
        docente_id: docenteId
      })
    });
    
    if (data.success) {
      alert(`✅ Asignatura "${nombre}" agregada a ${grado} ${nivel} - Paralelo ${paralelo}` + 
            (docenteId ? ' con docente asignado' : ''));
      e.target.reset();
      
      await cargarGrados();
      await cargarAsignaturasRegistradas();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
});
// CARGAR ASIGNATURAS REGISTRADAS
// ===============================
// CARGAR ASIGNATURAS REGISTRADAS
// ===============================
// ===============================
// CARGAR ASIGNATURAS REGISTRADAS (VERSIÓN CORREGIDA)
// ===============================
async function cargarAsignaturasRegistradas() {
  try {
    console.log('📚 Cargando asignaturas registradas...');
    
    // En lugar de llamar a /api/grados/asignaturas
    // Llamamos a /api/grados/completos que YA tenemos funcionando
    const data = await fetchSafe('/api/grados/completos');
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    console.log(`✅ Asignaturas extraídas de grados`);
    // Las asignaturas ya se muestran en mostrarGrados()
    // No necesitamos mostrarlas en otro lugar
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}



// Función para eliminar asignatura de grado
async function eliminarAsignaturaDeGrado(claseId) {
  if (!confirm('⚠️ ¿Está seguro de eliminar esta asignatura del grado?')) {
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/clases/${claseId}`, {
      method: 'DELETE'
    });
    
    if (data.success) {
      alert('✅ Asignatura eliminada del grado');
      await cargarAsignaturasRegistradas();
      await cargarGrados();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}
// CARGAR DOCENTES PARA ASIGNAR
async function cargarDocentesParaAsignar() {
  try {
    const res = await fetch('/api/docentes');
    const data = await res.json();
    
    if (data.success) {
      const select = document.getElementById('selectDocenteAsignar');
      if (select) {
        select.innerHTML = '<option value="">Seleccionar docente</option>';
        data.docentes.forEach(doc => {
          select.innerHTML += `<option value="${doc.id}">${doc.fullname}</option>`;
        });
      }
    }
  } catch (error) {
    console.error('Error cargando docentes:', error);
  }
}

// ASIGNAR DOCENTE A ASIGNATURA
document.getElementById('asignarDocenteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const asignaturaId = document.getElementById('selectAsignaturaDocente').value;
  const docenteId = document.getElementById('selectDocenteAsignar').value;
  
  if (!asignaturaId || !docenteId) {
    alert('⚠️ Seleccione asignatura y docente');
    return;
  }
  
  try {
    const res = await fetch(`/api/grados/asignaturas/${asignaturaId}/docente`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docente_id: docenteId })
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Docente asignado exitosamente');
      e.target.reset();
      cargarGrados();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
});

// ELIMINAR ASIGNATURA DE GRADO
async function eliminarAsignatura(asignaturaId) {
  if (!confirm('⚠️ ¿Está seguro de eliminar esta asignatura?')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/grados/asignaturas/${asignaturaId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Asignatura eliminada');
      cargarAsignaturasRegistradas();
      cargarGrados();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ELIMINAR GRADO
// ELIMINAR GRADO
async function eliminarGrado(gradoId) {
  if (!confirm('⚠️ ¿Está seguro de eliminar este grado?\n\nSe eliminarán todas las clases asociadas.')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/grados/${gradoId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Grado eliminado exitosamente');
      cargarGrados();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ELIMINAR ASIGNATURA
async function eliminarAsignatura(asignaturaId) {
  if (!confirm('⚠️ ¿Está seguro de eliminar esta asignatura del grado?')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/grados/asignaturas/${asignaturaId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Asignatura eliminada');
      cargarGrados();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// VER DETALLE DE GRADO
async function verDetalleGrado(gradoId) {
  try {
    const res = await fetch(`/api/grados/${gradoId}/detalle`);
    const data = await res.json();
    
    if (data.success) {
      const grado = data.grado;
      
      let asignaturasHTML = '<ul class="list-group">';
      if (grado.asignaturas && grado.asignaturas.length > 0) {
        grado.asignaturas.forEach(asig => {
          asignaturasHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              ${asig.nombre}
              <span class="badge bg-${asig.docente_nombre ? 'success' : 'secondary'}">
                ${asig.docente_nombre || 'Sin docente'}
              </span>
            </li>
          `;
        });
      } else {
        asignaturasHTML += '<li class="list-group-item text-muted">Sin asignaturas configuradas</li>';
      }
      asignaturasHTML += '</ul>';
      
      const modalHtml = `
        <div class="modal fade" id="modalDetalleGrado" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-info text-white">
                <h5 class="modal-title">
                  <i class="bi bi-info-circle me-2"></i>Detalle del Grado
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <h5>${grado.grado} ${grado.nivel}</h5>
                <p class="text-muted">ID: ${grado.id}</p>
                
                <h6 class="mt-4">Asignaturas Configuradas:</h6>
                ${asignaturasHTML}
                
                <div class="mt-4">
                  <h6>Estadísticas:</h6>
                  <div class="row">
                    <div class="col-md-4">
                      <div class="card bg-primary text-white">
                        <div class="card-body text-center p-2">
                          <h6 class="card-title">Asignaturas</h6>
                          <h3>${grado.asignaturas?.length || 0}</h3>
                        </div>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <div class="card bg-success text-white">
                        <div class="card-body text-center p-2">
                          <h6 class="card-title">Docentes Asignados</h6>
                          <h3>${grado.asignaturas?.filter(a => a.docente_nombre).length || 0}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const modalAnterior = document.getElementById('modalDetalleGrado');
      if (modalAnterior) modalAnterior.remove();
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      const modal = new bootstrap.Modal(document.getElementById('modalDetalleGrado'));
      modal.show();
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// 2. MATRÍCULAS (NUEVO SISTEMA)
// ===============================

// CARGAR GRADOS PARA MATRÍCULAS
// REEMPLAZAR la función cargarGradosParaMatriculas:
// ===============================
// CARGAR GRADOS EN SELECTOR DE MATRÍCULAS (MEJORADO)
// ===============================
// REEMPLAZA la función cargarGradosParaMatriculas en admin.js

async function cargarGradosParaMatriculas() {
  try {
    console.log('📥 Cargando grados para matrículas...');
    
    const data = await fetchSafe('/api/grados/completos');
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    const selectGrado = document.getElementById('matriculaGrado');
    const selectNivel = document.getElementById('matriculaNivel');
    const selectParalelo = document.getElementById('matriculaParalelo');
    
    if (!selectGrado) return;
    
    // Agrupar grados únicos
    const gradosUnicos = {};
    (data.grados || []).forEach(grado => {
      const key = `${grado.grado}-${grado.nivel}-${grado.paralelo}`;
      if (!gradosUnicos[key]) {
        gradosUnicos[key] = {
          id: grado.id,
          grado: grado.grado,
          nivel: grado.nivel,
          paralelo: grado.paralelo
        };
      }
    });
    
    console.log(`✅ Grados encontrados: ${Object.keys(gradosUnicos).length}`);
    
    // Poblar selector de grado
    selectGrado.innerHTML = '<option value="">Seleccionar Grado</option>';
    Object.values(gradosUnicos).forEach(grado => {
      const option = document.createElement('option');
      option.value = grado.id;
      option.textContent = `${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo}`;
      option.dataset.nivel = grado.nivel;
      option.dataset.paralelo = grado.paralelo;
      selectGrado.appendChild(option);
    });
    
    // EVENT LISTENER: Cuando se selecciona un grado
    selectGrado.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      
      if (selectedOption.value) {
        // Rellenar automáticamente nivel y paralelo
        const nivel = selectedOption.dataset.nivel;
        const paralelo = selectedOption.dataset.paralelo;
        
        selectNivel.value = nivel;
        selectParalelo.value = paralelo;
        
        console.log(`✅ Grado seleccionado: ${selectedOption.textContent}`);
        console.log(`   Nivel: ${nivel}`);
        console.log(`   Paralelo: ${paralelo}`);
      } else {
        selectNivel.value = '';
        selectParalelo.value = '';
      }
    });
    
  } catch (error) {
    console.error('❌ Error cargando grados:', error);
  }
}

// ===============================
// CARGAR CLASES PARA SELECTOR DE ESTUDIANTES
// ===============================
async function cargarClasesParaEstudiantes() {
  try {
    console.log('📥 Cargando clases para selector de estudiantes...');
    
    const res = await fetch('/api/clases');
    const data = await res.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    console.log(`✅ ${data.clases.length} clase(s) cargada(s)`);
    
    // Este selector se usa en el formulario de agregar estudiante a clase
    const selectClase = document.getElementById('adminClaseEstudiantesSelector');
    if (selectClase) {
      selectClase.innerHTML = '<option value="">Seleccione una clase para gestionar estudiantes</option>';
      data.clases.forEach(clase => {
        const texto = `${clase.grado} ${clase.curso} - ${clase.paralelo} | ${clase.asignatura_nombre} | ${clase.docente_nombre || 'Sin docente'}`;
        selectClase.innerHTML += `<option value="${clase.id}">${texto}</option>`;
      });
    }
  } catch (error) {
    console.error('❌ Error cargando clases:', error);
  }
}


// ===============================
// MOSTRAR MATRÍCULAS (SIN CAMBIOS EN LA TABLA)
// ===============================
// Esta función ya está bien, pero la incluyo para referencia

function mostrarMatriculas(matriculas) {
  const tbody = document.getElementById('matriculasTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!matriculas || matriculas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay matrículas registradas</td></tr>';
    return;
  }

  matriculas.forEach(mat => {
    const fechaFormateada = formatearFecha(mat.fecha_matricula);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${mat.cedula}</td>
      <td>${mat.nombre}</td>
      <td>${mat.genero}</td>
      <td>${mat.periodo_academico}</td>
      <td>${mat.grado}</td>
      <td>${mat.nivel}</td>
      <td>${mat.paralelo}</td>
      <td>${fechaFormateada}</td>
      <td>
        <!-- Botón VER -->
        <button class="btn btn-sm btn-info me-1" onclick="verMatricula(${mat.id})" title="Ver detalle">
          <i class="bi bi-eye"></i>
        </button>
        <!-- Botón EDITAR -->
        <button class="btn btn-sm btn-warning me-1" onclick="editarMatricula(${mat.id})" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <!-- Botón ELIMINAR -->
        <button class="btn btn-sm btn-danger" onclick="eliminarMatricula(${mat.id})" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


// =============================================
// VER DETALLE DE UNA MATRÍCULA
// =============================================
async function verMatricula(matriculaId) {
  try {
    console.log(`👀 Ver detalle matrícula ID: ${matriculaId}`);

    const data = await fetchSafe(`/api/matriculas/${matriculaId}`);
    
    if (!data.success) {
      alert(`❌ Error: ${data.error || 'No se pudo cargar la matrícula'}`);
      return;
    }

    const mat = data.matricula;

    // Construir modal de vista
    const modalHtml = `
      <div class="modal fade" id="modalVerMatricula" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-eye me-2"></i>Detalle de Matrícula
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">Información del Estudiante</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Cédula:</strong></td><td><code>${mat.cedula}</code></td></tr>
                    <tr><td><strong>Nombre:</strong></td><td>${mat.nombre}</td></tr>
                    <tr><td><strong>Género:</strong></td><td>${mat.genero}</td></tr>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">Información de la Matrícula</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Período Académico:</strong></td><td>${mat.periodo_academico}</td></tr>
                    <tr><td><strong>Grado:</strong></td><td>${mat.grado}</td></tr>
                    <tr><td><strong>Nivel:</strong></td><td>${mat.nivel}</td></tr>
                    <tr><td><strong>Paralelo:</strong></td><td>${mat.paralelo}</td></tr>
                    <tr><td><strong>Fecha de Matrícula:</strong></td><td>${formatearFecha(mat.fecha_matricula)}</td></tr>
                    <tr><td><strong>Estado:</strong></td><td><span class="badge bg-success">${mat.estado || 'Activo'}</span></td></tr>
                  </table>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" class="btn btn-warning" onclick="editarMatricula(${mat.id})">
                <i class="bi bi-pencil me-1"></i>Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Limpiar modal anterior si existe
    const oldModal = document.getElementById('modalVerMatricula');
    if (oldModal) oldModal.remove();

    // Agregar y mostrar
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('modalVerMatricula'));
    modal.show();

  } catch (error) {
    console.error('Error al ver matrícula:', error);
    alert('❌ Error de conexión al cargar detalle');
  }
}
// CARGAR MATRÍCULAS

// REEMPLAZAR la función cargarMatriculas en admin.js:
async function cargarMatriculas() {
  try {
    console.log('📋 Cargando matrículas...');
    const data = await fetchSafe('/api/matriculas');
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    // Usar actualización silenciosa
    const tbody = document.getElementById('matriculasTableBody');
    if (tbody) {
      datosAnteriorMatriculas = actualizarSilencioso(
        data.matriculas || [],
        datosAnteriorMatriculas,
        tbody,
        mostrarMatriculas
      );
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
}

// CREAR MATRÍCULA
// CREAR MATRÍCULA - VERSIÓN CORREGIDA
// REEMPLAZAR el event listener del formulario de matrícula:
 document.addEventListener('DOMContentLoaded', () => {
  // Este evento espera a que la página cargue completamente
  
  const matriculaForm = document.getElementById('matriculaForm');
  
  if (matriculaForm) {
    // Si encontró el formulario, le agrega el evento
    matriculaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      console.log('📝 Procesando formulario de matrícula...');
      
      // OBTENER VALORES CON VALIDACIÓN
      const cedula = document.getElementById('matriculaCedula')?.value?.trim() || '';
      const nombre = document.getElementById('matriculaNombre')?.value?.trim() || '';
      const genero = document.getElementById('matriculaGenero')?.value || '';
      const periodo_academico = document.getElementById('matriculaPeriodo')?.value?.trim() || '';
      const grado_id = document.getElementById('matriculaGrado')?.value || '';
      const nivel = document.getElementById('matriculaNivel')?.value || '';
      const paralelo = document.getElementById('matriculaParalelo')?.value || '';
      
      // VALIDAR QUE TODOS LOS CAMPOS ESTÉN LLENOS
      console.log('Valores capturados:', {
        cedula,
        nombre,
        genero,
        periodo_academico,
        grado_id,
        nivel,
        paralelo
      });
      
      if (!cedula) {
        alert('⚠️ Ingrese la cédula del estudiante');
        return;
      }
      
      if (!nombre) {
        alert('⚠️ Ingrese el nombre del estudiante');
        return;
      }
      
      if (!genero) {
        alert('⚠️ Seleccione el género');
        return;
      }
      
      if (!periodo_academico) {
        alert('⚠️ Ingrese el período académico (ej: 2025-2026)');
        return;
      }
      
      if (!grado_id) {
        alert('⚠️ Seleccione un grado');
        return;
      }
      
      if (!nivel) {
        alert('⚠️ El nivel educativo no se llenó automáticamente. Seleccione un grado válido.');
        return;
      }
      
      if (!paralelo) {
        alert('⚠️ El paralelo no se llenó automáticamente. Seleccione un grado válido.');
        return;
      }
      
      try {
        console.log('📤 Enviando datos de matrícula...');
        
        const data = await fetchSafe('/api/matriculas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cedula,
            nombre,
            genero,
            periodo_academico,
            grado_id,
            nivel,
            paralelo
          })
        });
        
        if (data.success) {
          console.log('✅ Matrícula registrada exitosamente');
          alert('✅ ' + data.message);
          
          // Limpiar formulario
          matriculaForm.reset();
          document.getElementById('matriculaNivel').value = '';
          document.getElementById('matriculaParalelo').value = '';
          
          // Recargar tablas
          console.log('🔄 Recargando datos...');
          await cargarMatriculas();
          await cargarRegistroEstudiantes();
          console.log('✅ Datos recargados');
          
        } else {
          console.error('❌ Error del servidor:', data.error);
          alert(`❌ Error: ${data.error}`);
        }
      } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('❌ Error de conexión: ' + error.message);
      }
    });
  } else {
    console.warn('⚠️ Elemento matriculaForm no encontrado en el DOM');
  }
});

// ===============================
// LLENAR NIVEL Y PARALELO AUTOMÁTICAMENTE
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  // Cuando la página carga completamente
  
  const selectGrado = document.getElementById('matriculaGrado');
  const inputNivel = document.getElementById('matriculaNivel');
  const inputParalelo = document.getElementById('matriculaParalelo');
  
  if (selectGrado) {
    // Cuando cambies el select de grado
    selectGrado.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      
      console.log('🔄 Grado seleccionado:', selectedOption.text);
      
      if (selectedOption.value) {
        // Obtener nivel y paralelo del dataset
        const nivel = selectedOption.dataset.nivel || '';
        const paralelo = selectedOption.dataset.paralelo || '';
        
        console.log('   Nivel:', nivel);
        console.log('   Paralelo:', paralelo);
        
        // Rellenar campos ocultos automáticamente
        if (inputNivel) inputNivel.value = nivel;
        if (inputParalelo) inputParalelo.value = paralelo;
        
        console.log('✅ Campos de nivel y paralelo rellenados automáticamente');
      } else {
        // Si no hay grado seleccionado, limpiar
        if (inputNivel) inputNivel.value = '';
        if (inputParalelo) inputParalelo.value = '';
      }
    });
  } else {
    console.warn('⚠️ Elemento matriculaGrado no encontrado');
  }
});
//Mostras estuidiantes matriculados
// AGREGAR o REEMPLAZAR esta función:
// REEMPLAZAR la función mostrarRegistroEstudiantes existente:
// ===============================
// FRONTEND - FIX: mostrarRegistroEstudiantes()
// ===============================
// REEMPLAZA esta función en admin.js

// =============================================
// MOSTRAR REGISTRO DE ESTUDIANTES - TODAS LAS ASIGNATURAS VISIBLES
// =============================================
// =============================================
// MOSTRAR REGISTRO DE ESTUDIANTES - TODAS LAS ASIGNATURAS VISIBLES
// =============================================
function mostrarRegistroEstudiantes(estudiantes) {
  console.log('mostrarRegistroEstudiantes llamado con', estudiantes?.length || 0, 'estudiantes');

  const tbody = document.getElementById('tablaRegistroEstudiantesBody');
  if (!tbody) {
    console.error('No se encontró la tabla con id="tablaRegistroEstudiantesBody"');
    return;
  }

  tbody.innerHTML = '';

  if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay estudiantes registrados o los datos están vacíos</td></tr>';
    return;
  }

  estudiantes.forEach((est, index) => {
    console.log(`Procesando estudiante ${index + 1}:`, est.nombre, 'clases:', est.clases_matriculadas?.length || 0);

    let clasesHTML = '<span class="text-muted">Sin clases matriculadas</span>';

    if (Array.isArray(est.clases_matriculadas) && est.clases_matriculadas.length > 0) {
      clasesHTML = '<div class="d-flex flex-wrap gap-1">';
      est.clases_matriculadas.forEach(clase => {
        const asignatura = clase.asignatura_nombre || clase.asignatura || 'Sin nombre';
        const gradoPar = `${clase.grado || ''} ${clase.paralelo || ''}`.trim() || '-';
        clasesHTML += `
          <span class="badge bg-primary text-white mb-1" 
                title="${asignatura} - ${gradoPar}">
            ${asignatura}
            <small class="d-block">${gradoPar}</small>
          </span>
        `;
      });
      clasesHTML += '</div>';
      clasesHTML += `<small class="text-muted">(${est.clases_matriculadas.length} materia(s))</small>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${est.cedula || '-'}</td>
      <td><strong>${est.nombre || 'Sin nombre'}</strong></td>
      <td>${est.genero || '-'}</td>
      <td>${est.periodo_actual || est.periodo_lectivo || '-'}</td>
      <td>${est.grado_actual || '-'}</td>
      <td>${clasesHTML}</td>
      <td>
        <span class="badge bg-${(est.adaptacion_curricular || 'Ninguna') === 'Ninguna' ? 'secondary' : 'warning'}">
          ${est.adaptacion_curricular || 'Ninguna'}
        </span>
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-info me-1" onclick="verPerfilEstudiante(${est.id})">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-warning me-1" onclick="editarEstudiante(${est.id}, '${(est.nombre || '').replace(/'/g, "\\'")}', '${est.genero || ''}', '${(est.adaptacion_curricular || 'Ninguna').replace(/'/g, "\\'")}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarEstudianteCompleto(${est.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  console.log('Tabla de estudiantes renderizada con éxito');
}

// ===============================
// VER PERFIL DEL ESTUDIANTE - VERSIÓN MEJORADA
// ===============================
async function verPerfilEstudiante(estudianteId) {
  console.log(`📋 Abriendo perfil del estudiante ${estudianteId}...`);
  
  try {
    // Hacer fetch al endpoint mejorado que creamos
    const res = await fetch(`/api/estudiantes/registro?filtro=${estudianteId}`);
    const data = await res.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      alert('Error cargando perfil');
      return;
    }
    
    // Buscar el estudiante en la respuesta
    const estudiante = data.estudiantes.find(e => e.id === estudianteId);
    
    if (!estudiante) {
      console.error('❌ Estudiante no encontrado');
      alert('Estudiante no encontrado');
      return;
    }
    
    console.log('✅ Perfil cargado:', estudiante.nombre);
    console.log('📚 Clases matriculadas:', estudiante.clases_matriculadas.length);
    
    // Construir HTML de clases
    let clasesHTML = '';
    
    if (estudiante.clases_matriculadas && estudiante.clases_matriculadas.length > 0) {
      clasesHTML = '<div class="list-group">';
      
      estudiante.clases_matriculadas.forEach((clase) => {
        const asignatura = clase.asignatura_nombre || 'Sin asignatura';
        const gradoPar = `${clase.grado || ''} ${clase.paralelo || ''}`.trim() || '-';
        
        clasesHTML += `
          <div class="list-group-item">
            <div class="row">
              <div class="col-md-8">
                <h6 class="mb-1">
                  <span class="badge bg-primary">${asignatura}</span>
                </h6>
                <small class="text-muted">
                  <strong>Grado:</strong> ${gradoPar}
                </small>
              </div>
              <div class="col-md-4 text-end">
                <small class="text-muted d-block">
                  <strong>Docente:</strong>
                </small>
                <small>${clase.docente_nombre || 'Sin asignar'}</small>
              </div>
            </div>
          </div>
        `;
      });
      
      clasesHTML += '</div>';
      clasesHTML += `<div class="alert alert-info mt-3 text-center">Total: <strong>${estudiante.clases_matriculadas.length}</strong> asignatura(s)</div>`;
    } else {
      clasesHTML = '<div class="alert alert-warning text-center"><i class="bi bi-exclamation-triangle"></i> Sin matrículas activas</div>';
    }
    
    // Crear modal
    const modalHtml = `
      <div class="modal fade" id="modalPerfilEstudiante" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-person-badge me-2"></i>Perfil del Estudiante
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">
                    <i class="bi bi-info-circle me-2"></i>Información Personal
                  </h6>
                  <table class="table table-sm table-borderless">
                    <tr>
                      <td><strong>Cédula:</strong></td>
                      <td><code>${estudiante.cedula}</code></td>
                    </tr>
                    <tr>
                      <td><strong>Nombre:</strong></td>
                      <td>${estudiante.nombre}</td>
                    </tr>
                    <tr>
                      <td><strong>Género:</strong></td>
                      <td>${estudiante.genero}</td>
                    </tr>
                    <tr>
                      <td><strong>Adaptación:</strong></td>
                      <td>
                        <span class="badge bg-${estudiante.adaptacion_curricular === 'Ninguna' ? 'secondary' : 'warning'}">
                          ${estudiante.adaptacion_curricular}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Usuario:</strong></td>
                      <td><code>${estudiante.username || 'N/A'}</code></td>
                    </tr>
                    <tr>
                      <td><strong>Email:</strong></td>
                      <td>${estudiante.email || '<span class="text-muted">No vinculado</span>'}</td>
                    </tr>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">
                    <i class="bi bi-book me-2"></i>Clases Matriculadas (${estudiante.clases_matriculadas ? estudiante.clases_matriculadas.length : 0})
                  </h6>
                  ${clasesHTML}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalPerfilEstudiante');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalPerfilEstudiante'));
    modal.show();
    
    console.log('✅ Modal de perfil mostrado');
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}
//Mostrar MATRÍCULAS
// AGREGAR o REEMPLAZAR esta función:


// EDITAR MATRÍCULA
// REEMPLAZAR la función editarMatricula:
async function editarMatricula(matriculaId) {
  try {
    console.log(`✏️ Editando matrícula ID: ${matriculaId}`);
    
    // Mostrar indicador de carga
    const loadingModal = document.createElement('div');
    loadingModal.innerHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="mt-2 mb-0">Cargando datos...</p>
      </div>
    `;
    document.body.appendChild(loadingModal);
    
    const data = await fetchSafe(`/api/matriculas/${matriculaId}`);
    
    // Remover indicador de carga
    document.body.removeChild(loadingModal);
    
    if (!data.success) {
      alert(`❌ Error: ${data.error}`);
      return;
    }
    
    const matricula = data.matricula;
    
    // Cargar grados disponibles
    const dataGrados = await fetchSafe('/api/grados/completos');
    
    let opcionesGrados = '<option value="">Seleccionar Grado</option>';
    if (dataGrados.success && dataGrados.grados) {
      const gradosUnicos = {};
      dataGrados.grados.forEach(grado => {
        const key = `${grado.grado}-${grado.nivel}`;
        if (!gradosUnicos[key]) {
          gradosUnicos[key] = {
            id: grado.id,
            grado: grado.grado,
            nivel: grado.nivel,
            paralelos: []
          };
        }
        if (!gradosUnicos[key].paralelos.includes(grado.paralelo)) {
          gradosUnicos[key].paralelos.push(grado.paralelo);
        }
      });
      
      Object.values(gradosUnicos).forEach(grado => {
        const selected = grado.grado === matricula.grado && grado.nivel === matricula.nivel ? 'selected' : '';
        opcionesGrados += `
          <option value="${grado.id}" ${selected} 
                  data-nivel="${grado.nivel}" 
                  data-paralelos='${JSON.stringify(grado.paralelos)}'>
            ${grado.grado} (${grado.nivel})
          </option>
        `;
      });
    }
    
    // Crear modal de edición
    const modalHtml = `
      <div class="modal fade" id="modalEditarMatricula" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Matrícula
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="formEditarMatricula">
                <div class="mb-3">
                  <label class="form-label">Cédula</label>
                  <input type="text" class="form-control" value="${matricula.cedula}" disabled>
                  <small class="text-muted">No editable</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Nombre</label>
                  <input type="text" class="form-control" value="${matricula.nombre}" disabled>
                  <small class="text-muted">No editable</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Género</label>
                  <input type="text" class="form-control" value="${matricula.genero}" disabled>
                  <small class="text-muted">No editable</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Período Académico</label>
                  <input type="text" class="form-control" id="editMatriculaPeriodo" 
                         value="${matricula.periodo_lectivo}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Grado</label>
                  <select class="form-select" id="editMatriculaGrado" required>
                    ${opcionesGrados}
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Nivel Educativo</label>
                  <input type="text" class="form-control" id="editMatriculaNivel" 
                         value="${matricula.nivel}" readonly>
                </div>
                <div class="mb-3">
                  <label class="form-label">Paralelo</label>
                  <select class="form-select" id="editMatriculaParalelo" required>
                    <option value="${matricula.paralelo}" selected>${matricula.paralelo}</option>
                  </select>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionMatricula(${matriculaId})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Eliminar modal anterior si existe
    const modalAnterior = document.getElementById('modalEditarMatricula');
    if (modalAnterior) modalAnterior.remove();
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Event listener para actualizar nivel y paralelos
    const selectGrado = document.getElementById('editMatriculaGrado');
    const selectNivel = document.getElementById('editMatriculaNivel');
    const selectParalelo = document.getElementById('editMatriculaParalelo');
    
    selectGrado.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      if (selectedOption.value) {
        selectNivel.value = selectedOption.dataset.nivel;
        
        const paralelos = JSON.parse(selectedOption.dataset.paralelos || '[]');
        selectParalelo.innerHTML = '<option value="">Seleccionar</option>';
        paralelos.forEach(p => {
          selectParalelo.innerHTML += `<option value="${p}">${p}</option>`;
        });
      }
    });
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalEditarMatricula'));
    modal.show();
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión al cargar la matrícula');
  }
}

// GUARDAR EDICIÓN DE MATRÍCULA
async function guardarEdicionMatricula(matriculaId) {
  const periodo = document.getElementById('editMatriculaPeriodo').value.trim();
  const gradoId = document.getElementById('editMatriculaGrado').value;
  const nivel = document.getElementById('editMatriculaNivel').value;
  const paralelo = document.getElementById('editMatriculaParalelo').value;
  
  if (!periodo || !gradoId || !nivel || !paralelo) {
    alert('⚠️ Complete todos los campos');
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/matriculas/${matriculaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodo_academico: periodo,
        grado_id: gradoId,
        paralelo: paralelo
      })
    });
    
    if (data.success) {
      alert('✅ Matrícula actualizada exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarMatricula'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await cargarMatriculas();
      await cargarRegistroEstudiantes();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ELIMINAR MATRÍCULA
// REEMPLAZAR la función eliminarMatricula:
async function eliminarMatricula(matriculaId) {
  if (!confirm('⚠️ ¿Está seguro de eliminar esta matrícula?\n\nEl estudiante se marcará como retirado de esta clase.')) {
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/matriculas/${matriculaId}`, {
      method: 'DELETE'
    });
    
    if (data.success) {
      alert('✅ Matrícula eliminada exitosamente');
      
      // Recargar inmediatamente
      await cargarMatriculas();
      await cargarRegistroEstudiantes();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión al eliminar');
  }
}

// ===============================
// 3. ACTUALIZAR DOMContentLoaded
// ===============================

// Reemplaza el DOMContentLoaded existente con esto:
// ===============================
// INICIALIZAR
// ===============================
// ===============================
// BUSCA Y REEMPLAZA ESTO EN admin.js
// ===============================

// Busca por esta función y verifica que sea EXACTAMENTE así:

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación...');
  
  verificarAuth();
  
  const cargarModulosSeguros = async () => {
    try { await cargarUsuarios(); } catch (e) { console.error('Error usuarios:', e); }
    try { await cargarDocentes(); } catch (e) { console.error('Error docentes:', e); }
    try { await cargarInventario(); } catch (e) { console.error('Error inventario:', e); }
    try { await cargarGrados(); } catch (e) { console.error('Error grados:', e); }
    try { await cargarAsignaturasRegistradas(); } catch (e) { console.error('Error asignaturas:', e); }
    try { await cargarMatriculas(); } catch (e) { console.error('Error matrículas:', e); }
    
    try { await cargarTareasMantenimiento(); } catch (e) { console.error('Error tareas:', e); }
    try { await cargarEquiposEnSelectores(); } catch (e) { console.error('Error equipos:', e); }
    try { await cargarClases(); } catch (e) { console.error('Error clases:', e); }
    try { await cargarHistorialMantenimiento(); } catch (e) { console.error('Error historial:', e); }
    try { await cargarEncuestaAccesibilidad(); } catch (e) { console.error('Error encuesta:', e); }
    try { await cargarClasesParaCalificaciones(); } catch (e) { console.error('Error clases cal:', e); }
    try { await cargarClasesParaEstudiantes(); } catch (e) { console.error('Error clases est:', e); }
    try { await cargarDocentesParaAsignar(); } catch (e) { console.error('Error docentes asignar:', e); }
    try { await cargarGradosParaMatriculas(); } catch (e) { console.error('Error grados mat:', e); }
  };
  
  // Cargar datos una sola vez
  cargarModulosSeguros();
  
  // Configurar campos por defecto
  const campoFecha = document.getElementById('fechaMantenimiento');
  if (campoFecha) campoFecha.value = new Date().toISOString().split('T')[0];
  
  const campoPeriodo = document.getElementById('matriculaPeriodo');
  if (campoPeriodo) campoPeriodo.value = '2025-2026';
  
  console.log('✅ Inicialización completada');
  
  // ⭐ NO AGREGAR NINGÚN setInterval AQUÍ
  // ⭐ NO AGREGAR NINGÚN cargarGrados() AQUÍ
});

// ===============================
// ÚNICO setInterval AL FINAL (fuera de DOMContentLoaded)
// ===============================

setInterval(() => {
  const tabActiva = document.querySelector('.tab-pane.active');
  
  if (!tabActiva) return;
  
  if (tabActiva.id === 'nav-usuarios') {
    cargarUsuariosSilencioso();
  } 
  else if (tabActiva.id === 'nav-matriculas') {
    cargarMatriculasSilencioso();
  
  } 
  else if (tabActiva.id === 'nav-inventario') {
    cargarInventarioSilencioso();
  } 
  else if (tabActiva.id === 'nav-mantenimiento') {
    cargarHistorialMantenimientoSilencioso();
  }
}, 5000);

// ===============================
// RESTAURAR ESTADO TABLA MANTENIMIENTO
// ===============================

setTimeout(() => {
  restaurarEstadoTablaMantenimiento();
}, 500);

// ===============================
// GUARDAR EDICIÓN ESTUDIANTE
// ===============================
async function guardarEdicionEstudiante() {
  const nombre = document.getElementById('editNombre').value.trim();
  const genero = document.getElementById('editGenero').value;
  const adaptacion = document.getElementById('editAdaptacion').value.trim();
  
  if (!nombre || !genero) {
    alert('⚠️ Nombre y género son obligatorios');
    return;
  }
  
  try {
    const res = await fetch(`/api/estudiantes/${estudianteEditandoId}/editar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre,
        genero: genero,
        adaptacion_curricular: adaptacion
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Estudiante actualizado exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarEstudiante'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const selector = document.getElementById('adminClaseEstudiantesSelector');
      if (selector && selector.value) {
        selector.dispatchEvent(new Event('change'));
      }
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ===============================
// GUARDAR EDICIÓN USUARIO
// ===============================
async function guardarEdicionUsuario(userId) {
  const fullname = document.getElementById('editUserFullname').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const active = parseInt(document.getElementById('editUserActive').value);
  
  if (!fullname || !email) {
    alert('⚠️ Nombre y email son obligatorios');
    return;
  }
  
  try {
    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname, email, active })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Usuario actualizado exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await cargarUsuarios();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ===============================
// GUARDAR EDICIÓN CLASE
// ===============================
async function guardarEdicionClase(claseId) {
  const grado = document.getElementById('editClaseGrado').value.trim();
  const curso = document.getElementById('editClaseCurso').value.trim();
  const paralelo = document.getElementById('editClaseParalelo').value.trim();
  const docenteId = document.getElementById('editClaseDocente').value || null;
  
  if (!grado || !curso || !paralelo) {
    alert('⚠️ Grado, curso y paralelo son obligatorios');
    return;
  }
  
  try {
    const res = await fetch(`/api/clases/${claseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grado: grado,
        curso: curso,
        paralelo: paralelo,
        docente_id: docenteId
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      alert('✅ Clase actualizada exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarClase'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await cargarClases();
      await cargarClasesParaEstudiantes();
      await cargarClasesParaCalificaciones();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ===============================
// GUARDAR EDICIÓN GRADO
// ===============================
async function guardarEdicionGrado(gradoId) {
  const grado = document.getElementById('editGrado').value.trim();
  const nivel = document.getElementById('editNivel').value;
  const paralelo = document.getElementById('editParalelo').value;
  
  if (!grado || !nivel || !paralelo) {
    alert('⚠️ Complete todos los campos');
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/grados/${gradoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grado, nivel, paralelo })
    });
    
    if (data.success) {
      alert('✅ Grado actualizado exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarGrado'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await cargarGrados();
    } else {
      alert(`❌ ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ===============================
// GUARDAR EDICIÓN MATRÍCULA
// ===============================
async function guardarEdicionMatricula(matriculaId) {
  const periodo = document.getElementById('editMatriculaPeriodo').value.trim();
  const gradoId = document.getElementById('editMatriculaGrado').value;
  const nivel = document.getElementById('editMatriculaNivel').value;
  const paralelo = document.getElementById('editMatriculaParalelo').value;
  
  if (!periodo || !gradoId || !nivel || !paralelo) {
    alert('⚠️ Complete todos los campos');
    return;
  }
  
  try {
    const data = await fetchSafe(`/api/matriculas/${matriculaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodo_academico: periodo,
        grado_id: gradoId,
        paralelo: paralelo
      })
    });
    
    if (data.success) {
      alert('✅ Matrícula actualizada exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarMatricula'));
      if (modal) {
        modal.hide();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await cargarMatriculas();
      await cargarRegistroEstudiantes();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
  }
}

// ===============================
// TOGGLE TABLA MANTENIMIENTO
// ===============================

let tablaMantExpandida = localStorage.getItem('tablaMantExpandida') !== 'false';

function toggleTablaMantenimiento() {
  const tabla = document.getElementById('tablaMantContainer');
  const botonToggle = document.getElementById('btnToggleMantenimiento');
  const icono = botonToggle.querySelector('i');
  
  if (!tabla) {
    console.warn('⚠️ No se encontró tablaMantContainer');
    return;
  }
  
  tablaMantExpandida = !tablaMantExpandida;
  localStorage.setItem('tablaMantExpandida', tablaMantExpandida);
  
  if (tablaMantExpandida) {
    tabla.style.display = 'block';
    tabla.style.animation = 'slideDown 0.3s ease-out';
    icono.className = 'bi bi-chevron-up';
    botonToggle.textContent = '';
    botonToggle.innerHTML = '<i class="bi bi-chevron-up"></i> Cerrar Cronograma';
  } else {
    tabla.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => {
      tabla.style.display = 'none';
    }, 300);
    icono.className = 'bi bi-chevron-down';
    botonToggle.textContent = '';
    botonToggle.innerHTML = '<i class="bi bi-chevron-down"></i> Abrir Cronograma';
  }
}

function restaurarEstadoTablaMantenimiento() {
  const tabla = document.getElementById('tablaMantContainer');
  const botonToggle = document.getElementById('btnToggleMantenimiento');
  
  if (!tabla || !botonToggle) return;
  
  if (!tablaMantExpandida) {
    tabla.style.display = 'none';
    botonToggle.innerHTML = '<i class="bi bi-chevron-down"></i> Abrir Cronograma';
  } else {
    tabla.style.display = 'block';
    botonToggle.innerHTML = '<i class="bi bi-chevron-up"></i> Cerrar Cronograma';
  }
}

const estiloCss = document.createElement('style');
estiloCss.textContent = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
  
  #tablaMantContainer {
    transition: all 0.3s ease-out;
  }
`;


// ===============================
// SISTEMA DE ACTUALIZACIÓN SILENCIOSA
// ===============================

// Caché para almacenar datos anteriores
let cacheData = {
  usuarios: null,
  grados: null,
  matriculas: null,
  estudiantes: null,
  inventario: null,
  historialMantenimiento: null
};

// Función para comparar datos
function datosHanCambiado(nuevosDatos, datosAnteriores) {
  if (!datosAnteriores) return true; // Primer carga
  if (!nuevosDatos) return false;
  return JSON.stringify(nuevosDatos) !== JSON.stringify(datosAnteriores);
}

// ===============================
// VERSIÓN SILENCIOSA - USUARIOS
// ===============================
async function cargarUsuariosSilencioso() {
  try {
    const res = await fetch('/api/admin/usuarios');
    const data = await res.json();
    
    if (data.success) {
      // Solo actualizar si hay cambios
      if (datosHanCambiado(data.usuarios, cacheData.usuarios)) {
        console.log('🔄 Actualizando usuarios...');
        mostrarUsuariosSeparados(data.usuarios);
        cacheData.usuarios = JSON.parse(JSON.stringify(data.usuarios)); // Guardar copia
      }
    }
  } catch (error) {
    console.error('Error cargando usuarios:', error);
  }
}

// ===============================
// VERSIÓN SILENCIOSA - GRADOS
// ===============================
async function cargarGradosSilencioso() {
  try {
    const data = await fetchSafe('/api/grados/completos');
    
    if (data.success) {
      if (datosHanCambiado(data.grados, cacheData.grados)) {
        console.log('🔄 Actualizando grados...');
        mostrarGrados(data.grados || []);
        cacheData.grados = JSON.parse(JSON.stringify(data.grados));
      }
    }
  } catch (error) {
    console.error('Error cargando grados:', error);
  }
}

// ===============================
// VERSIÓN SILENCIOSA - ASIGNATURAS
async function cargarAsignaturasRegistradasSilencioso() {
  try {
    const data = await fetchSafe('/api/grados/asignaturas');
    
    if (data.success) {
      if (datosHanCambiado('asignaturas', cacheData.asignaturas)) {
        console.log('🔄 Actualizando asignaturas...');
        cacheData.asignaturas = JSON.parse(JSON.stringify(data.asignaturas));
      }
    }
  } catch (error) {
    console.error('Error cargando asignaturas:', error);
  }
}

// ===============================
// VERSIÓN SILENCIOSA - MATRÍCULAS
// ===============================
async function cargarMatriculasSilencioso() {
  try {
    const data = await fetchSafe('/api/matriculas');
    
    if (data.success) {
      if (datosHanCambiado(data.matriculas, cacheData.matriculas)) {
        console.log('🔄 Actualizando matrículas...');
        mostrarMatriculas(data.matriculas || []);
        cacheData.matriculas = JSON.parse(JSON.stringify(data.matriculas));
      }
    }
  } catch (error) {
    console.error('Error cargando matrículas:', error);
  }
}

// ===============================
// VERSIÓN SILENCIOSA - ESTUDIANTES
// ===============================
async function cargarRegistroEstudiantesSilencioso() {
  try {
    // Obtener filtros actuales (si existen)
    const busqueda = document.getElementById('buscarEstudiante')?.value || '';
    const genero = document.getElementById('filtroGeneroEstudiante')?.value || '';
    const estado = document.getElementById('filtroEstadoEstudiante')?.value || '';
    
    const filtros = {};
    if (busqueda) filtros.busqueda = busqueda;
    if (genero) filtros.genero = genero;
    if (estado) filtros.estado = estado;
    
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => {
      params.append(key, value);
    });
    
    const url = `/api/estudiantes/registro${params.toString() ? '?' + params.toString() : ''}`;
    const data = await fetchSafe(url);
    
    if (data.success) {
      if (datosHanCambiado(data.estudiantes, cacheData.estudiantes)) {
        console.log('🔄 Actualizando estudiantes...');
        mostrarRegistroEstudiantes(data.estudiantes || []);
        actualizarEstadisticasEstudiantes(data.estadisticas || {});
        cacheData.estudiantes = JSON.parse(JSON.stringify(data.estudiantes));
      }
    }
  } catch (error) {
    console.error('Error cargando estudiantes:', error);
  }
}

// ===============================
// VERSIÓN SILENCIOSA - INVENTARIO
// ===============================
async function cargarInventarioSilencioso() {
  try {
    const res = await fetch('/api/inventario');
    const data = await res.json();
    
    if (data.success) {
      if (datosHanCambiado(data.inventario, cacheData.inventario)) {
        console.log('🔄 Actualizando inventario...');
        mostrarInventario(data.inventario);
        cacheData.inventario = JSON.parse(JSON.stringify(data.inventario));
      }
    }
  } catch (error) {
    console.error('Error cargando inventario:', error);
  }
}

// ===============================
// VERSIÓN SILENCIOSA - HISTORIAL MANTENIMIENTO
// ===============================
async function cargarHistorialMantenimientoSilencioso() {
  try {
    const res = await fetch('/api/mantenimiento/historial');
    const data = await res.json();
    
    if (data.success) {
      if (datosHanCambiado(data.mantenimientos, cacheData.historialMantenimiento)) {
        console.log('🔄 Actualizando historial...');
        mostrarHistorialMantenimiento(data.mantenimientos);
        cacheData.historialMantenimiento = JSON.parse(JSON.stringify(data.mantenimientos));
      }
    }
  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}

// ===============================
// INTERVALO DE ACTUALIZACIÓN SILENCIOSA
// ===============================
setInterval(() => {
  const tabActiva = document.querySelector('.tab-pane.active');
  
  if (!tabActiva) return;
  
  // Solo actualizar la pestaña que está visible
  if (tabActiva.id === 'nav-usuarios') {
    cargarUsuariosSilencioso();
  } else if (tabActiva.id === 'nav-grados') {
    cargarGradosSilencioso();
    cargarAsignaturasRegistradasSilencioso();
  } else if (tabActiva.id === 'nav-matriculas') {
    cargarMatriculasSilencioso();
  } else if (tabActiva.id === 'nav-registro-estudiantes') {
    cargarRegistroEstudiantesSilencioso();
  } else if (tabActiva.id === 'nav-inventario') {
    cargarInventarioSilencioso();
  } else if (tabActiva.id === 'nav-mantenimiento') {
    cargarHistorialMantenimientoSilencioso();
  }
}, 5000); // 5 segundos
document.head.appendChild(estiloCss);

// ===============================
// INICIALIZAR (CORREGIDO)
// ===============================
// REEMPLAZA el DOMContentLoaded completo al final de admin.js

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación...');
  
  verificarAuth();
  
  // CARGAR TODO UNA SOLA VEZ
  (async () => {
    try {
      console.log('📥 Cargando módulos...');
      
      await cargarUsuarios();
      console.log('✅ Usuarios cargados');
      
      await cargarDocentes();
      console.log('✅ Docentes cargados');
      
      await cargarInventario();
      console.log('✅ Inventario cargado');
      
      await cargarGrados();
      console.log('✅ Grados cargados');
      
      await cargarAsignaturasRegistradas();
      console.log('✅ Asignaturas cargadas');
      
      await cargarMatriculas();
      console.log('✅ Matrículas cargadas');
      
      
      await cargarTareasMantenimiento();
      console.log('✅ Tareas de mantenimiento cargadas');
      
      await cargarEquiposEnSelectores();
      console.log('✅ Equipos cargados');
      
      await cargarHistorialMantenimiento();
      console.log('✅ Historial de mantenimiento cargado');
      
      await cargarEncuestaAccesibilidad();
      console.log('✅ Encuesta de accesibilidad cargada');
      
      await cargarClasesParaCalificaciones();
      console.log('✅ Clases para calificaciones cargadas');
      
      await cargarGradosParaMatriculas();
      console.log('✅ Grados para matrículas cargados');
      
      console.log('✅✅✅ Inicialización completada');
      
    } catch (error) {
      console.error('❌ Error en inicialización:', error);
    }
  })();
  
  // Configurar campos por defecto
  const campoFecha = document.getElementById('fechaMantenimiento');
  if (campoFecha) {
    campoFecha.value = new Date().toISOString().split('T')[0];
  }
  
  const campoPeriodo = document.getElementById('matriculaPeriodo');
  if (campoPeriodo) {
    campoPeriodo.value = '2025-2026';
  }
  
  // Restaurar estado de tabla mantenimiento
  setTimeout(restaurarEstadoTablaMantenimiento, 500);
});

// ===============================
// ÚNICO setInterval GLOBAL (cada 10 segundos)
// ===============================

setInterval(() => {
  const tabActiva = document.querySelector('.tab-pane.active');
  
  if (!tabActiva) return;
  
  // Solo actualizar la pestaña activa para evitar parpadeos
  switch(tabActiva.id) {
    case 'nav-usuarios':
      cargarUsuarios();
      break;
    case 'nav-grados':
      cargarGrados();
      cargarAsignaturasRegistradas();
      break;
    case 'nav-matriculas':
      cargarMatriculas();
      break;
    case 'nav-registro-estudiantes':
      cargarRegistroEstudiantes();
      break;
    case 'nav-inventario':
      cargarInventario();
      break;
    case 'nav-mantenimiento':
      cargarHistorialMantenimiento();
      break;
  }
}, 10000); // Cada 10 segundos
// ===============================
// SOLO ESTE INTERVALO (sin duplicados)
// ===============================
// Este setInterval es el ÚNICO que debe estar activo
// Verifica que no haya otro setInterval en tu código

// ===============================
// SISTEMA ANTI-PARPADEO - CACHE INTELIGENTE
// ===============================

// Cache global para comparar datos
let CACHE = {
  grados: null,
  matriculas: null,
  estudiantes: null,
  ultimaActualizacion: {}
};

// Función para comparar datos (sin JSON.stringify pesado)
function datosHanCambiado(tabla, nuevosDatos) {
  if (!CACHE[tabla]) return true;
  
  const ahora = Date.now();
  const ultimaAct = CACHE.ultimaActualizacion[tabla] || 0;
  
  // Forzar actualización cada 30 segundos mínimo
  if (ahora - ultimaAct > 30000) {
    return true;
  }
  
  // Comparación rápida por longitud primero
  if (CACHE[tabla].length !== nuevosDatos.length) {
    return true;
  }
  
  // Comparación profunda solo si longitud es igual
  return JSON.stringify(CACHE[tabla]) !== JSON.stringify(nuevosDatos);
}

// Actualizar cache
function actualizarCache(tabla, datos) {
  CACHE[tabla] = JSON.parse(JSON.stringify(datos)); // Copia profunda
  CACHE.ultimaActualizacion[tabla] = Date.now();
}

// ===============================
// CARGAR GRADOS (VERSIÓN OPTIMIZADA SIN PARPADEO)
// ===============================
async function cargarGrados() {
  try {
    console.log('📥 Verificando grados...');
    
    const data = await fetchSafe('/api/grados/completos');
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    // ⭐ SOLO ACTUALIZAR SI HAY CAMBIOS
    if (!datosHanCambiado('grados', data.grados || [])) {
      console.log('✅ Grados sin cambios, no se actualiza la tabla');
      return;
    }
    
    console.log(`🔄 Grados cambiaron, actualizando tabla (${data.grados?.length || 0} registros)`);
    
    mostrarGrados(data.grados || []);
    actualizarCache('grados', data.grados || []);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ===============================
// CARGAR MATRÍCULAS (VERSIÓN OPTIMIZADA)
// ===============================
async function cargarMatriculas() {
  try {
    console.log('📋 Verificando matrículas...');
    const data = await fetchSafe('/api/matriculas');
    
    if (!data.success) return;
    
    // ⭐ SOLO ACTUALIZAR SI HAY CAMBIOS
    if (!datosHanCambiado('matriculas', data.matriculas || [])) {
      console.log('✅ Matrículas sin cambios');
      return;
    }
    
    console.log(`🔄 Matrículas cambiaron, actualizando (${data.matriculas?.length || 0})`);
    
    const tbody = document.getElementById('matriculasTableBody');
    if (tbody) {
      mostrarMatriculas(data.matriculas || []);
      actualizarCache('matriculas', data.matriculas || []);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ===============================
// CARGAR ESTUDIANTES (VERSIÓN OPTIMIZADA)
// ===============================
async function cargarRegistroEstudiantes(filtros = {}) {
  try {
    console.log('👥 Verificando estudiantes...');
    
    const params = new URLSearchParams();
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
    if (filtros.genero) params.append('genero', filtros.genero);
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.periodo) params.append('periodo', filtros.periodo);
    
    const url = `/api/estudiantes/registro${params.toString() ? '?' + params.toString() : ''}`;
    const data = await fetchSafe(url);
    
    if (!data.success) return;
    
    // ⭐ SOLO ACTUALIZAR SI HAY CAMBIOS
    const cacheKey = 'estudiantes_' + params.toString();
    if (!datosHanCambiado(cacheKey, data.estudiantes || [])) {
      console.log('✅ Estudiantes sin cambios');
      return;
    }
    
    console.log(`🔄 Estudiantes cambiaron, actualizando (${data.estudiantes?.length || 0})`);
    
    const tbody = document.getElementById('tablaRegistroEstudiantesBody');
    if (tbody) {
      mostrarRegistroEstudiantes(data.estudiantes || []);
      actualizarEstadisticasEstudiantes(data.estadisticas || {});
      actualizarCache(cacheKey, data.estudiantes || []);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ===============================
// INICIALIZACIÓN MEJORADA (SOLO UNA VEZ)
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación...');
  
  verificarAuth();
  
  // ⭐ CARGAR DATOS SOLO UNA VEZ AL INICIO
  const cargarTodoInicial = async () => {
    try {
      await cargarUsuarios();
      await cargarDocentes();
      await cargarInventario();
      await cargarGrados(); // Solo una vez aquí
      await cargarMatriculas();
      await cargarTareasMantenimiento();
      await cargarEquiposEnSelectores();
      await cargarHistorialMantenimiento();
      await cargarEncuestaAccesibilidad();
      await cargarClasesParaCalificaciones();
      await cargarGradosParaMatriculas();
      
      console.log('✅ Carga inicial completada');
    } catch (error) {
      console.error('❌ Error en carga inicial:', error);
    }
  };
  
  cargarTodoInicial();
  
  // Campos por defecto
  const campoFecha = document.getElementById('fechaMantenimiento');
  if (campoFecha) campoFecha.value = new Date().toISOString().split('T')[0];
  
  const campoPeriodo = document.getElementById('matriculaPeriodo');
  if (campoPeriodo) campoPeriodo.value = '2025-2026';
});

// ===============================
// ⭐ UN SOLO setInterval GLOBAL (cada 10 segundos)
// ===============================
setInterval(() => {
  const tabActiva = document.querySelector('.tab-pane.active');
  
  if (!tabActiva) return;
  
  console.log(`🔄 Verificando actualizaciones en: ${tabActiva.id}`);
  
  // Solo verificar la pestaña activa
  switch(tabActiva.id) {
    case 'nav-usuarios':
      cargarUsuarios();
      break;
    case 'nav-grados':
      cargarGrados(); // Con sistema de cache
      break;
    case 'nav-matriculas':
      cargarMatriculas(); // Con sistema de cache
      break;
    case 'nav-registro-estudiantes':
      cargarRegistroEstudiantes(); // Con sistema de cache
      break;
    case 'nav-inventario':
      cargarInventario();
      break;
    case 'nav-mantenimiento':
      cargarHistorialMantenimiento();
      break;
  }
}, 10000); // ⭐ Cada 10 segundos (no 5)

// ===============================
// FUNCIÓN PARA FORZAR RECARGA MANUAL
// ===============================
function forzarRecargaGrados() {
  console.log('🔄 Recarga manual forzada');
  CACHE.grados = null; // Limpiar cache
  cargarGrados();
}

// Exportar función para uso en eventos de guardado
window.forzarRecargaGrados = forzarRecargaGrados;

// ===============================
// RESTAURAR ESTADO DE MANTENIMIENTO
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(restaurarEstadoTablaMantenimiento, 500);
});


// ===============================
// ACCESIBILIDAD - CARGAR PREGUNTAS
// ===============================

async function cargarPreguntasAccesibilidad() {
  console.log('📋 Cargando preguntas de accesibilidad...');
  
  try {
    const response = await fetch('/api/accesibilidad/preguntas');
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      document.getElementById('preguntasAccesibilidadContainer').innerHTML = 
        `<div class="alert alert-danger">Error: ${data.error}</div>`;
      return;
    }
    
    const preguntas = data.preguntas;
    console.log(`✅ ${preguntas.length} preguntas cargadas`);
    
    renderizarPreguntasAccesibilidad(preguntas);
    
  } catch (error) {
    console.error('❌ Error cargando preguntas:', error);
    document.getElementById('preguntasAccesibilidadContainer').innerHTML = 
      `<div class="alert alert-danger">Error de conexión: ${error.message}</div>`;
  }
}

// ===============================
// ACCESIBILIDAD - RENDERIZAR PREGUNTAS
// ===============================

function renderizarPreguntasAccesibilidad(preguntas) {
  const container = document.getElementById('preguntasAccesibilidadContainer');
  
  if (preguntas.length === 0) {
    container.innerHTML = `<div class="alert alert-warning">No hay preguntas disponibles</div>`;
    return;
  }
  
  // Agrupar por módulo
  const porModulo = {};
  preguntas.forEach(p => {
    if (!porModulo[p.modulo]) {
      porModulo[p.modulo] = [];
    }
    porModulo[p.modulo].push(p);
  });
  
  // Colores por módulo
  const coloresPorModulo = {
    'Física': { color: 'primary', icono: 'bi-door-open' },
    'Tecnológica': { color: 'info', icono: 'bi-cpu' },
    'Pedagógica': { color: 'success', icono: 'bi-book' }
  };
  
  let html = '';
  
  Object.entries(porModulo).forEach(([modulo, preguntasModulo]) => {
    const config = coloresPorModulo[modulo] || { color: 'secondary', icono: 'bi-question-circle' };
    
    html += `
      <div class="card mb-4 border-${config.color}">
        <div class="card-header bg-${config.color} text-white">
          <h4 class="mb-0">
            <i class="bi ${config.icono}"></i> ${modulo}
          </h4>
        </div>
        <div class="card-body">
    `;
    
    preguntasModulo.forEach((pregunta, idx) => {
      html += renderizarPreguntaAccesibilidad(pregunta, idx + 1);
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  console.log('✅ Preguntas renderizadas');
}

// ===============================
// ACCESIBILIDAD - RENDERIZAR UNA PREGUNTA
// ===============================

function renderizarPreguntaAccesibilidad(pregunta, numeroEnModulo) {
  let html = `
    <div class="mb-4 pb-4 border-bottom">
      <div class="d-flex align-items-start">
        <span class="badge bg-secondary me-3 mt-1">${numeroEnModulo}</span>
        <div class="flex-grow-1">
          <p class="mb-2 fw-bold">${pregunta.pregunta}</p>
  `;
  
  if (pregunta.tipo_respuesta === 'escala') {
    html += `
      <div class="btn-group btn-group-sm" role="group" style="gap: 5px;">
    `;
    
    for (let i = 1; i <= 5; i++) {
      const labels = ['Muy en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Muy de acuerdo'];
      html += `
        <input type="radio" 
               class="btn-check" 
               name="pregunta_${pregunta.id}" 
               id="preg_${pregunta.id}_${i}" 
               value="${i}"
               data-pregunta-id="${pregunta.id}">
        <label class="btn btn-outline-secondary" for="preg_${pregunta.id}_${i}" title="${labels[i-1]}">
          ${i}
        </label>
      `;
    }
    
    html += `
      </div>
      <small class="text-muted d-block mt-2">
        1 = Muy en desacuerdo ... 5 = Muy de acuerdo
      </small>
    `;
    
  } else if (pregunta.tipo_respuesta === 'opcion_unica') {
    const opciones = pregunta.opciones ? pregunta.opciones.split(',') : [];
    
    html += `<div class="options-group">`;
    
    opciones.forEach((opcion, idx) => {
      const opcionLimpia = opcion.trim();
      html += `
        <div class="form-check mb-2">
          <input class="form-check-input" 
                 type="radio" 
                 name="pregunta_${pregunta.id}" 
                 id="preg_${pregunta.id}_opt_${idx}" 
                 value="${opcionLimpia}"
                 data-pregunta-id="${pregunta.id}">
          <label class="form-check-label" for="preg_${pregunta.id}_opt_${idx}">
            ${opcionLimpia}
          </label>
        </div>
      `;
    });
    
    html += `</div>`;
  }
  
  html += `
        </div>
      </div>
    </div>
  `;
  
  return html;
}

// ===============================
// ACCESIBILIDAD - ENVIAR ENCUESTA
// ===============================

async function enviarEncuestaAccesibilidad(e) {
  e.preventDefault();
  
  console.log('📤 Enviando encuesta...');
  
  const formData = new FormData(document.getElementById('formEncuestaAccesibilidad'));
  const respuestas = [];
  
  formData.forEach((valor, clave) => {
    if (clave.startsWith('pregunta_')) {
      const preguntaId = clave.replace('pregunta_', '');
      respuestas.push({
        pregunta_id: preguntaId,
        valor: valor
      });
    }
  });
  
  console.log(`📝 Total de respuestas recolectadas: ${respuestas.length}`);
  
  if (respuestas.length === 0) {
    mostrarMensajeAccesibilidad('Por favor, responde todas las preguntas', 'warning');
    return;
  }
  
  try {
    const response = await fetch('/api/accesibilidad/enviar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ respuestas })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Encuesta guardada exitosamente');
      mostrarMensajeAccesibilidad(
        `✅ ${data.message}`,
        'success'
      );
      
      document.getElementById('formEncuestaAccesibilidad').reset();
      
      // Recargar resultados si está visible
      setTimeout(() => {
        cargarResultadosAccesibilidad();
      }, 1000);
      
    } else {
      console.error('❌ Error:', data.error);
      mostrarMensajeAccesibilidad(
        `❌ Error: ${data.error}`,
        'danger'
      );
    }
    
  } catch (error) {
    console.error('❌ Error enviando encuesta:', error);
    mostrarMensajeAccesibilidad(
      `❌ Error de conexión: ${error.message}`,
      'danger'
    );
  }
}

// ===============================
// ACCESIBILIDAD - MOSTRAR MENSAJE
// ===============================

function mostrarMensajeAccesibilidad(mensaje, tipo = 'info') {
  const container = document.getElementById('resultadoAccesibilidad');
  if (container) {
    container.innerHTML = `
      <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
  }
}

// ===============================
// ACCESIBILIDAD - CARGAR RESULTADOS
// ===============================

async function cargarResultadosAccesibilidad() {
  console.log('📊 Cargando resultados de accesibilidad...');
  
  try {
    const response = await fetch('/api/accesibilidad/resultados');
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      const tbody = document.getElementById('tablaResultadosAccesibilidadBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${data.error}</td></tr>`;
      }
      return;
    }
    
    const resultados = data.resultados;
    console.log(`✅ ${resultados.length} resultados cargados`);
    
    renderizarResultadosAccesibilidad(resultados);
    generarResumenModulosAccesibilidad(resultados);
    
  } catch (error) {
    console.error('❌ Error cargando resultados:', error);
    const tbody = document.getElementById('tablaResultadosAccesibilidadBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error de conexión: ${error.message}</td></tr>`;
    }
  }
}

// ===============================
// ACCESIBILIDAD - RENDERIZAR RESULTADOS
// ===============================

function renderizarResultadosAccesibilidad(resultados) {
  const tbody = document.getElementById('tablaResultadosAccesibilidadBody');
  
  if (!tbody) return;
  
  if (resultados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">
          No hay respuestas registradas aún
        </td>
      </tr>
    `;
    return;
  }
  
  let html = '';
  
  resultados.forEach(resultado => {
    const promedio = parseFloat(resultado.promedio_respuestas) || 0;
    const totalRespuestas = resultado.total_respuestas || 0;
    
    let evaluacion = '';
    let colorEvaluacion = '';
    
    if (totalRespuestas === 0) {
      evaluacion = 'Sin datos';
      colorEvaluacion = 'secondary';
    } else if (promedio >= 4.5) {
      evaluacion = '⭐⭐⭐⭐⭐ Excelente';
      colorEvaluacion = 'success';
    } else if (promedio >= 3.5) {
      evaluacion = '⭐⭐⭐⭐ Muy Bueno';
      colorEvaluacion = 'info';
    } else if (promedio >= 2.5) {
      evaluacion = '⭐⭐⭐ Bueno';
      colorEvaluacion = 'warning';
    } else if (promedio >= 1.5) {
      evaluacion = '⭐⭐ Regular';
      colorEvaluacion = 'warning';
    } else {
      evaluacion = '⭐ Deficiente';
      colorEvaluacion = 'danger';
    }
    
    const preguntaAbreviada = resultado.pregunta.length > 50 
      ? resultado.pregunta.substring(0, 50) + '...' 
      : resultado.pregunta;
    
    html += `
      <tr>
        <td>
          <span class="badge bg-primary">${resultado.modulo}</span>
        </td>
        <td title="${resultado.pregunta}">${preguntaAbreviada}</td>
        <td class="text-center">
          <span class="badge bg-secondary">${totalRespuestas}</span>
        </td>
        <td class="text-center fw-bold">
          ${totalRespuestas > 0 ? promedio.toFixed(2) : 'N/A'}
        </td>
        <td class="text-center">
          ${resultado.minimo !== null ? resultado.minimo : 'N/A'}
        </td>
        <td class="text-center">
          ${resultado.maximo !== null ? resultado.maximo : 'N/A'}
        </td>
        <td>
          <span class="badge bg-${colorEvaluacion}">${evaluacion}</span>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
  console.log('✅ Tabla de resultados renderizada');
}

// ===============================
// ACCESIBILIDAD - GENERAR RESUMEN POR MÓDULO
// ===============================

function generarResumenModulosAccesibilidad(resultados) {
  const container = document.getElementById('resumenModulosContainer');
  
  if (!container) return;
  
  const porModulo = {};
  
  resultados.forEach(r => {
    if (!porModulo[r.modulo]) {
      porModulo[r.modulo] = {
        preguntas: [],
        totalRespuestas: 0
      };
    }
    
    const promedio = parseFloat(r.promedio_respuestas) || 0;
    const totalResp = r.total_respuestas || 0;
    
    porModulo[r.modulo].preguntas.push({
      pregunta: r.pregunta,
      promedio: promedio,
      totalRespuestas: totalResp
    });
    
    porModulo[r.modulo].totalRespuestas += totalResp;
  });
  
  let html = '';
  
  Object.entries(porModulo).forEach(([modulo, datos]) => {
    const promedioModulo = datos.preguntas.length > 0 
      ? datos.preguntas.reduce((sum, p) => sum + p.promedio, 0) / datos.preguntas.length 
      : 0;
    
    let colorModulo = 'primary';
    let iconoModulo = 'bi-bar-chart';
    
    if (modulo === 'Física') {
      colorModulo = 'danger';
      iconoModulo = 'bi-door-open';
    } else if (modulo === 'Tecnológica') {
      colorModulo = 'info';
      iconoModulo = 'bi-cpu';
    } else if (modulo === 'Pedagógica') {
      colorModulo = 'success';
      iconoModulo = 'bi-book';
    }
    
    let evaluacionModulo = '';
    if (promedioModulo >= 4.5) {
      evaluacionModulo = '✅ Excelente (4.5+)';
    } else if (promedioModulo >= 3.5) {
      evaluacionModulo = '✅ Muy Bueno (3.5+)';
    } else if (promedioModulo >= 2.5) {
      evaluacionModulo = '⚠️ Bueno (2.5+)';
    } else if (promedioModulo >= 1.5) {
      evaluacionModulo = '⚠️ Regular (1.5+)';
    } else {
      evaluacionModulo = '❌ Deficiente (<1.5)';
    }
    
    html += `
      <div class="col-md-4 mb-3">
        <div class="card border-${colorModulo} h-100">
          <div class="card-header bg-${colorModulo} text-white">
            <h5 class="mb-0">
              <i class="bi ${iconoModulo} me-2"></i>${modulo}
            </h5>
          </div>
          <div class="card-body">
            <div class="mb-2">
              <strong>Promedio General:</strong><br>
              <span class="display-6">${promedioModulo.toFixed(2)}/5</span>
            </div>
            <hr>
            <div class="mb-2">
              <strong>Evaluación:</strong><br>
              <span class="badge bg-${colorModulo}">${evaluacionModulo}</span>
            </div>
            <div>
              <strong>Preguntas:</strong> ${datos.preguntas.length}<br>
              <strong>Respuestas Totales:</strong> ${datos.totalRespuestas}
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  console.log('✅ Resumen de módulos generado');
}

// ===============================
// INICIALIZAR ACCESIBILIDAD
// ===============================

function inicializarAccesibilidad() {
  console.log('🚀 Inicializando módulo de accesibilidad...');
  
  // Cargar preguntas cuando se abre la pestaña
  const btnAccesibilidad = document.querySelector('[data-bs-target="#nav-accesibilidad"]');
  
  if (btnAccesibilidad) {
    btnAccesibilidad.addEventListener('click', () => {
      console.log('📋 Pestaña de Accesibilidad abierta');
      setTimeout(() => {
        cargarPreguntasAccesibilidad();
        cargarResultadosAccesibilidad();
      }, 300);
    });
  }
  
  // Listener para el formulario
  const form = document.getElementById('formEncuestaAccesibilidad');
  if (form) {
    form.addEventListener('submit', enviarEncuestaAccesibilidad);
    console.log('✅ Listener del formulario agregado');
  }
  
  // Listener para el botón de cargar resultados
  const btnCargarResultados = document.getElementById('btnCargarResultados');
  if (btnCargarResultados) {
    btnCargarResultados.addEventListener('click', cargarResultadosAccesibilidad);
    console.log('✅ Listener del botón de resultados agregado');
  }
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarAccesibilidad);

// ============================================
// VER DETALLE DE ACTIVO (modal simple de lectura)
// ============================================
async function verActivo(id) {
  try {
    const res = await fetch(`/api/inventario/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert('❌ No se pudo cargar el activo: ' + data.error);
      return;
    }

    const item = data.activo;

    const modalHtml = `
      <div class="modal fade" id="modalVerActivo" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-eye me-2"></i>Detalle del Activo
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <table class="table table-sm table-borderless">
                <tr><td><strong>Código:</strong></td><td>${item.codigo}</td></tr>
                <tr><td><strong>Tipo:</strong></td><td>${item.tipo}</td></tr>
                <tr><td><strong>Ubicación:</strong></td><td>${item.ubicacion}</td></tr>
                <tr><td><strong>Estado:</strong></td>
                    <td><span class="badge bg-${getEstadoBadge(item.estado)}">${item.estado}</span></td></tr>
                <tr><td><strong>Descripción:</strong></td><td>${item.descripcion || 'Sin descripción'}</td></tr>
                <tr><td><strong>Fecha registro:</strong></td><td>${item.fecha_registro || 'N/A'}</td></tr>
              </table>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Limpiar modal anterior si existe
    const oldModal = document.getElementById('modalVerActivo');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('modalVerActivo'));
    modal.show();

  } catch (error) {
    console.error('Error al ver activo:', error);
    alert('❌ Error de conexión al ver el activo');
  }
}

// ============================================
// EDITAR ACTIVO (modal con formulario)
// ============================================
async function editarActivo(id) {
  try {
    // 1. Obtener datos actuales
    const res = await fetch(`/api/inventario/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert('❌ No se pudo cargar el activo: ' + data.error);
      return;
    }

    const item = data.activo;

    // 2. Crear modal de edición
    const modalHtml = `
      <div class="modal fade" id="modalEditarActivo" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Activo
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="formEditarActivo">
                <div class="mb-3">
                  <label class="form-label">Código</label>
                  <input type="text" class="form-control" id="editCodigo" value="${item.codigo}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Tipo de equipo</label>
                  <input type="text" class="form-control" id="editTipo" value="${item.tipo}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Ubicación</label>
                  <input type="text" class="form-control" id="editUbicacion" value="${item.ubicacion}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Estado</label>
                  <select class="form-select" id="editEstado" required>
                    <option value="Operativo"   ${item.estado === 'Operativo' ? 'selected' : ''}>Operativo</option>
                    <option value="Mantenimiento" ${item.estado === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
                    <option value="Desuso"      ${item.estado === 'Desuso' ? 'selected' : ''}>Desuso</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Descripción</label>
                  <textarea class="form-control" id="editDescripcion" rows="3">${item.descripcion || ''}</textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionActivo(${id})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Limpiar modal anterior
    const oldModal = document.getElementById('modalEditarActivo');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('modalEditarActivo'));
    modal.show();

  } catch (error) {
    console.error('Error al editar activo:', error);
    alert('❌ Error de conexión');
  }
}

// ============================================
// GUARDAR EDICIÓN DEL ACTIVO
// ============================================
async function guardarEdicionActivo(id) {
  const codigo      = document.getElementById('editCodigo')?.value.trim();
  const tipo        = document.getElementById('editTipo')?.value.trim();
  const ubicacion   = document.getElementById('editUbicacion')?.value.trim();
  const estado      = document.getElementById('editEstado')?.value;
  const descripcion = document.getElementById('editDescripcion')?.value.trim();

  if (!codigo || !tipo || !ubicacion || !estado) {
    alert('⚠️ Complete los campos obligatorios');
    return;
  }

  try {
    const res = await fetch(`/api/inventario/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo,
        tipo,
        ubicacion,
        estado,
        descripcion
      })
    });

    const data = await res.json();

    if (data.success) {
      alert('✅ Activo actualizado exitosamente');
      
      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarActivo'));
      if (modal) modal.hide();

      // Recargar inventario
      await cargarInventario();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error al guardar edición:', error);
    alert('❌ Error de conexión');
  }
}

// ============================================
// VER DETALLE DE UN MANTENIMIENTO (modal de lectura)
// ============================================
async function verMantenimiento(id) {
  try {
    const res = await fetch(`/api/mantenimiento/historial/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert('❌ No se pudo cargar el mantenimiento: ' + data.error);
      return;
    }

    const mant = data.mantenimiento;

    const modalHtml = `
      <div class="modal fade" id="modalVerMantenimiento" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-eye me-2"></i>Detalle del Mantenimiento
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">Información del equipo</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Código:</strong></td><td>${mant.equipo_codigo}</td></tr>
                    <tr><td><strong>Tipo:</strong></td><td>${mant.equipo_tipo}</td></tr>
                    <tr><td><strong>Ubicación:</strong></td><td>${mant.ubicacion || 'N/A'}</td></tr>
                  </table>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-3">Mantenimiento realizado</h6>
                  <table class="table table-sm">
                    <tr><td><strong>Fecha:</strong></td><td>${formatearFecha(mant.fecha_realizada)}</td></tr>
                    <tr><td><strong>Tarea:</strong></td><td>${mant.tarea_nombre}</td></tr>
                    <tr><td><strong>Realizado por:</strong></td><td>${mant.realizado_por_nombre || 'N/A'}</td></tr>
                  </table>
                </div>
              </div>
              <hr>
              <h6 class="text-muted">Observaciones:</h6>
              <p class="border p-3 bg-light rounded">${mant.observaciones || 'Sin observaciones registradas'}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const old = document.getElementById('modalVerMantenimiento');
    if (old) old.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('modalVerMantenimiento')).show();

  } catch (err) {
    console.error(err);
    alert('❌ Error al cargar detalle del mantenimiento');
  }
}

// ============================================
// EDITAR REGISTRO DE MANTENIMIENTO
// ============================================
async function editarMantenimiento(id) {
  try {
    // 1. Obtener datos actuales
    const res = await fetch(`/api/mantenimiento/historial/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert('❌ Error: ' + data.error);
      return;
    }

    const mant = data.mantenimiento;

    // 2. Cargar equipos y tareas para los select (reutilizamos funciones existentes)
    await cargarEquiposEnSelectores();     // para que estén disponibles
    await cargarTareasMantenimiento();     // para que estén disponibles

    // 3. Construir modal
    const modalHtml = `
      <div class="modal fade" id="modalEditarMantenimiento" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Registro de Mantenimiento
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="formEditarMantenimiento">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Equipo</label>
                    <select class="form-select" id="editEquipoMantenimiento" required>
                      <!-- Se llenará dinámicamente -->
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Tarea realizada</label>
                    <select class="form-select" id="editTipoTareaMantenimiento" required>
                      <!-- Se llenará dinámicamente -->
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Fecha realizada</label>
                    <input type="date" class="form-control" id="editFechaMantenimiento" 
                           value="${mant.fecha_realizada.split('T')[0]}" required>
                  </div>
                  <div class="col-12">
                    <label class="form-label">Observaciones</label>
                    <textarea class="form-control" id="editObservacionesMantenimiento" rows="4">${mant.observaciones || ''}</textarea>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionMantenimiento(${id})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const oldModal = document.getElementById('modalEditarMantenimiento');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Llenar select de equipos
    const selectEquipo = document.getElementById('editEquipoMantenimiento');
    const equipos = await fetch('/api/inventario').then(r => r.json());
    if (equipos.success) {
      selectEquipo.innerHTML = '<option value="">Seleccione equipo</option>';
      equipos.inventario.forEach(eq => {
        const selected = eq.id === mant.inventario_id ? 'selected' : '';
        selectEquipo.innerHTML += `<option value="${eq.id}" ${selected}>${eq.codigo} - ${eq.tipo} (${eq.ubicacion})</option>`;
      });
    }

    // Llenar select de tareas
    const selectTarea = document.getElementById('editTipoTareaMantenimiento');
    const tareas = await fetch('/api/mantenimiento/tareas').then(r => r.json());
    if (tareas.success) {
      selectTarea.innerHTML = '<option value="">Seleccione tarea</option>';
      tareas.tareas.forEach(t => {
        const selected = t.id === mant.tarea_mantenimiento_id ? 'selected' : '';
        selectTarea.innerHTML += `<option value="${t.id}" ${selected}>${t.nombre}</option>`;
      });
    }

    const modal = new bootstrap.Modal(document.getElementById('modalEditarMantenimiento'));
    modal.show();

  } catch (err) {
    console.error(err);
    alert('❌ Error al cargar datos para edición');
  }
}

// ============================================
// GUARDAR EDICIÓN DE MANTENIMIENTO
// ============================================
async function guardarEdicionMantenimiento(id) {
  const inventario_id = document.getElementById('editEquipoMantenimiento')?.value;
  const tarea_mantenimiento_id = document.getElementById('editTipoTareaMantenimiento')?.value;
  const fecha_realizada = document.getElementById('editFechaMantenimiento')?.value;
  const observaciones = document.getElementById('editObservacionesMantenimiento')?.value.trim();

  if (!inventario_id || !tarea_mantenimiento_id || !fecha_realizada) {
    alert('⚠️ Complete los campos obligatorios');
    return;
  }

  try {
    const res = await fetch(`/api/mantenimiento/historial/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventario_id,
        tarea_mantenimiento_id,
        fecha_realizada,
        observaciones
      })
    });

    const data = await res.json();

    if (data.success) {
      alert('✅ Registro de mantenimiento actualizado');
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarMantenimiento'));
      if (modal) modal.hide();
      await cargarHistorialMantenimiento();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    alert('❌ Error de conexión al guardar');
  }
}


// =============================================
// VER DETALLE DE TAREA DE MANTENIMIENTO
// =============================================
async function verTareaMantenimiento(id) {
  try {
    const res = await fetch(`/api/mantenimiento/tareas/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert('❌ No se pudo cargar la tarea: ' + (data.error || 'Error desconocido'));
      return;
    }

    const tarea = data.tarea;

    const frecuenciaTexto = {
      'M': 'Mensual',
      'B': 'Bimestral',
      'S': 'Semestral',
      'N': 'Nunca / Única'
    }[tarea.frecuencia] || tarea.frecuencia;

    const modalHtml = `
      <div class="modal fade" id="modalVerTarea" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-eye me-2"></i>Detalle de Tarea de Mantenimiento
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <table class="table table-sm table-borderless">
                <tr>
                  <td><strong>ID:</strong></td>
                  <td>${tarea.id}</td>
                </tr>
                <tr>
                  <td><strong>Nombre:</strong></td>
                  <td>${tarea.nombre}</td>
                </tr>
                <tr>
                  <td><strong>Frecuencia:</strong></td>
                  <td><span class="badge bg-${getFrecuenciaBadge(tarea.frecuencia)}">${frecuenciaTexto}</span></td>
                </tr>
                <tr>
                  <td><strong>Creado por:</strong></td>
                  <td>${tarea.creado_por_nombre || 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>Fecha creación:</strong></td>
                  <td>${tarea.created_at ? new Date(tarea.created_at).toLocaleDateString() : 'N/A'}</td>
                </tr>
              </table>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const oldModal = document.getElementById('modalVerTarea');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('modalVerTarea')).show();

  } catch (err) {
    console.error('Error al ver tarea:', err);
    alert('❌ Error de conexión al cargar la tarea');
  }
}

// =============================================
// EDITAR TAREA DE MANTENIMIENTO
// =============================================
async function editarTareaMantenimiento(id) {
  try {
    const res = await fetch(`/api/mantenimiento/tareas/${id}`);
    const data = await res.json();

    if (!data.success) {
      alert('❌ No se pudo cargar la tarea: ' + (data.error || 'Error desconocido'));
      return;
    }

    const tarea = data.tarea;

    const modalHtml = `
      <div class="modal fade" id="modalEditarTarea" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-pencil-square me-2"></i>Editar Tarea de Mantenimiento
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="formEditarTarea">
                <div class="mb-3">
                  <label class="form-label">Nombre de la tarea</label>
                  <input type="text" class="form-control" id="editNombreTarea" value="${tarea.nombre}" required>
                </div>
                <div class="mb-3">
                  <label class="form-label">Frecuencia</label>
                  <select class="form-select" id="editFrecuenciaTarea" required>
                    <option value="M" ${tarea.frecuencia === 'M' ? 'selected' : ''}>Mensual</option>
                    <option value="B" ${tarea.frecuencia === 'B' ? 'selected' : ''}>Bimestral</option>
                    <option value="S" ${tarea.frecuencia === 'S' ? 'selected' : ''}>Semestral</option>
                    <option value="N" ${tarea.frecuencia === 'N' ? 'selected' : ''}>Nunca / Única</option>
                  </select>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-warning" onclick="guardarEdicionTareaMantenimiento(${id})">
                <i class="bi bi-save me-1"></i>Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const oldModal = document.getElementById('modalEditarTarea');
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('modalEditarTarea')).show();

  } catch (err) {
    console.error('Error al editar tarea:', err);
    alert('❌ Error de conexión');
  }
}

// =============================================
// GUARDAR EDICIÓN DE TAREA
// =============================================
async function guardarEdicionTareaMantenimiento(id) {
  const nombre = document.getElementById('editNombreTarea')?.value.trim();
  const frecuencia = document.getElementById('editFrecuenciaTarea')?.value;

  if (!nombre || !frecuencia) {
    alert('⚠️ Nombre y frecuencia son obligatorios');
    return;
  }

  try {
    const res = await fetch(`/api/mantenimiento/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, frecuencia })
    });

    const data = await res.json();

    if (data.success) {
      alert('✅ Tarea actualizada exitosamente');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarTarea'));
      if (modal) modal.hide();

      // Recargar la tabla de tareas
      cargarTareasMantenimiento();
    } else {
      alert('❌ Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (err) {
    console.error('Error al guardar edición:', err);
    alert('❌ Error de conexión');
  }
}


// ===============================
// MATRICULACIÓN EN LOTE - FRONTEND
// ===============================
// AGREGAR ESTAS FUNCIONES EN admin.js

// ===============================
// 1. CARGAR CICLOS ESCOLARES
// ===============================
async function cargarCiclosEscolares() {
  try {
    console.log('📅 Cargando ciclos escolares...');
    
    const res = await fetch('/api/ciclos-escolares');
    const data = await res.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    // Llenar selector de ciclos en el formulario de matriculación en lote
    const selectCiclo = document.getElementById('cicloMatriculacionLote');
    if (selectCiclo) {
      selectCiclo.innerHTML = '';
      data.ciclos.forEach(ciclo => {
        const option = document.createElement('option');
        option.value = ciclo;
        option.textContent = ciclo;
        if (ciclo === data.actual) {
          option.selected = true;
        }
        selectCiclo.appendChild(option);
      });
    }
    
    // Llenar selector de ciclos en el registro de estudiantes
    const selectCicloReg = document.getElementById('cicloEstudiantesReg');
    if (selectCicloReg) {
      selectCicloReg.innerHTML = '<option value="">Todos los ciclos</option>';
      data.ciclos.forEach(ciclo => {
        const option = document.createElement('option');
        option.value = ciclo;
        option.textContent = ciclo + (ciclo === data.actual ? ' (Actual)' : ' (Histórico)');
        selectCicloReg.appendChild(option);
      });
    }
    
    console.log(`✅ ${data.ciclos.length} ciclo(s) cargado(s)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ===============================
// 2. OBTENER ESTUDIANTES DE UN CURSO (para matriculación en lote)
// ===============================
async function cargarEstudiantesCurso(cursoId) {
  try {
    console.log(`📋 Obteniendo estudiantes del curso ${cursoId}...`);
    
    if (!cursoId) {
      document.getElementById('tablaEstudiantesCursoLote').innerHTML = 
        '<tr><td colspan="7" class="text-center text-muted">Seleccione un curso primero</td></tr>';
      return;
    }
    
    const res = await fetch(`/api/matriculas/curso/${cursoId}/estudiantes`);
    const data = await res.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      alert('Error: ' + data.error);
      return;
    }
    
    console.log(`✅ ${data.total} estudiante(s) obtenido(s)`);
    
    mostrarEstudiantesCursoLote(data.estudiantes);
    
    // Actualizar contador
    const contador = document.getElementById('contadorEstudiantesCurso');
    if (contador) {
      contador.textContent = data.total;
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error de conexión');
  }
}

// ===============================
// 3. MOSTRAR ESTUDIANTES EN TABLA (con checkboxes)
// ===============================
function mostrarEstudiantesCursoLote(estudiantes) {
  const tbody = document.getElementById('tablaEstudiantesCursoLote');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (estudiantes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay estudiantes en este curso</td></tr>';
    return;
  }
  
  estudiantes.forEach(est => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="checkbox" class="form-check-input estudiante-checkbox" 
               value="${est.estudiante_id}" 
               data-nombre="${est.nombre}">
      </td>
      <td>${est.cedula}</td>
      <td>${est.nombre}</td>
      <td>${est.genero}</td>
      <td>${est.grado} ${est.nivel} - ${est.paralelo}</td>
      <td>${est.periodo_actual}</td>
      <td>
        ${est.adaptacion_curricular !== 'Ninguna' 
          ? `<span class="badge bg-warning">${est.adaptacion_curricular}</span>` 
          : '<span class="badge bg-secondary">Ninguna</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  console.log(`✅ Tabla renderizada con ${estudiantes.length} estudiantes`);
  
  // Event listener para el checkbox "Seleccionar todos"
  const checkboxTodos = document.getElementById('seleccionarTodosEstudiantes');
  if (checkboxTodos) {
    checkboxTodos.addEventListener('change', function() {
      document.querySelectorAll('.estudiante-checkbox').forEach(cb => {
        cb.checked = this.checked;
      });
      actualizarContadorSeleccionados();
    });
  }
  
  // Event listener para cada checkbox individual
  document.querySelectorAll('.estudiante-checkbox').forEach(cb => {
    cb.addEventListener('change', actualizarContadorSeleccionados);
  });
}

// ===============================
// 4. ACTUALIZAR CONTADOR DE SELECCIONADOS
// ===============================
function actualizarContadorSeleccionados() {
  const seleccionados = document.querySelectorAll('.estudiante-checkbox:checked').length;
  const contador = document.getElementById('contadorEstudiantesSeleccionados');
  
  if (contador) {
    contador.textContent = seleccionados;
  }
  
  // Habilitar/deshabilitar botón de matriculación
  const btnMatricular = document.getElementById('btnMatricularLote');
  if (btnMatricular) {
    btnMatricular.disabled = seleccionados === 0;
  }
  
  console.log(`✅ ${seleccionados} estudiante(s) seleccionado(s)`);
}

// ===============================
// 5. MATRICULAR EN LOTE
// ===============================
async function matricularEnLote() {
  try {
    // Obtener estudiantes seleccionados
    const checkboxesSeleccionados = document.querySelectorAll('.estudiante-checkbox:checked');
    const estudiantes_ids = Array.from(checkboxesSeleccionados).map(cb => parseInt(cb.value));
    
    if (estudiantes_ids.length === 0) {
      alert('⚠️ Seleccione al menos un estudiante');
      return;
    }
    
    // Obtener clase destino y período
    const clase_destino_id = document.getElementById('claseDestinoLote').value;
    const periodo_lectivo = document.getElementById('periodDestino').value;
    
    if (!clase_destino_id) {
      alert('⚠️ Seleccione una clase destino');
      return;
    }
    
    if (!periodo_lectivo) {
      alert('⚠️ Seleccione un período lectivo');
      return;
    }
    
    // Confirmación
    const nombres = Array.from(checkboxesSeleccionados)
      .slice(0, 3)
      .map(cb => cb.getAttribute('data-nombre'))
      .join(', ');
    
    const restoMensaje = estudiantes_ids.length > 3 
      ? ` ... y ${estudiantes_ids.length - 3} más` 
      : '';
    
    const confirmacion = confirm(`
      ⚠️ ¿Está seguro de matricular ${estudiantes_ids.length} estudiante(s) en la nueva clase?
      
      Estudiantes: ${nombres}${restoMensaje}
      
      Esta acción registrará a todos estos estudiantes en el período ${periodo_lectivo}.
    `);
    
    if (!confirmacion) return;
    
    // Mostrar indicador de carga
    const btnMatricular = document.getElementById('btnMatricularLote');
    const textoOriginal = btnMatricular.innerHTML;
    btnMatricular.disabled = true;
    btnMatricular.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';
    
    console.log(`📤 Matriculando en lote...`);
    console.log(`   Estudiantes: ${estudiantes_ids.length}`);
    console.log(`   Clase destino: ${clase_destino_id}`);
    console.log(`   Período: ${periodo_lectivo}`);
    
    const res = await fetch('/api/matriculas/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estudiantes_ids,
        clase_destino_id,
        periodo_lectivo
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      console.log(`✅ Lote procesado:`);
      console.log(`   Exitosas: ${data.exitosas}`);
      console.log(`   Duplicadas: ${data.duplicadas}`);
      
      let mensaje = `✅ ${data.mensaje}\n\n`;
      mensaje += `Exitosas: ${data.exitosas}\n`;
      mensaje += `Duplicadas: ${data.duplicadas}`;
      
      if (data.errores && data.errores.length > 0) {
        mensaje += `\nErrores: ${data.errores.length}`;
      }
      
      alert(mensaje);
      
      // Limpiar selección
      document.querySelectorAll('.estudiante-checkbox').forEach(cb => cb.checked = false);
      document.getElementById('seleccionarTodosEstudiantes').checked = false;
      actualizarContadorSeleccionados();
      
      // Recargar datos
      await cargarMatriculas();
      await cargarRegistroEstudiantes();
      
    } else {
      alert('❌ Error: ' + data.error);
    }
    
    // Restaurar botón
    btnMatricular.disabled = false;
    btnMatricular.innerHTML = textoOriginal;
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión: ' + error.message);
    
    // Restaurar botón
    const btnMatricular = document.getElementById('btnMatricularLote');
    if (btnMatricular) {
      btnMatricular.disabled = false;
      btnMatricular.innerHTML = '<i class="bi bi-person-plus me-1"></i>Matricular Seleccionados';
    }
  }
}

// ===============================
// 6. CARGAR ESTUDIANTES POR CICLO (para registro histórico)
// ===============================
async function cargarEstudiantesPorCiclo(ciclo) {
  try {
    console.log(`📅 Cargando estudiantes del ciclo ${ciclo}...`);
    
    if (!ciclo) {
      // Cargar todos si ciclo está vacío
      await cargarRegistroEstudiantes();
      return;
    }
    
    const res = await fetch(`/api/estudiantes/por-ciclo/${ciclo}`);
    const data = await res.json();
    
    if (!data.success) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    console.log(`✅ ${data.total} estudiante(s) del ciclo ${ciclo}`);
    
    // Mostrar en tabla
    mostrarRegistroEstudiantesCiclo(data.estudiantes, ciclo);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// ===============================
// 7. MOSTRAR ESTUDIANTES POR CICLO (con separación visual)
// ===============================


// ===============================
// 8. CARGAR GRADOS PARA CLASE DESTINO
// ===============================
async function cargarGradosClaseDestino() {
  try {
    const res = await fetch('/api/grados/completos');
    const data = await res.json();
    
    if (!data.success) return;
    
    const select = document.getElementById('claseDestinoLote');
    if (select) {
      select.innerHTML = '<option value="">Seleccionar clase destino</option>';
      
      const gradosUnicos = {};
      data.grados.forEach(grado => {
        const key = `${grado.id}`;
        if (!gradosUnicos[key]) {
          gradosUnicos[key] = {
            id: grado.id,
            grado: grado.grado,
            nivel: grado.nivel,
            paralelo: grado.paralelo
          };
        }
      });
      
      Object.values(gradosUnicos).forEach(grado => {
        const option = document.createElement('option');
        option.value = grado.id;
        option.textContent = `${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error cargando grados:', error);
  }
}

// ===============================
// INICIALIZAR MATRICULACIÓN EN LOTE
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando matriculación en lote...');
  
  // Cargar ciclos escolares
  cargarCiclosEscolares();
  
  // Cargar grados para clase destino
  cargarGradosClaseDestino();
  
  // Event listener: cuando se selecciona un curso origen
  const selectCursoOrigen = document.getElementById('cursoOrigenLote');
  if (selectCursoOrigen) {
    selectCursoOrigen.addEventListener('change', function() {
      cargarEstudiantesCurso(this.value);
    });
  }
  
  // Event listener: cuando se selecciona un ciclo en registro
  const selectCicloReg = document.getElementById('cicloEstudiantesReg');
  if (selectCicloReg) {
    selectCicloReg.addEventListener('change', function() {
      cargarEstudiantesPorCiclo(this.value);
    });
  }
  
  // Event listener: botón matricular en lote
  const btnMatricular = document.getElementById('btnMatricularLote');
  if (btnMatricular) {
    btnMatricular.addEventListener('click', matricularEnLote);
  }
  
  console.log('✅ Matriculación en lote inicializado');
});

// ===============================
// ACCESIBILIDAD - RESETEAR RESPUESTAS
// ===============================

// ✅ RESETEAR TODAS LAS RESPUESTAS
async function resetearTodasRespuestas() {
  console.log('🗑️ Iniciando reset de todas las respuestas...');
  
  // Confirmación 1
  const confirmacion1 = confirm(
    '⚠️ ¿Está seguro de ELIMINAR TODAS las respuestas de la encuesta?\n\n' +
    'Esta acción eliminará PERMANENTEMENTE todas las respuestas de todos los usuarios.\n\n' +
    '⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER.'
  );
  
  if (!confirmacion1) {
    console.log('❌ Reset cancelado por el usuario');
    return;
  }
  
  // Confirmación 2
  const confirmacion2 = confirm(
    '🚨 CONFIRMACIÓN FINAL\n\n' +
    '¿REALMENTE desea eliminar TODAS las respuestas?\n\n' +
    'Escriba OK en el siguiente cuadro para confirmar.'
  );
  
  if (!confirmacion2) {
    console.log('❌ Reset cancelado en segunda confirmación');
    return;
  }
  
  const confirmacionTexto = prompt('Escriba OK (en mayúsculas) para confirmar la eliminación:');
  
  if (confirmacionTexto !== 'OK') {
    alert('❌ Reset cancelado - Código incorrecto');
    return;
  }
  
  try {
    // Mostrar indicador de carga
    const notificacion = mostrarNotificacionAccesibilidad('Eliminando respuestas...', 'warning');
    
    const data = await fetchSafe('/api/accesibilidad/reset-all', {
      method: 'DELETE'
    });
    
    if (data.success) {
      console.log('✅ Reset completado:', data.respuestas_eliminadas, 'respuestas eliminadas');
      
      mostrarNotificacionAccesibilidad(
        `✅ ${data.message}\n${data.respuestas_eliminadas} respuesta(s) eliminada(s)`,
        'success'
      );
      
      // Recargar resultados
      setTimeout(() => {
        cargarResultadosAccesibilidad();
      }, 1500);
      
    } else {
      console.error('❌ Error:', data.error);
      mostrarNotificacionAccesibilidad(`❌ Error: ${data.error}`, 'danger');
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    mostrarNotificacionAccesibilidad(`❌ Error de conexión: ${error.message}`, 'danger');
  }
}

// ✅ RESETEAR RESPUESTAS DE UN USUARIO
async function resetearRespuestasUsuario(usuarioId) {
  if (!usuarioId) {
    alert('⚠️ Debe especificar un ID de usuario');
    return;
  }
  
  const confirmacion = confirm(
    `⚠️ ¿Está seguro de eliminar todas las respuestas del usuario ID ${usuarioId}?\n\n` +
    'Esta acción NO se puede deshacer.'
  );
  
  if (!confirmacion) return;
  
  try {
    const data = await fetchSafe(`/api/accesibilidad/usuario/${usuarioId}/reset`, {
      method: 'DELETE'
    });
    
    if (data.success) {
      console.log('✅ Respuestas del usuario eliminadas');
      mostrarNotificacionAccesibilidad(data.message, 'success');
      
      setTimeout(() => {
        cargarResultadosAccesibilidad();
      }, 1000);
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// ✅ OBTENER ESTADÍSTICAS
async function obtenerEstadisticasAccesibilidad() {
  try {
    console.log('📊 Obteniendo estadísticas...');
    
    const data = await fetchSafe('/api/accesibilidad/estadisticas');
    
    if (data.success) {
      const stats = data.estadisticas;
      
      console.log('✅ Estadísticas:', stats);
      
      // Mostrar en un modal
      const modalHtml = `
        <div class="modal fade" id="modalEstadisticasAccesibilidad" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header bg-info text-white">
                <h5 class="modal-title">
                  <i class="bi bi-graph-up me-2"></i>Estadísticas de Accesibilidad
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <table class="table table-striped">
                  <tr>
                    <td><strong>Total de usuarios que respondieron:</strong></td>
                    <td class="text-end"><span class="badge bg-primary fs-6">${stats.total_usuarios || 0}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Total de respuestas registradas:</strong></td>
                    <td class="text-end"><span class="badge bg-success fs-6">${stats.total_respuestas || 0}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Preguntas respondidas:</strong></td>
                    <td class="text-end"><span class="badge bg-info fs-6">${stats.preguntas_respondidas || 0}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Primera respuesta:</strong></td>
                    <td class="text-end">${stats.primera_respuesta ? new Date(stats.primera_respuesta).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Última respuesta:</strong></td>
                    <td class="text-end">${stats.ultima_respuesta ? new Date(stats.ultima_respuesta).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const modalAnterior = document.getElementById('modalEstadisticasAccesibilidad');
      if (modalAnterior) modalAnterior.remove();
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      const modal = new bootstrap.Modal(document.getElementById('modalEstadisticasAccesibilidad'));
      modal.show();
      
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// ===============================
// ACCESIBILIDAD - RESETEAR RESPUESTAS
// ===============================

// ✅ RESETEAR TODAS LAS RESPUESTAS
async function resetearTodasRespuestas() {
  console.log('🗑️ Iniciando reset de todas las respuestas...');
  
  // Confirmación 1
  const confirmacion1 = confirm(
    '⚠️ ¿Está seguro de ELIMINAR TODAS las respuestas de la encuesta?\n\n' +
    'Esta acción eliminará PERMANENTEMENTE todas las respuestas de todos los usuarios.\n\n' +
    '⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER.'
  );
  
  if (!confirmacion1) {
    console.log('❌ Reset cancelado por el usuario');
    return;
  }
  
  // Confirmación 2
  const confirmacion2 = confirm(
    '🚨 CONFIRMACIÓN FINAL\n\n' +
    '¿REALMENTE desea eliminar TODAS las respuestas?\n\n' +
    'Escriba OK en el siguiente cuadro para confirmar.'
  );
  
  if (!confirmacion2) {
    console.log('❌ Reset cancelado en segunda confirmación');
    return;
  }
  
  const confirmacionTexto = prompt('Escriba OK (en mayúsculas) para confirmar la eliminación:');
  
  if (confirmacionTexto !== 'OK') {
    alert('❌ Reset cancelado - Código incorrecto');
    return;
  }
  
  try {
    // Mostrar indicador de carga
    const notificacion = mostrarNotificacionAccesibilidad('Eliminando respuestas...', 'warning');
    
    const data = await fetchSafe('/api/accesibilidad/reset-all', {
      method: 'DELETE'
    });
    
    if (data.success) {
      console.log('✅ Reset completado:', data.respuestas_eliminadas, 'respuestas eliminadas');
      
      mostrarNotificacionAccesibilidad(
        `✅ ${data.message}\n${data.respuestas_eliminadas} respuesta(s) eliminada(s)`,
        'success'
      );
      
      // Recargar resultados
      setTimeout(() => {
        cargarResultadosAccesibilidad();
      }, 1500);
      
    } else {
      console.error('❌ Error:', data.error);
      mostrarNotificacionAccesibilidad(`❌ Error: ${data.error}`, 'danger');
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    mostrarNotificacionAccesibilidad(`❌ Error de conexión: ${error.message}`, 'danger');
  }
}

// ✅ RESETEAR RESPUESTAS DE UN USUARIO
async function resetearRespuestasUsuario(usuarioId) {
  if (!usuarioId) {
    alert('⚠️ Debe especificar un ID de usuario');
    return;
  }
  
  const confirmacion = confirm(
    `⚠️ ¿Está seguro de eliminar todas las respuestas del usuario ID ${usuarioId}?\n\n` +
    'Esta acción NO se puede deshacer.'
  );
  
  if (!confirmacion) return;
  
  try {
    const data = await fetchSafe(`/api/accesibilidad/usuario/${usuarioId}/reset`, {
      method: 'DELETE'
    });
    
    if (data.success) {
      console.log('✅ Respuestas del usuario eliminadas');
      mostrarNotificacionAccesibilidad(data.message, 'success');
      
      setTimeout(() => {
        cargarResultadosAccesibilidad();
      }, 1000);
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// ✅ OBTENER ESTADÍSTICAS
async function obtenerEstadisticasAccesibilidad() {
  try {
    console.log('📊 Obteniendo estadísticas...');
    
    const data = await fetchSafe('/api/accesibilidad/estadisticas');
    
    if (data.success) {
      const stats = data.estadisticas;
      
      console.log('✅ Estadísticas:', stats);
      
      // Mostrar en un modal
      const modalHtml = `
        <div class="modal fade" id="modalEstadisticasAccesibilidad" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header bg-info text-white">
                <h5 class="modal-title">
                  <i class="bi bi-graph-up me-2"></i>Estadísticas de Accesibilidad
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <table class="table table-striped">
                  <tr>
                    <td><strong>Total de usuarios que respondieron:</strong></td>
                    <td class="text-end"><span class="badge bg-primary fs-6">${stats.total_usuarios || 0}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Total de respuestas registradas:</strong></td>
                    <td class="text-end"><span class="badge bg-success fs-6">${stats.total_respuestas || 0}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Preguntas respondidas:</strong></td>
                    <td class="text-end"><span class="badge bg-info fs-6">${stats.preguntas_respondidas || 0}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Primera respuesta:</strong></td>
                    <td class="text-end">${stats.primera_respuesta ? new Date(stats.primera_respuesta).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Última respuesta:</strong></td>
                    <td class="text-end">${stats.ultima_respuesta ? new Date(stats.ultima_respuesta).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const modalAnterior = document.getElementById('modalEstadisticasAccesibilidad');
      if (modalAnterior) modalAnterior.remove();
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      const modal = new bootstrap.Modal(document.getElementById('modalEstadisticasAccesibilidad'));
      modal.show();
      
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error de conexión');
  }
}

// ✅ FUNCIÓN AUXILIAR PARA NOTIFICACIONES
function mostrarNotificacionAccesibilidad(mensaje, tipo = 'info') {
  const container = document.getElementById('resultadoAccesibilidad') || 
                    document.querySelector('.container');
  
  if (container) {
    const notificacion = document.createElement('div');
    notificacion.className = `alert alert-${tipo} alert-dismissible fade show position-fixed bottom-0 end-0 m-3`;
    notificacion.style.zIndex = '9999';
    notificacion.style.minWidth = '300px';
    notificacion.innerHTML = `
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(notificacion);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
      notificacion.style.transition = 'opacity 0.5s';
      notificacion.style.opacity = '0';
      setTimeout(() => notificacion.remove(), 500);
    }, 5000);
    
    return notificacion;
  }
}


// ===============================
// FUNCIÓN PARA ACTUALIZACIÓN SILENCIOSA (SIN PARPADEOS)
// ===============================

let datosAnteriorMatriculas = null;
let datosAnteriorEstudiantes = null;

function actualizarSilencioso(nuevosDatos, datosAnteriores, tbody, funcionMostrar) {
  // Comparar datos
  const datosJSON_nuevos = JSON.stringify(nuevosDatos);
  const datosJSON_anterior = datosAnteriores ? JSON.stringify(datosAnteriores) : '';
  
  if (datosJSON_nuevos === datosJSON_anterior) {
    console.log('✅ Sin cambios, no actualizar tabla');
    return datosAnteriores;
  }
  
  console.log('🔄 Datos cambiados, actualizando tabla...');
  
  // Guardar scroll position
  const scrollPos = tbody.parentElement?.scrollTop || 0;
  
  // Actualizar tabla
  funcionMostrar(nuevosDatos);
  
  // Restaurar scroll position
  if (tbody.parentElement) {
    tbody.parentElement.scrollTop = scrollPos;
  }
  
  return nuevosDatos;
}
// ✅ EXPORTAR FUNCIONES GLOBALES
window.resetearTodasRespuestas = resetearTodasRespuestas;
window.resetearRespuestasUsuario = resetearRespuestasUsuario;
window.obtenerEstadisticasAccesibilidad = obtenerEstadisticasAccesibilidad;

console.log('✅ Funciones de reset de accesibilidad cargadas');

