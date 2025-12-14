# ----------------------------
# 1. BUILD aşaması
# ----------------------------
FROM node:20.19.0-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build args (Northflank Build arguments buraya gelir)
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG NUXT_PUBLIC_SUPABASE_URL
ARG NUXT_PUBLIC_SUPABASE_KEY

# Build sırasında Nuxt/modül bunları okuyabilsin
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_KEY=${SUPABASE_KEY}
ENV NUXT_PUBLIC_SUPABASE_URL=${NUXT_PUBLIC_SUPABASE_URL}
ENV NUXT_PUBLIC_SUPABASE_KEY=${NUXT_PUBLIC_SUPABASE_KEY}

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

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
