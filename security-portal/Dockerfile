# Stage 1: Build Angular app
FROM node:18-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build --prod

# Stage 2: Serve app with Nginx
FROM nginx:alpine 

# Remove default Nginx static files and copy the built Angular app
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/security-portal /usr/share/nginx/html

# Copy Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]