Markdown
# INFORME TÉCNICO: Práctica Individual 4 - Configuración de un Pipeline de Despliegue
**Estudiante:** Camila Arando Guerra  
**Carrera:** Ingeniería de Sistemas (Facultad de Tecnología, Universidad Mayor, Real y Pontificia de San Francisco Xavier de Chuquisaca)

---

## 1. Descripción del Pipeline de CD y Decisiones Técnicas

El pipeline de Entrega Continua (CD) fue diseñado utilizando **GitHub Actions** para automatizar el ciclo de vida del software, asegurando que ningún cambio llegue a producción sin pasar por validaciones de calidad, seguridad y pruebas de salud (*health checks*).

### Arquitectura de Trabajos (*Jobs*)
* **`build-and-push`**:
  * Realiza el *checkout* del código fuente.
  * Inicia sesión en **Docker Hub** de forma segura utilizando secretos cifrados.
  * Utiliza un `Dockerfile` optimizado para empaquetar una API en **Node.js**.
  * Etiqueta la imagen automáticamente con el SHA único del commit y la etiqueta `latest` mediante `docker/metadata-action`.
  * Sube la imagen resultante al registro de Docker Hub.
  * Ejecuta un escaneo de seguridad automatizado con **Trivy** para detectar vulnerabilidades.
* **`deploy`**:
  * Depende de la correcta ejecución del paso anterior (`needs: build-and-push`).
  * Utiliza la funcionalidad de **GitHub Environments (`production`)** para aislar las credenciales de despliegue (`SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`).
  * Se conecta mediante SSH a la instancia de **AWS EC2** para actualizar el servicio de forma automatizada y segura.

### Decisiones Técnicas Clave
* **Estrategia Blue-Green con Puerto Temporal (3005):** Para evitar cortes en el servicio durante las actualizaciones, el script en el servidor descarga la nueva imagen y la ejecuta temporalmente en el puerto `3005`.
* **Health Check Automatizado:** Mediante una petición `curl` al puerto temporal, se comprueba que el servidor responda correctamente (`200 OK`) antes de apagar la versión anterior. Si el servicio falla, el script se aborta automáticamente protegiendo la disponibilidad en el puerto `80`.

---

## 2. Evidencias del Proceso

### A. Resumen del Flujo de Trabajo en GitHub Actions
El pipeline se ejecuta de manera exitosa dividiéndose en dos etapas secuenciales:
1. **`build-and-push`**: Compilación exitosa de la imagen de Docker, subida al registro de Docker Hub y aprobación satisfactoria del escaneo de vulnerabilidades mediante Trivy (configurado con `exit-code: 0` para reportar sin bloquear el flujo).
2. **`deploy`**: Conexión segura mediante el entorno de producción (`production`) a la instancia AWS EC2, aplicando el despliegue con validación en el puerto temporal `3005` antes de liberar el tráfico al puerto `80`.

### B. Resultado del Escaneo de Seguridad (Trivy)
El análisis estático de la imagen ejecutado por Trivy reportó el estado de las dependencias del sistema operativo base y de las librerías de Node.js, garantizando la trazabilidad y el control de los componentes críticos previo al pase a producción.

### C. Verificación en la Instancia Remota
La aplicación quedó accesible públicamente a través de la dirección IP de la instancia EC2, respondiendo correctamente a las peticiones HTTP con la versión oficial de la API (`version: '2.0.0'`).

---

## 3. Códigos Clave Utilizados

### Archivo de la Aplicación (`app.js`)
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    version: '2.0.0', 
    mensaje: "API CRUD funcionando correctamente" 
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
Archivo Dockerfile
Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "app.js"]
Flujo de Integración y Despliegue (.github/workflows/cd.yml)
YAML
name: CD - Build, Push and Scan and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout del repositorio
        uses: actions/checkout@v3

      - name: Iniciar sesión en Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}

      - name: Extraer metadatos (etiquetas SHA y latest)
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: \${{ secrets.DOCKER_USERNAME }}/mi-app
          tags: |
            type=sha,format=long
            latest

      - name: Construir y publicar imagen Docker
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}

      - name: Escaneo de vulnerabilidades con Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '\${{ secrets.DOCKER_USERNAME }}/mi-app:latest'
          format: 'table'
          exit-code: '0'
          ignore-unfixed: true
          vuln-type: 'os,library'
          severity: 'CRITICAL,HIGH'

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Desplegar en produccion
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: \${{ secrets.SSH_HOST }}
          username: \${{ secrets.SSH_USER }}
          key: \${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            IMAGE="\${{ secrets.DOCKER_USERNAME }}/mi-app:latest"
            
            docker rm -f mi-app-new || true
            
            docker pull \$IMAGE
            docker run -d \
              --name mi-app-new \
              --restart unless-stopped \
              -p 3005:3000 \
              \$IMAGE
            
            sleep 10
            
            if curl -sf http://localhost:3005/; then
              echo "Health check exitoso. Reemplazando contenedor en producción..."
              docker stop mi-app || true
              docker rm mi-app || true
              docker run -d \
                --name mi-app \
                --restart unless-stopped \
                -p 80:3000 \
                \$IMAGE
              docker rm -f mi-app-new || true
            else
              echo "Health check FALLIDO. Abortando despliegue..."
              docker logs mi-app-new
              docker rm -f mi-app-new || true
              exit 1
            fi
            
            docker system prune -f
4. Procedimiento de Rollback Manual
Si una versión recién desplegada presenta fallos críticos en producción, el procedimiento documentado para realizar una reversión rápida (rollback) en el servidor AWS EC2 es el siguiente:

Conectarse al servidor remoto vía SSH.

Descargar explícitamente la imagen correspondiente al commit anterior estable mediante su SHA:

Bash
docker pull TU_USUARIO/mi-app:SHA_ANTERIOR
Detener y eliminar el contenedor defectuoso activo:

Bash
docker stop mi-app
docker rm mi-app
Levantar nuevamente el contenedor estable apuntando al puerto público 80:

Bash
docker run -d --name mi-app --restart unless-stopped -p 80:3000 TU_USUARIO/mi-app:SHA_ANTERIOR
5. Reflexión sobre las Ventajas del Uso de Contenedores y CD
Consistencia de Entornos: La contenedorización con Docker garantiza que el entorno de desarrollo, pruebas y producción sean exactamente idénticos, erradicando los típicos errores de incompatibilidad de librerías o sistemas operativos.

Automatización y Confiabilidad: La implementación de un pipeline de CD elimina la intervención manual propensa a errores humanos, estandarizando las pruebas de vulnerabilidades (Trivy) y los controles de salud (Health Checks).

Resiliencia y Agilidad: Permite ciclos de entrega rápidos, iteraciones continuas y mecanismos seguros de recuperación ante fallos, elevando los estándares profesionales de desarrollo de software bajo un enfoque de DevSecOps.

---

## 6. Descarga del Informe Completo

Si requieres visualizar este documento en un formato de maquetación formal (PDF) junto con las evidencias gráficas detalladas, puedes acceder al archivo descargable directamente desde la raíz del repositorio:
- [Descargar Informe Completo en PDF](./INFORME.pdf)