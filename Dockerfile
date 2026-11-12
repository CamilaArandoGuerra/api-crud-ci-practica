FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies si usas nodemon ahí)
RUN npm install

# Copiar el resto del código fuente
COPY . .

EXPOSE 3000

# Por defecto arranca en producción, pero se puede sobrescribir en docker-compose.dev.yml
CMD ["npm", "start"]
