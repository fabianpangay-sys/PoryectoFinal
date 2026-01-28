# PoryectoFinal
SistemaDeGestionEscolar

🏫 GESINFRA-WEB
Sistema de Gestión de Infraestructura y Recursos Académicos

GESINFRA-WEB es una plataforma web integral desarrollada para el Ministerio de Educación del Ecuador, orientada a la gestión académica, administrativa y de infraestructura de instituciones educativas.
El sistema centraliza los procesos clave de una institución, mejorando la organización, el control y la toma de decisiones mediante una solución tecnológica unificada.

✨ Funcionalidades Principales

Gestión completa de usuarios: administradores, docentes y estudiantes.

Control de acceso basado en roles (RBAC) y permisos por módulo.

Creación y gestión de grados, cursos y paralelos.

Asignación de docentes a clases y matrícula de estudiantes por período académico.

Sistema avanzado de calificaciones con cálculo automático de promedios.

Registro de tareas, exámenes, proyectos y supletorios.

Determinación automática del estado académico del estudiante.

Generación y descarga de boletas de calificaciones en PDF.

Gestión de inventario tecnológico institucional.

Módulo de políticas de accesibilidad e inclusión educativa.

🚀 Instalación y Configuración
Requisitos

Node.js versión 14 o superior

npm

Instalación

Clona el repositorio y accede al directorio del proyecto:

git clone https://github.com/tu-usuario/gesinfra-web.git
cd gesinfra-web


Instala las dependencias necesarias:

npm install


Inicia el servidor:

npm start


Accede a la aplicación desde el navegador en:

http://localhost:3000


El sistema incluye usuarios de prueba precargados para facilitar la evaluación inicial: un administrador con acceso completo, un docente con clases de ejemplo y un estudiante con calificaciones de prueba.

La base de datos SQLite se crea automáticamente al iniciar el servidor por primera vez, generando el archivo gesinfra.db con todas las tablas necesarias para el funcionamiento del sistema.

📊 Sistema de Calificaciones

El sistema de evaluación está basado en la normativa educativa ecuatoriana.

Cada trimestre se calcula de la siguiente manera:

Promedio del Trimestre =
(Promedio de 4 tareas × 0.70) + (Examen × 0.15) + (Proyecto × 0.15)

El promedio anual se obtiene con la siguiente fórmula:

Promedio Anual =
(Trimestre 1 + Trimestre 2 + Trimestre 3) / 3

Estados académicos:

Aprobado: promedio mayor o igual a 7.00

Supletorio: promedio entre 5.00 y 6.99

Reprobado: promedio menor a 5.00

Para estudiantes en supletorio, la nota final se calcula así:

Nota Final =
(Promedio Anual × 0.50) + (Nota de Supletorio × 0.50)

El estudiante aprueba si la nota final es mayor o igual a 7.00.

🛠️ Tecnologías Utilizadas

Backend desarrollado con Node.js y Express.js, utilizando SQLite3 como base de datos y Express-Session para el manejo de sesiones.

Frontend construido con HTML5, CSS3 y JavaScript Vanilla, utilizando Bootstrap 5.3.3 para la interfaz de usuario, Bootstrap Icons para los íconos y jsPDF para la generación de documentos PDF.

📁 Estructura del Proyecto

El proyecto se organiza de la siguiente manera:

Carpeta public para archivos estáticos (HTML, CSS y JavaScript).

Archivos JavaScript específicos para cada rol (administrador, docente y estudiante).

Archivo database.js para la configuración de la base de datos.

Archivo server.js que contiene el servidor Express y la lógica del backend.

Archivo package.json con las dependencias del proyecto.

Archivo README.md con la documentación.
