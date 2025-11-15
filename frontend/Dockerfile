# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy app files
COPY . .

# Build Nuxt app
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/.output ./

EXPOSE 3000

# Start Nuxt server
CMD ["node", "server/index.mjs"]
