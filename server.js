const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());

// Aquí puedes colocar tus rutas y conexión a la base de datos (ej. /api/movies, etc.)
app.get('/', (req, res) => {
  res.status(200).json({ mensaje: 'API CRUD funcionando correctamente' });
});

// 1. EXPORTA LA APLICACIÓN para que Jest y Supertest puedan usarla sin iniciar el servidor HTTP
module.exports = app;

// 2. CONDICIONA EL LISTEN para que solo abra el puerto si NO se está ejecutando en modo de pruebas
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}///////////////