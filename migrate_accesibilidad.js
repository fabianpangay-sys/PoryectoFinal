const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'gesinfra.db'), (err) => {
  if (err) {
    console.error('❌ Error al conectar:', err);
  } else {
    console.log('✅ Conectado a la base de datos');
    migrarAccesibilidad();
  }
});

function migrarAccesibilidad() {
  db.serialize(() => {
    console.log('🔄 Iniciando migración de tabla accesibilidad...');

    // Lista de columnas a agregar (si no existen)
    const columnasNuevas = [
      { nombre: 'adaptaciones_tecnologicas', tipo: 'TEXT' },
      { nombre: 'contacto', tipo: 'TEXT' },
      { nombre: 'comite', tipo: 'TEXT' },
      { nombre: 'rampas', tipo: 'TEXT', default: "'Si'" },
      { nombre: 'banos', tipo: 'TEXT', default: "'Si'" },
      { nombre: 'elevadores', tipo: 'TEXT', default: "'N/A'" },
      { nombre: 'inventario_recursos', tipo: 'TEXT' },
      { nombre: 'plan_capacitacion', tipo: 'TEXT' },
      { nombre: 'registro_adaptaciones', tipo: 'INTEGER', default: '0' }
    ];

    // Verificar qué columnas existen
    db.all(`PRAGMA table_info(accesibilidad)`, [], (err, columnas) => {
      if (err) {
        console.error('❌ Error obteniendo info de tabla:', err);
        db.close();
        return;
      }

      const columnasExistentes = columnas.map(c => c.name);
      console.log('📋 Columnas existentes:', columnasExistentes);

      let columnasAgregadas = 0;

      // Agregar columnas faltantes
      columnasNuevas.forEach(col => {
        if (!columnasExistentes.includes(col.nombre)) {
          let sql = `ALTER TABLE accesibilidad ADD COLUMN ${col.nombre} ${col.tipo}`;
          if (col.default) {
            sql += ` DEFAULT ${col.default}`;
          }

          db.run(sql, (err) => {
            if (err) {
              console.error(`❌ Error agregando columna ${col.nombre}:`, err.message);
            } else {
              console.log(`✅ Columna agregada: ${col.nombre}`);
              columnasAgregadas++;
            }
          });
        } else {
          console.log(`⏭️  Columna ya existe: ${col.nombre}`);
        }
      });

      // Esperar un momento y cerrar
      setTimeout(() => {
        if (columnasAgregadas > 0) {
          console.log(`\n✅ Migración completada: ${columnasAgregadas} columna(s) agregada(s)`);
        } else {
          console.log('\n✅ No se requirieron cambios, todas las columnas ya existen');
        }
        db.close();
      }, 1000);
    });
  });
}