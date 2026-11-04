# syntax=docker/dockerfile:1
#   docker build --build-arg APP_VERSION=$(git rev-parse HEAD) -t id-web .
#   docker run --rm -p 3000:3000 -e ID_API_URL=http://host.docker.internal:3190 \
#     -e SITE_URL=http://localhost:3000 -e SESSION_SECRET=<32+ chars> id-web
# APP_VERSION is the only build arg: one image runs on stage and prod, and
# everything environment-specific (*_API_URL, SITE_URL, SESSION_SECRET, ROBOTS)
# is runtime env.

# base: the Node image every stage starts from. Renovate updates the tag.
FROM node:26.13.0-trixie-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# deps: pnpm and node_modules, cached until the manifests change.
FROM base AS deps
ENV CI=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Node 25+ ships without corepack: install the pnpm that package.json "packageManager" names.
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && npm cache clean --force
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# build: the standalone server (.next/standalone) and its static assets.
FROM deps AS build
COPY . .
RUN pnpm build && mkdir -p public

# runtime: only the build output. Files stay owned by root, so the app cannot
# change itself; the numeric non-root user (Kubernetes can verify
# runAsNonRoot) may write only to /tmp and .next/cache. With a read-only root
# filesystem both are tmpfs (emptyDir in Kubernetes). .next/cache is 1777 like
# /tmp: `docker run --tmpfs` copies the directory's mode but not its owner.
FROM base AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY scripts/healthcheck.mjs ./
RUN mkdir -p .next/cache && chmod 1777 .next/cache
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "server.js"]
