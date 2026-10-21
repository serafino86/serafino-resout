FROM node:22.23.4-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node
EXPOSE 3001

CMD ["node", "server.js"]
