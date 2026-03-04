# Stage 1: Build the React Frontend
FROM node:18-slim AS frontend-builder
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Final Python Image
FROM python:3.9-slim
WORKDIR /app

# Sistem bağımlılıklarını kur
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılık dosyasını kopyala ve kur
COPY server/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Proje dosyalarını kopyala
COPY server/ .

# Ensure static folder is empty before copying fresh assets
RUN rm -rf static/* && mkdir -p static/generated uploads

# Built frontend dosyalarını kopyala
COPY --from=frontend-builder /client/dist ./static/

# Final launch
ENV PORT=5000
EXPOSE $PORT

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT app:app --timeout 120"]
