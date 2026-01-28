

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crear/conectar base de datos
const db = new sqlite3.Database(path.join(__dirname, 'gesinfra.db'), (err) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
  } else {
    console.log('✅ Conectado a SQLite (gesinfra.db)');
    initDatabase();
  }
});

// Crear todas las tablas
function initDatabase() {
  db.serialize(() => {
    
    // ============================================
    // TABLAS DE USUARIOS Y AUTENTICACIÓN
    // ============================================
    
    // TABLA USUARIOS (Admin crea docentes y estudiantes)
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      cedula TEXT UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'docente', 'estudiante')),
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES usuarios(id)
    )`);

    // TABLA PERMISOS (Relaciona usuarios con módulos)
    db.run(`CREATE TABLE IF NOT EXISTS permisos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      modulo TEXT NOT NULL CHECK(modulo IN ('inventario', 'calificaciones', 'accesibilidad', 'mantenimiento')),
      puede_leer INTEGER DEFAULT 1,
      puede_editar INTEGER DEFAULT 0,
      puede_crear INTEGER DEFAULT 0,
      puede_eliminar INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE(usuario_id, modulo)
    )`);

    // ============================================
    // TABLAS DE ESTRUCTURA ACADÉMICA
    // ============================================

    // TABLA SUBNIVELES EDUCATIVOS
    db.run(`CREATE TABLE IF NOT EXISTS subniveles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLA ASIGNATURAS (Admin puede crear asignaturas dinámicamente)
    db.run(`CREATE TABLE IF NOT EXISTS asignaturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      color TEXT DEFAULT '#007bff',
      activo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES usuarios(id)
    )`);

    // TABLA CLASES (Grado/Curso/Paralelo + Asignatura + Docente)
    db.run(`CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subnivel_id INTEGER NOT NULL,
      grado TEXT NOT NULL,
      curso TEXT NOT NULL,
      paralelo TEXT NOT NULL,
      asignatura_id INTEGER,
      docente_id INTEGER,
      periodo_lectivo TEXT DEFAULT '2025-2026',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (subnivel_id) REFERENCES subniveles(id),
      FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id),
      FOREIGN KEY (docente_id) REFERENCES usuarios(id),
      FOREIGN KEY (created_by) REFERENCES usuarios(id),
      UNIQUE(grado, curso, paralelo, asignatura_id, periodo_lectivo)
    )`);

    // ===============================
// TABLA: CLASE_ASIGNATURA (⭐ RELACIÓN MUCHOS A MUCHOS)
// ===============================
db.run(`CREATE TABLE IF NOT EXISTS clase_asignatura (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clase_id INTEGER NOT NULL,
  asignatura_id INTEGER NOT NULL,
  docente_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
  FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE,
  FOREIGN KEY (docente_id) REFERENCES usuarios(id),
  UNIQUE(clase_id, asignatura_id)
)`);

    // ============================================
    // TABLAS DE ESTUDIANTES Y MATRÍCULA
    // ============================================

    // TABLA ESTUDIANTES (Creados por ADMIN)
    db.run(`CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cedula TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      genero TEXT NOT NULL CHECK(genero IN ('Masculino', 'Femenino')),
      adaptacion_curricular TEXT DEFAULT 'Ninguna',
      usuario_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (created_by) REFERENCES usuarios(id)
    )`);

    // TABLA MATRICULAS (Relaciona estudiantes con clases)
    db.run(`CREATE TABLE IF NOT EXISTS matriculas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      clase_id INTEGER NOT NULL,
      periodo_lectivo TEXT NOT NULL,
      fecha_matricula DATE DEFAULT CURRENT_DATE,
      estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'retirado', 'graduado')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
      FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id),
      UNIQUE(estudiante_id, clase_id, periodo_lectivo)
    )`);

    // ============================================
    // TABLAS DE CALIFICACIONES
    // ============================================

    // TABLA CONFIGURACION_TAREAS (Define las 4 tareas por trimestre)
    // ============================================
// TABLA CONFIGURACION_TAREAS (CORREGIDA)
// ============================================
// REEMPLAZA LA SECCIÓN configuracion_tareas en database.js (línea ~132)

db.run(`CREATE TABLE IF NOT EXISTS configuracion_tareas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clase_id INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK(trimestre IN (1, 2, 3)),
  numero_tarea INTEGER NOT NULL CHECK(numero_tarea BETWEEN 1 AND 10),
  nombre_tarea TEXT NOT NULL,
  descripcion TEXT,
  fecha_entrega DATE,
  peso REAL DEFAULT 0.175,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES usuarios(id),
  UNIQUE(clase_id, trimestre, numero_tarea)
)`);

    // TABLA TAREAS (Calificaciones de tareas por estudiante)
    db.run(`CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      clase_id INTEGER NOT NULL,
      trimestre INTEGER NOT NULL CHECK(trimestre IN (1, 2, 3)),
      numero_tarea INTEGER NOT NULL CHECK(numero_tarea BETWEEN 1 AND 4),
      nota REAL DEFAULT 0 CHECK(nota >= 0 AND nota <= 10.00),
      fecha DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
      FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id),
      UNIQUE(estudiante_id, clase_id, trimestre, numero_tarea)
    )`);

    // TABLA EXAMENES (Examen por trimestre - 30%)
    db.run(`CREATE TABLE IF NOT EXISTS examenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      clase_id INTEGER NOT NULL,
      trimestre INTEGER NOT NULL CHECK(trimestre IN (1, 2, 3)),
      nota REAL DEFAULT 0 CHECK(nota >= 0 AND nota <= 10.00),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
      FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id),
      UNIQUE(estudiante_id, clase_id, trimestre)
    )`);

    // TABLA PROYECTOS (Proyecto por trimestre - 15%)
db.run(`CREATE TABLE IF NOT EXISTS proyectos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante_id INTEGER NOT NULL,
  clase_id INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK(trimestre IN (1, 2, 3)),
  nota REAL DEFAULT 0 CHECK(nota >= 0 AND nota <= 10.00),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
  FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES usuarios(id),
  UNIQUE(estudiante_id, clase_id, trimestre)
)`);

    // TABLA PROMEDIOS (Promedios calculados por trimestre)
    db.run(`CREATE TABLE IF NOT EXISTS promedios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      clase_id INTEGER NOT NULL,
      trimestre INTEGER NOT NULL CHECK(trimestre IN (1, 2, 3)),
      promedio_tareas REAL DEFAULT 0,
      promedio_trimestre REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
      FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
      UNIQUE(estudiante_id, clase_id, trimestre)
    )`);

    // TABLA PROMEDIOS_ANUALES
    db.run(`CREATE TABLE IF NOT EXISTS promedios_anuales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      clase_id INTEGER NOT NULL,
      periodo_lectivo TEXT NOT NULL,
      promedio_t1 REAL DEFAULT 0,
      promedio_t2 REAL DEFAULT 0,
      promedio_t3 REAL DEFAULT 0,
      promedio_anual REAL DEFAULT 0,
      estado TEXT DEFAULT 'Pendiente' CHECK(estado IN ('Aprobado', 'Supletorio', 'Reprobado', 'Pendiente')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
      FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
      UNIQUE(estudiante_id, clase_id, periodo_lectivo)
    )`);

    // TABLA SUPLETORIOS
    db.run(`CREATE TABLE IF NOT EXISTS supletorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      clase_id INTEGER NOT NULL,
      periodo_lectivo TEXT NOT NULL,
      promedio_base REAL DEFAULT 0,
      nota_supletorio REAL DEFAULT 0 CHECK(nota_supletorio >= 0 AND nota_supletorio <= 10.00),
      nota_final REAL DEFAULT 0,
      estado_final TEXT DEFAULT 'Pendiente' CHECK(estado_final IN ('Aprobado (S)', 'Reprobado (S)', 'Pendiente')),
      fecha_supletorio DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
      FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES usuarios(id),
      UNIQUE(estudiante_id, clase_id, periodo_lectivo)
    )`);

    // ============================================
    // TABLAS DE INVENTARIO Y MANTENIMIENTO
    // ============================================

    // TABLA INVENTARIO
    db.run(`CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      tipo TEXT NOT NULL,
      ubicacion TEXT NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('Operativo', 'Mantenimiento', 'Desuso')),
      descripcion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_at DATETIME,
      updated_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES usuarios(id),
      FOREIGN KEY (updated_by) REFERENCES usuarios(id)
    )`);

    // TABLA TAREAS_MANTENIMIENTO (Cronograma configurado)
    db.run(`CREATE TABLE IF NOT EXISTS tareas_mantenimiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      frecuencia TEXT NOT NULL CHECK(frecuencia IN ('M', 'B', 'S', 'N')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES usuarios(id)
    )`);

    // TABLA MANTENIMIENTOS_REALIZADOS
    db.run(`CREATE TABLE IF NOT EXISTS mantenimientos_realizados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventario_id INTEGER NOT NULL,
      tarea_mantenimiento_id INTEGER NOT NULL,
      fecha_realizada DATE DEFAULT CURRENT_DATE,
      observaciones TEXT,
      realizado_por INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventario_id) REFERENCES inventario(id) ON DELETE CASCADE,
      FOREIGN KEY (tarea_mantenimiento_id) REFERENCES tareas_mantenimiento(id),
      FOREIGN KEY (realizado_por) REFERENCES usuarios(id)
    )`);

    // ============================================
    // TABLAS DE ACCESIBILIDAD
    // ============================================

  

db.run(`
  CREATE TABLE IF NOT EXISTS actividades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  clase_id INTEGER NOT NULL,
  docente_id INTEGER NOT NULL,
  fecha_entrega DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clase_id) REFERENCES clases(id),
  FOREIGN KEY (docente_id) REFERENCES usuarios(id)
);

`);

// AGREGAR COLUMNAS SI NO EXISTEN (Para compatibilidad con BD existentes)
db.run(`ALTER TABLE configuracion_tareas ADD COLUMN descripcion TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('❌ Error agregando descripcion a configuracion_tareas:', err.message);
  } else {
    console.log('✅ Columna descripcion en configuracion_tareas verificada');
  }
});

db.run(`ALTER TABLE configuracion_tareas ADD COLUMN fecha_entrega DATE`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('❌ Error agregando fecha_entrega a configuracion_tareas:', err.message);
  } else {
    console.log('✅ Columna fecha_entrega en configuracion_tareas verificada');
  }
});

db.run(`ALTER TABLE configuracion_tareas ADD COLUMN updated_at DATETIME`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('❌ Error agregando updated_at a configuracion_tareas:', err.message);
  } else {
    console.log('✅ Columna updated_at en configuracion_tareas verificada');
  }
});




    // ============================================
    // DATOS INICIALES
    // ============================================

    // CREAR SUBNIVELES POR DEFECTO
    const subniveles = [
      ['Preparatoria', '1ro EGB'],
      ['Básica Elemental', '2do-4to EGB'],
      ['Básica Media', '5to-7mo EGB'],
      ['Básica Superior', '8vo-10mo EGB'],
      ['Bachillerato', '1ro-3ro BGU']
    ];

    subniveles.forEach(([nombre, desc]) => {
      db.run('INSERT OR IGNORE INTO subniveles (nombre, descripcion) VALUES (?, ?)', [nombre, desc]);
    });

    // CREAR USUARIO ADMIN POR DEFECTO
    db.run(`INSERT OR IGNORE INTO usuarios (username, password, fullname, email, cedula, role) 
            VALUES ('admin', 'admin123', 'Administrador Sistema', 'admin@gesinfra.com', '0000000000', 'admin')`,
      (err) => {
        if (!err) {
          console.log('✅ Usuario admin creado (admin/admin123)');
          
          // Dar permisos completos al admin en todos los módulos
          const modulos = ['inventario', 'calificaciones', 'accesibilidad', 'mantenimiento'];
          modulos.forEach(modulo => {
            db.run(`INSERT OR IGNORE INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar) 
                    VALUES (1, ?, 1, 1, 1, 1)`, [modulo]);
          });
        }
      }
    );

    // CREAR ASIGNATURA DE EJEMPLO (Admin la creará desde el sistema)
    db.run(`INSERT OR IGNORE INTO asignaturas (codigo, nombre, descripcion, color, created_by) 
            VALUES ('INF', 'Informática Aplicada', 'Asignatura de computación y tecnología', '#17a2b8', 1)`,
      (err) => {
        if (!err) console.log('✅ Asignatura de ejemplo creada (Informática)');
      }
    );

    // CREAR DOCENTE DE EJEMPLO (SOLO PARA TESTING - En producción el admin los crea)
    db.run(`INSERT OR IGNORE INTO usuarios (username, password, fullname, email, cedula, role, created_by) 
            VALUES ('docente1', 'docente123', 'Prof. Juan Pérez', 'docente@gesinfra.com', '0123456789', 'docente', 1)`,
      (err) => {
        if (!err) {
          console.log('✅ Usuario docente creado (docente1/docente123)');
          
          // Dar permisos al docente
          db.run(`INSERT OR IGNORE INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar) 
                  VALUES (2, 'calificaciones', 1, 1, 1, 1)`);
          db.run(`INSERT OR IGNORE INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar) 
                  VALUES (2, 'inventario', 1, 0, 0, 0)`);
          db.run(`INSERT OR IGNORE INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar) 
                  VALUES (2, 'accesibilidad', 1, 0, 0, 0)`);
          db.run(`INSERT OR IGNORE INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar) 
                  VALUES (2, 'mantenimiento', 1, 0, 0, 0)`);
        }
      }
    );

    // CREAR CLASE DE EJEMPLO
    db.run(`INSERT OR IGNORE INTO clases (subnivel_id, grado, curso, paralelo, asignatura_id, docente_id, created_by) 
            VALUES (4, '9no', 'EGB', 'A', 1, 2, 1)`,
      (err) => {
        if (!err) {
          console.log('✅ Clase de ejemplo creada (9no EGB - A - Informática)');
          
          // Crear configuración de tareas por defecto para esta clase
          const tareasDefault = [
            [1, 1, 'Tarea 1'], [1, 2, 'Tarea 2'], [1, 3, 'Tarea 3'], [1, 4, 'Tarea 4'],
            [2, 1, 'Tarea 1'], [2, 2, 'Tarea 2'], [2, 3, 'Tarea 3'], [2, 4, 'Tarea 4'],
            [3, 1, 'Tarea 1'], [3, 2, 'Tarea 2'], [3, 3, 'Tarea 3'], [3, 4, 'Tarea 4']
          ];
          
          tareasDefault.forEach(([trimestre, numero, nombre]) => {
            db.run(`INSERT OR IGNORE INTO configuracion_tareas (clase_id, trimestre, numero_tarea, nombre_tarea, created_by) 
                    VALUES (1, ?, ?, ?, 1)`, [trimestre, numero, nombre]);
          });
        }
      }
    );

    // CREAR ESTUDIANTE DE EJEMPLO (SOLO PARA TESTING)
    db.run(`INSERT OR IGNORE INTO usuarios (username, password, fullname, email, cedula, role, created_by) 
            VALUES ('estudiante1', 'est123', 'Ana García López', 'ana@gesinfra.com', '0987654321', 'estudiante', 1)`,
      (err) => {
        if (!err) {
          console.log('✅ Usuario estudiante creado (estudiante1/est123)');
          
          // Crear registro de estudiante
          db.run(`INSERT OR IGNORE INTO estudiantes (cedula, nombre, genero, adaptacion_curricular, usuario_id, created_by) 
                  VALUES ('0987654321', 'Ana García López', 'Femenino', 'Ninguna', 3, 1)`, (err) => {
            if (!err) {
              // Matricular en la clase de ejemplo
              db.run(`INSERT OR IGNORE INTO matriculas (estudiante_id, clase_id, periodo_lectivo, created_by) 
                      VALUES (1, 1, '2025-2026', 1)`);
            }
          });
          
          // Dar permisos de lectura al estudiante
          db.run(`INSERT OR IGNORE INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar) 
                  VALUES (3, 'calificaciones', 1, 0, 0, 0)`);
        }
      }
    );

    // CREAR TAREAS DE MANTENIMIENTO POR DEFECTO
    const tareasMantenimiento = [
      ['Limpieza Física (Interna/Externa)', 'S'],
      ['Chequeo de Antivirus (Escaneo)', 'M'],
      ['Limpieza de Archivos Temporales', 'M'],
      ['Revisión y Actualización de Drivers', 'B']
    ];

    tareasMantenimiento.forEach(([nombre, freq]) => {
      db.run(`INSERT OR IGNORE INTO tareas_mantenimiento (nombre, frecuencia, created_by) 
              VALUES (?, ?, 1)`, [nombre, freq]);
    });

    // CREAR REGISTRO DE ACCESIBILIDAD INICIAL
    

    console.log('✅ Tablas creadas/verificadas correctamente');
     db.run(`ALTER TABLE estudiantes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error agregando updated_at a estudiantes:', err.message);
      } else {
        console.log('✅ Columna updated_at en estudiantes verificada');
      }
    });

    db.run(`ALTER TABLE usuarios ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error agregando updated_at a usuarios:', err.message);
      } else {
        console.log('✅ Columna updated_at en usuarios verificada');
      }
    });

    db.run(`ALTER TABLE clases ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('❌ Error agregando updated_at a clases:', err.message);
      } else {
        console.log('✅ Columna updated_at en clases verificada');
      }
    });
    console.log('');
    console.log('📌 USUARIOS DE PRUEBA:');
    console.log('   Admin: admin / admin123');
    console.log('   Docente: docente1 / docente123');
    console.log('   Estudiante: estudiante1 / est123');
    console.log('');
  });
}

console.log('✅ Tablas creadas/verificadas correctamente');

// ============================================
// AGREGAR COLUMNAS updated_at SI NO EXISTEN
// ============================================
// ============================================
// AGREGAR COLUMNAS updated_at (CORREGIDO)
// ============================================
// Esperar a que se creen las tablas primero

setTimeout(() => {
  // Para tabla ESTUDIANTES
  db.run(`ALTER TABLE IF EXISTS estudiantes ADD COLUMN updated_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✅ Columna updated_at en estudiantes ya existe');
      } else {
        console.warn('⚠️ No se pudo agregar updated_at a estudiantes (tabla puede no existir aún)');
      }
    } else {
      // Actualizar registros existentes
      db.run(`UPDATE estudiantes SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      console.log('✅ Columna updated_at en estudiantes agregada');
    }
  });

  // Para tabla CLASES
  db.run(`ALTER TABLE IF EXISTS clases ADD COLUMN updated_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✅ Columna updated_at en clases ya existe');
      } else {
        console.warn('⚠️ No se pudo agregar updated_at a clases (tabla puede no existir aún)');
      }
    } else {
      // Actualizar registros existentes
      db.run(`UPDATE clases SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      console.log('✅ Columna updated_at en clases agregada');
    }
  });

  // Para tabla MATRICULAS
  db.run(`ALTER TABLE IF EXISTS matriculas ADD COLUMN updated_at DATETIME`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✅ Columna updated_at en matriculas ya existe');
      } else {
        console.warn('⚠️ No se pudo agregar updated_at a matriculas (tabla puede no existir aún)');
      }
    } else {
      // Actualizar registros existentes
      db.run(`UPDATE matriculas SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      console.log('✅ Columna updated_at en matriculas agregada');
    }
  });
}, 2000); // Esperar 2 segundos a que se creen las tablas

db.run(`ALTER TABLE usuarios ADD COLUMN updated_at DATETIME`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('❌ Error agregando updated_at a usuarios:', err.message);
  } else {
    // Actualizar registros existentes con la fecha actual
    db.run(`UPDATE usuarios SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`, (updateErr) => {
      if (!updateErr) {
        console.log('✅ Columna updated_at en usuarios verificada');
      }
    });
  }
});

db.run(`ALTER TABLE clases ADD COLUMN updated_at DATETIME`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('❌ Error agregando updated_at a clases:', err.message);
  } else {
    // Actualizar registros existentes con la fecha actual
    db.run(`UPDATE clases SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`, (updateErr) => {
      if (!updateErr) {
        console.log('✅ Columna updated_at en clases verificada');
      }
    });
  }
});

// ============================================
// AGREGAR updated_at a MATRICULAS
// ============================================
db.run(`ALTER TABLE matriculas ADD COLUMN updated_at DATETIME`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('❌ Error agregando updated_at a matriculas:', err.message);
  } else {
    // Actualizar registros existentes con la fecha actual
    db.run(`UPDATE matriculas SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`, (updateErr) => {
      if (!updateErr) {
        console.log('✅ Columna updated_at en matriculas verificada');
      }
    });
  }
});

console.log('');
console.log('📌 USUARIOS DE PRUEBA:');
console.log('   Admin: admin / admin123');
console.log('   Docente: docente1 / docente123');
console.log('   Estudiante: estudiante1 / est123');
console.log('');

// Función para crear una asignatura y luego la clase vinculada
function crearClaseConMateria(datos, callback) {
    const { nombreMateria, grado, curso, paralelo, docenteId, subnivelId, adminId } = datos;

    db.serialize(() => {
        // 1. Intentamos insertar la asignatura o ignorar si el código/nombre ya existe
        // Usamos el nombre como código simplificado para este ejemplo
        const codigoMateria = nombreMateria.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 100);
        
        db.run(`INSERT OR IGNORE INTO asignaturas (codigo, nombre, created_by) VALUES (?, ?, ?)`, 
        [codigoMateria, nombreMateria, adminId], function(err) {
            if (err) return callback(err);

            // 2. Buscamos el ID de la asignatura (la que acabamos de crear o la que ya existía)
            db.get(`SELECT id FROM asignaturas WHERE nombre = ?`, [nombreMateria], (err, asignatura) => {
                if (err || !asignatura) return callback(err || new Error("No se encontró la asignatura"));

                // 3. Insertamos la clase vinculando el ID de la asignatura
                const sql = `INSERT INTO clases (subnivel_id, grado, curso, paralelo, asignatura_id, docente_id, created_by) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`;
                
                db.run(sql, [subnivelId || 1, grado, curso, paralelo, asignatura.id, docenteId, adminId], function(err) {
                    callback(err, this.lastID);
                });
            });
        });
    });
}

// ... (Todo tu código anterior de tablas académicas está excelente)

// ============================================
// MODULO DE ACCESIBILIDAD (ENCUESTA UNL)
// ============================================
// ============================================
// MODULO DE ACCESIBILIDAD (ENCUESTA UNL) - VERSIÓN CORREGIDA
// ============================================
db.serialize(() => {
    // 1. Crear tablas del catálogo
    db.run(`CREATE TABLE IF NOT EXISTS encuesta_preguntas (
        id TEXT PRIMARY KEY,
        modulo TEXT NOT NULL,
        pregunta TEXT NOT NULL,
        tipo_respuesta TEXT NOT NULL,
        opciones TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS encuesta_respuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        pregunta_id TEXT NOT NULL,
        respuesta_valor TEXT NOT NULL,
        fecha_respuesta DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pregunta_id) REFERENCES encuesta_preguntas(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    // 2. Poblar preguntas - TODAS CON ESCALA 1-5 PARA ACUERDO/DESACUERDO
    const preguntasAccesibilidad = [
        // INFRAESTRUCTURA FÍSICA
        ['FIS_01', 'Física', 'La institución cuenta con accesos adecuados (rampas, ascensores, pasamanos)', 'escala', '1,2,3,4,5'],
        ['FIS_02', 'Física', 'Las aulas están diseñadas para sillas de ruedas', 'escala', '1,2,3,4,5'],
        ['FIS_03', 'Física', 'Existen baños adaptados para personas con discapacidad', 'escala', '1,2,3,4,5'],
        ['FIS_04', 'Física', 'Existen sistemas de alerta visual y sonora para emergencias', 'escala', '1,2,3,4,5'],
        ['FIS_05', 'Física', 'Hay señalización Braille y de alto contraste en las instalaciones', 'escala', '1,2,3,4,5'],
        
        // ASPECTOS TECNOLÓGICOS
        ['TEC_01', 'Tecnológica', 'Se dispone de tecnologías asistidas para estudiantes', 'escala', '1,2,3,4,5'],
        ['TEC_02', 'Tecnológica', 'Las plataformas digitales son accesibles para todos', 'escala', '1,2,3,4,5'],
        ['TEC_03', 'Tecnológica', 'Los materiales se proporcionan en formatos accesibles (PDF accesible, subtítulos, etc.)', 'escala', '1,2,3,4,5'],
        ['TEC_04', 'Tecnológica', 'Existe capacitación docente en tecnologías de apoyo e inclusión', 'escala', '1,2,3,4,5'],
        ['TEC_05', 'Tecnológica', 'Se cuentan con sistemas de comunicación aumentativa y alternativa', 'escala', '1,2,3,4,5'],
        
        // ASPECTOS PEDAGÓGICOS
        ['PED_01', 'Pedagógica', 'El personal docente tiene formación en educación inclusiva', 'escala', '1,2,3,4,5'],
        ['PED_02', 'Pedagógica', 'Se realizan adaptaciones curriculares según las necesidades del estudiante', 'escala', '1,2,3,4,5'],
        ['PED_03', 'Pedagógica', 'Se utilizan metodologías inclusivas como el Diseño Universal para el Aprendizaje (DUA)', 'escala', '1,2,3,4,5'],
        ['PED_04', 'Pedagógica', 'Existe flexibilidad en los sistemas de evaluación para estudiantes con discapacidad', 'escala', '1,2,3,4,5'],
        ['PED_05', 'Pedagógica', 'Hay disponibilidad de personal especializado en educación inclusiva', 'escala', '1,2,3,4,5']
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO encuesta_preguntas (id, modulo, pregunta, tipo_respuesta, opciones) VALUES (?, ?, ?, ?, ?)`);
    preguntasAccesibilidad.forEach(p => stmt.run(p, (err) => {
        if (err) console.error("Error al insertar pregunta:", p[0], err.message);
        else console.log("✅ Pregunta insertada:", p[0], "-", p[2].substring(0, 50) + "...");
    }));
    stmt.finalize(() => {
        console.log("✅ Todas las preguntas de accesibilidad cargadas correctamente");
    });
});





// Al final de tu archivo database.js reemplaza el module.exports anterior por este:
module.exports = {
    db: db,
    crearClaseConMateria: crearClaseConMateria
};

