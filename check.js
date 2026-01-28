const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gesinfra.db');

db.all(`
  SELECT c.id, c.grado, c.paralelo, a.nombre as asignatura
  FROM clases c
  LEFT JOIN asignaturas a ON c.asignatura_id = a.id
  WHERE c.grado = '1ro' AND c.paralelo = 'A'
`, (err, clases) => {
  console.log('=== CLASES EN 1ro A ===');
  console.table(clases);
  
  db.all(`
    SELECT m.id, m.estudiante_id, e.nombre, m.clase_id, a.nombre as asignatura
    FROM matriculas m
    INNER JOIN estudiantes e ON m.estudiante_id = e.id
    LEFT JOIN clases c ON m.clase_id = c.id
    LEFT JOIN asignaturas a ON c.asignatura_id = a.id
    WHERE m.estado = 'activo'
    ORDER BY e.nombre
  `, (err, matriculas) => {
    console.log('\n=== TODAS LAS MATRÍCULAS ACTIVAS ===');
    console.table(matriculas);
    db.close();
  });
});