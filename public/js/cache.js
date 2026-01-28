// Sistema de caché simple para evitar recargas constantes
const cacheManager = {
  cache: {},
  timeouts: {},
  
  // Función principal que maneja el caché
  async fetchWithCache(key, fetchFunction, cacheTime = 5000) {
    const now = Date.now();
    
    // Si existe en caché y no ha expirado, retornar datos cacheados
    if (this.cache[key] && this.cache[key].expiry > now) {
      console.log(`✅ Usando caché para: ${key}`);
      return this.cache[key].data;
    }
    
    // Si no existe o expiró, hacer la petición
    console.log(`📥 Cargando datos frescos para: ${key}`);
    const data = await fetchFunction();
    
    // Guardar en caché con tiempo de expiración
    this.cache[key] = {
      data: data,
      expiry: now + cacheTime
    };
    
    return data;
  },
  
  // Limpiar caché específico
  invalidate(key) {
    delete this.cache[key];
    console.log(`🗑️ Caché eliminado: ${key}`);
  },
  
  // Limpiar todo el caché
  invalidateAll() {
    this.cache = {};
    console.log(`🗑️ Todo el caché eliminado`);
  }
};

// EJEMPLO DE USO:

// En lugar de llamar directamente a fetch cada vez:
async function cargarGrados() {
  return await cacheManager.fetchWithCache(
    'grados-completos', // key única
    async () => {
      // Tu función de fetch original
      const response = await fetch('/api/grados/completos');
      return await response.json();
    },
    5000 // caché válido por 5 segundos
  );
}

// Cuando crees/actualices un grado, invalida el caché:
async function crearAsignatura(datos) {
  const response = await fetch('/api/grados/asignaturas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  
  // Invalidar caché después de modificar datos
  cacheManager.invalidate('grados-completos');
  
  return await response.json();
}

// Para React/useEffect, úsalo así:
/*
useEffect(() => {
  cargarGrados().then(setGrados);
}, []); // Solo se ejecuta una vez al montar
*/