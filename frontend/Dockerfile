# Dockerfile pour le Frontend React
FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY . .

# Exposer le port de développement Vite
EXPOSE 5173

# Commande de démarrage en mode développement
CMD ["npm", "run", "dev", "--", "--host"]
