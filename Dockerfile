FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run check:server && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /var/lib/lagerraum && chown -R node:node /var/lib/lagerraum /app
ENV NODE_ENV=production PORT=5176 LAGERRAUM_DATA_DIR=/var/lib/lagerraum
USER node
EXPOSE 5176
CMD ["npm","start"]
