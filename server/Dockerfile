# Python 3.9 slim imajı kullanıyoruz (hafif ve stabil)
FROM python:3.9-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Sistem bağımlılıklarını kur (bazı kütüphaneler için gerekebilir)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılık dosyasını kopyala ve kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Proje dosyalarını kopyala
COPY . .

# Static/uploads klasörlerini oluştur (varmış gibi davranalım)
RUN mkdir -p static/uploads static/generated

# Flask'ın çalışacağı port
EXPOSE 5000

# Uygulamayı Gunicorn ile ayağa kaldır (Production standardı)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app", "--timeout", "120"]
