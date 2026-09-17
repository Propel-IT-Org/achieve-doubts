# Build context is the REPO ROOT, not backend/ — this is a Bun workspace and
# the lockfile lives one level up:
#
#   docker build -f backend/Dockerfile -t achieve-doubts-api .
#   podman build --format docker -f backend/Dockerfile -t achieve-doubts-api .
#
# (Podman defaults to the OCI image format, which drops HEALTHCHECK.
# `--format docker` keeps it.)
#
# The release image contains one bundled file plus the migration SQL — no
# source tree and no node_modules:
#
#   docker run IMAGE            serve (default)
#   docker run IMAGE migrate    apply migrations, then exit
#   docker run IMAGE seed       load the taxonomy, then exit

ARG BUN_VERSION=1.4.2

FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app

# Every workspace manifest must be present for Bun to resolve the workspace
# graph, even though only the API's packages are installed below.
COPY package.json bun.lock ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Runtime dependencies of the API workspace only: the bundler needs nothing
# else, and skipping the frontend and devDependencies keeps this stage small.
RUN bun install --frozen-lockfile --production --filter @achieve/doubts-backend

FROM deps AS build
COPY backend/ backend/
RUN cd backend && bun run build

FROM oven/bun:${BUN_VERSION}-alpine AS release
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=bun:bun /app/backend/dist ./dist
# The runtime migrator reads these (including meta/_journal.json).
COPY --from=build --chown=bun:bun /app/backend/drizzle ./drizzle

# oven/bun images ship a non-root `bun` user.
USER bun

EXPOSE 3000

# main.ts drains on SIGTERM: /api/healthz turns 503 before the server stops.
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null || exit 1

ENTRYPOINT ["bun", "dist/main.js"]
CMD ["serve"]
