const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());

// ... (aquí van tus conexiones a la base de datos, rutas CRUD, etc.)

// 1. EXPORTA LA APLICACIÓN para que Jest y Supertest puedan usarla
module.exports = app;

// 2. CONDICIONA EL LISTEN para que solo abra el servidor si NO se está ejecutando en modo de pruebas
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}