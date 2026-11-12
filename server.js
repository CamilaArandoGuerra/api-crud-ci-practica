const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());

// Creamos un POOL para manejar reconexiones automáticas y evitar que la conexión muera
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password123',
  database: process.env.DB_NAME || 'crud_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificar conexión inicial y crear tabla si no existe
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    return;
  }
  console.log('¡Conectado exitosamente a la base de datos MySQL mediante Pool!');
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    )
  `;
  connection.query(createTableQuery, (createErr) => {
    connection.release(); // Liberamos la conexión de vuelta al pool
    if (createErr) console.error('Error al crear la tabla:', createErr);
  });
});

// Endpoint LEER (GET)
app.get('/categories', (req, res) => {
  pool.query('SELECT * FROM categories', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Endpoint CREAR (POST)
app.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El campo name es obligatorio' });
  }
  pool.query('INSERT INTO categories (name) VALUES (?)', [name], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: results.insertId, name });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});