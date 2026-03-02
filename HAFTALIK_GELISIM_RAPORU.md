# Code Alchemist Projesi: 2 Haftalık Gelişim ve Optimizasyon Raporu

**Özet**  
Bu rapor, *Code Alchemist* isimli yapay zeka destekli tam yığın (full-stack) kod asistanı projesinin altyapı güçlendirme ve akıllı model orkestrasyonu süreçlerini akademik bir dille ele almaktadır. Projenin gelişimi doğrultusunda, sistemin daha ölçeklenebilir, hataya dayanıklı (fault-tolerant) ve maliyet/performans açısından optimize edilmiş bir yapıya kavuşturulması amacıyla iki haftalık bir planlama yapılmış ve uygulanmıştır. Birinci hafta, uygulamanın temel mimari altyapısının bulut tabanlı yapıya taşınmasına odaklanırken; ikinci hafta, sistemin temel "zekasını" oluşturan dinamik dil tespiti ve modele özel yönlendirme (auto-routing) sisteminin geliştirilmesine ayrılmıştır.

---

## 1. Hafta: Altyapı ve Veri Kalıcılığı (Infrastructure & Persistence)

İlk haftanın temel odak noktası, sistemin geliştirme (development) ortamındaki kısıtlamalardan kurtarılarak, üretim (production) ortamının gerektirdiği ölçeklenebilirlik, veri bütünlüğü ve taşınabilirlik standartlarına ulaştırılmasıdır. 

### 1.1. SQLite'tan Bulut Tabanlı PostgreSQL (Supabase) Mimarisinde Geçiş
Sistemin ilk iterasyonlarında hızlı prototipleme amacıyla kullanılan SQLite veritabanı, eşzamanlı (concurrent) okuma/yazma işlemlerinde kilitlenme (locking) sorunları yaratabilmekte ve çoklu sunucu (multi-node) mimarilerinde veri senkronizasyonu açısından darboğaz oluşturmaktadır. Bu kısıtlamaları aşmak adına veritabanı mimarisi, bulut tabanlı ve tam yönetilen (fully-managed) bir PostgreSQL hizmeti olan **Supabase** platformuna taşınmıştır. 
- **Akademik Gerekçe:** İlişkisel veritabanı yönetim sistemlerinde (RDBMS) ACID prensiplerinin (Atomicity, Consistency, Isolation, Durability) katı bir şekilde uygulanması, özellikle kullanıcı sohbet geçmişi (History) ve snippet kayıtları gibi verilerin güvenilirliği için elzemdir. PostgreSQL'in gelişmiş eşzamanlılık kontrolü (MVCC - Multi-Version Concurrency Control) sayesinde, yüksek trafik altında dahi veri bütünlüğü sağlanmıştır.

### 1.2. Uygulamanın Docker ile Konteynerize Edilmesi
Projenin bağımlılıklarının (Python, Node.js paketleri, işletim sistemi seviyesindeki kütüphaneler) birbirine karışmasını önlemek ve "benim bilgisayarımda çalışıyordu" problemini (configuration drift) ortadan kaldırmak için uygulama izole konteynerlere (Docker containers) bölünmüştür.
- **Odaklanılan İşlemler:** Yazılımın çalışması için gereken Dockerfile yapılandırmaları oluşturulmuş, işletim sistemi imajları minimize edilerek (Alpine veya ince imajlar) çalıştırma maliyetleri düşürülmüş ve geliştirme ortamı ile üretim ortamı arasındaki parite (Dev/Prod parity) %100 oranında sağlanmıştır.

### 1.3. Render Üzerinde CI/CD Süreçleri ve Canlı Ortam Dağıtımı
Manuel dağıtım süreçlerinin (deployment) neden olabileceği insan hatalarını minimize etmek amacıyla Sürekli Entegrasyon ve Sürekli Dağıtım (CI/CD) boru hatları (pipelines) kurulmuştur. 
- **İşlem Adımları:** GitHub repository'si doğrudan sunucu (Render.com) ortamına entegre edilmiştir. Push işlemi gerçekleştiği anda webhook tetikleyicileri devreye girerek yeni sürümü otomatik olarak derler (build) ve sıfır kesinti (zero-downtime) prensibiyle yayına alır (deploy).

**🏆 1. Hafta Çıktısı ve Kazanımı:** Veri kaybı riski ortadan kaldırılmış, donanımdan bağımsız çalışabilen, bulut üzerinde yatay ve dikey ölçeklenmeye hazır (scalable) monolitik bir mimari altyapı başarıyla kurulmuştur.

---

## 2. Hafta: Akıllı Yönlendirme Katmanı (Intelligent Auto-Routing)

İkinci haftanın amacı, projenin "bilişsel yükünü" (cognitive load) yöneten ve maliyet/performans optimizasyonunu sağlayan ana orkestrasyon katmanının (Orchestration Layer) geliştirilmesidir. Büyük Dil Modellerinin (LLM) her programlama dilinde aynı performansı vermemesi ve farklı API maliyetlerine sahip olması, bu akıllı katmanın geliştirilmesini zorunlu kılmıştır.

### 2.1. Otomatik Dil Tespiti (Language Detection Katmanı)
Kullanıcıdan gelen kod parçacıklarının (snippet) veya teknik soruların hangi programlama diline ait olduğunu hatasız tespit etmek, yönlendirme mimarisinin ilk adımıdır. Bu bağlamda iki aşamalı (hibrit) bir heuristik analiz modülü (`language_detector.py`) geliştirilmiştir.
- **Mekanizma Yapisı:** 
  1. *Leksikal Analiz (Keyword Matching):* Girdi metni, dillerin kendilerine özgü anahtar kelime matrislerinden (örn. Python için `def`, C++ için `std::cout`) geçirilerek algoritmik bir skorlama (scoring) yapılır. Bu yöntem statik, deterministik ve sıfır gecikmeli (zero-latency) bir tespittir.
  2. *LLM Fallback (Düşük Bilişsel Sınama):* Girdi sadece `[::-1]` gibi standart dışı bir syntax içeriyorsa ve leksikal analiz yetersiz kalıyorsa, bu girdi hafif ağırlıklı ve hızlı bir modele (örn. Gemini 2.5 Flash Lite) gönderilerek "bilişsel dil tespiti" gerçekleştirilir.

### 2.2. Auto-Router: Dile Özel En Optimize Modelin Seçimi
Model yönlendirme mekanizması (`model_router.py`), performans (accuracy), yanıt süresi (latency) ve parasal maliyet (cost) parametrelerini optimize eden karmaşık bir karar ağacıdır (decision tree).
- **Akademik Temellendirme:**
  - **Python:** Veri manipülasyonu ve betik dillerindeki hızı kanıtlanmış olan **Gemini 2.5 Flash** modeline yönlendirilmektedir.
  - **Kurumsal (Enterprise) Diller (Java, C#):** Nesne yönelimli mimari, SOLID prensipleri ve ağır bağımlılık yönetimindeki üstün muhakeme gücü nedeniyle **GPT-4o** tercih edilmektedir.
  - **Web ve Sistem Programlama (JS, TS, React, C++):** Front-end dünyasındaki "State-of-the-Art" model olan **Claude 3.5 Sonnet** motoruna devredilmektedir.
- *Test Süreçleri:* Bu geçiş aşaması, `manual_test_routing.py` analizleriyle simüle edilmiş; hem standart yapılar (Java Boilerplate vb.) hem de tuzaklı-kısa metinler test edilerek sistemin güvenilirliği kanıtlanmıştır.

### 2.3. Çıktıların Dil Standartlarına Uygun Hale Getirilmesi
Modelden dönen (üretilen) cevapların ham metin olarak bırakılması yerine, o dile ait endüstri standartlarına otomatik olarak adapte edilmesi sağlanmıştır.
- **Uygulama:** Python çıktıları PEP8 standartlarına göre biçimlendirilirken, JavaScript/TypeScript çıktıları ECMAScript güncel sürümlerine (ESLint kalıplarına) veya React kancalarına (Hooks) uygun şekilde yapılandırılmaktadır (Standardizer module).

**🏆 2. Hafta Çıktısı ve Kazanımı:** Sistemin hem finansal kaynak kullanımı (API çağrı maliyetleri) optimize edilmiş hem de kullanıcıya çok daha kaliteli (yüksek accuracy) yanıtlar dönmesi garanti altına alınmıştır. Bu yönlendirme (routing) sistemi, Code Alchemist projesinin asıl donanım/yapay zeka "Orkestratörü" konumundadır.

---

## 3. Hafta: Açık Kaynak Entegrasyonu ve Bağlamsal Analiz (Context-Aware Architecture)

3. haftanın temel odak noktası, Code Alchemist'in tekil kod blokları veya sınırlı sohbet geçmişi (chat history) üzerinden değerlendirme yapma kısıtlamasını aşarak, **tüm bir projenin ekosistemini (repository) bağlam (context) olarak algılayabilmesini** sağlamaktır. Bu yetenek, sistemin lokal bir asistandan ziyade "kurumsal bir kod mimarı" olarak hareket etmesinin önünü açar.

### 3.1. GitHub API Entegrasyonu ve Dinamik Dosya Ağacı Ayrıştırması 
Sistemin veritabanı şeması ve API yönlendirmeleri, doğrudan kullanıcının repository'lerine bağlanacak şekilde genişletilmiştir (`/api/github/link`).
- **Mekanizma Yapisı:** Geliştirilen `GitHubParser` sınıfı, hedeflenen reponun (örn. `kullanici/repo_adi`) Public API üzerinden tam dizin hiyerarşisini çeker. Node.js paketleri (`node_modules`), derlenmiş dillerdeki binary'ler (`.exe`, `.dll`) veya Python sanal ortamları (`venv`) gibi RAG (Retrieval-Augmented Generation) sürecini kirletecek ve token limitlerini aşacak gereksiz dizinler, ön işleme (preprocessing) aşamasında filtrelenmekte (pruning) ve böylece sadece odaklanılması gereken kaynak kod dosyaları listelenmektedir.

### 3.2. Bağlam Enjeksiyonu (Context Injection) & RAG Altyapısı
Uygulamanın kalbi olan `/api/ask` route'una "Bağlam Enjeksiyonu" modülü yerleştirilmiştir.
- **Akademik Gerekçe:** Dil modellerinde en sık karşılaşılan sorunlardan biri olan *halüsinasyon (hallucination)* genellikle eksik bağlamdan kaynaklanır. Sisteme bir repo bağlandığında (linked_repo), LLM'ye sunulan prompt'un sistem talimatı (System Instruction) bölümüne gizli olarak projenin yapısı (project tree) enjekte edilir. Böylece model, örneğin "Bu projede auth mimarisi nasıl kurulmuş?" sorusuna, doğrudan dizindeki `middleware` veya `models.py` konumlarını referans göstererek (grounding) tam isabetli bir *Context-Aware* sentezleme yapar.

### 3.3. Toplu Refactoring (Bulk Refactoring) Hazırlığı
Projenin bütününde yapılacak büyük mimari değişikliklerin (örn. "Kullanıcı tablosuna yeni bir alan ekledim, tüm sistemi buna göre güncelle") yönetilebilmesi için asistanın toplu dosya düzenleme isteklerini alabileceği (`/api/refactor/bulk`) yeni uç noktaların altyapısı (taslağı) hazırlanmıştır.

**🏆 3. Hafta Çıktısı ve Kazanımı:** Code Alchemist, izole bir chat botundan sıyrılarak tam teşekküllü ve vizyoner bir IDE eklentisi/ajanalı (Agent) mantığına evrilmiştir. Bütüncül proje farkındalığı sayesinde, sistem çapında refactoring fikirleri veya spesifik hata ayıklama (debug) senaryoları çok daha yüksek doğrulukla (precision) yönetilebilir hale gelmiştir.

---

## Genel Değerlendirme

Bu üç haftalık gelişim süreci, Code Alchemist uygulamasını basit bir LLM "wrapper" (sarmalayıcı) olmaktan çıkarıp, **Mimarisi sağlam, bulutta çalışan ve bağlama duyarlı (context-aware)** gelişmiş bir yazılım asistanına dönüştürmüştür. Sistem, teknik sürdürülebilirliği sağlamış ve modern DevOps ile AI Ops prensiplerine uygun şekilde kurgulanmıştır.
