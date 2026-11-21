# Backend Node.js (Prisma, server.js bọc các hàm trong backend/api).
# Giả định: có package.json, thư mục prisma/ và file server.js ở gốc thư mục backend.
FROM node:22-bookworm-slim

ENV NODE_ENV=production

# Prisma cần openssl.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node

# Cài cả devDependencies vì lệnh `prisma migrate deploy` cần Prisma CLI.
# (Chuyển "prisma" sang dependencies thì có thể bỏ --include=dev để image nhẹ hơn.)
COPY --chown=node:node package*.json ./
RUN npm ci --include=dev

COPY --chown=node:node . .
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "server.js"]
