# ----------------------------
# 1. BUILD aşaması
# ----------------------------
FROM node:20.14.0-slim AS builder

# Gerekli paketler
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Sadece package.json kopyala
COPY package.json ./

# Bağımlılıkları kur
RUN npm install

# Kaynak dosyaları kopyala
COPY . .

# Nuxt prepare (postinstall) manuel çalıştır
RUN npm run postinstall

# Build
RUN npm run build


# ----------------------------
# 2. PRODUCTION aşaması
# ----------------------------
FROM node:20.14.0-slim

WORKDIR /app

# Sadece prod için gerekli dosyaları kopyala
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
