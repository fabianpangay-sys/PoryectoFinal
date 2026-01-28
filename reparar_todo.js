// reparar_todo.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'gesinfra.db'), (err) => {
  if (err) {
    console.error('❌ Error:', err.message);
    return;
  }
  console.log('✅ Conectado a gesinfra.db');
  repararTodo();
});

function agregarColumna(tabla, columna, tipo, mensaje) {
  return new Promise((resolve) => {
    db.run(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`ℹ️  ${tabla}.${columna} ya existe`);
        } else {
          console.error(`❌ Error en ${tabla}.${columna}:`, err.message);
        }
      } else {
        console.log(`✅ ${mensaje}`);
      }
      resolve();
    });
  });
}

async function repararTodo() {
  console.log('\n🔧 REPARANDO TODAS LAS TABLAS...\n');
  
  // 1. TABLA GRADOS
  await agregarColumna('grados', 'nivel', 'TEXT DEFAULT "EGB"', 'Columna nivel agregada a grados');
  
  // 2. TABLA MATRICULAS_NUEVAS
  await agregarColumna('matriculas_nuevas', 'nivel', 'TEXT', 'Columna nivel agregada a matriculas_nuevas');
  
  // 3. TABLA CLASES
  await agregarColumna('clases', 'nivel', 'TEXT DEFAULT "EGB"', 'Columna nivel agregada a clases');
  
  // 4. TABLA ASIGNATURAS_GRADO (si existe)
  await agregarColumna('asignaturas_grado', 'nivel', 'TEXT', 'Columna nivel agregada a asignaturas_grado');
  
  // 5. ACTUALIZAR DATOS
  console.log('\n📝 ACTUALIZANDO DATOS...\n');
  
  // Copiar curso a nivel en grados
  db.run(`UPDATE grados SET nivel = curso WHERE nivel IS NULL OR nivel = ''`, () => {
    console.log('✅ Datos copiados de curso a nivel en grados');
  });
  
  // Actualizar matriculas_nuevas con nivel del grado correspondiente
  db.run(`
    UPDATE matriculas_nuevas 
    SET nivel = (SELECT nivel FROM grados WHERE grados.id = matriculas_nuevas.grado_id)
    WHERE nivel IS NULL
  `, () => {
    console.log('✅ Niveles actualizados en matriculas_nuevas');
  });
  
  // Actualizar clases con nivel del grado correspondiente
  db.run(`
    UPDATE clases 
    SET nivel = 'EGB' 
    WHERE nivel IS NULL AND (curso LIKE '%EGB%' OR grado IN ('1ro','2do','3ro','4to','5to','6to','7mo','8vo','9no','10mo'))
  `, () => {
    console.log('✅ Niveles EGB actualizados en clases');
  });
  
  db.run(`
    UPDATE clases 
    SET nivel = 'BGU' 
    WHERE nivel IS NULL AND (curso LIKE '%BGU%' OR grado IN ('1ro BGU','2do BGU','3ro BGU'))
  `, () => {
    console.log('✅ Niveles BGU actualizados en clases');
  });
  
  // VERIFICAR
  setTimeout(() => {
    console.log('\n📊 VERIFICANDO CAMBIOS...\n');
    
    db.all(`SELECT 'grados' as tabla, COUNT(*) as total FROM grados UNION ALL
            SELECT 'matriculas_nuevas', COUNT(*) FROM matriculas_nuevas UNION ALL
            SELECT 'clases', COUNT(*) FROM clases`, (err, conteos) => {
      if (err) {
        console.error('❌ Error en conteo:', err.message);
      } else {
        conteos.forEach(c => {
          console.log(`   ${c.tabla}: ${c.total} registros`);
        });
      }
      
      console.log('\n🎉 REPARACIÓN COMPLETADA!');
      console.log('🔄 REINICIA TU SERVIDOR:');
      console.log('   1. Presiona Ctrl+C en la terminal');
      console.log('   2. Ejecuta: node tu_servidor.js');
      console.log('   3. Refresca tu navegador');
      
      db.close();
    });
  }, 1000);
}