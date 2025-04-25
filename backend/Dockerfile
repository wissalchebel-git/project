FROM node:18

WORKDIR /app

# Install git
#RUN apk add --no-cache git

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
