# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache curl bash && curl -fsSL https://vite.plus | bash
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache bash
COPY --from=deps /root/.vite-plus /root/.vite-plus
ENV PATH="/root/.vite-plus/bin:$PATH"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN vp run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
EXPOSE 6789
ENV HOST=0.0.0.0
ENV PORT=6789
CMD ["node", "dist/server/entry.mjs"]
