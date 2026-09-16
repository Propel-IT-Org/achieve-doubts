# Build context is the REPO ROOT, not backend/ — this is a Bun workspace, so
# the lockfile and every workspace manifest live one level up:
#
#   docker build -f backend/Dockerfile -t achieve-doubts-api .
#
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# All workspace manifests must be present for `bun install` to resolve the
# workspace graph, even though the API itself has no workspace dependencies.
COPY package.json bun.lock ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Deliberately NOT --production: drizzle-kit is a devDependency and
# `bun run db:migrate` has to be runnable from this same image on deploy.
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copying the whole /app carries node_modules plus the manifests, and avoids
# guessing which packages Bun hoisted to the root vs. left in backend/.
COPY --from=deps /app /app
COPY backend/ backend/

# There is no build step: Bun executes the TypeScript entry directly.
# The image ships the source, which is also what makes db:migrate work here.

# oven/bun images ship a non-root `bun` user.
USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/healthz || exit 1

CMD ["bun", "run", "backend/src/index.ts"]
