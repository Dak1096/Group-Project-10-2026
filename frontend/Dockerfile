# Frontend: build ra file tĩnh rồi phục vụ bằng nginx.
# Giả định: `npm run build` xuất ra thư mục dist (Vite). Next.js hoặc framework khác thì sửa lại.
# Frontend gọi API bằng đường dẫn tương đối /api, không để localhost trong code.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
