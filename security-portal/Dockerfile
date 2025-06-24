

# -------- Stage 1: Build Angular app --------
FROM node:18-slim  AS build

WORKDIR /usr/src/app

# Installer les dépendances
COPY package.json package-lock.json ./
RUN npm install

# Copier le reste des fichiers
COPY . .

# Compiler l'application Angular en mode production
RUN npm run build -- --output-path=dist/security-portal --configuration=production

# -------- Stage 2: Serve app with Nginx + SSL --------
FROM nginx:alpine

# Créer le répertoire pour les certificats SSL
RUN mkdir -p /etc/nginx/ssl

# Copier les certificats SSL
COPY ssl/localhost.crt /etc/nginx/ssl/localhost.crt
COPY ssl/localhost.key /etc/nginx/ssl/localhost.key

# Définir les bonnes permissions
RUN chmod 644 /etc/nginx/ssl/localhost.crt && \
    chmod 600 /etc/nginx/ssl/localhost.key && \
    chown root:root /etc/nginx/ssl/*

# Supprimer les fichiers statiques Nginx par défaut
RUN rm -rf /usr/share/nginx/html/*

# Copier l'app Angular buildée (depuis le sous-répertoire 'browser')
COPY --from=build /usr/src/app/dist/security-portal/browser /usr/share/nginx/html

# Copier la configuration Nginx personnalisée (support HTTPS)
COPY nginx.conf /etc/nginx/nginx.conf

# Exposer les ports HTTP (80) et HTTPS (443)
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
