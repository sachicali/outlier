# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies including dev dependencies for building
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Runtime stage
FROM oven/bun:1 AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S api -u 1001

# Copy package files
COPY package.json bun.lockb ./

# Install only production dependencies
RUN bun install --production --frozen-lockfile

# Copy application code
COPY --from=builder --chown=api:nodejs /app/src ./src
COPY --from=builder --chown=api:nodejs /app/logs ./logs

# Create necessary directories
RUN mkdir -p logs && chown -R api:nodejs logs

# Switch to non-root user
USER api

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["bun", "src/index.js"]