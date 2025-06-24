FROM node:18-slim 

# Set working directory
WORKDIR /usr/src/app

# Install necessary packages (using apt for Debian-based images)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        git && \
    rm -rf /var/lib/apt/lists/*


COPY package*.json ./

RUN npm install

COPY . .


EXPOSE 5000
CMD ["node", "server.js"]
