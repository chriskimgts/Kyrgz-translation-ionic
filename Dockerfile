# Use Node.js 20
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files for both frontend and backend
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci
RUN cd server && npm ci

# Copy server code
COPY server/ ./server/

# Copy frontend source
COPY src/ ./src/
COPY angular.json ./
COPY tsconfig*.json ./
COPY ionic.config.json ./
COPY capacitor.config.ts ./

# Build the frontend
RUN npm run build:prod

# Build the backend
RUN cd server && npm run build

# Expose port (Cloud Run uses PORT env var)
EXPOSE 8080

# Set environment variable
ENV PORT=8080

# Start the backend server
CMD ["node", "server/dist/server.js"]
