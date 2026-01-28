const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './database/gesinfra.db';

// Crear conexión
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
    } else {
        console.log('✅ Conectado a SQLite');
    }
});

// Inicializar base de datos
function initDatabase() {
    db.serialize(() => {
        // Tabla usuarios
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE,
            role TEXT NOT NULL CHECK(role IN ('admin', 'docente', 'estudiante')),
            student_cedula TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_cedula) REFERENCES students(cedula)
        )`);

        // Tabla estudiantes
        db.run(`CREATE TABLE IF NOT EXISTS students (
            cedula TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            gender TEXT NOT NULL CHECK(gender IN ('Masculino', 'Femenino')),
            grade TEXT NOT NULL,
            paralelo TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabla calificaciones por trimestre
        db.run(`CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_cedula TEXT NOT NULL,
            trimester TEXT NOT NULL CHECK(trimester IN ('t1', 't2', 't3')),
            ai REAL DEFAULT 1.00,
            ag REAL DEFAULT 1.00,
            rp REAL DEFAULT 1.00,
            pi REAL DEFAULT 1.00,
            ex REAL DEFAULT 1.00,
            promedio REAL DEFAULT 1.00,
            status TEXT DEFAULT 'Reprobado',
            FOREIGN KEY (student_cedula) REFERENCES students(cedula) ON DELETE CASCADE,
            UNIQUE(student_cedula, trimester)
        )`);

        // Tabla promedios anuales
        db.run(`CREATE TABLE IF NOT EXISTS annual_grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_cedula TEXT UNIQUE NOT NULL,
            annual_avg REAL DEFAULT 1.00,
            annual_status TEXT DEFAULT 'Supletorio',
            supletorio_note REAL DEFAULT 0.00,
            final_avg REAL DEFAULT 1.00,
            final_status TEXT DEFAULT 'Reprobado',
            FOREIGN KEY (student_cedula) REFERENCES students(cedula) ON DELETE CASCADE
        )`);

        // Tabla inventario
        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cod_activo TEXT UNIQUE NOT NULL,
            tipo_equipo TEXT NOT NULL,
            ubicacion TEXT NOT NULL,
            estado TEXT NOT NULL CHECK(estado IN ('Operativo', 'Mantenimiento', 'Desuso')),
            descripcion TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabla políticas de accesibilidad
        db.run(`CREATE TABLE IF NOT EXISTS accessibility_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            politica_general TEXT,
            adaptaciones_tecnologicas TEXT,
            plan_capacitacion TEXT,
            revision_fecha DATE,
            responsable TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabla contexto académico
        db.run(`CREATE TABLE IF NOT EXISTS academic_context (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_educativa TEXT DEFAULT 'Unidad Educativa Modelo',
            asignatura TEXT DEFAULT 'Informática Aplicada',
            ano_lectivo TEXT DEFAULT '2025-2026',
            modalidad TEXT DEFAULT 'Presencial',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Insertar usuario admin por defecto
        const adminPassword = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT OR IGNORE INTO users (username, password, full_name, email, role) 
                VALUES ('admin', ?, 'Administrador', 'admin@gesinfra.edu.ec', 'admin')`, 
                [adminPassword]);

        // Insertar contexto académico por defecto
        db.run(`INSERT OR IGNORE INTO academic_context (id) VALUES (1)`);

        // Insertar política de accesibilidad por defecto
        db.run(`INSERT OR IGNORE INTO accessibility_policies (id) VALUES (1)`);
    });
}

// Funciones helper para queries
const query = {
    // Ejecutar query con parámetros
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },

    // Obtener un registro
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Obtener múltiples registros
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

module.exports = { db, initDatabase, query };