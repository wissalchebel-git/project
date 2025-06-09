FROM node:18-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y git 

COPY package*.json ./

RUN npm install

COPY . .


EXPOSE 5000
CMD ["node", "server.js"]
