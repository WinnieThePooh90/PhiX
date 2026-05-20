FROM node:22-alpine
RUN apk add --no-cache docker-cli docker-cli-compose
WORKDIR /app
COPY package*.json ./
# postinstall braucht scripts/ + prisma/ — die liegen erst nach COPY . . vor.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run prisma:generate-all
EXPOSE 3000
CMD ["npm", "start"]
