# ============================================
# Stage 1: Dependencies + s6-overlay
# ============================================
FROM node:lts-alpine AS deps
WORKDIR /app

# Install s6-overlay for multi-arch
ARG TARGETARCH
ARG S6_OVERLAY_VERSION=3.2.1.0

RUN case ${TARGETARCH} in \
      amd64) S6_ARCH=x86_64 ;; \
      arm64) S6_ARCH=aarch64 ;; \
      armhf) S6_ARCH=armhf ;; \
      *) S6_ARCH=${TARGETARCH} ;; \
    esac && \
    wget -O /tmp/s6-overlay-noarch.tar.xz \
      https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz && \
    wget -O /tmp/s6-overlay-arch.tar.xz \
      https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz

# Enable Corepack to manage pnpm
RUN corepack enable

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts

# ============================================
# Stage 2: Build
# ============================================
FROM node:lts-alpine AS build
WORKDIR /app

RUN corepack enable

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Generate Prisma client
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm prisma generate
RUN pnpm postinstall

# Copy source and build
COPY . .
RUN --mount=type=cache,id=build,target=/app/node_modules/.cache \
    pnpm run build

# Remove dev dependencies with a clean production install
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts --prod

# ============================================
# Stage 3: Runner
# ============================================
FROM node:lts-alpine AS runner
WORKDIR /app

# Copy s6-overlay from deps stage
COPY --from=deps /init /init
COPY --from=deps /command /command
COPY --from=deps /etc/s6-overlay /etc/s6-overlay
COPY --from=deps /package /package

# Install runtime dependencies
RUN apk add --no-cache openssl && \
    rm -rf /var/cache/apk/*

# Copy application files from build stage
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/package.json ./package.json

# Copy s6 service definitions and migration script
COPY --chown=node:node docker/s6-rc.d /etc/s6-overlay/s6-rc.d/
COPY --chown=node:node --chmod=755 docker/run-migrations.sh /app/docker/run-migrations.sh

# s6 runs as root but drops to node user for services
ENV NODE_ENV=production
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME=30000
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2
ENV S6_KILL_FINISH_MAXTIME=5000
ENV S6_KILL_GRACETIME=3000

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9090/v1/health || exit 1

# Signal handling
STOPSIGNAL SIGTERM

# Use s6-overlay as entrypoint
ENTRYPOINT ["/init"]
