# Multi-stage build for the Discord ↔ GitHub gateway bot.
# Build context is this directory (apps/discord-bot) — the bot has no
# workspace-internal dependencies, so it builds standalone.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/lib ./lib
# Cloud Run injects PORT; the bot opens a health server on it.
EXPOSE 8080
CMD ["node", "lib/index.js"]
