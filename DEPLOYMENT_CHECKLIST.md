# Render.com Deployment Checklist

## 📋 Render'a Yayınlamadan Önce Yapılacaklar

### 1. ✅ Git Repository Hazırlanması
```bash
# .gitignore'da aşağıdakilerin olduğundan emin ol
.env
.env.local
instance/
node_modules/
server/static/dist/
__pycache__/
*.pyc
.pytest_cache/
.venv/
build/
dist/
*.egg-info/
```

### 2. ✅ Environment Variables (Render Dashboard'da Secret olarak ekle)
```
FLASK_ENV=production
SECRET_KEY=<güvenli-random-string-üret>
JWT_SECRET_KEY=<başka-güvenli-string>
DATABASE_URL=postgresql://... (Render otomatik sağlar)
GEMINI_API_KEY=<api-key>
OPENAI_API_KEY=<api-key>
ANTHROPIC_API_KEY=<api-key>
STRIPE_API_KEY=<api-key>
RESEND_API_KEY=<api-key>
PYTHONUNBUFFERED=1
```

### 3. ✅ Database Migration (PostgreSQL)
```bash
# Local'de test et:
flask db upgrade

# Render'da otomatik çalışması için:
# - render.yaml'da buildCommand eklendi
# - Database connection Render'dan gelecek
```

### 4. ✅ Build Process
```bash
# Build komutları render.yaml'da tanımlandı:
cd server && \
pip install -r requirements.txt && \
cd ../client && \
npm install && \
npm run build && \
cp -r dist/* ../server/static/
```

### 5. ✅ Static Files
- Client build edilecek: `npm run build`
- Dosyalar `/server/static/` dizinine kopyalanacak
- Backend'de serve edilecek: `WsgiToAsgi(flask_app)`

---

## 🚀 Render'da Yayın Aşamaları

### Adım 1: Render.com'da Oturum Aç
```
https://dashboard.render.com
```

### Adım 2: GitHub'ı Bağla
- Repo'yu Render'a connect et
- Branch: `main` (veya production branch'in)

### Adım 3: Service Oluştur
- **Service Type:** Web Service
- **Build Command:** `render.yaml` otomatik kullanılacak
- **Start Command:** Procfile veya render.yaml'dan gelecek

### Adım 4: Environment Variables Ekle
- Tüm secret variables'ları Render dashboard'ında ekle
- Asla code'da hardcode etme!

### Adım 5: Database Bağla
- PostgreSQL database oluştur (Render'da)
- `DATABASE_URL` env variable otomatik set edilir

### Adım 6: Deploy Başlat
- Push to GitHub → Render otomatik deploy eder
- Logs'u takip et: `Settings → Logs`

---

## 🔍 Deployment Sonrası Kontrol

### 1. Health Check
```bash
curl https://your-app.onrender.com/health
# Response: {"status": "ok"}
```

### 2. API Test
```bash
curl -X POST https://your-app.onrender.com/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"test","model":"gpt-4o-mini"}'
```

### 3. Web UI Test
```
https://your-app.onrender.com/
# Frontend açılmalı (static files serve edilecek)
```

### 4. Logs Kontrol
- Render dashboard → Logs
- Herhangi bir error var mı?
- Startup time normal mi?

---

## ⚠️ Dikkat Edilecek Noktalar

### 1. **Port Binding**
```python
# ❌ YANLIŞ:
app.run(port=5001)

# ✅ DOĞRU:
port = int(os.getenv('PORT', 5001))
app.run(host='0.0.0.0', port=port)
```

### 2. **Workers Ayarı**
```bash
# ❌ YANLIŞ (Fixed workers):
uvicorn app:app --workers 4

# ✅ DOĞRU (Dynamic):
uvicorn app:app --workers ${WEB_CONCURRENCY:-4}
```

### 3. **Timeout Settings**
```bash
# Streaming responses için yeterli timeout gerekli
--timeout-keep-alive 90
--timeout-notify 90
--timeout-graceful-shutdown 30
```

### 4. **Disk ve Memory**
- Free tier: 512 MB RAM (worker sayısını 2-4 tut)
- Standard: 2 GB RAM (worker sayısını 4-8 tut)

### 5. **Cold Starts**
- Free tier'da inactive 15 dakika sonra durdurulur
- Bundled tier: 99.9% uptime garantisi

---

## 📦 Pakete İhtiyaç Olan Dependencies

```txt
# server/requirements.txt'te bulunması gereken:
Flask>=3.0.0
FastAPI>=0.111.0
uvicorn[standard]>=0.29.0
psycopg2-binary>=2.9.0  # PostgreSQL driver
SQLAlchemy>=2.0.0
google-genai>=1.10.0
openai>=1.51.0
anthropic>=0.39.0
python-dotenv>=1.0.0
# ... diğerleri
```

---

## 🎯 Render.yaml Kullanmanın Avantajları

- ✅ IaC (Infrastructure as Code)
- ✅ One-click deploy
- ✅ Otomatik build process
- ✅ Database provisioning
- ✅ Environment management
- ✅ Health checks
- ✅ Auto-scaling options

---

## 🔧 Troubleshooting

### Deploy Başarısız Olursa
1. Logs'u oku: `Render → Logs`
2. Build hatası mı?: `pip install` başarısız
3. Runtime hatası mı?: Server start edilemiyor
4. Environment variables var mı?: Missing env var

### Slow Response Times
1. Worker sayısını arttır: `WEB_CONCURRENCY=8`
2. Instance upgrade et (Free → Standard)
3. Database region'ını app'le aynı bölgeye koy
4. CDN ekle (Render free CDN var)

### Database Connection
```python
# Render otomatik DATABASE_URL sağlar
import os
db_url = os.getenv('DATABASE_URL')
# Format: postgresql://user:password@host:5432/dbname
```

---

## 📝 Tavsiyeler

1. **Production Model** olarak `gpt-4o-mini` veya `claude-sonnet` kullan (free tier Gemini limited)
2. **Database backup**'ını regular al
3. **Monitoring** kur (Sentry, Datadog vs.)
4. **Rate limiting** ekle API endpoints'ine
5. **Error logging** set up et (Render logs'a yazıyor)
6. **Environment isolation**: Development vs Production
7. **CI/CD**: GitHub Actions ile ekstra test aşaması ekle

