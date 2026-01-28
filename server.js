
// ===============================
// IMPORTACIONES
// ===============================
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const { db } = require('./database');

const app = express();
const PORT = 3000;

// ===============================
// CONFIGURACIÓN GENERAL
// ===============================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'gesinfra_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 horas
  }
}));

// ===============================
// ARCHIVOS ESTÁTICOS
// ===============================
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// RUTA PRINCIPAL → LOGIN
// ===============================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ===============================
// MIDDLEWARE AUTENTICACIÓN
// ===============================
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/');
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.user && req.session.user.role === role) return next();
    res.status(403).send('⛔ Acceso denegado');
  };
}

function requirePermission(modulo, accion) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    // Admin tiene todos los permisos
    if (req.session.user.role === 'admin') {
      return next();
    }

    const query = `
      SELECT puede_leer, puede_editar, puede_crear, puede_eliminar
      FROM permisos
      WHERE usuario_id = ? AND modulo = ?
    `;

    db.get(query, [req.session.user.id, modulo], (err, permiso) => {
      if (err || !permiso) {
        return res.status(403).json({ 
          success: false, 
          error: 'No tiene permisos para este módulo' 
        });
      }

      const tienePermiso = {
        'leer': permiso.puede_leer,
        'editar': permiso.puede_editar,
        'crear': permiso.puede_crear,
        'eliminar': permiso.puede_eliminar
      }[accion];

      if (!tienePermiso) {
        return res.status(403).json({ 
          success: false, 
          error: `No tiene permiso para ${accion} en este módulo` 
        });
      }

      next();
    });
  };
}

// ===============================
// LOGIN
// ===============================
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT * FROM usuarios
     WHERE username = ? AND password = ? AND active = 1`,
    [username, password],
    (err, user) => {
      if (err) return res.status(500).send('Error servidor');
      if (!user) return res.redirect('/?error=1');

      req.session.user = {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        cedula: user.cedula,
        role: user.role
      };

      if (user.role === 'admin') return res.redirect('/admin-dashboard.html');
      if (user.role === 'docente') return res.redirect('/docente-dashboard.html');
      if (user.role === 'estudiante') return res.redirect('/estudiante-dashboard.html');
    }
  );
});

// ===============================
// LOGOUT
// ===============================
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ===============================
// DASHBOARDS PROTEGIDOS
// ===============================
app.get('/admin-dashboard.html',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
  }
);

app.get('/docente-dashboard.html',
  isAuthenticated, requireRole('docente'),
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docente-dashboard.html'));
  }
);

app.get('/estudiante-dashboard.html',
  isAuthenticated, requireRole('estudiante'),
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'estudiante-dashboard.html'));
  }
);

// ===============================
// API → SESIÓN
// ===============================
app.get('/api/me', isAuthenticated, (req, res) => {
  res.json(req.session.user);
});

app.get('/api/auth/verify', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, authenticated: false });
  }
  res.json({ success: true, authenticated: true, user: req.session.user });
});

// ===============================
// API → ADMIN USUARIOS
// ===============================

// LISTAR USUARIOS
app.get('/api/admin/usuarios',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    db.all(
      `SELECT id, username, fullname, email, cedula, role, active
       FROM usuarios
       ORDER BY id DESC`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, usuarios: rows });
      }
    );
  }
);

// CREAR USUARIO
app.post('/api/admin/usuarios',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { username, password, fullname, email, cedula, role } = req.body;

    if (!username || !password || !fullname || !email || !role) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son requeridos' 
      });
    }

    db.run(
      `INSERT INTO usuarios
       (username, password, fullname, email, cedula, role, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, password, fullname, email, cedula || null, role, req.session.user.id],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ 
              success: false, 
              error: 'El usuario, email o cédula ya existe' 
            });
          }
          return res.status(500).json({ success: false, error: err.message });
        }

        const newUserId = this.lastID;

        // Permisos automáticos
        if (role === 'docente') {
          db.run(`INSERT INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar)
                  VALUES (?, 'calificaciones', 1, 1, 1, 1)`, [newUserId]);
          db.run(`INSERT INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar)
                  VALUES (?, 'inventario', 1, 0, 0, 0)`, [newUserId]);
          db.run(`INSERT INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar)
                  VALUES (?, 'accesibilidad', 1, 0, 0, 0)`, [newUserId]);
          db.run(`INSERT INTO permisos (usuario_id, modulo, puede_leer, puede_editar, puede_crear, puede_eliminar)
                  VALUES (?, 'mantenimiento', 1, 0, 0, 0)`, [newUserId]);
        }

        if (role === 'estudiante') {
          db.run(`INSERT INTO permisos (usuario_id, modulo, puede_leer)
                  VALUES (?, 'calificaciones', 1)`, [newUserId]);
        }

        res.json({ success: true, userId: newUserId });
      }
    );
  }
);

// ACTUALIZAR USUARIO
app.put('/api/admin/usuarios/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;
    const { fullname, email, active } = req.body;

    if (parseInt(id) === 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede modificar el usuario administrador principal' 
      });
    }

    db.run(
      `UPDATE usuarios SET fullname = ?, email = ?, active = ? WHERE id = ?`,
      [fullname, email, active, id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        res.json({ success: true, message: 'Usuario actualizado' });
      }
    );
  }
);

// ELIMINAR USUARIO
app.delete('/api/admin/usuarios/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede eliminar el usuario administrador principal' 
      });
    }

    db.run('DELETE FROM usuarios WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }
      res.json({ success: true, message: 'Usuario eliminado' });
    });
  }
);

// ===============================
// API → ASIGNATURAS
// ===============================

// LISTAR ASIGNATURAS
app.get('/api/asignaturas', isAuthenticated, (req, res) => {
  db.all(
    `SELECT id, codigo, nombre, descripcion, color, activo FROM asignaturas WHERE activo = 1 ORDER BY nombre`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, asignaturas: rows });
    }
  );
});

// CREAR ASIGNATURA
app.post('/api/asignaturas',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { codigo, nombre, descripcion, color } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({ success: false, error: 'Código y nombre son requeridos' });
    }

    db.run(
      `INSERT INTO asignaturas (codigo, nombre, descripcion, color, created_by) VALUES (?, ?, ?, ?, ?)`,
      [codigo, nombre, descripcion, color || '#007bff', req.session.user.id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'El código ya existe' });
          }
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, asignaturaId: this.lastID });
      }
    );
  }
);

// ACTUALIZAR ASIGNATURA
app.put('/api/asignaturas/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, color, activo } = req.body;

    db.run(
      `UPDATE asignaturas SET nombre = ?, descripcion = ?, color = ?, activo = ? WHERE id = ?`,
      [nombre, descripcion, color, activo, id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: 'Asignatura actualizada' });
      }
    );
  }
);

// ELIMINAR ASIGNATURA
app.delete('/api/asignaturas/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    db.run('UPDATE asignaturas SET activo = 0 WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: 'Asignatura desactivada' });
    });
  }
);

// ===============================
// API → CLASES
// ===============================

// LISTAR TODAS LAS CLASES (Admin ve todas, Docente solo las suyas)
app.get('/api/clases', isAuthenticated, (req, res) => {
  let query = `
    SELECT c.*, s.nombre as subnivel_nombre, a.nombre as asignatura_nombre, u.fullname as docente_nombre
    FROM clases c
    LEFT JOIN subniveles s ON c.subnivel_id = s.id
    LEFT JOIN asignaturas a ON c.asignatura_id = a.id
    LEFT JOIN usuarios u ON c.docente_id = u.id
  `;
  
  const params = [];
  
  if (req.session.user.role === 'docente') {
    query += ' WHERE c.docente_id = ?';
    params.push(req.session.user.id);
  }
  
  query += ' ORDER BY c.grado, c.paralelo';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, clases: rows });
  });
});

// ===============================
// API → ASIGNATURAS DEL ESTUDIANTE (NUEVO)
// ===============================

// ✅ OBTENER TODAS LAS ASIGNATURAS MATRICULADAS DEL ESTUDIANTE
app.get('/api/estudiantes/:estudianteId/asignaturas', 
  isAuthenticated, 
  (req, res) => {
    const { estudianteId } = req.params;
    
    console.log(`\n📚 GET /api/estudiantes/${estudianteId}/asignaturas`);
    
    db.all(`
      SELECT DISTINCT
        c.id as clase_id,
        c.grado,
        c.curso as nivel,
        c.paralelo,
        a.id as asignatura_id,
        a.nombre as asignatura_nombre,
        a.codigo as asignatura_codigo,
        a.color,
        u.id as docente_id,
        u.fullname as docente_nombre,
        m.periodo_lectivo
      FROM matriculas m
      INNER JOIN clases c ON m.clase_id = c.id
      LEFT JOIN asignaturas a ON c.asignatura_id = a.id
      LEFT JOIN usuarios u ON c.docente_id = u.id
      WHERE m.estudiante_id = ? AND m.estado = 'activo'
      ORDER BY a.nombre ASC
    `, [estudianteId], (err, asignaturas) => {
      if (err) {
        console.error('❌ Error:', err.message);
        return res.status(500).json({ 
          success: false, 
          error: 'Error obteniendo asignaturas: ' + err.message 
        });
      }
      
      if (!asignaturas || asignaturas.length === 0) {
        console.log('⚠️ Sin asignaturas');
        return res.json({ 
          success: true, 
          asignaturas: [],
          total: 0
        });
      }
      
      console.log(`✅ ${asignaturas.length} asignatura(s)`);
      
      res.json({ 
        success: true, 
        asignaturas: asignaturas,
        total: asignaturas.length
      });
    });
  }
);

// LISTAR DOCENTES
app.get('/api/docentes', isAuthenticated, (req, res) => {
  db.all(
    `SELECT id, fullname, email FROM usuarios WHERE role = 'docente' AND active = 1 ORDER BY fullname`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, docentes: rows });
    }
  );
});

// CREAR CLASE
// CREAR CLASE
// CREAR CLASE
app.post('/api/clases',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { nombreMateria, grado, curso, paralelo, docente_id, subnivel_id } = req.body;

    if (!nombreMateria || !grado || !curso || !paralelo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Materia, grado, curso y paralelo son requeridos' 
      });
    }

    // Importar la función crearClaseConMateria
    const { crearClaseConMateria } = require('./database');

    crearClaseConMateria({
      nombreMateria: nombreMateria,
      grado: grado,
      curso: curso,
      paralelo: paralelo,
      docenteId: docente_id || null,
      subnivelId: subnivel_id || 4,
      adminId: req.session.user.id
    }, (err, claseId) => {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(400).json({ 
            success: false, 
            error: 'Esta clase ya existe' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          error: err.message || 'Error al crear la clase' 
        });
      }

      // Obtener referencia a la base de datos
      const database = require('./database');
      const dbInstance = database.db;

      // Crear configuración de tareas por defecto
      for (let trimestre = 1; trimestre <= 3; trimestre++) {
        for (let numero = 1; numero <= 4; numero++) {
          dbInstance.run(
            `INSERT INTO configuracion_tareas (clase_id, trimestre, numero_tarea, nombre_tarea, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [claseId, trimestre, numero, `Tarea ${numero}`, req.session.user.id]
          );
        }
      }

      res.json({ success: true, claseId });
    });
  }
);
// ACTUALIZAR CLASE
// ACTUALIZAR CLASE (COMPLETA)
app.put('/api/clases/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;
    const { docente_id, grado, curso, paralelo } = req.body;

    // Validar que al menos un campo venga para actualizar
    if (docente_id === undefined && !grado && !curso && !paralelo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe proporcionar al menos un campo para actualizar' 
      });
    }

    // Construir query dinámico
    let updates = [];
    let params = [];

    if (docente_id !== undefined) {
      updates.push('docente_id = ?');
      params.push(docente_id);
    }
    if (grado) {
      updates.push('grado = ?');
      params.push(grado);
    }
    if (curso) {
      updates.push('curso = ?');
      params.push(curso);
    }
    if (paralelo) {
      updates.push('paralelo = ?');
      params.push(paralelo);
    }

    params.push(id); // El ID va al final para el WHERE

    const query = `UPDATE clases SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    db.run(query, params, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ 
            success: false, 
            error: 'Ya existe una clase con esa combinación de grado, curso y paralelo' 
          });
        }
        return res.status(500).json({ success: false, error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Clase no encontrada' });
      }

      res.json({ success: true, message: 'Clase actualizada exitosamente' });
    });
  }
);

// ELIMINAR CLASE
app.delete('/api/clases/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    db.run('DELETE FROM clases WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: 'Clase eliminada' });
    });
  }
);





// ===============================
// API → ESTUDIANTES
// ===============================

// LISTAR ESTUDIANTES
app.get('/api/estudiantes', isAuthenticated, (req, res) => {
  db.all(
    `SELECT e.*, u.username, u.email FROM estudiantes e
     LEFT JOIN usuarios u ON e.usuario_id = u.id
     ORDER BY e.nombre`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, estudiantes: rows });
    }
  );
});

// LISTAR ESTUDIANTES POR CLASE
app.get('/api/estudiantes/clase/:claseId', isAuthenticated, (req, res) => {
  const { claseId } = req.params;

  db.all(
    `SELECT e.*, m.estado as estado_matricula
     FROM estudiantes e
     INNER JOIN matriculas m ON e.id = m.estudiante_id
     WHERE m.clase_id = ? AND m.estado = 'activo'
     ORDER BY e.nombre`,
    [claseId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, estudiantes: rows });
    }
  );
});

// CREAR ESTUDIANTE Y MATRICULAR (TODO EN UNO - FASE 1)

// CREAR ESTUDIANTE Y MATRICULAR (TODO EN UNO - FASE 1)
app.post('/api/estudiantes',
  isAuthenticated, requirePermission('calificaciones', 'crear'),
  (req, res) => {
    const { cedula, nombre, genero, adaptacion_curricular, clase_id, periodo_lectivo } = req.body;

    if (!cedula || !nombre || !genero) {
      return res.status(400).json({ success: false, error: 'Cédula, nombre y género son requeridos' });
    }

    // PASO 1: Crear estudiante
    db.run(
      `INSERT INTO estudiantes (cedula, nombre, genero, adaptacion_curricular, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [cedula, nombre, genero, adaptacion_curricular || 'Ninguna', req.session.user.id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'La cédula ya está registrada' });
          }
          return res.status(500).json({ success: false, error: err.message });
        }

        const estudianteId = this.lastID;

        // PASO 2: Crear usuario automáticamente con EMAIL TEMPORAL
        db.run(
          `INSERT INTO usuarios (username, password, fullname, email, cedula, role, active, created_by)
           VALUES (?, ?, ?, ?, ?, 'estudiante', 1, ?)`,
          [cedula, cedula, nombre, `${cedula}@estudiante.temp`, cedula, req.session.user.id],
          function(errUsuario) {
            if (errUsuario) {
              // Si falla la creación del usuario, eliminar el estudiante creado
              db.run('DELETE FROM estudiantes WHERE id = ?', [estudianteId]);
              
              if (errUsuario.message.includes('UNIQUE')) {
                return res.status(400).json({ 
                  success: false, 
                  error: 'Ya existe un usuario con esta cédula' 
                });
              }
              return res.status(500).json({ 
                success: false, 
                error: 'Error al crear usuario: ' + errUsuario.message 
              });
            }

            const usuarioId = this.lastID;

            // PASO 3: Crear permisos básicos para el estudiante
            db.run(
              `INSERT INTO permisos (usuario_id, modulo, puede_leer)
               VALUES (?, 'calificaciones', 1)`,
              [usuarioId]
            );

            // PASO 4: Vincular usuario con estudiante (actualizar tabla estudiantes)
            db.run(
              `UPDATE estudiantes SET usuario_id = ? WHERE id = ?`,
              [usuarioId, estudianteId]
            );

            // PASO 5: Si hay clase_id, matricular automáticamente
            if (clase_id && periodo_lectivo) {
              db.run(
                `INSERT INTO matriculas (estudiante_id, clase_id, periodo_lectivo, created_by)
                 VALUES (?, ?, ?, ?)`,
                [estudianteId, clase_id, periodo_lectivo, req.session.user.id],
                function(errMatricula) {
                  if (errMatricula) {
                    return res.status(500).json({ 
                      success: false, 
                      error: 'Estudiante y usuario creados, pero error al matricular: ' + errMatricula.message 
                    });
                  }
                  
                  res.json({ 
                    success: true, 
                    estudianteId, 
                    usuarioId,
                    message: 'Estudiante registrado, usuario creado y matriculado exitosamente',
                    credenciales: {
                      usuario: cedula,
                      contraseña: cedula
                    }
                  });
                }
              );
            } else {
              // Si no hay clase, solo responder con éxito
              res.json({ 
                success: true, 
                estudianteId, 
                usuarioId,
                message: 'Estudiante y usuario creados exitosamente',
                credenciales: {
                  usuario: cedula,
                  contraseña: cedula
                }
              });
            }
          }
        );
      }
    );
  }
);

// MATRICULAR ESTUDIANTE EN CLASE (endpoint separado por si acaso)
app.post('/api/estudiantes/:id/matricular',
  isAuthenticated, requirePermission('calificaciones', 'crear'),
  (req, res) => {
    const { id } = req.params;
    const { clase_id, periodo_lectivo } = req.body;

    if (!clase_id || !periodo_lectivo) {
      return res.status(400).json({ success: false, error: 'Clase y periodo lectivo son requeridos' });
    }

    db.run(
      `INSERT INTO matriculas (estudiante_id, clase_id, periodo_lectivo, created_by)
       VALUES (?, ?, ?, ?)`,
      [id, clase_id, periodo_lectivo, req.session.user.id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'El estudiante ya está matriculado' });
          }
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: 'Estudiante matriculado exitosamente' });
      }
    );
  }
);

// ACTUALIZAR ESTUDIANTE
app.put('/api/estudiantes/:id',
  isAuthenticated, requirePermission('calificaciones', 'editar'),
  (req, res) => {
    const { id } = req.params;
    const { nombre, genero, adaptacion_curricular } = req.body;

    db.run(
      `UPDATE estudiantes SET nombre = ?, genero = ?, adaptacion_curricular = ? WHERE id = ?`,
      [nombre, genero, adaptacion_curricular, id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: 'Estudiante actualizado' });
      }
    );
  }
);

// ELIMINAR ESTUDIANTE
app.delete('/api/estudiantes/:id',
  isAuthenticated, requirePermission('calificaciones', 'eliminar'),
  (req, res) => {
    db.run('DELETE FROM estudiantes WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: 'Estudiante eliminado' });
    });
  }
);


// DESMATRICULAR ESTUDIANTE DE UNA CLASE ESPECÍFICA
app.delete('/api/estudiantes/:estudianteId/clase/:claseId',
  isAuthenticated, requirePermission('calificaciones', 'eliminar'),
  (req, res) => {
    const { estudianteId, claseId } = req.params;

    db.run(
      'DELETE FROM matriculas WHERE estudiante_id = ? AND clase_id = ?',
      [estudianteId, claseId],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: 'Matrícula no encontrada' });
        }
        res.json({ success: true, message: 'Estudiante desmatriculado de esta clase' });
      }
    );
  }
);

// ELIMINAR ESTUDIANTE COMPLETAMENTE (estudiante + usuario + matrículas)
app.delete('/api/estudiantes/:id/completo',
  isAuthenticated, requirePermission('calificaciones', 'eliminar'),
  (req, res) => {
    const { id } = req.params;

    // Primero obtener el usuario_id asociado
    db.get('SELECT usuario_id FROM estudiantes WHERE id = ?', [id], (err, estudiante) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!estudiante) return res.status(404).json({ success: false, error: 'Estudiante no encontrado' });

      const usuarioId = estudiante.usuario_id;

      // Eliminar en cascada
      db.serialize(() => {
        // 1. Eliminar matrículas
        db.run('DELETE FROM matriculas WHERE estudiante_id = ?', [id]);
        
        // 2. Eliminar calificaciones (tareas, examenes, proyectos, promedios)
        db.run('DELETE FROM tareas WHERE estudiante_id = ?', [id]);
        db.run('DELETE FROM examenes WHERE estudiante_id = ?', [id]);
        db.run('DELETE FROM proyectos WHERE estudiante_id = ?', [id]);
        db.run('DELETE FROM promedios WHERE estudiante_id = ?', [id]);
        db.run('DELETE FROM promedios_anuales WHERE estudiante_id = ?', [id]);
        db.run('DELETE FROM supletorios WHERE estudiante_id = ?', [id]);
        
        // 3. Eliminar estudiante
        db.run('DELETE FROM estudiantes WHERE id = ?', [id]);
        
        // 4. Eliminar usuario y permisos si existe
        if (usuarioId) {
          db.run('DELETE FROM permisos WHERE usuario_id = ?', [usuarioId]);
          db.run('DELETE FROM usuarios WHERE id = ?', [usuarioId], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: 'Estudiante, usuario y todos los registros eliminados completamente' });
          });
        } else {
          res.json({ success: true, message: 'Estudiante y registros eliminados completamente' });
        }
      });
    });
  }
);

// EDITAR ESTUDIANTE
app.put('/api/estudiantes/:id/editar',
  isAuthenticated, requirePermission('calificaciones', 'editar'),
  (req, res) => {
    const { id } = req.params;
    const { nombre, genero, adaptacion_curricular } = req.body;

    if (!nombre || !genero) {
      return res.status(400).json({ success: false, error: 'Nombre y género son requeridos' });
    }

    // Actualizar estudiante
    db.run(
      `UPDATE estudiantes 
       SET nombre = ?, genero = ?, adaptacion_curricular = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nombre, genero, adaptacion_curricular || 'Ninguna', id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: 'Estudiante no encontrado' });
        }

        // Actualizar también el nombre en la tabla usuarios
        db.run(
          `UPDATE usuarios 
           SET fullname = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE cedula = (SELECT cedula FROM estudiantes WHERE id = ?)`,
          [nombre, id],
          function(errUsuario) {
            if (errUsuario) {
              console.error('Error actualizando usuario:', errUsuario);
            }
            res.json({ success: true, message: 'Estudiante actualizado exitosamente' });
          }
        );
      }
    );
  }
);
// ===============================
// API → CALIFICACIONES
// ===============================

// OBTENER CALIFICACIONES POR CLASE
app.get('/api/calificaciones/clase/:claseId', isAuthenticated, (req, res) => {
  const { claseId } = req.params;

  // Verificar acceso (admin o docente de la clase)
  if (req.session.user.role === 'docente') {
    db.get('SELECT docente_id FROM clases WHERE id = ?', [claseId], (err, clase) => {
      if (err || !clase || clase.docente_id !== req.session.user.id) {
        return res.status(403).json({ success: false, error: 'No tiene acceso a esta clase' });
      }
      obtenerCalificaciones(claseId, res);
    });
  } else {
    obtenerCalificaciones(claseId, res);
  }
});

function obtenerCalificaciones(claseId, res) {
  const query = `
    SELECT 
      e.id as estudiante_id,
      e.cedula,
      e.nombre,
      e.genero,
      e.adaptacion_curricular,
      t.trimestre,
      t.numero_tarea,
      t.nota as nota_tarea,
      ex.nota as nota_examen,
      pr.nota as nota_proyecto,
      p.promedio_trimestre,
      pa.promedio_anual,
      pa.estado,
      s.nota_supletorio,
      s.nota_final,
      s.estado_final
    FROM estudiantes e
    INNER JOIN matriculas m ON e.id = m.estudiante_id
    LEFT JOIN tareas t ON e.id = t.estudiante_id AND t.clase_id = ?
    LEFT JOIN examenes ex ON e.id = ex.estudiante_id AND ex.clase_id = ? AND ex.trimestre = t.trimestre
    LEFT JOIN proyectos pr ON e.id = pr.estudiante_id AND pr.clase_id = ? AND pr.trimestre = t.trimestre
    LEFT JOIN promedios p ON e.id = p.estudiante_id AND p.clase_id = ? AND p.trimestre = t.trimestre
    LEFT JOIN promedios_anuales pa ON e.id = pa.estudiante_id AND pa.clase_id = ?
    LEFT JOIN supletorios s ON e.id = s.estudiante_id AND s.clase_id = ?
    WHERE m.clase_id = ? AND m.estado = 'activo'
    ORDER BY e.nombre, t.trimestre, t.numero_tarea
  `;

  db.all(query, [claseId, claseId, claseId, claseId, claseId, claseId, claseId], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    

    // Agrupar por estudiante
    const estudiantes = {};
    rows.forEach(row => {
      if (!estudiantes[row.estudiante_id]) {
        estudiantes[row.estudiante_id] = {
          id: row.estudiante_id,
          cedula: row.cedula,
          nombre: row.nombre,
          genero: row.genero,
          adaptacion_curricular: row.adaptacion_curricular,
          trimestres: { 1: {}, 2: {}, 3: {} },
          promedio_anual: row.promedio_anual || 0,
          estado: row.estado || 'Pendiente',
          supletorio: {
            nota: row.nota_supletorio || 0,
            nota_final: row.nota_final || 0,
            estado: row.estado_final || 'Pendiente'
          }
        };
      }

      if (row.trimestre) {
        if (!estudiantes[row.estudiante_id].trimestres[row.trimestre].tareas) {
            estudiantes[row.estudiante_id].trimestres[row.trimestre] = {
            tareas: {},
            examen: row.nota_examen || 0,
            proyecto: row.nota_proyecto || 0,
            promedio: row.promedio_trimestre || 0
       };
        }
        if (row.numero_tarea) {
          estudiantes[row.estudiante_id].trimestres[row.trimestre].tareas[row.numero_tarea] = row.nota_tarea || 0;
        }
      }
    });

    res.json({ success: true, estudiantes: Object.values(estudiantes) });
  });
}



// ===============================
// NUEVO ENDPOINT - OBTENER TAREAS CONFIGURADAS POR CLASE Y TRIMESTRE
// ===============================
// AGREGAR DESPUÉS de app.get('/api/calificaciones/clase/:claseId'...)
// Alrededor de la línea 645

app.get('/api/actividades/configuradas/:claseId/:trimestre', isAuthenticated, (req, res) => {
  const { claseId, trimestre } = req.params;

  // Verificar acceso (admin o docente de la clase)
  if (req.session.user.role === 'docente') {
    db.get('SELECT docente_id FROM clases WHERE id = ?', [claseId], (err, clase) => {
      if (err || !clase || clase.docente_id !== req.session.user.id) {
        return res.status(403).json({ success: false, error: 'No tiene acceso a esta clase' });
      }
      obtenerTareasConfiguradas(claseId, trimestre, res);
    });
  } else {
    obtenerTareasConfiguradas(claseId, trimestre, res);
  }
});

function obtenerTareasConfiguradas(claseId, trimestre, res) {
  db.all(`
    SELECT 
      id,
      clase_id,
      trimestre,
      numero_tarea,
      nombre_tarea,
      descripcion,
      fecha_entrega,
      created_at,
      updated_at
    FROM configuracion_tareas
    WHERE clase_id = ? AND trimestre = ?
    ORDER BY numero_tarea ASC
  `, [claseId, trimestre], (err, tareas) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    res.json({ 
      success: true, 
      tareas: tareas || [],
      total: (tareas || []).length
    });
  });
}
// ===============================
// NUEVA RUTA: GUARDAR ACTIVIDAD
// ===============================
// ===============================
// CORREGIR: GUARDAR ACTIVIDAD/TAREA (POST /api/actividades)
// ===============================
// REEMPLAZA el endpoint app.post('/api/actividades'...) que existe alrededor de línea 615
// Este es el CORRECTO que guarda en configuracion_tareas

app.post('/api/actividades', isAuthenticated, (req, res) => {
    const { titulo, descripcion, fecha, clase_id, trimestre, numero_tarea } = req.body;
    
    console.log('📥 POST /api/actividades:', { titulo, descripcion, fecha, clase_id, trimestre, numero_tarea });

    // Validaciones
    if (!titulo || !clase_id || !trimestre) {
        return res.status(400).json({ 
            success: false, 
            error: 'Título, clase y trimestre son requeridos' 
        });
    }

    // Convertir valores a tipos correctos
    const tri = parseInt(trimestre);
    const clsId = parseInt(clase_id);
    
    if (tri < 1 || tri > 3) {
        return res.status(400).json({ 
            success: false, 
            error: 'Trimestre inválido (debe ser 1, 2 o 3)' 
        });
    }

    // Determinar numero_tarea si no viene en la solicitud
    if (numero_tarea) {
        // Si viene numero_tarea, es una actualización de una tarea existente
        db.run(`
            UPDATE configuracion_tareas 
            SET nombre_tarea = ?, descripcion = ?, fecha_entrega = ?, updated_at = CURRENT_TIMESTAMP
            WHERE clase_id = ? AND trimestre = ? AND numero_tarea = ?
        `, [titulo, descripcion || '', fecha || null, clsId, tri, numero_tarea], function(err) {
            if (err) {
                console.error('❌ Error actualizando tarea:', err.message);
                return res.status(500).json({ success: false, error: err.message });
            }

            console.log(`✅ Tarea ${numero_tarea} del trimestre ${tri} actualizada`);
            res.json({ 
                success: true, 
                tareaId: numero_tarea, 
                numero_tarea: numero_tarea,
                message: 'Actividad actualizada exitosamente',
                accion: 'actualizado'
            });
        });
    } else {
        // Si NO viene numero_tarea, es una nueva tarea - contar cuántas existen
        db.get(`
            SELECT MAX(numero_tarea) as max_numero 
            FROM configuracion_tareas 
            WHERE clase_id = ? AND trimestre = ?
        `, [clsId, tri], (err, row) => {
            if (err) {
                console.error('❌ Error consultando max numero_tarea:', err.message);
                return res.status(500).json({ success: false, error: err.message });
            }

            const nuevoNumero = ((row && row.max_numero) ? row.max_numero : 0) + 1;

            // Validar que no exceda límite (opcional, puedes permitir más de 4)
            if (nuevoNumero > 10) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No se pueden crear más de 10 tareas por trimestre' 
                });
            }

            // Insertar nueva tarea
            db.run(`
                INSERT INTO configuracion_tareas 
                (clase_id, trimestre, numero_tarea, nombre_tarea, descripcion, fecha_entrega, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [clsId, tri, nuevoNumero, titulo, descripcion || '', fecha || null, req.session.user.id], 
            function(err) {
                if (err) {
                    console.error('❌ Error insertando tarea:', err.message);
                    return res.status(500).json({ success: false, error: err.message });
                }

                console.log(`✅ Nueva tarea ${nuevoNumero} creada en trimestre ${tri}`);
                res.json({ 
                    success: true, 
                    tareaId: this.lastID, 
                    numero_tarea: nuevoNumero,
                    message: 'Actividad creada exitosamente',
                    accion: 'creado'
                });
            });
        });
    }
});

// GUARDAR NOTA DE TAREA
app.post('/api/calificaciones/tarea',
  isAuthenticated, requirePermission('calificaciones', 'editar'),
  (req, res) => {
    const { estudiante_id, clase_id, trimestre, numero_tarea, nota } = req.body;

    if (nota < 0 || nota > 10) {
      return res.status(400).json({ success: false, error: 'La nota debe estar entre 0 y 10' });
    }

    db.run(
      `INSERT INTO tareas (estudiante_id, clase_id, trimestre, numero_tarea, nota, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(estudiante_id, clase_id, trimestre, numero_tarea) DO UPDATE SET nota = ?`,
      [estudiante_id, clase_id, trimestre, numero_tarea, nota, req.session.user.id, nota],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Recalcular promedios
        calcularPromedios(estudiante_id, clase_id, trimestre);
        
        res.json({ success: true, message: 'Nota guardada exitosamente' });
      }
    );
  }
);



// GUARDAR NOTA DE EXAMEN
app.post('/api/calificaciones/examen',
  isAuthenticated, requirePermission('calificaciones', 'editar'),
  (req, res) => {
    const { estudiante_id, clase_id, trimestre, nota } = req.body;

    if (nota < 0 || nota > 10) {
      return res.status(400).json({ success: false, error: 'La nota debe estar entre 0 y 10' });
    }

    db.run(
      `INSERT INTO examenes (estudiante_id, clase_id, trimestre, nota, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(estudiante_id, clase_id, trimestre) DO UPDATE SET nota = ?`,
      [estudiante_id, clase_id, trimestre, nota, req.session.user.id, nota],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Recalcular promedios
        calcularPromedios(estudiante_id, clase_id, trimestre);
        
        res.json({ success: true, message: 'Examen guardado exitosamente' });
      }
    );
  }
);

// GUARDAR NOTA DE PROYECTO
app.post('/api/calificaciones/proyecto',
  isAuthenticated, requirePermission('calificaciones', 'editar'),
  (req, res) => {
    const { estudiante_id, clase_id, trimestre, nota } = req.body;

    if (nota < 0 || nota > 10) {
      return res.status(400).json({ success: false, error: 'La nota debe estar entre 0 y 10' });
    }

    db.run(
      `INSERT INTO proyectos (estudiante_id, clase_id, trimestre, nota, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(estudiante_id, clase_id, trimestre) DO UPDATE SET nota = ?`,
      [estudiante_id, clase_id, trimestre, nota, req.session.user.id, nota],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Recalcular promedios
        calcularPromedios(estudiante_id, clase_id, trimestre);
        
        res.json({ success: true, message: 'Proyecto guardado exitosamente' });
      }
    );
  }
);

// GUARDAR NOTA DE SUPLETORIO
app.post('/api/calificaciones/supletorio',
  isAuthenticated, requirePermission('calificaciones', 'editar'),
  (req, res) => {
    const { estudiante_id, clase_id, nota } = req.body;

    if (nota < 0 || nota > 10) {
      return res.status(400).json({ success: false, error: 'La nota debe estar entre 0 y 10' });
    }

    // Obtener promedio anual base
    db.get(`
      SELECT promedio_anual 
      FROM promedios_anuales 
      WHERE estudiante_id = ? AND clase_id = ?
    `, [estudiante_id, clase_id], (err, promAnual) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      const promedioBase = promAnual ? promAnual.promedio_anual : 0;
      
      // Calcular nota final: 50% promedio base + 50% supletorio
      const notaFinal = (promedioBase * 0.5) + (nota * 0.5);
      
      // Determinar estado final
      const estadoFinal = notaFinal >= 7 ? 'Aprobado (S)' : 'Reprobado (S)';

      db.run(
        `INSERT INTO supletorios (estudiante_id, clase_id, periodo_lectivo, promedio_base, nota_supletorio, nota_final, estado_final, created_by)
         VALUES (?, ?, '2025-2026', ?, ?, ?, ?, ?)
         ON CONFLICT(estudiante_id, clase_id, periodo_lectivo) 
         DO UPDATE SET promedio_base = ?, nota_supletorio = ?, nota_final = ?, estado_final = ?`,
        [estudiante_id, clase_id, promedioBase, nota, notaFinal, estadoFinal, req.session.user.id, 
         promedioBase, nota, notaFinal, estadoFinal],
        function(err) {
          if (err) return res.status(500).json({ success: false, error: err.message });
          res.json({ success: true, message: 'Supletorio guardado exitosamente', notaFinal, estadoFinal });
        }
      );
    });
  }
);




// FUNCIÓN PARA CALCULAR PROMEDIOS (70% tareas + 15% examen + 15% proyecto)
function calcularPromedios(estudiante_id, clase_id, trimestre) {
  // Obtener notas de tareas
  db.all(`
    SELECT nota FROM tareas 
    WHERE estudiante_id = ? AND clase_id = ? AND trimestre = ?
  `, [estudiante_id, clase_id, trimestre], (err, tareas) => {
    if (err) return;

    // Obtener nota de examen
    db.get(`
      SELECT nota FROM examenes 
      WHERE estudiante_id = ? AND clase_id = ? AND trimestre = ?
    `, [estudiante_id, clase_id, trimestre], (err, examen) => {
      if (err) return;

      // Obtener nota de proyecto
      db.get(`
        SELECT nota FROM proyectos 
        WHERE estudiante_id = ? AND clase_id = ? AND trimestre = ?
      `, [estudiante_id, clase_id, trimestre], (err, proyecto) => {
        if (err) return;

        // Calcular promedio de tareas
        const notasTareas = tareas.map(t => t.nota);
        const promedioTareas = notasTareas.length > 0 
          ? notasTareas.reduce((a, b) => a + b, 0) / notasTareas.length 
          : 0;

        const notaExamen = examen ? examen.nota : 0;
        const notaProyecto = proyecto ? proyecto.nota : 0;

        // NUEVA FÓRMULA: 70% tareas + 15% examen + 15% proyecto
        // Definir pesos dinámicos según evaluación registrada
        let pesoExamen = 0;
        let pesoProyecto = 0;

        if (notaExamen > 0 && notaProyecto > 0) {
        pesoExamen = 0.15;
        pesoProyecto = 0.15;
        } else if (notaExamen > 0) {
        pesoExamen = 0.30;
        } else if (notaProyecto > 0) {
        pesoProyecto = 0.30;
     }

// Cálculo final del promedio del trimestre
const promedioTrimestre =
  (promedioTareas * 0.70) +
  (notaExamen * pesoExamen) +
  (notaProyecto * pesoProyecto);


        // Guardar o actualizar promedio
        db.run(`
          INSERT INTO promedios (estudiante_id, clase_id, trimestre, promedio_tareas, promedio_trimestre)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(estudiante_id, clase_id, trimestre) 
          DO UPDATE SET promedio_tareas = ?, promedio_trimestre = ?, updated_at = CURRENT_TIMESTAMP
        `, [estudiante_id, clase_id, trimestre, promedioTareas, promedioTrimestre, promedioTareas, promedioTrimestre]);

        // Calcular promedio anual si existen los 3 trimestres
        calcularPromedioAnual(estudiante_id, clase_id);
      });
    });
  });
}

// CALCULAR PROMEDIO ANUAL
function calcularPromedioAnual(estudiante_id, clase_id) {
  db.all(`
    SELECT trimestre, promedio_trimestre 
    FROM promedios 
    WHERE estudiante_id = ? AND clase_id = ?
  `, [estudiante_id, clase_id], (err, promedios) => {
    if (err || promedios.length < 3) return;

    const t1 = promedios.find(p => p.trimestre === 1)?.promedio_trimestre || 0;
    const t2 = promedios.find(p => p.trimestre === 2)?.promedio_trimestre || 0;
    const t3 = promedios.find(p => p.trimestre === 3)?.promedio_trimestre || 0;

    const promedioAnual = (t1 + t2 + t3) / 3;

    let estado = 'Pendiente';
    if (promedioAnual >= 7) estado = 'Aprobado';
    else if (promedioAnual >= 5) estado = 'Supletorio';
    else estado = 'Reprobado';

    db.run(`
      INSERT INTO promedios_anuales 
      (estudiante_id, clase_id, periodo_lectivo, promedio_t1, promedio_t2, promedio_t3, promedio_anual, estado)
      VALUES (?, ?, '2025-2026', ?, ?, ?, ?, ?)
      ON CONFLICT(estudiante_id, clase_id, periodo_lectivo)
      DO UPDATE SET promedio_t1 = ?, promedio_t2 = ?, promedio_t3 = ?, promedio_anual = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
    `, [estudiante_id, clase_id, t1, t2, t3, promedioAnual, estado, t1, t2, t3, promedioAnual, estado]);
  });
}

// ===============================
// API → INVENTARIO
// ===============================

// ===============================
// API → INVENTARIO (COMPLETO)
// ===============================

// LISTAR INVENTARIO
app.get('/api/inventario', isAuthenticated, (req, res) => {
  db.all(
    `SELECT * FROM inventario ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, inventario: rows });
    }
  );
});

// ✅ VER UN ACTIVO ESPECÍFICO
app.get('/api/inventario/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT * FROM inventario WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!row) return res.status(404).json({ success: false, error: 'Activo no encontrado' });
      res.json({ success: true, activo: row });
    }
  );
});

// CREAR ACTIVO
app.post('/api/inventario',
  isAuthenticated, requirePermission('inventario', 'crear'),
  (req, res) => {
    const { codigo, tipo, ubicacion, estado, descripcion } = req.body;

    if (!codigo || !tipo || !ubicacion || !estado) {
      return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
    }

    db.run(
      `INSERT INTO inventario (codigo, tipo, ubicacion, estado, descripcion, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [codigo, tipo, ubicacion, estado, descripcion, req.session.user.id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'El código ya existe' });
          }
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, activoId: this.lastID });
      }
    );
  }
);

// ✅ ACTUALIZAR ACTIVO (COMPLETO)
app.put('/api/inventario/:id',
  isAuthenticated, requirePermission('inventario', 'editar'),
  (req, res) => {
    const { id } = req.params;
    const { codigo, tipo, ubicacion, estado, descripcion } = req.body;

    if (!codigo || !tipo || !ubicacion || !estado) {
      return res.status(400).json({ 
        success: false, 
        error: 'Código, tipo, ubicación y estado son obligatorios' 
      });
    }

    db.run(
      `UPDATE inventario 
       SET codigo = ?, tipo = ?, ubicacion = ?, estado = ?, descripcion = ?, 
           updated_at = CURRENT_TIMESTAMP, updated_by = ? 
       WHERE id = ?`,
      [codigo, tipo, ubicacion, estado, descripcion, req.session.user.id, id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ 
              success: false, 
              error: 'El código ya existe' 
            });
          }
          return res.status(500).json({ success: false, error: err.message });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: 'Activo no encontrado' });
        }
        
        res.json({ success: true, message: 'Activo actualizado exitosamente' });
      }
    );
  }
);

// ELIMINAR ACTIVO
app.delete('/api/inventario/:id',
  isAuthenticated, requirePermission('inventario', 'eliminar'),
  (req, res) => {
    db.run('DELETE FROM inventario WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Activo no encontrado' });
      }
      res.json({ success: true, message: 'Activo eliminado' });
    });
  }
);



// ===============================
// API → MANTENIMIENTO
// ===============================

// 1. LISTAR TAREAS DE MANTENIMIENTO (Cronograma)
app.get('/api/mantenimiento/tareas',
  isAuthenticated,
  (req, res) => {
    db.all(
      `SELECT t.*, u.fullname as creado_por_nombre
       FROM tareas_mantenimiento t
       LEFT JOIN usuarios u ON t.created_by = u.id
       ORDER BY t.id ASC`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, tareas: rows });
      }
    );
  }
);

// 2. CREAR TAREA DE MANTENIMIENTO
app.post('/api/mantenimiento/tareas',
  isAuthenticated,
  requirePermission('mantenimiento', 'crear'),
  (req, res) => {
    const { nombre, frecuencia } = req.body;

    if (!nombre || !frecuencia) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nombre y frecuencia son requeridos' 
      });
    }

    if (!['M', 'B', 'S', 'N'].includes(frecuencia)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Frecuencia inválida. Use: M (Mensual), B (Bimestral), S (Semestral), N (Nunca)' 
      });
    }

    db.run(
      `INSERT INTO tareas_mantenimiento (nombre, frecuencia, created_by)
       VALUES (?, ?, ?)`,
      [nombre, frecuencia, req.session.user.id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ 
          success: true, 
          tareaId: this.lastID,
          message: 'Tarea de mantenimiento creada exitosamente' 
        });
      }
    );
  }
);

// 3. ELIMINAR TAREA DE MANTENIMIENTO
app.delete('/api/mantenimiento/tareas/:id',
  isAuthenticated,
  requirePermission('mantenimiento', 'eliminar'),
  (req, res) => {
    const { id } = req.params;

    // Verificar si hay mantenimientos asociados
    db.get(
      `SELECT COUNT(*) as total FROM mantenimientos_realizados WHERE tarea_mantenimiento_id = ?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        if (row.total > 0) {
          return res.status(400).json({ 
            success: false, 
            error: `No se puede eliminar. Hay ${row.total} mantenimiento(s) registrado(s) con esta tarea` 
          });
        }

        // Si no hay mantenimientos asociados, eliminar
        db.run('DELETE FROM tareas_mantenimiento WHERE id = ?', [id], function(err) {
          if (err) return res.status(500).json({ success: false, error: err.message });
          if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
          }
          res.json({ success: true, message: 'Tarea eliminada exitosamente' });
        });
      }
    );
  }
);

// 4. LISTAR HISTORIAL DE MANTENIMIENTOS (con filtros opcionales)
app.get('/api/mantenimiento/historial',
  isAuthenticated,
  (req, res) => {
    const { equipo_id, fecha_desde, fecha_hasta } = req.query;

    let query = `
      SELECT 
        m.id,
        m.fecha_realizada,
        m.observaciones,
        i.codigo as equipo_codigo,
        i.tipo as equipo_tipo,
        t.nombre as tarea_nombre,
        u.fullname as realizado_por_nombre
      FROM mantenimientos_realizados m
      INNER JOIN inventario i ON m.inventario_id = i.id
      INNER JOIN tareas_mantenimiento t ON m.tarea_mantenimiento_id = t.id
      LEFT JOIN usuarios u ON m.realizado_por = u.id
      WHERE 1=1
    `;

    const params = [];

    // Filtro por equipo
    if (equipo_id) {
      query += ' AND m.inventario_id = ?';
      params.push(equipo_id);
    }

    // Filtro por fecha desde
    if (fecha_desde) {
      query += ' AND m.fecha_realizada >= ?';
      params.push(fecha_desde);
    }

    // Filtro por fecha hasta
    if (fecha_hasta) {
      query += ' AND m.fecha_realizada <= ?';
      params.push(fecha_hasta);
    }

    query += ' ORDER BY m.fecha_realizada DESC, m.id DESC';

    db.all(query, params, (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, mantenimientos: rows });
    });
  }
);

// 5. REGISTRAR MANTENIMIENTO REALIZADO
app.post('/api/mantenimiento/registrar',
  isAuthenticated,
  requirePermission('mantenimiento', 'crear'),
  (req, res) => {
    const { inventario_id, tarea_mantenimiento_id, fecha_realizada, observaciones } = req.body;

    if (!inventario_id || !tarea_mantenimiento_id || !fecha_realizada) {
      return res.status(400).json({ 
        success: false, 
        error: 'Equipo, tarea y fecha son requeridos' 
      });
    }

    // Verificar que el equipo existe
    db.get('SELECT id FROM inventario WHERE id = ?', [inventario_id], (err, equipo) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!equipo) {
        return res.status(404).json({ success: false, error: 'Equipo no encontrado' });
      }

      // Verificar que la tarea existe
      db.get('SELECT id FROM tareas_mantenimiento WHERE id = ?', [tarea_mantenimiento_id], (err, tarea) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!tarea) {
          return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
        }

        // Insertar el mantenimiento
        db.run(
          `INSERT INTO mantenimientos_realizados 
           (inventario_id, tarea_mantenimiento_id, fecha_realizada, observaciones, realizado_por)
           VALUES (?, ?, ?, ?, ?)`,
          [inventario_id, tarea_mantenimiento_id, fecha_realizada, observaciones || '', req.session.user.id],
          function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ 
              success: true, 
              mantenimientoId: this.lastID,
              message: 'Mantenimiento registrado exitosamente' 
            });
          }
        );
      });
    });
  }
);

// 6. ELIMINAR REGISTRO DE MANTENIMIENTO
app.delete('/api/mantenimiento/historial/:id',
  isAuthenticated,
  requirePermission('mantenimiento', 'eliminar'),
  (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM mantenimientos_realizados WHERE id = ?', [id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Registro no encontrado' });
      }
      res.json({ success: true, message: 'Registro de mantenimiento eliminado' });
    });
  }
);

// ===============================
// API → MANTENIMIENTO - TAREAS (COMPLETO - CORREGIDO)
// ===============================
// AGREGAR ESTO EN server.js DESPUÉS DEL ENDPOINT DELETE /api/mantenimiento/tareas/:id
// (Alrededor de la línea ~1140)

// ✅ VER TAREA DE MANTENIMIENTO ESPECÍFICA
app.get('/api/mantenimiento/tareas/:id',
  isAuthenticated,
  (req, res) => {
    const { id } = req.params;
    
    console.log(`👀 GET /api/mantenimiento/tareas/${id}`);
    
    db.get(`
      SELECT 
        t.*,
        u.fullname as creado_por_nombre
      FROM tareas_mantenimiento t
      LEFT JOIN usuarios u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id], (err, tarea) => {
      if (err) {
        console.error('❌ Error:', err.message);
        return res.status(500).json({ 
          success: false, 
          error: 'Error obteniendo tarea: ' + err.message 
        });
      }
      
      if (!tarea) {
        console.log(`⚠️ Tarea ${id} no encontrada`);
        return res.status(404).json({ 
          success: false, 
          error: 'Tarea de mantenimiento no encontrada' 
        });
      }
      
      console.log(`✅ Tarea encontrada: "${tarea.nombre}"`);
      res.json({ success: true, tarea });
    });
  }
);

// ✅ EDITAR TAREA DE MANTENIMIENTO
app.put('/api/mantenimiento/tareas/:id',
  isAuthenticated,
  requirePermission('mantenimiento', 'editar'),
  (req, res) => {
    const { id } = req.params;
    const { nombre, frecuencia } = req.body;
    
    console.log(`✏️ PUT /api/mantenimiento/tareas/${id}`, { nombre, frecuencia });
    
    // Validación
    if (!nombre || !frecuencia) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nombre y frecuencia son requeridos' 
      });
    }
    
    // Validar frecuencia
    if (!['M', 'B', 'S', 'N'].includes(frecuencia)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Frecuencia inválida. Use: M (Mensual), B (Bimestral), S (Semestral), N (Nunca)' 
      });
    }
    
    // ⭐ ACTUALIZAR TAREA (SIN updated_at porque no existe en la tabla)
    db.run(`
      UPDATE tareas_mantenimiento 
      SET nombre = ?, 
          frecuencia = ?
      WHERE id = ?
    `, [nombre, frecuencia, id], function(err) {
      if (err) {
        console.error('❌ Error actualizando tarea:', err.message);
        return res.status(500).json({ 
          success: false, 
          error: 'Error actualizando tarea: ' + err.message 
        });
      }
      
      if (this.changes === 0) {
        console.log(`⚠️ Tarea ${id} no encontrada para actualizar`);
        return res.status(404).json({ 
          success: false, 
          error: 'Tarea de mantenimiento no encontrada' 
        });
      }
      
      console.log(`✅ Tarea ${id} actualizada: "${nombre}" - ${frecuencia}`);
      res.json({ 
        success: true, 
        message: 'Tarea de mantenimiento actualizada exitosamente',
        tareaId: id,
        nombre,
        frecuencia
      });
    });
  }
);


// ===============================
// API → LECCIONES Y ACTIVIDADES
// ===============================

// CREAR LECCIÓN
app.post('/api/lecciones',
  isAuthenticated, requirePermission('calificaciones', 'crear'),
  (req, res) => {
    const { titulo, descripcion, clase_id } = req.body;

    if (!titulo || !clase_id) {
      return res.status(400).json({ success: false, error: 'Título y clase son requeridos' });
    }

    db.run(
      `INSERT INTO lecciones (titulo, descripcion, clase_id, docente_id)
       VALUES (?, ?, ?, ?)`,
      [titulo, descripcion, clase_id, req.session.user.id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, leccionId: this.lastID });
      }
    );
  }
);

// LISTAR LECCIONES POR CLASE
app.get('/api/lecciones/clase/:claseId', isAuthenticated, (req, res) => {
  db.all(
    `SELECT l.*, u.fullname as docente_nombre 
     FROM lecciones l
     LEFT JOIN usuarios u ON l.docente_id = u.id
     WHERE l.clase_id = ?
     ORDER BY l.fecha DESC`,
    [req.params.claseId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, lecciones: rows });
    }
  );
});

// CREAR ACTIVIDAD/TAREA
app.post('/api/actividades',
  isAuthenticated, requirePermission('calificaciones', 'crear'),
  (req, res) => {
    const { titulo, descripcion, clase_id, fecha_entrega } = req.body;

    if (!titulo || !clase_id) {
      return res.status(400).json({ success: false, error: 'Título y clase son requeridos' });
    }

    db.run(
      `INSERT INTO actividades (titulo, descripcion, clase_id, docente_id, fecha_entrega)
       VALUES (?, ?, ?, ?, ?)`,
      [titulo, descripcion, clase_id, req.session.user.id, fecha_entrega],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, actividadId: this.lastID });
      }
    );
  }
);

// LISTAR ACTIVIDADES POR CLASE
app.get('/api/actividades/clase/:claseId', isAuthenticated, (req, res) => {
  db.all(
    `SELECT a.*, u.fullname as docente_nombre 
     FROM actividades a
     LEFT JOIN usuarios u ON a.docente_id = u.id
     WHERE a.clase_id = ?
     ORDER BY a.fecha_entrega DESC`,
    [req.params.claseId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, actividades: rows });
    }
  );
});


// ===============================
// API → PERFIL ESTUDIANTE
// ===============================

// OBTENER PERFIL DEL ESTUDIANTE
app.get('/api/estudiante/perfil', isAuthenticated, (req, res) => {
  if (req.session.user.role !== 'estudiante') {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  db.get(
    `SELECT e.*, u.username, u.email 
     FROM estudiantes e 
     LEFT JOIN usuarios u ON e.usuario_id = u.id 
     WHERE u.id = ?`,
    [req.session.user.id],
    (err, estudiante) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!estudiante) return res.status(404).json({ success: false, error: 'Estudiante no encontrado' });
      
      res.json({ success: true, estudiante });
    }
  );
});

// CAMBIAR CONTRASEÑA
app.put('/api/estudiante/cambiar-password', isAuthenticated, (req, res) => {
  if (req.session.user.role !== 'estudiante') {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  const { password_actual, password_nueva } = req.body;

  if (!password_actual || !password_nueva) {
    return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
  }

  // Verificar contraseña actual
  db.get(
    'SELECT password FROM usuarios WHERE id = ?',
    [req.session.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      if (user.password !== password_actual) {
        return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
      }

      // Actualizar contraseña
      db.run(
        'UPDATE usuarios SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [password_nueva, req.session.user.id],
        function(err) {
          if (err) return res.status(500).json({ success: false, error: err.message });
          res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
        }
      );
    }
  );
});

app.get('/estudiante-configuracion.html',
  isAuthenticated, requireRole('estudiante'),
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'estudiante-configuracion.html'));
  }
);

// VINCULAR EMAIL
app.put('/api/estudiante/vincular-email', isAuthenticated, (req, res) => {
  if (req.session.user.role !== 'estudiante') {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email es requerido' });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }

  // Verificar que el email no esté en uso
  db.get('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, req.session.user.id], (err, existing) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Este email ya está en uso' });
    }

    // Actualizar email
    db.run(
      'UPDATE usuarios SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [email, req.session.user.id],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Actualizar sesión
        req.session.user.email = email;
        
        res.json({ success: true, message: 'Email vinculado exitosamente' });
      }
    );
  });
});




// === CONFIGURACIÓN INICIAL DE LA BASE DE DATOS ===
db.serialize(() => {
    // 1. Tabla de Catálogo de Preguntas
    db.run(`CREATE TABLE IF NOT EXISTS encuesta_preguntas (
        id TEXT PRIMARY KEY,
        modulo TEXT NOT NULL,
        pregunta TEXT NOT NULL,
        tipo_respuesta TEXT NOT NULL,
        opciones TEXT
    )`);

    // 2. Tabla de Respuestas de Usuarios
    db.run(`CREATE TABLE IF NOT EXISTS encuesta_respuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        pregunta_id TEXT NOT NULL,
        respuesta_valor TEXT NOT NULL,
        fecha_respuesta DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pregunta_id) REFERENCES encuesta_preguntas(id)
    )`);

    // 3. Poblado automático del catálogo (15 preguntas seleccionadas)
    const preguntas = [
        ['FIS_01', 'Física', 'Accesos adecuados (rampas, ascensores, pasamanos)', 'escala', '1,2,3,4,5'],
        ['FIS_02', 'Física', 'Aulas diseñadas para sillas de ruedas', 'escala', '1,2,3,4,5'],
        ['FIS_03', 'Física', 'Baños adaptados', 'opcion_unica', 'Sí suficientes, Sí insuficientes, No ninguno, No estoy seguro'],
        ['FIS_04', 'Física', 'Sistemas de alerta visual y sonora', 'opcion_unica', 'Sí ambos, Solo sonoro, Solo visual, Ninguno, No estoy seguro'],
        ['FIS_05', 'Física', 'Señalización Braille/Alto contraste', 'escala', '1,2,3,4,5'],
        ['TEC_01', 'Tecnológica', 'Disponibilidad de tecnologías asistidas', 'opcion_unica', 'Sí suficiente, Sí limitada, No ninguna, No sé qué son'],
        ['TEC_02', 'Tecnológica', 'Plataformas digitales accesibles', 'opcion_unica', 'Totalmente, Parcialmente, No accesibles, No utilizamos, No estoy seguro'],
        ['TEC_03', 'Tecnológica', 'Materiales en formatos accesibles (PDF/Subtítulos)', 'escala', '1,2,3,4,5'],
        ['TEC_04', 'Tecnológica', 'Capacitación docente en TIC de apoyo', 'opcion_unica', 'Regularmente, Ocasionalmente, Rara vez, Nunca, No estoy seguro'],
        ['TEC_05', 'Tecnológica', 'Sistemas de comunicación aumentativa', 'opcion_unica', 'Sí varios, Algunos básicos, No, No estoy seguro'],
        ['PED_01', 'Pedagógica', 'Formación docente en inclusión', 'escala', '1,2,3,4,5'],
        ['PED_02', 'Pedagógica', 'Realización de adaptaciones curriculares', 'opcion_unica', 'Sistemáticamente, No siempre, Rara vez, No, No estoy seguro'],
        ['PED_03', 'Pedagógica', 'Uso de metodologías inclusivas (DUA)', 'escala', '1,2,3,4,5'],
        ['PED_04', 'Pedagógica', 'Flexibilidad en sistemas de evaluación', 'escala', '1,2,3,4,5'],
        ['PED_05', 'Pedagógica', 'Disponibilidad de personal especializado', 'opcion_unica', 'Sí suficiente, Sí insuficiente, No, No estoy seguro']
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO encuesta_preguntas (id, modulo, pregunta, tipo_respuesta, opciones) VALUES (?, ?, ?, ?, ?)`);
    preguntas.forEach(p => stmt.run(p));
    stmt.finalize();
});

// === RUTAS API ===

// Obtener todas las preguntas para el frontend
app.get('/api/encuesta/preguntas', (req, res) => {
    db.all("SELECT * FROM encuesta_preguntas", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Guardar o Editar una pregunta del catálogo
app.post('/api/encuesta/preguntas/config', (req, res) => {
    const { id, modulo, pregunta, tipo_respuesta, opciones } = req.body;
    const sql = `INSERT OR REPLACE INTO encuesta_preguntas (id, modulo, pregunta, tipo_respuesta, opciones) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [id, modulo, pregunta, tipo_respuesta, opciones], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", message: "Pregunta configurada" });
    });
});

// Registrar respuestas de una encuesta completada
app.post('/api/encuesta/enviar', (req, res) => {
    const { usuario_id, respuestas } = req.body; // respuestas: [{pregunta_id, valor}, ...]
    const stmt = db.prepare(`INSERT INTO encuesta_respuestas (usuario_id, pregunta_id, respuesta_valor) VALUES (?, ?, ?)`);
    
    db.serialize(() => {
        respuestas.forEach(r => stmt.run([usuario_id, r.pregunta_id, r.valor]));
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: "success", message: "Resultados guardados" });
        });
    });
});

// Editar una respuesta individual ya existente
app.put('/api/encuesta/respuestas/:id', (req, res) => {
    const { respuesta_valor } = req.body;
    db.run(`UPDATE encuesta_respuestas SET respuesta_valor = ? WHERE id = ?`, 
    [respuesta_valor, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success", updated: this.changes });
    });
});


// ===============================
// API → ACCESIBILIDAD
// ===============================

// ===============================
// API → ACCESIBILIDAD - ENDPOINTS CORRECTOS
// ===============================

// ✅ 1. OBTENER TODAS LAS PREGUNTAS
app.get('/api/accesibilidad/preguntas', isAuthenticated, (req, res) => {
    console.log('📋 GET /api/accesibilidad/preguntas');
    
    db.all(
        `SELECT * FROM encuesta_preguntas ORDER BY modulo ASC, id ASC`,
        [],
        (err, rows) => {
            if (err) {
                console.error('❌ Error obteniendo preguntas:', err);
                return res.json({ success: false, error: err.message });
            }
            
            if (!rows || rows.length === 0) {
                console.warn('⚠️ No hay preguntas en la BD');
                return res.json({ 
                    success: false, 
                    error: 'No hay preguntas registradas en la base de datos' 
                });
            }
            
            console.log(`✅ ${rows.length} preguntas obtenidas`);
            res.json({ success: true, preguntas: rows });
        }
    );
});

// ✅ 2. GUARDAR RESPUESTAS DE LA ENCUESTA
app.post('/api/accesibilidad/enviar', isAuthenticated, (req, res) => {
    console.log('📤 POST /api/accesibilidad/enviar');
    
    const { respuestas } = req.body;
    const usuarioId = req.session.user?.id || null;
    
    if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
        console.error('❌ No se recibieron respuestas válidas');
        return res.json({ 
            success: false, 
            error: 'No se recibieron respuestas' 
        });
    }
    
    console.log(`📝 Usuario ${usuarioId} enviando ${respuestas.length} respuestas...`);
    
    db.serialize(() => {
        const stmt = db.prepare(`
            INSERT INTO encuesta_respuestas 
            (usuario_id, pregunta_id, respuesta_valor, fecha_respuesta)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        let respondidas = 0;
        let errores = 0;
        const erroresList = [];
        
        respuestas.forEach((respuesta, index) => {
            const { pregunta_id, valor } = respuesta;
            
            if (!pregunta_id || !valor) {
                console.error(`❌ Respuesta ${index} incompleta:`, respuesta);
                errores++;
                erroresList.push(`Respuesta ${index}: datos incompletos`);
                return;
            }
            
            stmt.run(
                [usuarioId, pregunta_id, valor],
                function(err) {
                    if (err) {
                        console.error(`❌ Error guardando respuesta ${index}:`, err.message);
                        errores++;
                        erroresList.push(`Pregunta ${pregunta_id}: ${err.message}`);
                    } else {
                        respondidas++;
                        console.log(`  ✅ Respuesta ${index + 1}/${respuestas.length} guardada`);
                    }
                }
            );
        });
        
        stmt.finalize((err) => {
            if (err) {
                console.error('❌ Error finalizando:', err);
                return res.json({ 
                    success: false, 
                    error: 'Error finalizando guardado: ' + err.message,
                    respondidas,
                    errores
                });
            }
            
            console.log(`✅ Proceso completado: ${respondidas} guardadas, ${errores} errores`);
            
            if (respondidas === 0 && errores > 0) {
                return res.json({
                    success: false,
                    error: 'No se pudieron guardar las respuestas',
                    errores: erroresList,
                    respondidas: 0
                });
            }
            
            res.json({ 
                success: true, 
                message: `✅ Encuesta guardada exitosamente (${respondidas}/${respuestas.length} respuestas)`,
                respondidas,
                errores,
                erroresList: errores > 0 ? erroresList : undefined
            });
        });
    });
});

// ✅ 3. OBTENER RESULTADOS/RESUMEN
app.get('/api/accesibilidad/resultados', isAuthenticated, requireRole('admin'), (req, res) => {
    console.log('📊 GET /api/accesibilidad/resultados');
    
    db.all(`
        SELECT 
            ep.id,
            ep.modulo,
            ep.pregunta,
            COUNT(er.id) as total_respuestas,
            AVG(CAST(er.respuesta_valor AS FLOAT)) as promedio_respuestas,
            MIN(CAST(er.respuesta_valor AS INTEGER)) as minimo,
            MAX(CAST(er.respuesta_valor AS INTEGER)) as maximo
        FROM encuesta_preguntas ep
        LEFT JOIN encuesta_respuestas er ON ep.id = er.pregunta_id
        GROUP BY ep.id, ep.pregunta, ep.modulo
        ORDER BY ep.modulo ASC, ep.id ASC
    `, [], (err, resultados) => {
        if (err) {
            console.error('❌ Error obteniendo resultados:', err);
            return res.json({ 
                success: false, 
                error: 'Error al obtener resultados: ' + err.message 
            });
        }
        
        console.log(`✅ ${resultados.length} resultados obtenidos`);
        res.json({ 
            success: true, 
            resultados,
            total: resultados.length
        });
    });
});

// ✅ 4. OBTENER RESPUESTAS DE UN USUARIO
app.get('/api/accesibilidad/usuario/:usuarioId', isAuthenticated, (req, res) => {
    const { usuarioId } = req.params;
    
    if (req.session.user.role !== 'admin' && req.session.user.id != usuarioId) {
        return res.status(403).json({ 
            success: false, 
            error: 'No tiene permiso para ver estas respuestas' 
        });
    }
    
    console.log(`📋 GET /api/accesibilidad/usuario/${usuarioId}`);
    
    db.all(`
        SELECT 
            er.id,
            er.pregunta_id,
            er.respuesta_valor,
            er.fecha_respuesta,
            ep.pregunta,
            ep.modulo
        FROM encuesta_respuestas er
        JOIN encuesta_preguntas ep ON er.pregunta_id = ep.id
        WHERE er.usuario_id = ?
        ORDER BY ep.modulo ASC, ep.id ASC
    `, [usuarioId], (err, respuestas) => {
        if (err) {
            console.error('❌ Error:', err);
            return res.json({ 
                success: false, 
                error: 'Error al obtener respuestas' 
            });
        }
        
        console.log(`✅ ${respuestas.length} respuestas del usuario ${usuarioId}`);
        res.json({ 
            success: true, 
            respuestas,
            total: respuestas.length
        });
    });
});

// ✅ 5. EDITAR UNA PREGUNTA (Solo Admin)
app.put('/api/accesibilidad/preguntas/:id', 
    isAuthenticated, requireRole('admin'), 
    (req, res) => {
        const { id } = req.params;
        const { pregunta, opciones } = req.body;
        
        console.log(`✏️ PUT /api/accesibilidad/preguntas/${id}`);
        
        if (!pregunta) {
            return res.json({ 
                success: false, 
                error: 'La pregunta es requerida' 
            });
        }
        
        db.run(
            `UPDATE encuesta_preguntas SET pregunta = ?, opciones = ? WHERE id = ?`,
            [pregunta, opciones || '', id],
            function(err) {
                if (err) {
                    console.error('❌ Error:', err);
                    return res.json({ success: false, error: err.message });
                }
                
                if (this.changes === 0) {
                    return res.json({ 
                        success: false, 
                        error: 'Pregunta no encontrada' 
                    });
                }
                
                console.log(`✅ Pregunta ${id} actualizada`);
                res.json({ success: true, message: 'Pregunta actualizada exitosamente' });
            }
        );
    }
);

// ===============================
// API → ACCESIBILIDAD - RESETEAR RESPUESTAS
// ===============================

// ✅ ELIMINAR TODAS LAS RESPUESTAS (RESET COMPLETO)
app.delete('/api/accesibilidad/reset-all',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    console.log('🗑️ DELETE /api/accesibilidad/reset-all - Eliminando todas las respuestas');
    
    db.run('DELETE FROM encuesta_respuestas', [], function(err) {
      if (err) {
        console.error('❌ Error eliminando respuestas:', err);
        return res.json({ 
          success: false, 
          error: 'Error al eliminar respuestas: ' + err.message 
        });
      }
      
      console.log(`✅ ${this.changes} respuesta(s) eliminada(s)`);
      
      res.json({ 
        success: true, 
        message: `✅ Se eliminaron ${this.changes} respuesta(s) exitosamente`,
        respuestas_eliminadas: this.changes
      });
    });
  }
);

// ✅ ELIMINAR RESPUESTAS DE UN USUARIO ESPECÍFICO
app.delete('/api/accesibilidad/usuario/:usuarioId/reset',
  isAuthenticated,
  (req, res) => {
    const { usuarioId } = req.params;
    
    // Verificar permisos: solo admin o el propio usuario
    if (req.session.user.role !== 'admin' && req.session.user.id != usuarioId) {
      return res.status(403).json({ 
        success: false, 
        error: 'No tiene permiso para eliminar estas respuestas' 
      });
    }
    
    console.log(`🗑️ DELETE /api/accesibilidad/usuario/${usuarioId}/reset`);
    
    db.run('DELETE FROM encuesta_respuestas WHERE usuario_id = ?', [usuarioId], function(err) {
      if (err) {
        console.error('❌ Error:', err);
        return res.json({ success: false, error: err.message });
      }
      
      if (this.changes === 0) {
        return res.json({ 
          success: false, 
          error: 'No se encontraron respuestas para este usuario' 
        });
      }
      
      console.log(`✅ ${this.changes} respuesta(s) eliminada(s) del usuario ${usuarioId}`);
      
      res.json({ 
        success: true, 
        message: `✅ Se eliminaron ${this.changes} respuesta(s)`,
        respuestas_eliminadas: this.changes
      });
    });
  }
);

// ✅ ELIMINAR UNA RESPUESTA ESPECÍFICA
app.delete('/api/accesibilidad/respuestas/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ DELETE /api/accesibilidad/respuestas/${id}`);
    
    db.run('DELETE FROM encuesta_respuestas WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('❌ Error:', err);
        return res.json({ success: false, error: err.message });
      }
      
      if (this.changes === 0) {
        return res.json({ 
          success: false, 
          error: 'Respuesta no encontrada' 
        });
      }
      
      console.log(`✅ Respuesta ${id} eliminada`);
      
      res.json({ 
        success: true, 
        message: 'Respuesta eliminada exitosamente' 
      });
    });
  }
);

// ✅ OBTENER ESTADÍSTICAS DE RESPUESTAS
app.get('/api/accesibilidad/estadisticas',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    console.log('📊 GET /api/accesibilidad/estadisticas');
    
    db.get(`
      SELECT 
        COUNT(DISTINCT usuario_id) as total_usuarios,
        COUNT(*) as total_respuestas,
        COUNT(DISTINCT pregunta_id) as preguntas_respondidas,
        MIN(fecha_respuesta) as primera_respuesta,
        MAX(fecha_respuesta) as ultima_respuesta
      FROM encuesta_respuestas
    `, [], (err, stats) => {
      if (err) {
        console.error('❌ Error:', err);
        return res.json({ success: false, error: err.message });
      }
      
      console.log('✅ Estadísticas obtenidas:', stats);
      
      res.json({ 
        success: true, 
        estadisticas: stats
      });
    });
  }
);
// ===============================
// FIN ENDPOINTS ACCESIBILIDAD
// ===============================

// ===============================
// API → ESTRUCTURA ACADÉMICA
// ===============================
// ===============================
// API → REGISTRO DE ESTUDIANTES (MEJORADO)
// ===============================
// ===============================
// API → REGISTRO DE ESTUDIANTES (MEJORADO Y CORREGIDO)
// ===============================
// ===============================
// API → REGISTRO DE ESTUDIANTES (VERSIÓN FINAL CORREGIDA)
// ===============================
app.get('/api/estudiantes/registro', isAuthenticated, (req, res) => {
  const { busqueda, genero, estado, periodo } = req.query;
  
  console.log('📥 GET /api/estudiantes/registro - Cargando estudiantes con asignaturas');
  
  // PASO 1: Obtener lista de estudiantes con filtros
  let query = `
    SELECT DISTINCT
      e.id,
      e.cedula,
      e.nombre,
      e.genero,
      e.adaptacion_curricular,
      e.created_at,
      u.username,
      u.email
    FROM estudiantes e
    LEFT JOIN usuarios u ON e.usuario_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (busqueda) {
    query += ' AND (e.nombre LIKE ? OR e.cedula LIKE ?)';
    params.push(`%${busqueda}%`, `%${busqueda}%`);
  }
  if (genero) {
    query += ' AND e.genero = ?';
    params.push(genero);
  }
  
  query += ' ORDER BY e.nombre';
  
  db.all(query, params, (err, estudiantes) => {
    if (err) {
      console.error('❌ Error en /api/estudiantes/registro:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (estudiantes.length === 0) {
      console.log('⚠️ No se encontraron estudiantes');
      return res.json({ 
        success: true, 
        estudiantes: [],
        estadisticas: {
          total_activos: 0,
          total_masculinos: 0,
          total_femeninos: 0
        }
      });
    }
    
    console.log(`✅ ${estudiantes.length} estudiante(s) encontrado(s). Obteniendo clases...`);
    
    let estudiantesProcesados = 0;
    const estudiantesFormateados = [];
    
    // PASO 2: Para CADA estudiante, obtener TODAS sus clases
    estudiantes.forEach((est, index) => {
      console.log(`\n📊 [${index + 1}/${estudiantes.length}] Procesando: ${est.nombre}`);
      
      // ⭐ CONSULTA MEJORADA: Obtener TODAS las clases con asignaturas y docentes
      // IMPORTANTE: Usar COALESCE para evitar NULL
      db.all(`
        SELECT 
          c.id as clase_id,
          c.grado,
          c.curso,
          c.paralelo,
          a.id as asignatura_id,
          COALESCE(a.nombre, 'Clase sin asignatura') as asignatura_nombre,
          u.id as docente_id,
          COALESCE(u.fullname, 'Sin asignar') as docente_nombre,
          m.periodo_lectivo,
          m.estado as estado_matricula
        FROM matriculas m
        INNER JOIN clases c ON m.clase_id = c.id
        LEFT JOIN asignaturas a ON c.asignatura_id = a.id
        LEFT JOIN usuarios u ON c.docente_id = u.id
        WHERE m.estudiante_id = ? AND m.estado = 'activo'
        ORDER BY COALESCE(a.nombre, c.grado)
      `, [est.id], (err, clases) => {
        if (err) {
          console.error(`❌ Error obteniendo clases del estudiante ${est.id}:`, err);
          clases = [];
        }
        
        console.log(`   📚 ${clases.length} clase(s) encontrada(s):`);
        clases.forEach((c, i) => {
          console.log(`      [${i + 1}] ${c.asignatura_nombre} - ${c.grado} ${c.paralelo} - Docente: ${c.docente_nombre}`);
        });
        
        // ⭐ CONSTRUIR ARRAY DE CLASES CON TODA LA INFORMACIÓN
        const clasesMatriculadas = clases.map(c => ({
          clase_id: c.clase_id,
          grado: c.grado,
          curso: c.curso,
          paralelo: c.paralelo,
          asignatura_id: c.asignatura_id,
          asignatura_nombre: c.asignatura_nombre,
          docente_id: c.docente_id,
          docente_nombre: c.docente_nombre,
          periodo_lectivo: c.periodo_lectivo
        }));
        
        // Obtener el grado actual (primera clase)
        const gradoActual = clases.length > 0 
          ? `${clases[0].grado} ${clases[0].curso}` 
          : '-';
        
        const periodoActual = clases.length > 0 
          ? clases[0].periodo_lectivo 
          : '-';
        
        // Formatear información del estudiante
        const estudianteFormateado = {
          id: est.id,
          cedula: est.cedula,
          nombre: est.nombre,
          genero: est.genero,
          adaptacion_curricular: est.adaptacion_curricular,
          username: est.username,
          email: est.email,
          created_at: est.created_at,
          clases_matriculadas: clasesMatriculadas, // ⭐ ARRAY COMPLETO DE CLASES
          grado_actual: gradoActual,
          periodo_actual: periodoActual,
          total_materias: clases.length
        };
        
        estudiantesFormateados.push(estudianteFormateado);
        estudiantesProcesados++;
        
        console.log(`   ✅ Estudiante procesado: ${estudiantesProcesados}/${estudiantes.length}`);
        
        // ⭐ CUANDO SE HAYAN PROCESADO TODOS LOS ESTUDIANTES
        if (estudiantesProcesados === estudiantes.length) {
          // Ordenar por nombre
          estudiantesFormateados.sort((a, b) => a.nombre.localeCompare(b.nombre));
          
          // Calcular estadísticas
          const totalActivos = estudiantesFormateados.length;
          const totalMasculinos = estudiantesFormateados.filter(e => e.genero === 'Masculino').length;
          const totalFemeninos = estudiantesFormateados.filter(e => e.genero === 'Femenino').length;
          
          const estadisticas = {
            total_activos: totalActivos,
            total_masculinos: totalMasculinos,
            total_femeninos: totalFemeninos
          };
          
          console.log(`\n✅ ===============================`);
          console.log(`✅ RESPUESTA COMPLETA`);
          console.log(`✅ Total estudiantes: ${totalActivos}`);
          console.log(`✅ Total masculinos: ${totalMasculinos}`);
          console.log(`✅ Total femeninos: ${totalFemeninos}`);
          console.log(`✅ ===============================\n`);
          
          // ⭐ ENVIAR RESPUESTA CON TODOS LOS DATOS
          res.json({ 
            success: true, 
            estudiantes: estudiantesFormateados, 
            estadisticas 
          });
        }
      });
    });
  });
});

// OBTENER PERFIL COMPLETO DE ESTUDIANTE
app.get('/api/estudiantes/:id/perfil', isAuthenticated, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT e.*, u.username, u.email 
     FROM estudiantes e 
     LEFT JOIN usuarios u ON e.usuario_id = u.id 
     WHERE e.id = ?`,
    [id],
    (err, estudiante) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!estudiante) return res.status(404).json({ success: false, error: 'Estudiante no encontrado' });
      
      // Obtener clases matriculadas
      db.all(
        `SELECT c.id, c.grado, c.curso, c.paralelo, a.nombre as asignatura, u.fullname as docente
         FROM matriculas m
         INNER JOIN clases c ON m.clase_id = c.id
         LEFT JOIN asignaturas a ON c.asignatura_id = a.id
         LEFT JOIN usuarios u ON c.docente_id = u.id
         WHERE m.estudiante_id = ? AND m.estado = 'activo'`,
        [id],
        (err, clases) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          
          res.json({ 
            success: true, 
            estudiante: {
              ...estudiante,
              clases_matriculadas: clases
            }
          });
        }
      );
    }
  );
});


// ===============================
// API → GRADOS (FALTANTE)
// ===============================
app.get('/api/grados', isAuthenticated, requireRole('admin'), (req, res) => {
  db.all(`
    SELECT 
      c.id,
      c.grado,
      c.curso as nivel,
      c.paralelo,
      a.nombre as asignatura_nombre,
      u.fullname as docente_nombre,
      a.id as asignatura_id
    FROM clases c
    LEFT JOIN asignaturas a ON c.asignatura_id = a.id
    LEFT JOIN usuarios u ON c.docente_id = u.id
    ORDER BY c.grado, c.paralelo
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, grados: rows });
  });
});

// ===============================
// API → MATRÍCULAS (FALTANTE)
// ===============================
// REEMPLAZAR la función cargarMatriculas existente con esta versión completa:

// LISTAR MATRÍCULAS
app.get('/api/matriculas', isAuthenticated, requireRole('admin'), (req, res) => {
  db.all(`
    SELECT 
      m.id,
      e.cedula,
      e.nombre,
      e.genero,
      c.grado,
      c.curso as nivel,
      c.paralelo,
      m.periodo_lectivo as periodo_academico,
      m.fecha_matricula,
      m.estado
    FROM matriculas m
    INNER JOIN estudiantes e ON m.estudiante_id = e.id
    INNER JOIN clases c ON m.clase_id = c.id
    WHERE m.estado = 'activo'
    ORDER BY m.fecha_matricula DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Error en /api/matriculas:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    console.log(`✅ Matrículas cargadas: ${rows.length}`);
    res.json({ success: true, matriculas: rows || [] });
  });
});

//Editar Matrícula
// EDITAR MATRÍCULA (ENDPOINT COMPLETO)
app.get('/api/matriculas/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT 
      m.id,
      m.estudiante_id,
      m.clase_id,
      m.periodo_lectivo,
      e.cedula,
      e.nombre,
      e.genero,
      c.grado,
      c.curso as nivel,
      c.paralelo
    FROM matriculas m
    INNER JOIN estudiantes e ON m.estudiante_id = e.id
    INNER JOIN clases c ON m.clase_id = c.id
    WHERE m.id = ?
  `, [id], (err, matricula) => {
    if (err) {
      console.error('Error obteniendo matrícula:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (!matricula) {
      return res.status(404).json({ success: false, error: 'Matrícula no encontrada' });
    }
    
    res.json({ success: true, matricula });
  });
});

// CREAR MATRÍCULA (mejorada)
app.post('/api/matriculas',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { cedula, nombre, genero, periodo_academico, grado_id, nivel, paralelo } = req.body;

    if (!cedula || !nombre || !genero || !periodo_academico || !grado_id || !paralelo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son requeridos' 
      });
    }

    // Paso 1: Verificar si el estudiante ya existe
    db.get('SELECT id FROM estudiantes WHERE cedula = ?', [cedula], (err, estudianteExistente) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      const procesarMatricula = (estudianteId) => {
        // Buscar la clase específica que coincida con grado_id y paralelo
        db.get(`
          SELECT id FROM clases 
          WHERE id = ? OR (grado = ? AND paralelo = ?)
          LIMIT 1
        `, [grado_id, grado_id, paralelo], (err, clase) => {
          if (err) {
            return res.status(500).json({ success: false, error: err.message });
          }
          
          if (!clase) {
            return res.status(404).json({ 
              success: false, 
              error: 'No se encontró una clase para este grado y paralelo' 
            });
          }

          // Verificar si ya está matriculado en esta clase
          db.get(`
            SELECT id FROM matriculas 
            WHERE estudiante_id = ? AND clase_id = ? AND estado = 'activo'
          `, [estudianteId, clase.id], (err, matriculaExistente) => {
            if (err) {
              return res.status(500).json({ success: false, error: err.message });
            }

            if (matriculaExistente) {
              return res.status(400).json({ 
                success: false, 
                error: 'El estudiante ya está matriculado en esta clase' 
              });
            }

            // Crear la matrícula
            db.run(`
              INSERT INTO matriculas (estudiante_id, clase_id, periodo_lectivo, estado, created_by)
              VALUES (?, ?, ?, 'activo', ?)
            `, [estudianteId, clase.id, periodo_academico, req.session.user.id], function(err) {
              if (err) {
                return res.status(500).json({ success: false, error: err.message });
              }

              res.json({ 
                success: true, 
                matriculaId: this.lastID,
                message: 'Matrícula registrada exitosamente'
              });
            });
          });
        });
      };

      if (estudianteExistente) {
        // Si el estudiante existe, proceder con matrícula
        procesarMatricula(estudianteExistente.id);
      } else {
        // Si no existe, crear estudiante primero
        db.run(`
          INSERT INTO estudiantes (cedula, nombre, genero, adaptacion_curricular, created_by)
          VALUES (?, ?, ?, 'Ninguna', ?)
        `, [cedula, nombre, genero, req.session.user.id], function(err) {
          if (err) {
            return res.status(500).json({ success: false, error: err.message });
          }

          const nuevoEstudianteId = this.lastID;

          // Crear usuario automáticamente
          db.run(`
            INSERT INTO usuarios (username, password, fullname, email, cedula, role, active, created_by)
            VALUES (?, ?, ?, ?, ?, 'estudiante', 1, ?)
          `, [cedula, cedula, nombre, `${cedula}@estudiante.temp`, cedula, req.session.user.id], function(errUsuario) {
            if (errUsuario) {
              console.error('Error creando usuario:', errUsuario);
            } else {
              // Vincular usuario con estudiante
              db.run('UPDATE estudiantes SET usuario_id = ? WHERE id = ?', [this.lastID, nuevoEstudianteId]);
              
              // Crear permisos
              db.run(`
                INSERT INTO permisos (usuario_id, modulo, puede_leer)
                VALUES (?, 'calificaciones', 1)
              `, [this.lastID]);
            }

            // Proceder con matrícula
            procesarMatricula(nuevoEstudianteId);
          });
        });
      }
    });
  }
);

// ACTUALIZAR MATRÍCULA
app.put('/api/matriculas/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;
    const { grado_id, paralelo, periodo_academico } = req.body;

    if (!grado_id || !paralelo || !periodo_academico) {
      return res.status(400).json({ 
        success: false, 
        error: 'Grado, paralelo y período son requeridos' 
      });
    }

    // Buscar la clase correspondiente
    db.get(`
      SELECT id FROM clases 
      WHERE id = ? OR (grado = ? AND paralelo = ?)
      LIMIT 1
    `, [grado_id, grado_id, paralelo], (err, clase) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (!clase) {
        return res.status(404).json({ 
          success: false, 
          error: 'No se encontró una clase para este grado y paralelo' 
        });
      }

      db.run(`
        UPDATE matriculas 
        SET clase_id = ?, periodo_lectivo = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [clase.id, periodo_academico, id], function(err) {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }

        if (this.changes === 0) {
          return res.status(404).json({ success: false, error: 'Matrícula no encontrada' });
        }

        res.json({ success: true, message: 'Matrícula actualizada' });
      });
    });
  }
);

// ELIMINAR MATRÍCULA
// ELIMINAR MATRÍCULA (VERSIÓN CORRECTA)
app.delete('/api/matriculas/:id',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ DELETE /api/matriculas/${id}`);
    
    // ⭐ ELIMINAR COMPLETAMENTE (no solo cambiar estado)
    db.run('DELETE FROM matriculas WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('❌ Error eliminando:', err);
        return res.status(500).json({ 
          success: false, 
          error: err.message 
        });
      }
      
      if (this.changes === 0) {
        console.log('⚠️ Matrícula no encontrada');
        return res.status(404).json({ 
          success: false, 
          error: 'Matrícula no encontrada' 
        });
      }
      
      console.log(`✅ Matrícula ${id} eliminada completamente`);
      
      res.json({ 
        success: true, 
        message: '✅ Matrícula eliminada exitosamente',
        matriculaId: id
      });
    });
  }
);

// ===============================
// API → ASIGNATURAS POR GRADO (FALTANTE)
// ===============================
app.get('/api/grados/asignaturas', isAuthenticated, requireRole('admin'), (req, res) => {
  db.all(`
    SELECT 
      c.id,
      c.grado,
      c.curso as nivel,
      a.nombre,
      u.fullname as docente_nombre
    FROM clases c
    LEFT JOIN asignaturas a ON c.asignatura_id = a.id
    LEFT JOIN usuarios u ON c.docente_id = u.id
    WHERE a.nombre IS NOT NULL
    ORDER BY c.grado, a.nombre
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, asignaturas: rows });
  });
});

// ===============================
// ASIGNAR DOCENTE A ASIGNATURA (FALTANTE)
// ===============================
app.put('/api/grados/asignaturas/:claseId/docente', 
  isAuthenticated, requireRole('admin'), 
  (req, res) => {
    const { claseId } = req.params;
    const { docente_id } = req.body;
    
    db.run(
      `UPDATE clases SET docente_id = ? WHERE id = ?`,
      [docente_id, claseId],
      function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: 'Docente asignado exitosamente' });
      }
    );
  }
);

// ===============================
// API → GRADOS COMPLETOS (para selectores)
// ===============================
app.get('/api/grados/lista', isAuthenticated, (req, res) => {
  const grados = [
    {id: '1ro', nombre: '1ro'},
    {id: '2do', nombre: '2do'},
    {id: '3ro', nombre: '3ro'},
    {id: '4to', nombre: '4to'},
    {id: '5to', nombre: '5to'},
    {id: '6to', nombre: '6to'},
    {id: '7mo', nombre: '7mo'},
    {id: '8vo', nombre: '8vo'},
    {id: '9no', nombre: '9no'},
    {id: '10mo', nombre: '10mo'},
    {id: '1ro_bach', nombre: '1ro Bachillerato'},
    {id: '2do_bach', nombre: '2do Bachillerato'},
    {id: '3ro_bach', nombre: '3ro Bachillerato'}
  ];
  res.json({ success: true, grados });
});

// ===============================
// API → ASIGNATURAS PARA SELECTOR
// ===============================
app.get('/api/asignaturas/lista', isAuthenticated, (req, res) => {
  db.all(`SELECT id, nombre FROM asignaturas WHERE activo = 1 ORDER BY nombre`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, asignaturas: rows });
  });
});

// ===============================
// API → GRADOS COMPLETOS CON ASIGNATURAS
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
// API → ELIMINAR GRADO/CLASE
// ===============================
app.delete('/api/grados/:id', 
  isAuthenticated, requireRole('admin'), 
  (req, res) => {
    const { id } = req.params;
    
    db.run(`DELETE FROM clases WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: 'Grado eliminado exitosamente' });
    });
  }
);

// ===============================
// API → ELIMINAR ASIGNATURA DE GRADO
// ===============================
app.delete('/api/grados/asignaturas/:id', 
  isAuthenticated, requireRole('admin'), 
  (req, res) => {
    const { id } = req.params;
    
    // Primero verificar si hay estudiantes matriculados
    db.get(`
      SELECT COUNT(*) as total 
      FROM matriculas m
      INNER JOIN clases c ON m.clase_id = c.id
      WHERE c.asignatura_id = ?
    `, [id], (err, row) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      if (row.total > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `No se puede eliminar. Hay ${row.total} estudiante(s) matriculado(s) en esta asignatura` 
        });
      }
      
      // Eliminar la clase (que representa la asignatura en el grado)
      db.run(`DELETE FROM clases WHERE asignatura_id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: 'Asignatura eliminada del grado' });
      });
    });
  }
);

// ===============================
// RUTAS PARA GRADOS - COMPLETAS
// ===============================
// ===============================
// API → GRADOS COMPLETOS (FALTABA)
// ===============================
// AGREGAR ESTE ENDPOINT en server.js después del endpoint /api/grados/:id/detalle

   // ===============================
// REEMPLAZA ESTE ENDPOINT EN server.js (línea ~1550)
// ===============================

app.get('/api/grados/completos', isAuthenticated, requireRole('admin'), (req, res) => {
  console.log('📥 GET /api/grados/completos - Cargando grados con asignaturas y estudiantes');
  
  // PASO 1: Obtener todos los grados únicos (sin duplicados)
  db.all(`
    SELECT DISTINCT
      c.grado,
      c.curso as nivel,
      c.paralelo
    FROM clases c
    WHERE c.grado IS NOT NULL
    ORDER BY c.grado, c.paralelo
  `, [], (err, grados) => {
    if (err) {
      console.error('❌ Error obteniendo grados:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }

    if (grados.length === 0) {
      console.log('⚠️ No hay grados en la base de datos');
      return res.json({ success: true, grados: [] });
    }

    console.log(`✅ ${grados.length} grados únicos encontrados`);

    let procesados = 0;
    const gradosCompletos = [];

    // PASO 2: Para cada grado, obtener asignaturas y estudiantes
    grados.forEach((grado, index) => {
      console.log(`\n📊 [${index + 1}/${grados.length}] Procesando: ${grado.grado} ${grado.nivel} ${grado.paralelo}`);
      
      // PASO 2A: Obtener asignaturas del grado
      db.all(`
        SELECT 
          c.id as clase_id,
          c.asignatura_id,
          a.nombre as asignatura_nombre,
          c.docente_id,
          u.fullname as docente_nombre
        FROM clases c
        LEFT JOIN asignaturas a ON c.asignatura_id = a.id
        LEFT JOIN usuarios u ON c.docente_id = u.id
        WHERE c.grado = ? AND c.curso = ? AND c.paralelo = ?
          AND a.nombre IS NOT NULL
        ORDER BY a.nombre
      `, [grado.grado, grado.nivel, grado.paralelo], (err, asignaturas) => {
        if (err) {
          console.error(`❌ Error obteniendo asignaturas:`, err);
          asignaturas = [];
        }

        console.log(`   📚 ${asignaturas.length} asignatura(s) encontrada(s)`);
        asignaturas.forEach((a, i) => {
          console.log(`      [${i + 1}] ${a.asignatura_nombre} (ID: ${a.clase_id})`);
        });

        // PASO 2B: Contar estudiantes ÚNICOS matriculados en este grado
        // ⭐ CUENTA ESTUDIANTES DISTINTOS EN TODAS LAS CLASES DEL GRADO
        db.get(`
          SELECT COUNT(DISTINCT m.estudiante_id) as total
          FROM matriculas m
          INNER JOIN clases c ON m.clase_id = c.id
          WHERE c.grado = ? AND c.curso = ? AND c.paralelo = ?
            AND m.estado = 'activo'
        `, [grado.grado, grado.nivel, grado.paralelo], (err, countResult) => {
          if (err) {
            console.error(`❌ Error contando estudiantes:`, err);
          }

          const totalEstudiantes = countResult?.total || 0;
          console.log(`   👥 ${totalEstudiantes} estudiante(s) matriculado(s)`);

          // PASO 3: Construir objeto del grado completo
          const gradoCompleto = {
            // ID: usar el primer clase_id si hay asignaturas, sino un ID temporal
            id: asignaturas.length > 0 ? asignaturas[0].clase_id : `temp_${grado.grado}_${grado.paralelo}`,
            grado: grado.grado,
            nivel: grado.nivel,
            paralelo: grado.paralelo,
            asignaturas: asignaturas.map(a => ({
              id: a.clase_id,
              asignatura_id: a.asignatura_id,
              nombre: a.asignatura_nombre,
              docente_id: a.docente_id,
              docente_nombre: a.docente_nombre || 'Sin asignar'
            })),
            total_estudiantes: totalEstudiantes
          };

          gradosCompletos.push(gradoCompleto);
          procesados++;

          console.log(`   ✅ Procesado: ${procesados}/${grados.length}`);

          // PASO 4: Cuando todos estén procesados, enviar respuesta
          if (procesados === grados.length) {
            // Ordenar alfabéticamente
            gradosCompletos.sort((a, b) => {
              const ordenGrado = a.grado.localeCompare(b.grado);
              if (ordenGrado !== 0) return ordenGrado;
              return a.paralelo.localeCompare(b.paralelo);
            });

            console.log(`\n✅ ===============================`);
            console.log(`✅ RESPUESTA COMPLETA`);
            console.log(`✅ Total de grados: ${gradosCompletos.length}`);
            console.log(`✅ ===============================`);
            gradosCompletos.forEach((g, i) => {
              console.log(`   [${i + 1}] ${g.grado} ${g.nivel} ${g.paralelo}:`);
              console.log(`       📚 ${g.asignaturas.length} asignatura(s)`);
              console.log(`       👥 ${g.total_estudiantes} estudiante(s)`);
            });
            console.log(`✅ ===============================\n`);

            res.json({ 
              success: true, 
              grados: gradosCompletos 
            });
          }
        });
      });
    });
  });
});
// ===============================
// INSTRUCCIONES DE INSTALACIÓN
// ===============================




// 1. VER DETALLE DE GRADO
// ===============================
// BACKEND - CORREGIR /api/grados/:id/detalle
// ===============================
// REEMPLAZA este endpoint completo en server.js (alrededor de línea 1400-1500)

app.get('/api/grados/:id/detalle', isAuthenticated, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  console.log(`🔍 GET /api/grados/${id}/detalle - Buscando grado ID: ${id}`);
  
  // Buscar por ID de clase directamente
  db.get(`
    SELECT 
      c.id,
      c.grado,
      c.curso as nivel,
      c.paralelo,
      c.docente_id
    FROM clases c
    WHERE c.id = ?
    LIMIT 1
  `, [id], (err, clase) => {
    if (err) {
      console.error('❌ Error BD:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (!clase) {
      console.log(`❌ Clase no encontrada con ID: ${id}`);
      return res.status(404).json({ success: false, error: 'Grado no encontrado' });
    }
    
    console.log(`✅ Grado encontrado: ${clase.grado} ${clase.nivel} ${clase.paralelo}`);
    
    // Obtener todas las asignaturas de este grado
    db.all(`
      SELECT 
        c.id as clase_id,
        c.asignatura_id,
        a.nombre,
        c.docente_id,
        u.fullname as docente_nombre
      FROM clases c
      LEFT JOIN asignaturas a ON c.asignatura_id = a.id
      LEFT JOIN usuarios u ON c.docente_id = u.id
      WHERE c.grado = ? AND c.curso = ? AND c.paralelo = ?
      ORDER BY a.nombre ASC
    `, [clase.grado, clase.nivel, clase.paralelo], (err, asignaturas) => {
      if (err) {
        console.error('❌ Error obteniendo asignaturas:', err);
        asignaturas = [];
      }
      
      console.log(`✅ Asignaturas encontradas: ${asignaturas.length}`);
      
      // Obtener estudiantes
      db.get(`
        SELECT COUNT(DISTINCT m.estudiante_id) as total
        FROM matriculas m
        INNER JOIN clases c ON m.clase_id = c.id
        WHERE c.grado = ? AND c.curso = ? AND c.paralelo = ?
      `, [clase.grado, clase.nivel, clase.paralelo], (err, est) => {
        
        const grado = {
          id: clase.id,
          grado: clase.grado,
          nivel: clase.nivel,
          paralelo: clase.paralelo,
          asignaturas: asignaturas.map(a => ({
            id: a.clase_id,
            nombre: a.nombre,
            docente_id: a.docente_id,
            docente_nombre: a.docente_nombre || 'Sin asignar'
          })),
          total_estudiantes: est?.total || 0
        };
        
        res.json({ success: true, grado });
      });
    });
  });
});

// ===============================
// ENDPOINT AUXILIAR PARA DEBUG
// ===============================
// Este endpoint te ayuda a ver qué hay en la BD
app.get('/api/grados/debug/:id', isAuthenticated, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT id, grado, curso, paralelo FROM clases WHERE id = ?', [id], (err, clase) => {
    if (err || !clase) {
      return res.json({ error: 'Clase no encontrada', id });
    }
    
    db.all(`
      SELECT 
        c.id,
        c.grado,
        c.curso,
        c.paralelo,
        a.nombre as asignatura,
        u.fullname as docente
      FROM clases c
      LEFT JOIN asignaturas a ON c.asignatura_id = a.id
      LEFT JOIN usuarios u ON c.docente_id = u.id
      WHERE c.grado = ? AND c.curso = ? AND c.paralelo = ?
    `, [clase.grado, clase.curso, clase.paralelo], (err, clases) => {
      res.json({
        clase_base: clase,
        todas_las_clases_encontradas: clases,
        total: clases.length
      });
    });
  });
});

// 2. EDITAR GRADO
app.put('/api/grados/:id', isAuthenticated, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { grado: nuevoGrado, nivel, paralelo } = req.body;
  
  console.log(`✏️ PUT /api/grados/${id}`, { nuevoGrado, nivel, paralelo });
  
  if (!nuevoGrado || !nivel || !paralelo) {
    return res.status(400).json({ 
      success: false, 
      error: 'Todos los campos son requeridos' 
    });
  }
  
  db.run(
    `UPDATE clases SET grado = ?, curso = ?, paralelo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [nuevoGrado, nivel, paralelo, id],
    function(err) {
      if (err) {
        console.error('❌ Error actualizando:', err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      console.log(`✅ Grado ${id} actualizado. Cambios: ${this.changes}`);
      res.json({ 
        success: true, 
        message: 'Grado actualizado exitosamente',
        changes: this.changes 
      });
    }
  );
});

// 3. ELIMINAR GRADO (COMPLETO)
app.delete('/api/grados/:id/completo', isAuthenticated, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ DELETE /api/grados/${id}/completo`);
  
  // Verificar si hay estudiantes matriculados
  db.get(`
    SELECT COUNT(*) as total 
    FROM matriculas 
    WHERE clase_id = ? AND estado = 'activo'
  `, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (row.total > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `No se puede eliminar. Hay ${row.total} estudiante(s) matriculado(s)` 
      });
    }
    
    // Eliminar la clase
    db.run('DELETE FROM clases WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Grado no encontrado' });
      }
      
      console.log(`✅ Grado ${id} eliminado. Cambios: ${this.changes}`);
      res.json({ 
        success: true, 
        message: 'Grado eliminado exitosamente',
        changes: this.changes 
      });
    });
  });
});

// 4. ELIMINAR ASIGNATURA DE GRADO
app.delete('/api/grados/:idGrado/asignatura/:idAsignatura', 
  isAuthenticated, requireRole('admin'), 
  (req, res) => {
    const { idGrado, idAsignatura } = req.params;
    console.log(`🗑️ DELETE /api/grados/${idGrado}/asignatura/${idAsignatura}`);
    
    // Verificar que la clase tenga esa asignatura
    db.get(`
      SELECT id FROM clases 
      WHERE id = ? AND asignatura_id = ?
    `, [idGrado, idAsignatura], (err, clase) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!clase) return res.status(404).json({ success: false, error: 'Asignatura no encontrada en este grado' });
      
      // Eliminar la clase (que representa la asignatura en el grado)
      db.run('DELETE FROM clases WHERE id = ?', [idGrado], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        console.log(`✅ Asignatura eliminada. Cambios: ${this.changes}`);
        res.json({ 
          success: true, 
          message: 'Asignatura eliminada del grado',
          changes: this.changes 
        });
      });
    });
  }
);


// ===============================
// API → ASIGNATURAS POR GRADO (FALTANTE - CORREGIDO)
// ===============================
app.get('/api/grados/asignaturas', isAuthenticated, (req, res) => {
  db.all(`
    SELECT 
      c.id,
      c.grado,
      c.curso as nivel,
      c.paralelo,
      a.id as asignatura_id,
      a.nombre,
      u.fullname as docente_nombre,
      u.id as docente_id
    FROM clases c
    LEFT JOIN asignaturas a ON c.asignatura_id = a.id
    LEFT JOIN usuarios u ON c.docente_id = u.id
    WHERE a.nombre IS NOT NULL
    ORDER BY c.grado, c.paralelo, a.nombre
  `, [], (err, rows) => {
    if (err) {
      console.error('Error en /api/grados/asignaturas:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, asignaturas: rows || [] });
  });
});

// ===============================
// API → CONFIGURAR ASIGNATURAS POR GRADO
// ==============================
// REEMPLAZAR el endpoint POST /api/grados/asignaturas existente:
// ===============================
// API → CONFIGURAR ASIGNATURAS POR GRADO (VERSIÓN MEJORADA CON PARALELO AUTOMÁTICO)
// ===============================
// ===============================
// REEMPLAZA ESTE ENDPOINT COMPLETO EN server.js
// API → CONFIGURAR ASIGNATURAS POR GRADO (VERSIÓN CORREGIDA CON CÓDIGO)
// ===============================

app.post('/api/grados/asignaturas',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    const { grado_id, nivel, paralelo, nombre, docente_id } = req.body;

    console.log('📥 POST /api/grados/asignaturas', { 
      grado_id, 
      nivel, 
      paralelo,
      nombre, 
      docente_id 
    });

    if (!grado_id || !nivel || !paralelo || !nombre) {
      return res.status(400).json({ 
        success: false, 
        error: 'Grado, nivel, paralelo y nombre de asignatura son requeridos' 
      });
    }

    // PASO 1: Verificar o crear asignatura
    db.get(
      `SELECT id FROM asignaturas WHERE nombre = ?`,
      [nombre],
      (err, asignaturaExistente) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }

        const crearClaseConParaleloManual = (asigId) => {
          // CREAR CLASE CON EL PARALELO PROPORCIONADO POR EL USUARIO
          db.run(
            `INSERT INTO clases (grado, curso, paralelo, asignatura_id, docente_id, subnivel_id, created_by)
             VALUES (?, ?, ?, ?, ?, 4, ?)`,
            [grado_id, nivel, paralelo, asigId, docente_id || null, req.session.user.id],
            function(err) {
              if (err) {
                console.error('❌ Error creando clase:', err);
                
                // Manejar error de duplicado
                if (err.message.includes('UNIQUE')) {
                  return res.status(400).json({ 
                    success: false, 
                    error: `Ya existe una clase "${nombre}" en ${grado_id} ${nivel} - Paralelo ${paralelo}. Elija otro paralelo.` 
                  });
                }
                
                return res.status(500).json({ success: false, error: err.message });
              }

              console.log(`✅ Clase creada con ID: ${this.lastID}`);
              console.log(`   📚 Asignatura: ${nombre}`);
              console.log(`   🎯 Grado: ${grado_id} ${nivel}`);
              console.log(`   📍 Paralelo: ${paralelo}`);
              
              res.json({ 
                success: true, 
                claseId: this.lastID,
                paralelo: paralelo,
                message: `Asignatura "${nombre}" agregada a ${grado_id} ${nivel} - Paralelo ${paralelo}` + 
                         (docente_id ? ' con docente asignado' : '')
              });
            }
          );
        };

        // Si la asignatura ya existe, usar su ID
        if (asignaturaExistente) {
          console.log(`ℹ️ Asignatura "${nombre}" ya existe con ID: ${asignaturaExistente.id}`);
          crearClaseConParaleloManual(asignaturaExistente.id);
        } else {
          // Si no existe, crear la asignatura primero
          // ⭐ GENERAR CÓDIGO ÚNICO (AQUÍ ESTÁ LA CORRECCIÓN)
          const codigoUnico = `ASG-${nombre.substring(0, 3).toUpperCase()}-${Date.now()}`;
          
          db.run(
            `INSERT INTO asignaturas (codigo, nombre, descripcion, created_by)
             VALUES (?, ?, ?, ?)`,
            [codigoUnico, nombre, nombre, req.session.user.id],
            function(err) {
              if (err) {
                console.error('❌ Error creando asignatura:', err.message);
                
                // Si el código ya existe (muy raro), usar un código alternativo
                if (err.message.includes('UNIQUE')) {
                  const codigoAlternativo = `ASG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                  
                  db.run(
                    `INSERT INTO asignaturas (codigo, nombre, descripcion, created_by)
                     VALUES (?, ?, ?, ?)`,
                    [codigoAlternativo, nombre, nombre, req.session.user.id],
                    function(err2) {
                      if (err2) {
                        console.error('❌ Error creando asignatura (intento 2):', err2);
                        return res.status(500).json({ success: false, error: 'Error al crear la asignatura: ' + err2.message });
                      }
                      console.log(`✅ Asignatura "${nombre}" creada con código: ${codigoAlternativo}`);
                      crearClaseConParaleloManual(this.lastID);
                    }
                  );
                } else {
                  // Error que no es por duplicado de código
                  return res.status(500).json({ 
                    success: false, 
                    error: 'Error al crear asignatura: ' + err.message 
                  });
                }
                return;
              }

              console.log(`✅ Asignatura "${nombre}" creada exitosamente`);
              console.log(`   📝 Código: ${codigoUnico}`);
              console.log(`   🆔 ID: ${this.lastID}`);
              crearClaseConParaleloManual(this.lastID);
            }
          );
        }
      }
    );
  }
);

// ===============================
// ENDPOINTS FALTANTES - AGREGAR A server.js
// ===============================
// Estos endpoints se necesitan para que funcione el botón EDITAR
// de la tabla de grados

// ===============================
// 1. GET /api/grados/completos - OBTENER GRADOS CON ASIGNATURAS
// ===============================
app.get('/api/grados/completos', isAuthenticated, requireRole('admin'), (req, res) => {
  try {
    console.log('📚 GET /api/grados/completos');
    
    db.all(
      `SELECT DISTINCT 
        g.id, 
        g.grado, 
        g.nivel, 
        g.paralelo,
        (SELECT COUNT(*) FROM estudiantes WHERE grado_id = g.id) as total_estudiantes
       FROM grados g
       ORDER BY g.grado, g.nivel, g.paralelo`,
      (err, grados) => {
        if (err) {
          console.error('❌ Error:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        if (!grados || grados.length === 0) {
          return res.json({ success: true, grados: [] });
        }
        
        // Para cada grado, obtener asignaturas
        let gradosConAsignaturas = [];
        let procesados = 0;
        
        grados.forEach((grado) => {
          db.all(
            `SELECT 
              c.id,
              a.nombre,
              a.codigo,
              c.docente_id,
              d.fullname as docente_nombre
             FROM clases c
             LEFT JOIN asignaturas a ON c.asignatura_id = a.id
             LEFT JOIN docentes d ON c.docente_id = d.id
             WHERE c.grado = ? AND c.curso = ? AND c.paralelo = ?`,
            [grado.grado, grado.nivel, grado.paralelo],
            (err, asignaturas) => {
              if (err) {
                console.error('❌ Error obteniendo asignaturas:', err);
                asignaturas = [];
              }
              
              gradosConAsignaturas.push({
                ...grado,
                asignaturas: asignaturas || []
              });
              
              procesados++;
              
              // Cuando se procesen todos, responder
              if (procesados === grados.length) {
                console.log(`✅ ${gradosConAsignaturas.length} grado(s) con asignaturas`);
                res.json({ success: true, grados: gradosConAsignaturas });
              }
            }
          );
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 2. PUT /api/grados/asignaturas/:id/docente - CAMBIAR DOCENTE DE ASIGNATURA
// ===============================
app.put('/api/grados/asignaturas/:id/docente', isAuthenticated, requireRole('admin'), (req, res) => {
  try {
    const claseId = req.params.id;
    const { docente_id } = req.body;
    
    console.log(`🔄 PUT /api/grados/asignaturas/${claseId}/docente`);
    console.log(`   Docente ID: ${docente_id || 'null'}`);
    
    db.run(
      `UPDATE clases SET docente_id = ? WHERE id = ?`,
      [docente_id || null, claseId],
      function(err) {
        if (err) {
          console.error('❌ Error:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        console.log(`✅ Docente asignado a clase ${claseId}`);
        res.json({ 
          success: true, 
          message: 'Docente asignado exitosamente'
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 3. DELETE /api/grados/asignaturas/:id - ELIMINAR ASIGNATURA
// ===============================
app.delete('/api/grados/asignaturas/:id', isAuthenticated, requireRole('admin'), (req, res) => {
  try {
    const claseId = req.params.id;
    
    console.log(`🗑️ DELETE /api/grados/asignaturas/${claseId}`);
    
    db.run(
      `DELETE FROM clases WHERE id = ?`,
      [claseId],
      function(err) {
        if (err) {
          console.error('❌ Error:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        console.log(`✅ Asignatura eliminada (clase ${claseId})`);
        res.json({ 
          success: true, 
          message: 'Asignatura eliminada exitosamente'
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 4. DELETE /api/grados/:id/completo - ELIMINAR GRADO COMPLETO
// ===============================
app.delete('/api/grados/:id/completo', isAuthenticated, requireRole('admin'), (req, res) => {
  try {
    const gradoId = req.params.id;
    
    console.log(`🗑️ DELETE /api/grados/${gradoId}/completo`);
    
    // Primero obtener el grado para saber grado, nivel, paralelo
    db.get(
      `SELECT grado, nivel, paralelo FROM grados WHERE id = ?`,
      [gradoId],
      (err, grado) => {
        if (err || !grado) {
          console.error('❌ Grado no encontrado');
          return res.status(404).json({ success: false, error: 'Grado no encontrado' });
        }
        
        // Eliminar todas las clases de este grado
        db.run(
          `DELETE FROM clases 
           WHERE grado = ? AND curso = ? AND paralelo = ?`,
          [grado.grado, grado.nivel, grado.paralelo],
          function(err) {
            if (err) {
              console.error('❌ Error:', err);
              return res.status(500).json({ success: false, error: err.message });
            }
            
            // Eliminar el grado
            db.run(
              `DELETE FROM grados WHERE id = ?`,
              [gradoId],
              function(err) {
                if (err) {
                  console.error('❌ Error:', err);
                  return res.status(500).json({ success: false, error: err.message });
                }
                
                console.log(`✅ Grado ${grado.grado} ${grado.nivel} ${grado.paralelo} eliminado`);
                res.json({ 
                  success: true, 
                  message: `Grado ${grado.grado} ${grado.nivel} - Paralelo ${grado.paralelo} eliminado`
                });
              }
            );
          }
        );
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// 5. GET /api/docentes - OBTENER LISTA DE DOCENTES
// ===============================
app.get('/api/docentes', isAuthenticated, requireRole('admin'), (req, res) => {
  try {
    console.log('👨‍🏫 GET /api/docentes');
    
    db.all(
      `SELECT id, fullname FROM docentes ORDER BY fullname`,
      (err, docentes) => {
        if (err) {
          console.error('❌ Error:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        console.log(`✅ ${docentes?.length || 0} docente(s)`);
        res.json({ 
          success: true, 
          docentes: docentes || []
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ===============================
// ENDPOINT PARA LIMPIAR TODO RÁPIDO
// ===============================
// AGREGA ESTO en server.js

app.post('/api/admin/reset-grados-rapido',
  isAuthenticated, requireRole('admin'),
  (req, res) => {
    console.log('💥 INICIANDO RESET RÁPIDO DE GRADOS...');
    
    db.serialize(() => {
      // 1. Eliminar todas las clases (grados)
      db.run('DELETE FROM clases', [], function(err) {
        if (err) console.error('Error borrando clases:', err);
        console.log(`🗑️ Clases eliminadas: ${this.changes}`);
      });

      // 2. Volver a crear los grados base sin duplicados
      const grados = [
        ['1ro', 'EGB', 'A'],
        ['2do', 'EGB', 'A'],
        ['3ro', 'EGB', 'A'],
        ['4to', 'EGB', 'A'],
        ['5to', 'EGB', 'A'],
        ['6to', 'EGB', 'A'],
        ['7mo', 'EGB', 'A'],
        ['8vo', 'EGB', 'A'],
        ['9no', 'EGB', 'A'],
        ['10mo', 'BGU', 'A'],
        ['1ro', 'BGU', 'A'],
        ['2do', 'BGU', 'A'],
        ['3ro', 'BGU', 'A']
      ];

      const stmt = db.prepare(`
        INSERT INTO clases (grado, curso, paralelo, subnivel_id, created_by)
        VALUES (?, ?, ?, 4, 1)
      `);

      grados.forEach(g => {
        stmt.run(g, function(err) {
          if (!err) {
            console.log(`✅ Grado creado: ${g[0]} ${g[1]} ${g[2]} (ID: ${this.lastID})`);
          }
        });
      });

      stmt.finalize(() => {
        setTimeout(() => {
          console.log('\n✅ RESET COMPLETADO - Grados recreados sin duplicados');
          res.json({ 
            success: true, 
            message: 'Reset completado. Se recrearon 13 grados sin duplicados',
            grados_creados: grados.length
          });
        }, 1000);
      });
    });
  }
);


// ===============================
// API → MATRICULACIÓN EN LOTE
// ===============================
// AGREGAR ESTOS ENDPOINTS EN server.js

// 1. OBTENER ESTUDIANTES DE UN CURSO ACTUAL (para matriculación en lote)
app.get('/api/matriculas/curso/:cursoId/estudiantes', 
  isAuthenticated, requireRole('admin'), 
  (req, res) => {
    const { cursoId } = req.params;
    
    console.log(`📋 GET /api/matriculas/curso/${cursoId}/estudiantes`);
    
    db.all(`
      SELECT DISTINCT
        e.id as estudiante_id,
        e.cedula,
        e.nombre,
        e.genero,
        e.adaptacion_curricular,
        m.periodo_lectivo as periodo_actual,
        c.grado,
        c.curso as nivel,
        c.paralelo
      FROM matriculas m
      INNER JOIN estudiantes e ON m.estudiante_id = e.id
      INNER JOIN clases c ON m.clase_id = c.id
      WHERE m.clase_id = ? AND m.estado = 'activo'
      ORDER BY e.nombre ASC
    `, [cursoId], (err, estudiantes) => {
      if (err) {
        console.error('❌ Error obteniendo estudiantes:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      console.log(`✅ ${estudiantes.length} estudiante(s) encontrado(s)`);
      
      res.json({ 
        success: true, 
        estudiantes,
        total: estudiantes.length
      });
    });
  }
);

// 2. MATRICULAR MÚLTIPLES ESTUDIANTES EN UNA NUEVA CLASE (Lote)
app.post('/api/matriculas/lote', 
  isAuthenticated, requireRole('admin'), 
  (req, res) => {
    const { estudiantes_ids, clase_destino_id, periodo_lectivo } = req.body;
    
    console.log(`📤 POST /api/matriculas/lote`);
    console.log(`   Estudiantes: ${estudiantes_ids.length}`);
    console.log(`   Clase destino: ${clase_destino_id}`);
    console.log(`   Período: ${periodo_lectivo}`);
    
    // Validaciones
    if (!Array.isArray(estudiantes_ids) || estudiantes_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe seleccionar al menos un estudiante' 
      });
    }
    
    if (!clase_destino_id || !periodo_lectivo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Clase y período lectivo son requeridos' 
      });
    }
    
    // Verificar que la clase existe
    db.get('SELECT id FROM clases WHERE id = ?', [clase_destino_id], (err, clase) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (!clase) {
        return res.status(404).json({ 
          success: false, 
          error: 'La clase destino no existe' 
        });
      }
      
      // Proceder con matriculación en lote
      db.serialize(() => {
        let exitosas = 0;
        let errores = [];
        let duplicadas = 0;
        
        const stmt = db.prepare(`
          INSERT INTO matriculas 
          (estudiante_id, clase_id, periodo_lectivo, estado, created_by)
          VALUES (?, ?, ?, 'activo', ?)
        `);
        
        estudiantes_ids.forEach((estudianteId, index) => {
          console.log(`  [${index + 1}/${estudiantes_ids.length}] Matriculando estudiante ${estudianteId}...`);
          
          stmt.run(
            [estudianteId, clase_destino_id, periodo_lectivo, req.session.user.id],
            function(err) {
              if (err) {
                if (err.message.includes('UNIQUE')) {
                  console.log(`    ℹ️  Ya estaba matriculado en esta clase`);
                  duplicadas++;
                } else {
                  console.error(`    ❌ Error:`, err.message);
                  errores.push(`Estudiante ${estudianteId}: ${err.message}`);
                }
              } else {
                console.log(`    ✅ Matriculado exitosamente`);
                exitosas++;
              }
            }
          );
        });
        
        stmt.finalize((err) => {
          if (err) {
            console.error('❌ Error finalizando:', err);
            return res.status(500).json({ success: false, error: err.message });
          }
          
          console.log(`✅ Lote completado:`);
          console.log(`   Exitosas: ${exitosas}`);
          console.log(`   Duplicadas: ${duplicadas}`);
          console.log(`   Errores: ${errores.length}`);
          
          res.json({ 
            success: true, 
            mensaje: `${exitosas} estudiante(s) matriculado(s) exitosamente`,
            exitosas,
            duplicadas,
            errores: errores.length > 0 ? errores : undefined,
            total_procesados: estudiantes_ids.length
          });
        });
      });
    });
  }
);

// 3. OBTENER CICLOS ESCOLARES DISPONIBLES
app.get('/api/ciclos-escolares', 
  isAuthenticated, 
  (req, res) => {
    console.log('📅 GET /api/ciclos-escolares');
    
    db.all(`
      SELECT DISTINCT periodo_lectivo as ciclo
      FROM matriculas
      WHERE periodo_lectivo IS NOT NULL
      ORDER BY periodo_lectivo DESC
    `, [], (err, ciclos) => {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // Agregar el ciclo actual por defecto
      const ciclosUnicos = ciclos.map(c => c.ciclo);
      if (!ciclosUnicos.includes('2025-2026')) {
        ciclosUnicos.unshift('2025-2026');
      }
      
      console.log(`✅ ${ciclosUnicos.length} ciclo(s) encontrado(s):`);
      ciclosUnicos.forEach(c => console.log(`   - ${c}`));
      
      res.json({ 
        success: true, 
        ciclos: ciclosUnicos,
        actual: '2025-2026'
      });
    });
  }
);

// 4. OBTENER ESTUDIANTES POR CICLO ESCOLAR (con separación de históricos)
app.get('/api/estudiantes/por-ciclo/:ciclo', 
  isAuthenticated, 
  (req, res) => {
    const { ciclo } = req.params;
    
    console.log(`📊 GET /api/estudiantes/por-ciclo/${ciclo}`);
    
    // Filtros opcionales
    const { busqueda, genero } = req.query;
    
    let query = `
      SELECT DISTINCT
        e.id,
        e.cedula,
        e.nombre,
        e.genero,
        e.adaptacion_curricular,
        m.periodo_lectivo,
        c.grado,
        c.curso as nivel,
        c.paralelo,
        a.nombre as asignatura_nombre,
        u.fullname as docente_nombre,
        m.estado as estado_matricula
      FROM estudiantes e
      LEFT JOIN matriculas m ON e.id = m.estudiante_id
      LEFT JOIN clases c ON m.clase_id = c.id
      LEFT JOIN asignaturas a ON c.asignatura_id = a.id
      LEFT JOIN usuarios u ON c.docente_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (ciclo && ciclo !== 'todos') {
      query += ` AND m.periodo_lectivo = ?`;
      params.push(ciclo);
    }
    
    if (busqueda) {
      query += ` AND (e.nombre LIKE ? OR e.cedula LIKE ?)`;
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }
    
    if (genero) {
      query += ` AND e.genero = ?`;
      params.push(genero);
    }
    
    query += ` ORDER BY e.nombre ASC`;
    
    db.all(query, params, (err, estudiantes) => {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // Agrupar por estudiante y mantener todas sus clases
      const estudiantesAgrupados = {};
      
      estudiantes.forEach(est => {
        if (!estudiantesAgrupados[est.id]) {
          estudiantesAgrupados[est.id] = {
            id: est.id,
            cedula: est.cedula,
            nombre: est.nombre,
            genero: est.genero,
            adaptacion_curricular: est.adaptacion_curricular,
            periodo_lectivo: est.periodo_lectivo,
            clases: []
          };
        }
        
        // Agregar clase si existe
        if (est.asignatura_nombre) {
          estudiantesAgrupados[est.id].clases.push({
            grado: est.grado,
            nivel: est.nivel,
            paralelo: est.paralelo,
            asignatura: est.asignatura_nombre,
            docente: est.docente_nombre
          });
        }
      });
      
      const resultado = Object.values(estudiantesAgrupados);
      
      console.log(`✅ ${resultado.length} estudiante(s) en ciclo ${ciclo}`);
      
      res.json({ 
        success: true, 
        ciclo,
        estudiantes: resultado,
        total: resultado.length
      });
    });
  }
);

// 5. ESTADÍSTICAS POR CICLO ESCOLAR
app.get('/api/estadisticas/ciclo/:ciclo', 
  isAuthenticated, 
  (req, res) => {
    const { ciclo } = req.params;
    
    console.log(`📈 GET /api/estadisticas/ciclo/${ciclo}`);
    
    db.all(`
      SELECT 
        COUNT(DISTINCT e.id) as total_estudiantes,
        COUNT(DISTINCT c.id) as total_clases,
        COUNT(DISTINCT u.id) as total_docentes,
        e.genero,
        COUNT(e.id) as cantidad
      FROM matriculas m
      INNER JOIN estudiantes e ON m.estudiante_id = e.id
      INNER JOIN clases c ON m.clase_id = c.id
      LEFT JOIN usuarios u ON c.docente_id = u.id
      WHERE m.periodo_lectivo = ? AND m.estado = 'activo'
      GROUP BY e.genero
    `, [ciclo], (err, stats) => {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      console.log(`✅ Estadísticas compiladas`);
      
      res.json({ 
        success: true, 
        ciclo,
        estadisticas: stats
      });
    });
  }
);


// ===============================
// API → MANTENIMIENTO - VER Y EDITAR
// ===============================

// ✅ VER UN MANTENIMIENTO ESPECÍFICO
app.get('/api/mantenimiento/historial/:id',
  isAuthenticated,
  (req, res) => {
    const { id } = req.params;
    
    console.log(`👀 GET /api/mantenimiento/historial/${id}`);
    
    db.get(`
      SELECT 
        m.id,
        m.fecha_realizada,
        m.observaciones,
        m.inventario_id,
        m.tarea_mantenimiento_id,
        i.codigo as equipo_codigo,
        i.tipo as equipo_tipo,
        i.ubicacion,
        t.nombre as tarea_nombre,
        u.fullname as realizado_por_nombre
      FROM mantenimientos_realizados m
      INNER JOIN inventario i ON m.inventario_id = i.id
      INNER JOIN tareas_mantenimiento t ON m.tarea_mantenimiento_id = t.id
      LEFT JOIN usuarios u ON m.realizado_por = u.id
      WHERE m.id = ?
    `, [id], (err, mantenimiento) => {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (!mantenimiento) {
        return res.status(404).json({ success: false, error: 'Mantenimiento no encontrado' });
      }
      
      console.log('✅ Mantenimiento encontrado:', mantenimiento.id);
      res.json({ success: true, mantenimiento });
    });
  }
);

// ✅ EDITAR MANTENIMIENTO
app.put('/api/mantenimiento/historial/:id',
  isAuthenticated,
  requirePermission('mantenimiento', 'editar'),
  (req, res) => {
    const { id } = req.params;
    const { inventario_id, tarea_mantenimiento_id, fecha_realizada, observaciones } = req.body;
    
    console.log(`✏️ PUT /api/mantenimiento/historial/${id}`);
    
    if (!inventario_id || !tarea_mantenimiento_id || !fecha_realizada) {
      return res.status(400).json({ 
        success: false, 
        error: 'Equipo, tarea y fecha son requeridos' 
      });
    }
    
    db.run(`
      UPDATE mantenimientos_realizados 
      SET inventario_id = ?, 
          tarea_mantenimiento_id = ?, 
          fecha_realizada = ?, 
          observaciones = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [inventario_id, tarea_mantenimiento_id, fecha_realizada, observaciones || '', id], 
    function(err) {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Mantenimiento no encontrado' });
      }
      
      console.log('✅ Mantenimiento actualizado');
      res.json({ success: true, message: 'Mantenimiento actualizado exitosamente' });
    });
  }
);

// ✅ VER TAREA DE MANTENIMIENTO ESPECÍFICA
app.get('/api/mantenimiento/tareas/:id',
  isAuthenticated,
  (req, res) => {
    const { id } = req.params;
    
    console.log(`👀 GET /api/mantenimiento/tareas/${id}`);
    
    db.get(`
      SELECT 
        t.*,
        u.fullname as creado_por_nombre
      FROM tareas_mantenimiento t
      LEFT JOIN usuarios u ON t.created_by = u.id
      WHERE t.id = ?
    `, [id], (err, tarea) => {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (!tarea) {
        return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
      }
      
      console.log('✅ Tarea encontrada:', tarea.nombre);
      res.json({ success: true, tarea });
    });
  }
);

// ✅ EDITAR TAREA DE MANTENIMIENTO
app.put('/api/mantenimiento/tareas/:id',
  isAuthenticated,
  requirePermission('mantenimiento', 'editar'),
  (req, res) => {
    const { id } = req.params;
    const { nombre, frecuencia } = req.body;
    
    console.log(`✏️ PUT /api/mantenimiento/tareas/${id}`);
    
    if (!nombre || !frecuencia) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nombre y frecuencia son requeridos' 
      });
    }
    
    if (!['M', 'B', 'S', 'N'].includes(frecuencia)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Frecuencia inválida' 
      });
    }
    
    db.run(`
      UPDATE tareas_mantenimiento 
      SET nombre = ?, frecuencia = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nombre, frecuencia, id], function(err) {
      if (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
      }
      
      console.log('✅ Tarea actualizada');
      res.json({ success: true, message: 'Tarea actualizada exitosamente' });
    });
  }
);
// ===============================
// INICIAR SERVIDOR
// ===============================
app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log(`🚀 GESINFRA-WEB ejecutándose en:`);
  console.log(`   http://localhost:${PORT}`);
  console.log('========================================');
  console.log('');
});

// ===============================
// MANEJO GLOBAL DE ERRORES
// ===============================
process.on('uncaughtException', (err) => {
  console.error('❌ ERROR NO CAPTURADO:', err.message);
  console.error('Stack:', err.stack);
  // NO reiniciar el servidor, solo loguear
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMESA RECHAZADA:', reason);
});

// ===============================
// MANEJADOR DE ERRORES EXPRESS
// ===============================
app.use((err, req, res, next) => {
  console.error('❌ ERROR EN MIDDLEWARE:', err.message);
  res.status(500).json({ 
    success: false, 
    error: 'Error del servidor: ' + err.message 
  });
});