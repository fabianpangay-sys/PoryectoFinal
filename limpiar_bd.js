const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'gesinfra.db'));

console.log('\n🗑️ LIMPIANDO BASE DE DATOS DE MATRÍCULAS...\n');

db.serialize(() => {
  // 1. Ver qué hay ANTES
  db.all(`
    SELECT m.id, m.estudiante_id, e.nombre, m.clase_id, m.periodo_lectivo
    FROM matriculas m
    LEFT JOIN estudiantes e ON m.estudiante_id = e.id
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Error:', err.message);
      return;
    }
    
    console.log('📊 MATRÍCULAS ACTUALES:');
    console.table(rows || []);
    console.log(`Total: ${rows.length}\n`);
    
    // 2. Eliminar TODAS las matrículas
    db.run(`DELETE FROM matriculas`, function(err) {
      if (err) {
        console.error('❌ Error eliminando:', err.message);
        return;
      }
      
      console.log(`✅ ELIMINADAS: ${this.changes} matrículas`);
      console.log('✅ Tabla de matrículas VACÍA\n');
      
      // 3. Verificar que esté vacía
      db.all(`SELECT COUNT(*) as total FROM matriculas`, [], (err, rows) => {
        console.log('📊 MATRÍCULAS DESPUÉS DE LIMPIAR:');
        console.log(`Total: ${rows[0].total}\n`);
        
        console.log('✅ BASE DE DATOS LIMPIA - LISTO PARA MATRICULAR\n');
        db.close();
      });
    });
  });
});