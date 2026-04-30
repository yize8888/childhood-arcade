# syntax=docker/dockerfile:1.7
# 海外构建：docker build --build-arg NPM_REGISTRY=https://registry.npmjs.org/ .
ARG NPM_REGISTRY=https://registry.npmmirror.com/

FROM node:24-bookworm-slim AS builder
ARG NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` enforces the lockfile strictly, which breaks cross-platform builds
# when the lockfile was generated on a different OS/arch (e.g. Windows) —
# esbuild's platform-specific binary in optionalDependencies won't be listed.
# `npm install` resolves optional deps for the builder's current platform.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm install --ignore-scripts --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
ARG NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY \
    NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/app.db \
    UPLOADS_DIR=/data/uploads \
    BIOS_DIR=/data/bios \
    SAVES_DIR=/data/saves \
    CORES_DIR=/data/cores \
    npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache --virtual .build-deps python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm npm ci --omit=dev \
 && apk del .build-deps \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY data/bios /opt/bios-seed
COPY data/cores /opt/cores-seed
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
COPY server ./server

VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
