# CodeAlchemist 6. Hafta: Özellikler Özeti

> **Güncelleme Tarihi:** Mart 2026  
> **Durum:** Yapılmış ve test edilmiş ✅  
> **Teknik Seviye:** Orta (ön yüz mimarisi, veri akışı bilgisi gerekir)

---

## İçerik Listesi

1. [Yama Uygulama ve Geri Alma Motoru](#h61-yama-uygulama-ve-geri-alma-motoru)
2. [Bağlam Çubuğu](#h62-bağlam-çubuğu-ve-token-baskısı)
3. [Yanıt Süresi Metrikleri](#h63-yanıt-süresi-ve-ttft)
4. [Maliyet Paneli](#h64-model-maliyet-paneli)
5. [Açılış Sayfası & Auth Hunisi](#h65-açılış-sayfası)

---

## H6.1: Yama Uygulama ve Geri Alma Motoru

### Problem
Kullanıcı, yapay zeka önerilen kodu sisteme aktarmak için manuel olarak kopyala-yapıştır yapıyordu.

### Çözüm
- **Türü:** Frontend durum yönetimi (React hooks)
- **Mekanizm:** Anlık görüntü (snapshot) + komut deseni
- **Kültür:** Güvenli, geri alınabilen kodlama

### İşlev
```
[Kod bloğu] → [Değiştir] / [Ekle] / [Geri Al]
              ↓
    patchHistory yığınında snapshot saklan
              ↓
    Editör durumu atomikte güncellenez
```

### Test Sonuçları
✅ Replace modu  
✅ Append modu  
✅ Undo işlemi  
✅ Boş editör  

---

## H6.2: Bağlam Çubuğu ve Token Baskısı

### Problem
Kullanıcı, model bağlam penceresinin dolma riskini görmüyordu.

### Çözüm
- **Görüntü:** Renk gradyanı çubuk (0–100%)
- **Hesaplama:** `tokens = karakterler / 4` (heuristik)
- **Durumlar:**
  - 🟢 **0–49%** = Güvenli
  - 🟡 **50–79%** = Dikkat
  - 🔴 **80–100%** = Kritik

### Aktif Kaynaklar
Ayılı bayrak gösterisi:
- 💬 Prompt aktif
- 📄 Kod aktif
- 🖼️ Görsel eklenmiş
- 📦 Depo bağlantılı

### Doğruluk
⚠️ **Tahmin katmanıdır.** Kesin token sayısı için OpenAI/Anthropic API'lerinin native output'ları kullanılmalıdır.

---

## H6.3: Yanıt Süresi ve TTFT

### Ölçülen Metrikler
1. **TTFT** = İsteğin ilk token'a ulaştığı zaman
   - Tipik: 0.5–2.0 saniye
   - Gösterim: Yeşil (hızlı), Gri (normal), Turuncu (yavaş)

2. **Toplam Yanıt Süresi** = Başından sonuna
   - Tipik: 1.5–5.0 saniye

### Implementasyon
```javascript
startTime → firstChunkTime → endTime
                ↓
Metrikler mesaj nesnesine kaydedilir
```

### Faydası
- Sistem performansı şeffaf hale gelir
- Model seçimi veriye dayalı hale gelir
- Altyapı sorunları erken tespit edilir

---

## H6.4: Model Maliyet Paneli

### Veri Kaynağı
`GET /api/stats/model-usage` → Backend istatistikleri

### Hesaplama Formula
```
İstek × Ort.GirişToken × GirişFiyat + İstek × Ort.ÇıkışToken × ÇıkışFiyat
```

### Görselleştirme
- Tablo: Model, Kullanım Sayısı, Tahmini Maliyet
- Pasta Grafik: Toplam bütçenin model dağılımı

### Fiyatlandırma Örneği
| Model | Giriş | Çıkış |
|-------|-------|-------|
| GPT-4o | $0.005/1K | $0.015/1K |
| Claude 3.5 | $0.003/1K | $0.015/1K |
| Gemini 2.0 | $0.00075/1K | $0.003/1K |

### Uyarı
⚠️ **Bu tahmini maliyet** resmi muhasebe değildir.  
Doğru fatura platformdan alınmalıdır.

---

## H6.5: Açılış Sayfası & Auth Hunisi

### UX Akışı

#### Yeni Kullanıcı
```
Ziyaret
  ↓
[Açılış Sayfası] "Ürün özellikleri anlatısı"
  ↓
[Başla] buttonu
  ↓
[Auth Modal] "Giriş / Kayıt"
  ↓
[Sohbet Arayüzü]
```

#### Oturum açmış Kullanıcı
```
Ziyaret
  ↓
[Sohbet Arayüzü] (Doğrudan)
```

### Teknik Detaylar
- Local Storage'da token varsa açılış atlanır
- Z-index: Açılış (z=10), Modal (z=100), Chat (z=5)
- Modal kapatma otomatik açılış gizlemez (seçim imkânı)

---

## Mühendislik Özeti

| Ölçüt | Başarısı |
|-------|----------|
| **Güvenli kod aktarımı** | ✅ Yama + undo |
| **Bağlam farkındalığı** | ✅ Token göstergesi |
| **Performans şeffaflığı** | ✅ TTFT + toplam |
| **Ekonomik bilinç** | ✅ Maliyet paneli |
| **Başlangıç akışı** | ✅ Rehberli hunisi |

---

## Sonraki Adımlar (Hafta 7+)

- [ ] Sınırlı undo yığını (max 30)
- [ ] Gerçek token sayımı (API'lerden)
- [ ] Dinamik fiyatlandırma
- [ ] Mobil uyumluluk polishing
- [ ] Gamification entegrasyonu

---

**Detaylı dokümantasyon için:** Bkz. `week6_codebase_report.tex`  
**Kod referansları:** `client/src/components/ChatInterface.jsx`, `ModelCostDashboard.jsx`
