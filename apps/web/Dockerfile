# syntax=docker/dockerfile:1
# Build context: repository root. Produces the Expo web export served by nginx.

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @fittrack/web --workspace @fittrack/shared --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# EXPO_PUBLIC_* values are inlined into the bundle at build time.
ARG EXPO_PUBLIC_API_URL=http://localhost:4000
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
RUN npm run build -w @fittrack/web

FROM nginx:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
