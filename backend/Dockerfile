FROM node:23.8.0-alpine3.21 

WORKDIR /usr/src/app

RUN apk update && apk add --no-cache git

COPY package*.json ./

RUN npm install

COPY . .


EXPOSE 5000
CMD ["node", "server.js"]
