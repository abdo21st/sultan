# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./prisma.config.ts
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --prefer-offline --fetch-retries=5 --fetch-timeout=300000 --loglevel=verbose --foreground-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY lib/permissions.ts ./lib/permissions.ts
COPY lib/password-policy.ts ./lib/password-policy.ts
COPY lib/password-constraints.ts ./lib/password-constraints.ts
COPY scripts/enroll-initial-admin.ts ./scripts/enroll-initial-admin.ts
CMD ["npm", "run", "db:migrate:deploy"]

FROM builder AS verification
RUN apk add --no-cache chromium docker-cli && npx --no-install playwright install ffmpeg
ENV CI=true E2E_CHROME_PATH=/usr/bin/chromium
CMD ["npm", "test", "--", "--runInBand"]

FROM node:22-alpine AS runner
ARG APP_REVISION=unknown
LABEL org.opencontainers.image.revision=$APP_REVISION
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs -G nodejs
RUN mkdir -p /app/storage/order-images && chown -R nextjs:nodejs /app/storage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
