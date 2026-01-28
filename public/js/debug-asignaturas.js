// ===============================
// DEBUG ASIGNATURAS - AGREGAR AL FINAL DE admin.js
// ===============================

// Función para probar directamente
async function debugAsignaturas() {
  console.log('\n🔧 === INICIANDO DEBUG DE ASIGNATURAS ===\n');
  
  // TEST 1: Verificar que fetchSafe existe
  console.log('TEST 1: ¿Existe fetchSafe?');
  if (typeof fetchSafe === 'function') {
    console.log('✅ fetchSafe existe');
  } else {
    console.log('❌ fetchSafe NO existe');
    return;
  }

  // TEST 2: Llamar al endpoint directamente
  console.log('\nTEST 2: Llamando a /api/grados/asignaturas...');
  try {
    const response = await fetch('/api/grados/asignaturas');
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (data.success) {
      console.log(`✅ Endpoint respondió correctamente`);
      console.log(`   Total asignaturas: ${data.asignaturas?.length || 0}`);
      
      if (data.asignaturas && data.asignaturas.length > 0) {
        console.log('\n📋 Primeras 3 asignaturas:');
        data.asignaturas.slice(0, 3).forEach((asig, idx) => {
          console.log(`   [${idx+1}] ${asig.nombre} (Grado: ${asig.grado}, Docente: ${asig.docente_nombre})`);
        });
      } else {
        console.log('⚠️ El endpoint retorna éxito pero SIN asignaturas');
      }
    } else {
      console.log(`❌ Error en endpoint: ${data.error}`);
    }
  } catch (error) {
    console.log(`❌ Error en fetch: ${error.message}`);
  }

  // TEST 3: Verificar /api/grados/completos
  console.log('\n\nTEST 3: Llamando a /api/grados/completos...');
  try {
    const response = await fetch('/api/grados/completos');
    const data = await response.json();
    
    console.log('Response status:', response.status);
    
    if (data.success) {
      console.log(`✅ Endpoint respondió correctamente`);
      console.log(`   Total grados: ${data.grados?.length || 0}`);
      
      if (data.grados && data.grados.length > 0) {
        console.log('\n📋 Primeros 3 grados:');
        data.grados.slice(0, 3).forEach((grado, idx) => {
          console.log(`   [${idx+1}] ${grado.grado} ${grado.nivel} ${grado.paralelo}`);
          console.log(`       - Asignaturas: ${grado.asignaturas?.length || 0}`);
          if (grado.asignaturas && grado.asignaturas.length > 0) {
            grado.asignaturas.slice(0, 2).forEach(asig => {
              console.log(`         • ${asig.nombre} (${asig.docente_nombre || 'Sin docente'})`);
            });
          }
        });
      } else {
        console.log('⚠️ El endpoint retorna éxito pero SIN grados');
      }
    } else {
      console.log(`❌ Error en endpoint: ${data.error}`);
    }
  } catch (error) {
    console.log(`❌ Error en fetch: ${error.message}`);
  }

  // TEST 4: Verificar BASE DE DATOS (BACKEND)
  console.log('\n\nTEST 4: Verificando base de datos...');
  console.log('📌 Abre la consola del navegador (F12) y copia esto en la pestaña Network:');
  console.log('   - Busca peticiones a /api/grados/asignaturas');
  console.log('   - Busca peticiones a /api/grados/completos');
  console.log('   - Verifica el estado HTTP (200 = OK)');
  console.log('   - Mira la respuesta (tab "Response")');

  console.log('\n🔧 === FIN DEBUG ===\n');
}

// Ejecutar debug cuando está listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('\n⏳ Esperando 2 segundos antes de debug...\n');
  setTimeout(() => {
    debugAsignaturas();
  }, 2000);
});

// También disponible manualmente en consola con:
// debugAsignaturas()