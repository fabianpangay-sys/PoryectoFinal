// ========== VERIFICAR SESIÓN ==========
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

if (!currentUser) {
  window.location.href = 'login.html';
}

document.getElementById('userInfo').textContent = `${currentUser.fullname} (${currentUser.role})`;

// ========== LOGOUT ==========
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
});

// ========== DARK MODE ==========
document.getElementById('darkModeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

// ========== NAVEGACIÓN CARDS ==========
document.querySelectorAll('.module-card').forEach(card => {
  card.addEventListener('click', () => {
    const target = card.dataset.target;
    const tabButton = document.querySelector(`[data-bs-target="#${target}"]`);
    if (tabButton) tabButton.click();
  });
});

// ========== GESTIÓN DE USUARIOS ==========

// Cargar usuarios
function loadUsers() {
  fetch('/api/admin/usuarios')
    .then(res => res.json())
    .then(users => {
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = users.map(user => `
        <tr>
          <td>${user.id}</td>
          <td>${user.username}</td>
          <td>${user.fullname}</td>
          <td>${user.email}</td>
          <td><span class="badge bg-${getRoleBadge(user.role)}">${user.role}</span></td>
          <td><span class="badge bg-${user.active ? 'success' : 'danger'}">${user.active ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editUser(${user.id})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Eliminar</button>
          </td>
        </tr>
      `).join('');
    })
    .catch(err => console.error('Error al cargar usuarios:', err));
}

function getRoleBadge(role) {
  const badges = { admin: 'danger', docente: 'primary', estudiante: 'info' };
  return badges[role] || 'secondary';
}

// Crear usuario
document.getElementById('createUserForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const userData = {
    username: document.getElementById('newUsername').value,
    password: document.getElementById('newPassword').value,
    fullname: document.getElementById('newFullName').value,
    email: document.getElementById('newEmail').value,
    role: document.getElementById('newRole').value
  };

  fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  })
    .then(res => res.json())
    .then(data => {
      alert('✅ Usuario creado exitosamente');
      loadUsers();
      e.target.reset();
    })
    .catch(err => alert('❌ Error al crear usuario: ' + err));
});

// Eliminar usuario
function deleteUser(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  
  fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      alert('✅ Usuario eliminado');
      loadUsers();
    })
    .catch(err => alert('❌ Error: ' + err));
}

// ========== INVENTARIO ==========

// Cargar inventario
function loadInventory() {
  fetch('/api/inventario')
    .then(res => res.json())
    .then(items => {
      const tbody = document.getElementById('inventory-table-body');
      tbody.innerHTML = items.map(item => `
        <tr>
          <td>${item.codigo}</td>
          <td><span class="badge bg-primary">${item.tipo}</span></td>
          <td>${item.ubicacion}</td>
          <td><span class="badge bg-${getEstadoBadge(item.estado)}">${item.estado}</span></td>
          <td>
            <button class="btn btn-sm btn-info" onclick="viewAsset(${item.id})">Ver</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAsset(${item.id})">Eliminar</button>
          </td>
        </tr>
      `).join('');
    })
    .catch(err => console.error('Error al cargar inventario:', err));
}

function getEstadoBadge(estado) {
  const badges = { Operativo: 'success', Mantenimiento: 'warning', Desuso: 'danger' };
  return badges[estado] || 'secondary';
}

// Crear activo
document.getElementById('assetForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const assetData = {
    codigo: document.getElementById('codActivo').value,
    tipo: document.getElementById('tipoEquipo').value,
    ubicacion: document.getElementById('ubicacion').value,
    estado: document.getElementById('estado').value,
    descripcion: document.getElementById('descripcion').value
  };

  fetch('/api/inventario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assetData)
  })
    .then(res => res.json())
    .then(data => {
      alert('✅ Activo añadido exitosamente');
      loadInventory();
      e.target.reset();
    })
    .catch(err => alert('❌ Error: ' + err));
});

// Eliminar activo
function deleteAsset(id) {
  if (!confirm('¿Eliminar este activo?')) return;
  
  fetch(`/api/inventario/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      alert('✅ Activo eliminado');
      loadInventory();
    })
    .catch(err => alert('❌ Error: ' + err));
}

// ========== ESTUDIANTES ==========

// Cargar estudiantes
function loadStudents() {
  fetch('/api/estudiantes')
    .then(res => res.json())
    .then(students => {
      window.studentsData = students; // Guardar globalmente
      loadGrades(); // Cargar calificaciones
    })
    .catch(err => console.error('Error al cargar estudiantes:', err));
}

// Crear estudiante
document.getElementById('addStudentForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const studentData = {
    cedula: document.getElementById('newStudentCedula').value,
    nombre: document.getElementById('newStudentName').value,
    genero: document.getElementById('newStudentGender').value,
    clase_id: 1 // Por defecto
  };

  fetch('/api/estudiantes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData)
  })
    .then(res => res.json())
    .then(data => {
      alert('✅ Estudiante registrado');
      loadStudents();
      e.target.reset();
    })
    .catch(err => alert('❌ Error: ' + err));
});

// ========== CALIFICACIONES ==========

// Cargar calificaciones por trimestre
function loadGrades() {
  for (let trimestre = 1; trimestre <= 3; trimestre++) {
    fetch(`/api/calificaciones/${trimestre}`)
      .then(res => res.json())
      .then(grades => {
        const tbody = document.getElementById(`trimestre${trimestre}Table`);
        
        // Combinar estudiantes con calificaciones
        const rows = (window.studentsData || []).map(student => {
          const grade = grades.find(g => g.estudiante_id === student.id) || {};
          return `
            <tr>
              <td>${student.cedula}</td>
              <td>${student.nombre}</td>
              <td><input type="number" class="form-control form-control-sm" value="${grade.tareas || 0}" min="0" max="10" step="0.01" 
                  onchange="updateGrade(${student.id}, ${trimestre}, 'tareas', this.value)"></td>
              <td><input type="number" class="form-control form-control-sm" value="${grade.leccion || 0}" min="0" max="10" step="0.01"
                  onchange="updateGrade(${student.id}, ${trimestre}, 'leccion', this.value)"></td>
              <td><strong>${grade.promedio || 0}</strong></td>
              <td><span class="badge bg-${grade.estado === 'Aprobado' ? 'success' : 'danger'}">${grade.estado || 'Pendiente'}</span></td>
            </tr>
          `;
        }).join('');
        
        tbody.innerHTML = rows;
      })
      .catch(err => console.error(`Error al cargar trimestre ${trimestre}:`, err));
  }
}

// Actualizar calificación
function updateGrade(estudiante_id, trimestre, field, value) {
  // Obtener valores actuales
  const tareas = field === 'tareas' ? parseFloat(value) : 0;
  const leccion = field === 'leccion' ? parseFloat(value) : 0;
  
  fetch('/api/calificaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estudiante_id, trimestre, tareas, leccion })
  })
    .then(res => res.json())
    .then(data => {
      console.log('Calificación actualizada:', data);
      loadGrades();
    })
    .catch(err => console.error('Error:', err));
}

// ========== ACCESIBILIDAD ==========

// Cargar políticas
function loadAccessibility() {
  fetch('/api/accesibilidad')
    .then(res => res.json())
    .then(data => {
      if (data.id) {
        document.getElementById('display_politica_general').textContent = data.politica_general || 'N/A';
        document.getElementById('display_adaptaciones_tecnologicas').textContent = data.adaptaciones_tecnologicas || 'N/A';
        document.getElementById('display_plan_capacitacion').textContent = data.plan_capacitacion || 'N/A';
        document.getElementById('display_revision_fecha').textContent = data.revision_fecha || 'N/A';
        document.getElementById('display_responsable').textContent = data.responsable || 'N/A';
      }
    })
    .catch(err => console.error('Error:', err));
}

// Guardar políticas
document.getElementById('saveAccessibilityBtn').addEventListener('click', () => {
  const data = {
    politica_general: document.getElementById('politica_general').value,
    adaptaciones_tecnologicas: document.getElementById('adaptaciones_tecnologicas').value,
    plan_capacitacion: document.getElementById('plan_capacitacion').value,
    revision_fecha: document.getElementById('revision_fecha').value,
    responsable: document.getElementById('responsable').value
  };

  fetch('/api/accesibilidad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(res => res.json())
    .then(result => {
      alert('✅ Políticas guardadas');
      loadAccessibility();
    })
    .catch(err => alert('❌ Error: ' + err));
});

// ========== INICIALIZACIÓN ==========
loadUsers();
loadInventory();
loadStudents();
loadAccessibility();