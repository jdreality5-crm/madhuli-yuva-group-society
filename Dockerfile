# Stage 1: Build Frontend
FROM node:18-alpine as frontend-build

WORKDIR /app/frontend

COPY frontend-package.json package.json
RUN npm install

COPY App.jsx .
COPY App.css .
COPY index.jsx .
COPY public-index.html public/index.html

RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine as backend

WORKDIR /app/backend

COPY package.json .
RUN npm install

COPY server.js .

# Stage 3: Final Image
FROM node:18-alpine

WORKDIR /app

# Copy backend
COPY --from=backend /app/backend .

# Copy frontend build
COPY --from=frontend-build /app/frontend/build ./public

# Create uploads directory
RUN mkdir -p uploads/bills uploads/photos

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/', (r) => {if (r.statusCode !== 404) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "server.js"]
