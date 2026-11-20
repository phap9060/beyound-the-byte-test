FROM node:22.22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS run
ENV NODE_ENV=production MASTRA_TELEMETRY_DISABLED=1
COPY --from=build /app /app
VOLUME /data
EXPOSE 3000
CMD ["sh", "deploy/start.sh"]
