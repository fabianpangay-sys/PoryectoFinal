// Verificar si ya hay sesión activa
const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

if (currentUser) {
  redirectByRole(currentUser.role);
}

// Manejar formulario de login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const alertContainer = document.getElementById('alertContainer');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Guardar usuario COMPLETO con permisos en localStorage
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      
      // Mostrar mensaje de éxito
      showAlert('success', `✅ Bienvenido ${data.user.fullname}. Redirigiendo...`);
      
      // Redirigir según rol
      setTimeout(() => {
        redirectByRole(data.user.role);
      }, 1000);
      
    } else {
      showAlert('danger', '❌ Credenciales incorrectas. Intenta nuevamente.');
    }
    
  } catch (error) {
    showAlert('danger', '❌ Error de conexión. Verifica que el servidor esté corriendo.');
    console.error('Error:', error);
  }
});

// Función para redirigir según el rol
function redirectByRole(role) {
  switch(role) {
    case 'admin':
      window.location.href = 'admin-dashboard.html';
      break;
    case 'docente':
      window.location.href = 'docente-dashboard.html';
      break;
    case 'estudiante':
      window.location.href = 'student-dashboard.html';
      break;
    default:
      window.location.href = 'login.html';
  }
}

// Función para mostrar alertas
function showAlert(type, message) {
  const alertContainer = document.getElementById('alertContainer');
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}

// FUNCIÓN GLOBAL: Hacer peticiones autenticadas
window.fetchWithAuth = async function(url, options = {}) {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  
  // Agregar header de autenticación
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': user.id,
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Si recibe 401, redirigir a login
  if (response.status === 401) {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
    return;
  }
  
  return response;
}

// FUNCIÓN GLOBAL: Verificar permiso del usuario actual
window.hasPermission = function(modulo, accion = 'leer') {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  
  if (!user) return false;
  if (user.role === 'admin') return true; // Admin siempre tiene permiso
  
  const permiso = user.permisos.find(p => p.modulo === modulo);
  if (!permiso) return false;
  
  const campoPermiso = `puede_${accion}`;
  return permiso[campoPermiso] === 1;
}