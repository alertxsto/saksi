# syntax=docker/dockerfile:1
# Saksi web (Next.js standalone). Built and run by deploy/deploy.sh + deploy/compose.yaml.
#
#   docker build -t saksi-web:dev \
#     --build-arg NEXT_PUBLIC_RPC_PRIMARY=https://... [--build-arg NEXT_PUBLIC_...=...] web/
#
# NEXT_PUBLIC_* values are inlined into the client and server bundles by `next build`, so they
# are build arguments. Everything else (secrets included) is read at runtime from the env file;
# the build needs no secrets.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Dependencies only change with the manifest or the lockfile, so this layer is usually cached.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=saksi-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM deps AS build
# Keep this list equal to the NEXT_PUBLIC_* names read in web/; deploy.sh passes every
# `ARG NEXT_PUBLIC_*` declared here from the env file and fingerprints them into the image tag.
ARG NEXT_PUBLIC_RPC_PRIMARY
ARG NEXT_PUBLIC_RPC_SECONDARY
ARG NEXT_PUBLIC_RPC_TERTIARY
ARG NEXT_PUBLIC_REGISTRY_ADDRESS
ARG NEXT_PUBLIC_JOURNAL_ADDRESS
ARG NEXT_PUBLIC_BREACH_ADDRESS
ARG NEXT_PUBLIC_DEPLOY_BLOCK
COPY . .
# public/ is optional in Next.js; create it so the runtime COPY below always has a source.
RUN mkdir -p public && pnpm build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Owned by root and only readable by the app user: the server never writes its own code.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
# There are no pages on this branch, so probe the API route instead: /api/status without the demo
# token answers 403 before touching the database, RPC or AI, and only once the route module has
# loaded. No token is needed and no secret is returned.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --start-interval=1s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/status',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.status===403?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]
