# Image tunggal dipakai oleh KEDUA process group di fly.toml (app + cron) --
# sengaja TIDAK memangkas devDependencies karena scripts/cron-sweep.ts dijalankan
# lewat `tsx` (devDependency) di runtime, bukan dikompilasi lebih dulu. Ini jaga
# arsitektur node-cron proses terpisah tetap identik dengan yang di dokumentasi.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src

EXPOSE 3000

# Perintah default -- fly.toml menimpa ini per process group ("app" pakai
# `npm run start`, "cron" pakai `npm run cron`), jadi nilai ini cuma fallback
# kalau image dijalankan manual (mis. `docker run` lokal tanpa fly.toml).
CMD ["npm", "run", "start"]
