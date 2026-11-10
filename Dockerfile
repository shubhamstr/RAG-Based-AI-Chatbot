# Stage 1: Build TypeScript source code
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definition files
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies required for tsc build)
RUN npm ci

# Copy TypeScript source code and server entrypoint
COPY src ./src
COPY server.ts ./

# Build the project
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=6001

# Install curl for docker health checks
RUN apk add --no-cache curl

# Copy dependency definition files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Copy static frontend assets
COPY public ./public

# Ensure uploads directory exists and is owned by the node user
RUN mkdir -p uploads && chown -R node:node /app

# Switch to standard non-root node user
USER node

# Expose Node.js application port
EXPOSE 6001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start the Node.js production server
CMD ["node", "dist/server.js"]
