# Code Alchemist - Yeni Özellikler Dokümantasyonu

Bu belge, Code Alchemist projesine eklenen dört temel özelliğin mimarisini, kullanılan teknolojileri ve implementasyon yöntemlerini detaylandırmaktadır.

## 1. Etkileşimli Mimari Grafiği (Interactive Architecture Graph)
**Amaç**: GitHub deposunun hiyerarşik yapısını görselleştirerek, düğümlere (dosyalara) tıklandığında kod içeriğinin etkileşimli bir panalde gösterilmesi.

- **Kullanılan Teknolojiler (Frontend)**: `React`, `react-force-graph-2d` (Fizik tabanlı render motoru), `react-syntax-highlighter` (Kod renklendirme).
- **Kullanılan Teknolojiler (Backend)**: `Flask`, GitHub REST API, `GitHubParser` sınıfı.
- **Yöntem ve Akış**:
  1. Frontend, `/api/github/tree` rotasına istek atar. Backend, GitHub üzerinden depo ağacını hiyerarşik bir formata dönüştürerek döndürür.
  2. `ForceGraph2D` kütüphanesi ile `root`, `dir` (dizin) ve `file` (dosya) tipleri düğüm (node) olarak oluşturulur; veri yolları ise bağlantılar (link) haline getirilir.
  3. Kullanıcı bir dosyaya (`file` düğümü) tıkladığında, `GitHubGraph.jsx` içerisinde tanımlı `onNodeClick` tetiklenir ve `/api/github/file` rotasına istek gönderilir.
  4. Backend'deki `GitHubParser`, GitHub üzerinden dosyanın ham içeriğini çeker ve döndürür. Yanıt, frontend'de bir yan panelde sözdizimi vurgulamasıyla gösterilir.

## 2. Yapay Zeka ile Güvenlik Denetimi (AI Pre-flight & Security Audit)
**Amaç**: Pull Request açılmadan önce kod değişikliklerinin sızdırılmış token, SQL enjeksiyonu ve darboğazlar açısından yapay zeka tarafından incelenmesi.

- **Kullanılan Teknolojiler**: `Python` (Flask), `Google Gemini API` (`genai.GenerativeModel`), `React` ve `JSON`.
- **Yöntem ve Akış**:
  1. Frontend (`ChatInterface.jsx`), "Create Pull Request" isteği atılmadan önce araya girer ve değiştirilen dosyaların içeriği ile yollarını `/api/github/audit_pr` uç noktasına gönderir.
  2. Backend, yapay zekayı bir "Kıdemli Siber Güvenlik ve Performans Denetçisi" olarak davranmaya zorlayan katı bir istem (prompt) hazırlar. Modelin yanıtı sadece `passed` (boolean) ve `issues` (dizi) içeren bir JSON olmak zorundadır.
  3. Döndürülen JSON pars edilir (`json.loads()`).
  4. Eğer zafiyetler (`issues`) bulunursa, frontend "Running AI Security Audit..." süreci sonrası kullanıcıya bir tarayıcı diyaloğu veya paneli ile uyarıları gösterilir. Kullanıcı, isterse iptal eder veya *"Proceed Anyway"* diyerek riski kabul edebilir. Ancak risk kabul edilirse `/api/github/pr` uç noktasına ikinci bir istek giderek Pull Request Github'da oluşturulur.

## 3. Otomatik Birim Testi Üretici (Unit Test Generator)
**Amaç**: Sohbet içindeki kod bloklarına tıklanıldığında, o kod için Jest, Pytest, Vitest ve JUnit 5 gibi framework'leri kullanarak tek tıkla test kodu üretilmesi.

- **Kullanılan Teknolojiler**: `Python`, `Google Gemini API`, `React Markdown`, Özel Markdown Bileşenleri.
- **Yöntem ve Akış**:
  1. Frontend (markdown render bileşeni), kod bloklarının üzerine "🧪 Generate Tests" (Test Üret) butonu yerleştirir. Butona tıklandığında ilgili kod ve dil bilgisi `/api/generate_tests` backend rotasına gönderilir.
  2. Backend, gelen dile dinamik olarak test framework'ü eşleştirir (örneğin Python için Pytest, JS/TS için Jest veya Vitest istenir). "Yalnızca çalışan ve temiz bir deneme kodu oluştur, herhangi bir açıklama yapma" standart promptu eklenir.
  3. Döndürülen JSON yanıtındaki `tests` alanı frontend'e iletilir ve mevcut sohbetin girdi kutucuğuna (input textarea) Markdown blogu olarak eklenir.

## 4. PDF Doküman Desteği (PDF Document Support)
**Amaç**: Görsel (image) veya düz metin dokümanlarına ek olarak PDF formatındaki belgelerin analizine imkan tanımak.

- **Kullanılan Teknolojiler**: `pypdf` kütüphanesi, `Python (Flask)`, Standart Dosya Girdileri (HTML `<input type="file">`).
- **Yöntem ve Akış**:
  1. Frontend'deki sohbet arayüzünde çoklu medya destekleyen elementin `accept` özelliğine `"application/pdf"` eklendi.
  2. Kullanıcı metinle beraber bir PDF'i gönderdiğinde, Node sunucusu medya tabanlı sohbet endpointine (`/api/chat` gibi görevli rotaya) isteği yönlendirir.
  3. Backend, yüklenen dosya uzantısını `.pdf` olarak yakalar. Gemini API'nin vizyon özelliğini veya doğrudan dosya URI yöntemlerini kullanmak yerine `pypdf.PdfReader` devreye girer.
  4. Belgenin sayfaları saf metin olarak çıkartılıp, kullanıcının mevcut "prompt"una (en fazla 10.000 karaktere kadar) "--- Uploaded PDF: {filename} ---" bloğu içerisinde gömülür.
  5. **Not:** Ham metin formuna veri dökerek yapay zekaya (ChatGPT, Claude, Gemini vs.) sorguda göndermek, AI sağlayıcısından bağımsız her model tarafından pdf'in desteklenmesini garanti etmektedir.
