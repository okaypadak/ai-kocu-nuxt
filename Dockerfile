# ----------------------------
# 1. BUILD aşaması
# ----------------------------
FROM node:20.19.0-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

# Build alırken .env dosyasını okumasını sağlar.
COPY .env .

RUN npm run postinstall
RUN npm run build


# ----------------------------
# 2. PRODUCTION aşaması
# ----------------------------
FROM node:20.19.0-slim

WORKDIR /app

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
