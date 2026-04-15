# TEKNİK ÜRÜN GEREKSİNİM DÖKÜMANI (TECH PRD)

Proje Adı: CareMind — Muayene & Sigorta Takip Uygulaması

Aşama: Faz 1 - MVP (Minimum Uygulanabilir Ürün)

Platform: iOS & Android (React Native + Expo)

Hazırlayan: Dila KEMER

Durum: Onaylandı

---

## 1. Ürün Vizyonu ve İş Hedefleri (Özet)

CareMind, Türkiye'deki 25 milyondan fazla araç sahibinin kronik olarak yaşadığı bir sorunu çözmeyi hedeflemektedir: araç muayene, trafik sigortası, kasko ve periyodik bakım tarihlerini takip etmek. Kullanıcılar bu tarihleri hâlâ takvimlere not almakta ancak bildirimleri kaçırmakta; bu durum yasal ceza ve maddi kayıplara yol açmaktadır.

Uygulamanın değer önerisi son derece sadedir: **araç bilgilerini bir kez gir, kritik tarihlerden önce otomatik bildirim al.** MVP, backend gerektirmeyen tam yerel bir mimari üzerine inşa edilecek; bu sayede geliştirme süresi ve maliyeti minimize edilecektir.

**Kuzey Yıldızı Metriği:** Uygulamada aktif bildirim kurulumu tamamlanmış araç sayısı.

**Viralite Metriği:** Sigorta teklif ekranından affiliate linkine yönlendirilen kullanıcı sayısı (lead).

---

## 2. Teknoloji Yığını (Tech Stack) & Mimari

MVP aşamasında backend bağımlılığını sıfırda tutmak, geliştirme hızını maksimize etmek ve tamamen çevrimdışı çalışabilmek için aşağıdaki mimari kullanılacaktır:

- **Mobil İstemci (Frontend):** React Native 0.73+ ile Expo SDK 50+. iOS ve Android için tek kod tabanı.
- **Dil:** TypeScript — zorunlu.
- **Navigasyon:** React Navigation v6 (Stack + Bottom Tab).
- **Yerel Depolama:** AsyncStorage — tüm araç verisi şifrelenmeden cihazda saklanır. Backend yoktur.
- **Bildirim Sistemi:** expo-notifications — yerel zamanlı push bildirimi, backend gerektirmez.
- **Tarih Hesaplama:** date-fns — kalan gün, format ve karşılaştırma işlemleri için.
- **UI Stili:** NativeWind (Tailwind CSS'in React Native uyarlaması).
- **Build & Dağıtım:** EAS Build + EAS Submit.

---

## 3. VERİ MODELİ (ASYNCSTORAGE)

Backend ve veritabanı bulunmamaktadır. Tüm veriler cihazda AsyncStorage'da JSON formatında tutulur.

**Anahtar:** `'araclar'` → Araç nesnelerinden oluşan JSON dizisi.

| Alan | Tip | Açıklama |
|---|---|---|
| `id` | UUID | Aracın eşsiz kimliği |
| `plaka` | string | Araç plakası |
| `marka` | string | Araç markası |
| `model` | string | Araç modeli |
| `yil` | number | Model yılı |
| `muayeneTarihi` | date | Muayene bitiş tarihi |
| `sigortaTarihi` | date | Trafik sigortası bitiş tarihi |
| `kaskoTarihi` | date | Kasko bitiş tarihi |
| `bakimTarihi` | date | Periyodik bakım tarihi |
| `bildirimler.gun60` | boolean | 60 gün önce bildirim |
| `bildirimler.gun30` | boolean | 30 gün önce bildirim |
| `bildirimler.gun7` | boolean | 7 gün önce bildirim |
| `bildirimler.gun1` | boolean | 1 gün önce bildirim |
| `bildirimler.saat` | string | Bildirimlerin gönderileceği saat (HH:mm) |

**Bildirim Planlama Kuralları:**
- Araç kaydedildiğinde veya güncellendiğinde tüm eski bildirimler iptal edilip yenileri planlanır.
- Her tarih kategorisi için bağımsız ID üretilir: `plaka + kategori + gun`.
- Geçmiş tarihler için bildirim planlanmaz; ana ekranda 🔴 kırmızı uyarı gösterilir.
- ⚠️ Expo bildirim kotası cihaz başına 64 adettir (4 araç × 4 kategori × 4 bildirim). 5+ araçta kırmızı > sarı > yeşil önceliklendirmesi uygulanır.

---

## 4. EKRANLAR (SCREENS) VE KULLANICI AKIŞI (UI/UX)

Arayüz tasarımı; temiz ve minimalist bir yapıya sahip olacak, renk kodlu durum göstergeleri (yeşil/sarı/kırmızı) ile bilgi hiyerarşisi net biçimde kurulacaktır. Yeni bir kullanıcı ilk araç eklemesini 60 saniyede tamamlayabilmelidir.

**Onboarding (SCR-01):**
3 sayfalık ilk açılış rehberi. Uygulamanın değer önerisi, bildirim izni gerekçesi ve araç eklemeye yönlendirme. Bildirim izni ekranında iznin neden gerekli olduğu açık şekilde anlatılır; red durumunda ana ekranda uyarı gösterilir.

**Ana Ekran (SCR-02):**
Tüm araçların kart listesi. Her kartta araç adı, en yakın tarih ve renk durum göstergesi yer alır: 🟢 30 günden fazla, 🟡 15–30 gün, 🔴 15 günden az. Sağ alt köşede "Araç Ekle" FAB butonu.

**Araç Ekle / Düzenle (SCR-03):**
Plaka, marka, model, yıl alanları ve dört tarih kategorisi için native `DatePicker` bileşenleri. Alt kısımda bildirim tercihleri (açma/kapatma ve saat seçimi). Düzenleme ve silme işlemleri aynı ekrandan yapılır.

**Araç Detay (SCR-04):**
Tek araç için dört tarih kategorisinin tam görünümü. Her satırda kalan gün sayısı, renk göstergesi ve "Yakın İstasyon Bul" aksiyonu (Google Harita'da "TÜVTÜRK" araması açar).

**Sigorta Teklifi (SCR-05):**
"Sigortanız 30 gün içinde bitiyor" bildirimi tetiklendikten sonra erişilen ekran. Affiliate partner URL'si UTM parametresiyle (`source=arachatir&lead_id={id}`) WebView içinde açılır.

**Ayarlar (SCR-06):**
Genel bildirim saati tercihi, uygulama sürüm bilgisi ve geri bildirim linki.

---

## 5. USER STORIES & ACCEPTANCE CRITERIA (BACKLOG)

### EPIC 1: Araç Profili Yönetimi

**US 1.1 — Araç Ekleme**

Hikaye: Bir araç sahibi olarak, aracımın bilgilerini ve kritik tarihlerini hızlıca kaydedebilmek istiyorum.

Kabul Kriterleri:
- **Given:** Kullanıcı Ana Ekran'daki "+" butonuna basmıştır.
- **When:** Plaka, marka ve en az bir tarih alanı doldurulup "Kaydet"e basıldığında;
- **Then:** Araç AsyncStorage'a yazılmalı ve Ana Ekran'da renk durum göstergesiyle listelenmeli.
- **And:** Tüm seçili tarihler için push bildirimleri otomatik olarak planlanmalıdır.
- **Hata Durumu:** Plaka alanı boş bırakılırsa "Plaka alanı boş bırakılamaz" şeklinde inline kırmızı hata metni gösterilmelidir.

**US 1.2 — Çoklu Araç Desteği**

Hikaye: Aileme ait birden fazla aracın takibini tek uygulamadan yapmak istiyorum.

Kabul Kriterleri:
- **Given:** Kullanıcının AsyncStorage'da en az bir aracı mevcuttur.
- **When:** "+" butonuyla yeni bir araç eklediğinde;
- **Then:** Ana Ekran'da her araç ayrı kart olarak listelenmelidir.
- **And:** Her araç kendi bağımsız bildirim planına sahip olmalıdır.

---

### EPIC 2: Bildirim Motoru

**US 2.1 — Otomatik Push Bildirimi Alma**

Hikaye: Muayene veya sigorta tarihim yaklaştığında, uygulamayı açmama gerek kalmadan bildirim almak istiyorum.

Kabul Kriterleri:
- **Given:** Kullanıcının muayene tarihi 30 gün sonrasına ayarlanmıştır.
- **When:** Sistemde tam 30 gün kala expo-notifications tarafından planlanan bildirim tetiklendiğinde;
- **Then:** Cihazda şu formatta bildirim görünmelidir: `Toyota Corolla — Muayene 30 gün kaldı`
- **And:** Bildirime tıklandığında uygulama açılarak ilgili aracın detay ekranına yönlendirilmelidir.
- **Hata Durumu:** Bildirim izni reddedilmişse Ana Ekran'da sarı uyarı banner'ı gösterilmeli ve izin ayarlarına yönlendirme linki sunulmalıdır.

**US 2.2 — Bildirim Tercihlerini Özelleştirme**

Hikaye: Hangi aracım için hangi aralıklarda bildirim alacağımı kendim seçmek istiyorum.

Kabul Kriterleri:
- **Given:** Kullanıcı Araç Düzenle ekranındadır.
- **When:** 60/30/7/1 gün toggle'larından birini kapatıp kaydederse;
- **Then:** İlgili bildirim AsyncStorage'dan silinmeli ve cihazdan iptal edilmelidir.
- **And:** Açık kalan bildirimler değişmeden planlanmaya devam etmelidir.

---

### EPIC 3: Sigorta Yönlendirme ve Gelir

**US 3.1 — Sigorta Teklifi Alma**

Hikaye: Sigortam bitmek üzereyken, uygulamanın içinden kolayca yenileme teklifi alabilmek istiyorum.

Kabul Kriterleri:
- **Given:** Kullanıcının trafik sigortası tarihi 30 gün içindedir.
- **When:** "Teklif Al" butonuna bastığında;
- **Then:** Sigorta teklif ekranı açılmalı ve partner URL UTM parametresiyle WebView'de yüklenmelidir: `source=arachatir&lead_id={kullaniciId}`
- **And:** WebView yüklenmezse (internet yoksa) native hata uyarısı gösterilmelidir.

---

## 6. Kapsam Dışı (Out of Scope - Faz 1 İçin)

- Bulut senkronizasyonu ve çoklu cihaz desteği (v2'de Supabase ile eklenecek).
- Plaka ile otomatik veri çekme (e-Devlet API ortaklığı gerektiriyor).
- HGS / OGS bakiye takibi.
- Araç satış / alım asistanı.
- Topluluk özellikleri (araç sahipleri forumu).
- Widget desteği (iOS / Android ana ekran).
- Filo yönetimi (10+ araç, kurumsal segment).
- Motosiklet desteği.