const request = require('supertest');
const app = require('./server');

describe('Pruebas de la API CRUD', () => {
  it('Debería responder a la ruta principal con estado 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});