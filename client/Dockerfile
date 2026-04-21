# 1. Aşama: Build (Derleme)
FROM node:20-alpine AS build

WORKDIR /app

# Bağımlılıkları kur
COPY package*.json ./
RUN npm install

# Kaynak kodları kopyala ve build al
COPY . .
RUN npm run build

# 2. Aşama: Servis (Nginx)
FROM nginx:stable-alpine

# Build çıktısını Nginx'in hizmet dizinine kopyala
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx portu
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
