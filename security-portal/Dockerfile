# Stage 1: Build Angular app
FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package.json package-lock.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application files
COPY . .
# Stage 2: Serve app with Nginx
#FROM nginx:alpine 

# Remove default Nginx static files and copy the built Angular app
#RUN rm -rf /usr/share/nginx/html/*
#COPY --from=build /app/dist/security-portal /usr/share/nginx/html
# Copy Nginx configuration file
#COPY nginx.conf /etc/nginx/conf.d/default.conf
#CMD ["nginx", "-g", "daemon off;"]
# Start Angular app

EXPOSE 4200

CMD ["npm", "start"]