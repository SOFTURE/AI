# The example app as a production-shaped image: the container recipe of @softure-ai/ops
# (modules/ops/README.md, "Container recipe"), verified by scripts/container.mjs and CI.
#
# One image, two roles: `node server.js` serves the app, `node migrate.mjs` applies the module
# migrations once before the app starts (compose.container.yaml runs it as a one-off service), so
# the schema can never drift from the code that stands on it.
#
# Build from the repository root (this app installs the workspace packages as packed copies):
#   docker build -f examples/next-app/Dockerfile -t softure-example-app .
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS builder
WORKDIR /repo
COPY . .
# `CI=true` skips the git hooks install (`prepare`): the image has no repository and no git.
RUN CI=true npm ci --no-audit --no-fund && npm run build

WORKDIR /repo/examples/next-app
RUN CI=true npm ci --no-audit --no-fund
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1
# Server action IDs change with every build unless this key is the same for every build
# (docs/02-module-standard.md §8). An app that builds per container or runs instances from different
# builds passes it as a build secret; one build run as several containers shares the IDs anyway.
#   RUN --mount=type=secret,id=actions_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY npm run build
RUN npm run build

# The migrate runner: module SQL files copied out of the packages (a bundle cannot find package
# folders), then the three-line script bundled with pg left external (the standalone server ships it).
RUN npx softure migrate --export-migrations ./softure-migrations \
 && /repo/node_modules/.bin/esbuild scripts/migrate.ts --bundle --platform=node --format=esm --target=node22 \
      --external:pg --external:@electric-sql/pglite --outfile=migrate.mjs

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 0.0.0.0, not localhost: otherwise the server listens only inside the container.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs

# Root-owned and read-only for the app user: the process cannot rewrite its own code.
COPY --from=builder /repo/examples/next-app/.next/standalone ./
COPY --from=builder /repo/examples/next-app/.next/static ./.next/static
COPY --from=builder /repo/examples/next-app/migrate.mjs ./migrate.mjs
COPY --from=builder /repo/examples/next-app/softure-migrations ./softure-migrations

USER nextjs
EXPOSE 3000

# Health measured by the database and the module checks, not by a page render: FIRE_TRACKER's
# `/login` answered 200 with Postgres stopped. In the image, not only in compose, so it travels to
# production. `node -e` because alpine has no curl.
HEALTHCHECK --interval=5s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
