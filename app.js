const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { initDatabase } = require('./database');

const app = express();
const PORT = 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'gesinfra-secret',
  resave: false,
  saveUninitialized: true,
}));

// Inicializar DB
let db;
initDatabase()
  .then(conn => { db = conn; })
  .catch(console.error);

// Middleware de autenticación
function auth(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/');
}

// ===== RUTAS PÚBLICAS =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// LOGIN
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await db.execute('SELECT * FROM users WHERE username=?', [username]);
  if (!rows.length) return res.json({ error: 'Usuario no encontrado' });
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ error: 'Contraseña incorrecta' });

  req.session.user = { id: user.id, role: user.role, name: user.full_name };
  res.json({ success: true, redirect: '/dashboard' });
});

// LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// CURRENT USER
app.get('/current-user', auth, (req, res) => {
  res.json(req.session.user);
});

// DASHBOARD
app.get('/dashboard', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ===== API DE LOS MÓDULOS =====

// ESTUDIANTES
app.get('/students', auth, async (req, res) => {
  const [students] = await db.execute('SELECT * FROM students');
  res.json(students);
});
app.post('/students', auth, async (req, res) => {
  const { cedula, name, gender, grade, paralelo } = req.body;
  await db.execute(
    'INSERT INTO students (cedula, name, gender, grade, paralelo) VALUES (?, ?, ?, ?, ?)',
    [cedula, name, gender, grade, paralelo]
  );
  res.json({ success: true });
});

// CALIFICACIONES
app.get('/grades', auth, async (req, res) => {
  const [grades] = await db.execute('SELECT * FROM grades');
  res.json(grades);
});
app.post('/grades', auth, async (req, res) => {
  const { student_cedula, trimester, ai, ag, rp, pi, ex, promedio, status } = req.body;
  await db.execute(
    `INSERT INTO grades (student_cedula, trimester, ai, ag, rp, pi, ex, promedio, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [student_cedula, trimester, ai, ag, rp, pi, ex, promedio, status]
  );
  res.json({ success: true });
});

// INVENTARIO
app.get('/inventory', auth, async (req, res) => {
  const [inventory] = await db.execute('SELECT * FROM inventory');
  res.json(inventory);
});
app.post('/inventory', auth, async (req, res) => {
  const { cod_activo, tipo_equipo, ubicacion, estado, descripcion } = req.body;
  await db.execute(
    'INSERT INTO inventory (cod_activo, tipo_equipo, ubicacion, estado, descripcion) VALUES (?, ?, ?, ?, ?)',
    [cod_activo, tipo_equipo, ubicacion, estado, descripcion]
  );
  res.json({ success: true });
});

/* CONTEXTO ACADÉMICO
app.get('/context', auth, async (req, res) => {
  const [context] = await db.execute('SELECT * FROM academic_context WHERE id=1');
  res.json(context[0]);
});
app.post('/context', auth, async (req, res) => {
  const { unidad_educativa, asignatura, ano_lectivo, modalidad } = req.body;
  await db.execute(
    `UPDATE academic_context SET unidad_educativa=?, asignatura=?, ano_lectivo=?, modalidad=? WHERE id=1`,
    [unidad_educativa, asignatura, ano_lectivo, modalidad]
  );
  res.json({ success: true });
});*/

// POLÍTICAS DE ACCESIBILIDAD
app.get('/policies', auth, async (req, res) => {
  const [policies] = await db.execute('SELECT * FROM accessibility_policies WHERE id=1');
  res.json(policies[0]);
});
app.post('/policies', auth, async (req, res) => {
  const { politica_general, adaptaciones_tecnologicas, plan_capacitacion, revision_fecha, responsable } = req.body;
  await db.execute(
    `UPDATE accessibility_policies 
     SET politica_general=?, adaptaciones_tecnologicas=?, plan_capacitacion=?, revision_fecha=?, responsable=? 
     WHERE id=1`,
    [politica_general, adaptaciones_tecnologicas, plan_capacitacion, revision_fecha, responsable]
  );
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
