\documentclass[11pt,a4paper]{article}

\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[margin=2.5cm]{geometry}
\usepackage{xcolor}
\usepackage{titlesec}
\usepackage{titletoc}
\usepackage{tocloft}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{tabularx}
\usepackage{array}
\usepackage{multirow}
\usepackage{listings}
\usepackage{fancyhdr}
\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{hyperref}
\usepackage{mdframed}
\usepackage{enumitem}
\usepackage{float}
\usepackage{colortbl}
\usepackage{tikz}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\usetikzlibrary{shapes.geometric, arrows, positioning, fit, backgrounds, calc}

% ─── Color Palette ───────────────────────────────────────────────────
\definecolor{primary}{HTML}{1A1A2E}
\definecolor{accent}{HTML}{E94560}
\definecolor{secondary}{HTML}{16213E}
\definecolor{highlight}{HTML}{0F3460}
\definecolor{claude}{HTML}{9B59B6}
\definecolor{gemini}{HTML}{2980B9}
\definecolor{gpt}{HTML}{27AE60}
\definecolor{warning}{HTML}{F39C12}
\definecolor{codebg}{HTML}{F4F4F8}
\definecolor{codefg}{HTML}{2C3E50}
\definecolor{sectionbg}{HTML}{EEF2FF}
\definecolor{rowgray}{HTML}{F8F9FA}

% ─── Page Style ──────────────────────────────────────────────────────
\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\textcolor{accent}{\small\textbf{Code Alchemist}} \textcolor{primary}{\small— VSCode Extension Migration}}
\fancyhead[R]{\textcolor{primary}{\small\thepage}}
\fancyfoot[C]{\textcolor{gray}{\tiny Teknik Yol Haritası \& Maliyet Analizi --- 2025}}
\renewcommand{\headrulewidth}{0.5pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{accent}\leaders\hrule height \headrulewidth\hfill}}

% ─── Section Formatting ──────────────────────────────────────────────
\titleformat{\section}
  {\large\bfseries\color{primary}}
  {}
  {0pt}
  {\llap{\textcolor{accent}{\rule[-2pt]{4pt}{\baselineskip}\hspace{6pt}}}\thesection\enspace #1}
  [\vspace{2pt}\textcolor{accent}{\rule{\linewidth}{1.5pt}}\vspace{-4pt}]

\titlespacing{\section}{0pt}{16pt}{8pt}

\titleformat{\subsection}
  {\color{highlight}\normalsize\bfseries}
  {\thesubsection}
  {0.5em}
  {#1}
  [\vspace{-2pt}\textcolor{highlight}{\rule{0.4\linewidth}{0.5pt}}]

\titlespacing{\subsection}{0pt}{10pt}{4pt}

\titleformat{\subsubsection}
  {\color{secondary}\small\bfseries}
  {\thesubsubsection}
  {0.5em}
  {#1}

\titlespacing{\subsubsection}{0pt}{8pt}{2pt}

% ─── Listings (Code) ─────────────────────────────────────────────────
\lstset{
  backgroundcolor=\color{codebg},
  basicstyle=\ttfamily\footnotesize\color{codefg},
  keywordstyle=\color{accent}\bfseries,
  commentstyle=\color{gray}\itshape,
  stringstyle=\color{claude},
  numberstyle=\tiny\color{gray},
  numbers=left,
  stepnumber=1,
  numbersep=8pt,
  frame=single,
  framerule=0.5pt,
  rulecolor=\color{highlight!40},
  breaklines=true,
  breakatwhitespace=false,
  breakindent=0pt,
  postbreak=\mbox{\textcolor{gray}{$\hookrightarrow$}\space},
  columns=flexible,
  keepspaces=true,
  tabsize=2,
  showstringspaces=false,
  captionpos=b,
  xleftmargin=1.5em,
  framexleftmargin=1.5em,
  aboveskip=8pt,
  belowskip=4pt,
}

\lstdefinelanguage{TypeScript}{
  keywords={const, let, var, function, async, await, return, import, export, from, class, interface, type, extends, implements, new, if, else, for, while, switch, case, break, default, try, catch, finally, throw, void, string, number, boolean, Promise, Array, Object},
  morecomment=[l]{//},
  morecomment=[s]{/*}{*/},
  morestring=[b]",
  morestring=[b]',
  morestring=[b]`
}

% ─── Custom Boxes ────────────────────────────────────────────────────
\newmdenv[
  linecolor=accent,
  linewidth=2pt,
  topline=false, bottomline=false, rightline=false,
  backgroundcolor=accent!5,
  innerleftmargin=12pt,
  innerrightmargin=8pt,
  innertopmargin=8pt,
  innerbottommargin=8pt
]{infobox}

\newmdenv[
  linecolor=warning,
  linewidth=2pt,
  topline=false, bottomline=false, rightline=false,
  backgroundcolor=warning!5,
  innerleftmargin=12pt,
  innerrightmargin=8pt,
  innertopmargin=8pt,
  innerbottommargin=8pt
]{warnbox}

\newmdenv[
  linecolor=gpt,
  linewidth=2pt,
  topline=false, bottomline=false, rightline=false,
  backgroundcolor=gpt!5,
  innerleftmargin=12pt,
  innerrightmargin=8pt,
  innertopmargin=8pt,
  innerbottommargin=8pt
]{successbox}

% ─── Hyperref ────────────────────────────────────────────────────────
\hypersetup{
  colorlinks=true,
  linkcolor=highlight,
  urlcolor=accent,
  citecolor=claude
}

% ─── Global Spacing & Overflow Fix ───────────────────────────────────
\setlength{\emergencystretch}{3em}
\tolerance=1500
\hbadness=1500
\sloppy

% ─── TOC ─────────────────────────────────────────────────────────────
\renewcommand{\cftsecfont}{\bfseries\color{primary}}
\renewcommand{\cftsubsecfont}{\color{secondary}}
\renewcommand{\cftsecpagefont}{\bfseries\color{accent}}
\setlength{\cftsecindent}{0pt}
\setlength{\cftsubsecindent}{1.5em}

%% ═══════════════════════════════════════════════════════════════════════
\begin{document}

% ─── TITLE PAGE ──────────────────────────────────────────────────────
\begin{titlepage}
  \pagecolor{primary}
  \color{white}
  \vspace*{2cm}
  \begin{center}
    {\Huge\bfseries Code Alchemist}\\[0.4cm]
    {\Large\color{accent} VSCode Extension Migration}\\[0.2cm]
    {\large\color{white!70} Teknik Yol Haritası \& Maliyet Analizi}\\[3cm]

    \begin{tikzpicture}
      \node[circle, fill=claude!80, minimum size=2cm, text=white, font=\bfseries] (C) at (-3,0) {Claude};
      \node[circle, fill=gemini!80, minimum size=2cm, text=white, font=\bfseries] (G) at (3,0)  {Gemini};
      \node[circle, fill=gpt!80,    minimum size=2cm, text=white, font=\bfseries] (P) at (0,-3) {GPT-4o};
      \node[rectangle, fill=accent!90, minimum width=2.2cm, minimum height=0.9cm,
            text=white, font=\bfseries, rounded corners=4pt] (R) at (0,-1.2) {Router};
      \draw[->, thick, white!60] (C) -- (R);
      \draw[->, thick, white!60] (G) -- (R);
      \draw[->, thick, white!60] (P) -- (R);
    \end{tikzpicture}

    \vspace{2cm}
    {\large Multi-LLM Orchestration \& VSCode API Entegrasyonu}\\[1cm]

    \begin{tabular}{rl}
      \textcolor{accent}{\textbf{Versiyon:}}   & 2.0 \\[4pt]
      \textcolor{accent}{\textbf{Tarih:}}      & 5 Mart 2026 \\[4pt]
      \textcolor{accent}{\textbf{Platform:}}   & VSCode Extension API \\[4pt]
      \textcolor{accent}{\textbf{Backend:}}    & Hibrit (Python + TypeScript) \\
    \end{tabular}
  \end{center}
  \vfill
  \begin{center}
    \textcolor{white!40}{\small Gizli \& Teknik Belge --- Dahili Kullanim}
  \end{center}
\end{titlepage}
\pagecolor{white}
\color{black}

% ─── TABLE OF CONTENTS ───────────────────────────────────────────────
\newpage
\tableofcontents
\newpage

%% ══════════════════════════════════════════════════════════
\section{Yönetici Özeti}

\begin{infobox}
\textbf{Proje Hedefi:} Code Alchemist'i (Flask + React) VSCode eklentisine dönüstürmek; Claude, Gemini ve GPT modellerini ayni anda çalistirip her birinin önerilerini editörde farkli renklerde isaretlemek ve hibrit bir mimari üzerinde sürdürülebilir maliyet yönetimi saglamak.
\end{infobox}

\vspace{0.5cm}

Mevcut proje üç katmandan oluşmaktadır: Python/Flask REST API, React SPA arayüzü ve \texttt{ModelRouter} sınıfı. VSCode eklentisine geçiş bu üç katmanın rolünü yeniden tanımlar ancak \textbf{tamamen yeniden yazmaz}. Temel strateji şöyledir:

\begin{itemize}[leftmargin=2em]
  \item Python backend \textbf{korunur} — sadece daha hafif, local-çalışabilir bir FastAPI servisine evrilir.
  \item React arayüzü \textbf{VSCode Webview API} ile sarmalanır; state yönetimi \texttt{vscode.postMessage} üzerinden köprülenir.
  \item Multi-LLM işaretlemeleri için VSCode \texttt{Decoration API} + \texttt{CodeLens} kullanilir.
  \item LLM çağrıları \textbf{Promise.allSettled} ile paralel, SSE/streaming ile canlı güncellenir.
\end{itemize}

%% ══════════════════════════════════════════════════════════
\section{Mevcut Mimari Analizi}

\subsection{Güçlü Yanlar (Korunacaklar)}

\begin{successbox}
\begin{itemize}[noitemsep, leftmargin=1.5em]
  \item \textbf{detect\_intent / ModelRouter:} Görev tipine göre (mimari, debug, açıklama) model seçimi — bu mantık TypeScript'e port edilebilir veya Python'da tutulabilir.
  \item \textbf{SQLAlchemy modelleri:} Geçmiş analizlerin cache'lenmesi için değerli.
  \item \textbf{JWT auth:} API anahtarlarını güvenle saklamak için adaptasyon mümkündür.
  \item \textbf{React bilesenler:} Webview'e büyük ölçüde taşınıyor.
\end{itemize}
\end{successbox}

\subsection{Dönüşüm Gerektiren Alanlar}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.4}
\begin{tabularx}{\linewidth}{>{\bfseries}lXX}
\toprule
\rowcolor{primary!10}
Bileşen & Mevcut Durum & Hedef Durum \\
\midrule
Flask routes & HTTP endpoint & FastAPI + sidecar process \\
React Router & Browser URL & Webview single-view state machine \\
localStorage & Browser storage & vscode.Memento / SecretStorage \\
Fetch/Axios & Doğrudan API & Extension host proxy \\
CSS Modules & Browser CSS & CSP-uyumlu inline / Tailwind CDN \\
WebSocket & Socket.io & vscode postMessage + SSE \\
\bottomrule
\end{tabularx}
\caption{Bileşen Dönüşüm Matrisi}
\end{table}

%% ══════════════════════════════════════════════════════════
\section{Hibrit Mimari: Python vs. TypeScript Kararı}

Bu, projenin en kritik mimari kararıdır. İki seçeneği titizlikle karşılaştıralım.

\subsection{Seçenek A: Tam TypeScript (Monolitik Eklenti)}

\begin{lstlisting}[language=TypeScript, caption={Tam TypeScript ModelRouter örneği}]
// extension/src/router/ModelRouter.ts
export class ModelRouter {
  async detectIntent(code: string): Promise<TaskType> {
    // Basit heuristik — Python'daki ML modelini kaybederiz
    if (/class |interface |abstract/.test(code)) return 'architecture';
    if (/error|exception|catch|throw/.test(code)) return 'debugging';
    return 'explanation';
  }

  async route(task: AnalysisTask): Promise<ModelConfig[]> {
    const intent = await this.detectIntent(task.code);
    return MODEL_MATRIX[intent]; // statik tablo
  }
}
\end{lstlisting}

\begin{warnbox}
\textbf{Dezavantajlar:} Python'daki ML tabanlı \texttt{detect\_intent} heuristiklerini kaybedersiniz. NumPy/sklearn bağımlılıkları TypeScript'e taşınamaz. SQLAlchemy cache katmanını yeniden yazmanız gerekir.
\end{warnbox}

\subsection{Seçenek B: Hibrit (Önerilen)}

\begin{lstlisting}[language=TypeScript, caption={Hibrit mimari — Python sidecar başlatma}]
// extension/src/backend/SidecarManager.ts
import { ChildProcess, spawn } from 'child_process';
import * as vscode from 'vscode';

export class SidecarManager {
  private proc: ChildProcess | null = null;
  private port: number = 8765;

  async start(): Promise<void> {
    const pythonPath = await this.resolvePython();
    const serverScript = path.join(__dirname, '..', 'backend', 'server.py');

    this.proc = spawn(pythonPath, [serverScript, '--port', String(this.port)], {
      env: { ...process.env, FLASK_ENV: 'production' }
    });

    this.proc.stdout?.on('data', (d) => {
      if (d.toString().includes('Running on')) {
        vscode.window.showInformationMessage('Code Alchemist backend hazır!');
      }
    });

    // Graceful shutdown
    vscode.workspace.onDidCloseTextDocument(() => this.stop());
  }

  async stop(): Promise<void> {
    this.proc?.kill('SIGTERM');
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}
\end{lstlisting}

\subsection{Kritik Tuzak: Python Sidecar Dağıtımı (Distribution)}

\begin{warnbox}
\textbf{Gerçek Dünya Problemi:} Yukarıdaki \texttt{SidecarManager} kodu geliştirme ortamında mükemmel çalışır. Ancak yüzlerce farklı kullanıcı makinesinde en çok \textit{issue} açacak yer tam olarak burasıdır.
\begin{itemize}[noitemsep, leftmargin=1.5em]
  \item Kullanıcının makinesinde Python hiç yüklü olmayabilir
  \item Yüklüyse sürümü uyumsuz olabilir (3.8 vs 3.11)
  \item \texttt{requirements.txt} paketlerini global ortama yüklemek tehlikelidir
  \item Kurumsal makinelerde \texttt{pip install} yasak olabilir
\end{itemize}
\end{warnbox}

İki gerçekçi çözüm yolu mevcuttur:

\subsubsection{Yol A: PyInstaller ile Standalone Binary (Önerilen)}

CI/CD pipeline'ında (GitHub Actions) Python kodu platforma özgü tek bir çalıştırılabilir dosyaya derlenir. Kullanıcının makinesinde Python kurulu olmasına gerek kalmaz.

\begin{lstlisting}[language=bash, caption={GitHub Actions — Çapraz Platform Binary Derleme}, numbers=none]
# .github/workflows/build-sidecar.yml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install pyinstaller -r backend/requirements.txt
      - run: |
          pyinstaller backend/server.py \
            --onefile \
            --name alchemist-sidecar \
            --distpath extension/bin/${{ runner.os }}
      # Sonuc: extension/bin/Linux/alchemist-sidecar
      #         extension/bin/Windows/alchemist-sidecar.exe
      #         extension/bin/macOS/alchemist-sidecar
\end{lstlisting}

\begin{lstlisting}[language=TypeScript, caption={SidecarManager — Binary'i Platform'a Göre Seç}]
// extension/src/backend/SidecarManager.ts (düzeltilmiş)
export class SidecarManager {
  private resolveBinaryPath(): string {
    const platform = process.platform; // 'linux' | 'win32' | 'darwin'
    const binaryName = platform === 'win32'
      ? 'alchemist-sidecar.exe'
      : 'alchemist-sidecar';

    const binaryPath = path.join(
      __dirname, '..', 'bin', platform, binaryName
    );

    if (!fs.existsSync(binaryPath)) {
      throw new Error(
        `Sidecar binary bulunamadı: ${binaryPath}. ` +
        `Lütfen eklentiyi yeniden yükleyin.`
      );
    }

    // macOS / Linux'ta çalıştırma izni ver
    if (platform !== 'win32') {
      fs.chmodSync(binaryPath, '755');
    }

    return binaryPath;
  }

  async start(): Promise<void> {
    // python.exe aramanın yerini binary çağrısı aldı
    const binaryPath = this.resolveBinaryPath();
    this.proc = spawn(binaryPath, ['--port', String(this.port)]);
    // Geri kalan kod aynı kalır...
  }
}
\end{lstlisting}

\subsubsection{Yol B: Otomatik Virtualenv Bootstrap (Alternatif)}

Binary derleme yapılamıyorsa, eklenti ilk çalışmada arka planda yalıtılmış bir sanal ortam kurar.

\begin{lstlisting}[language=TypeScript, caption={İlk Kurulumda Virtualenv Oluşturma}]
// extension/src/backend/PythonBootstrapper.ts
export class PythonBootstrapper {
  private venvPath: string;

  constructor(context: vscode.ExtensionContext) {
    // Eklentiye özgü, kullanıcı ortamını kirletmeyen yalıtılmış dizin
    this.venvPath = path.join(context.globalStorageUri.fsPath, 'venv');
  }

  async ensureEnvironment(): Promise<string> {
    if (await this.venvExists()) {
      return this.getPythonBin();
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Code Alchemist: Python ortamı kuruluyor...',
      cancellable: false
    }, async (progress) => {
      // 1) Sisteme kurulu Python'u bul (en az 3.10)
      const sysPython = await this.findSystemPython();

      // 2) İzole venv oluştur
      progress.report({ message: 'Sanal ortam oluşturuluyor...' });
      await exec(`${sysPython} -m venv "${this.venvPath}"`);

      // 3) Bağımlılıkları yükle
      progress.report({ message: 'Paketler yükleniyor (1-2 dk)...' });
      const reqPath = path.join(__dirname, '..', 'backend', 'requirements.txt');
      await exec(`"${this.getPipBin()}" install -r "${reqPath}" --quiet`);
    });

    return this.getPythonBin();
  }

  private getPythonBin(): string {
    return process.platform === 'win32'
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python');
  }
}
\end{lstlisting}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{lXXr}
\toprule
\rowcolor{primary!10}
\textbf{Yöntem} & \textbf{Avantaj} & \textbf{Dezavantaj} & \textbf{VSIX Boyutu} \\
\midrule
\rowcolor{rowgray}
PyInstaller Binary & Python gerekmez, hızlı başlangıç & 3 platform $\times$ CI build & +15–40 MB \\
Virtualenv Bootstrap & Küçük paket boyutu & İlk kurulum 1–2 dk bekler & +0.5 MB \\
\rowcolor{rowgray}
Saf Python (mevcut) & Kolay geliştirme & Prod'da kırılgan & +0 MB \\
\bottomrule
\end{tabularx}
\caption{Sidecar Dağıtım Yöntemi Karşılaştırması}
\end{table}

\begin{infobox}
\textbf{Öneri:} PyInstaller (Yol A) üretim için en sağlamdır. Faz 1'e \textit{``Python Environment Bootstrapping / Bundling''} adımı eklenmeli ve GitHub Actions pipeline'ı baştan kurulmalıdır.
\end{infobox}

\subsection{Karşılaştırma Tablosu}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{lXXX}
\toprule
\rowcolor{primary!10}
\textbf{Kriter} & \textbf{Tam TypeScript} & \textbf{Hibrit (Önerilen)} & \textbf{Ağırlık} \\
\midrule
Kurulum kolaylığı & \textcolor{gpt}{+++} & \textcolor{warning}{++} & Orta \\
detect\_intent kalitesi & \textcolor{accent}{+} & \textcolor{gpt}{+++} & Yüksek \\
Bellek kullanımı & \textcolor{gpt}{+++} & \textcolor{warning}{++} & Düşük \\
API güvenliği & \textcolor{warning}{++} & \textcolor{gpt}{+++} & Yüksek \\
SQLite cache & \textcolor{accent}{+} & \textcolor{gpt}{+++} & Orta \\
Geliştirme hızı & \textcolor{warning}{++} & \textcolor{gpt}{+++} & Yüksek \\
Uzun vadeli bakım & \textcolor{gpt}{+++} & \textcolor{gpt}{+++} & Yüksek \\
\midrule
\textbf{Toplam skoru} & \textbf{15/21} & \textbf{19/21} & \\
\bottomrule
\end{tabularx}
\caption{Mimari Seçenek Karşılaştırması}
\end{table}

\begin{successbox}
\textbf{Karar: Hibrit Mimari.} Python sidecar process olarak çalışır (\texttt{localhost:8765}). TypeScript extension, VSCode API + Webview yönetimini üstlenir. API anahtarları \texttt{vscode.SecretStorage}'da şifreli tutulur.
\end{successbox}

%% ══════════════════════════════════════════════════════════
\section{Multi-LLM Decoration Sistemi}

\subsection{Mimari Genel Bakış}

\begin{center}
\begin{tikzpicture}[
  box/.style={
    rectangle, rounded corners=4pt,
    minimum width=2.6cm, minimum height=0.75cm,
    align=center, font=\small, inner sep=4pt
  },
  arrow/.style={->, thick, >=stealth},
  label/.style={font=\tiny, midway}
]
  %% ── Satır 1: Ana akış ──────────────────────────────
  \node[box, fill=primary!15]  (editor)       at (0, 0)    {VSCode\\Editor};
  \node[box, fill=accent!20]   (analyzer)     at (4.5, 0)  {CodeAnalyzer.ts};
  \node[box, fill=claude!20]   (orchestrator) at (9, 0)    {Orchestrator};

  %% ── Satır 2: Modeller (3cm aralık → çakışmaz) ────
  \node[box, fill=claude!50, text=white] (claude) at (4,   -2.5) {Claude 3.5};
  \node[box, fill=gemini!50, text=white] (gemini) at (7.8, -2.5) {Gemini 2.0};
  \node[box, fill=gpt!50,    text=white] (gpt)    at (11.6,-2.5) {GPT-4o};

  %% ── Satır 3: Çıktı katmanı ──────────────────────
  \node[box, fill=primary!20]   (dec)  at (3,   -5)   {Decoration\\Manager};
  \node[box, fill=highlight!20] (lens) at (9,   -5)   {CodeLens\\Provider};

  %% ── Oklar ────────────────────────────────────────
  \draw[arrow] (editor)       -- node[above, label]{seçili kod} (analyzer);
  \draw[arrow] (analyzer)     --                               (orchestrator);

  \draw[arrow] (orchestrator) -- (claude);
  \draw[arrow] (orchestrator) -- (gemini);
  \draw[arrow] (orchestrator) -- (gpt);

  \draw[arrow] (claude) -- (dec);
  \draw[arrow] (gemini) -- (dec);
  \draw[arrow] (gpt)    -- (lens);
  \draw[arrow] (gemini) -- (lens);

  \draw[arrow, color=accent]   (dec)  to[out=180, in=270]
        node[left, label, color=accent]{renkli işaret} (editor);
  \draw[arrow, color=highlight](lens) to[out=120, in=0]
        node[above, label, color=highlight]{CodeLens} (editor);

\end{tikzpicture}
\end{center}

\subsection{DecorationManager Implementasyonu}

\begin{lstlisting}[language=TypeScript, caption={Multi-LLM Decoration Yöneticisi}]
// extension/src/decorations/DecorationManager.ts
import * as vscode from 'vscode';

export const DECORATION_TYPES = {
  claude: vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(155, 89, 182, 0.12)',
    borderLeft: '3px solid #9B59B6',
    overviewRulerColor: '#9B59B6',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: {
      contentText: ' ⚗ Claude',
      color: '#9B59B6',
      fontStyle: 'italic',
      fontSize: '11px',
      margin: '0 0 0 8px'
    }
  }),

  gemini: vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(41, 128, 185, 0.10)',
    borderLeft: '3px solid #2980B9',
    overviewRulerColor: '#2980B9',
    overviewRulerLane: vscode.OverviewRulerLane.Center,
    after: {
      contentText: ' ◆ Gemini',
      color: '#2980B9',
      fontStyle: 'italic',
      fontSize: '11px',
      margin: '0 0 0 8px'
    }
  }),

  gpt: vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(39, 174, 96, 0.09)',
    borderLeft: '3px solid #27AE60',
    overviewRulerColor: '#27AE60',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
    after: {
      contentText: ' ★ GPT-4o',
      color: '#27AE60',
      fontStyle: 'italic',
      fontSize: '11px',
      margin: '0 0 0 8px'
    }
  })
};

export class DecorationManager {
  private activeDecorations = new Map<string, vscode.DecorationOptions[]>();

  applyDecoration(
    editor: vscode.TextEditor,
    model: 'claude' | 'gemini' | 'gpt',
    range: vscode.Range,
    hoverMessage: string
  ): void {
    const decorationType = DECORATION_TYPES[model];
    const options: vscode.DecorationOptions = {
      range,
      hoverMessage: new vscode.MarkdownString(
        `**${model.toUpperCase()} Önerisi**\n\n${hoverMessage}`
      )
    };

    const key = `${model}:${editor.document.uri}`;
    const existing = this.activeDecorations.get(key) ?? [];
    existing.push(options);
    this.activeDecorations.set(key, existing);

    // Streaming: her öneri geldiğinde HEMEN uygula
    editor.setDecorations(decorationType, existing);
  }

  clearAll(editor: vscode.TextEditor): void {
    Object.entries(DECORATION_TYPES).forEach(([, type]) => {
      editor.setDecorations(type, []);
    });
    this.activeDecorations.clear();
  }
}
\end{lstlisting}

\subsection{CodeLens Sağlayıcısı — Performans Kritik Tasarım}

\begin{warnbox}
\textbf{Performans Tuzağı:} CodeLens \texttt{provideCodeLenses()} metodu her tuş vuruşunda tetiklenebilir. Eğer bu çağrı asenkron LLM istekleri başlatıyorsa editör donuklaşır, gereksiz API maliyeti oluşur.
\end{warnbox}

\textbf{Doğru strateji:} \texttt{provideCodeLenses()} yalnızca önceden hesaplanmış sonuçları döndürür. Asenkron LLM çağrıları ise yalnızca \textit{dosya kaydetme} veya \textit{kod seçimi} olaylarında başlatılır.

\begin{lstlisting}[language=TypeScript, caption={CodeLens Provider — Trigger-Bazlı Güvenli Tasarım}]
// extension/src/codelens/AlchemistCodeLensProvider.ts
export class AlchemistCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  // Önceden hesaplanmış sonuçları tutar — provideCodeLenses SYNC çalışır
  private pendingResults = new Map<string, LLMResult[]>();

  // ASENKRON LLM çağrısı yok — sadece cache'deki veriyi döndürür
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const results = this.pendingResults.get(document.uri.toString()) ?? [];
    return results.map((result) =>
      new vscode.CodeLens(result.range, {
        title: `$(sparkle) ${result.model}: ${result.summary}`,
        command: 'codeAlchemist.showSuggestion',
        arguments: [result]
      })
    );
  }

  // Sonuçlar gelince event'i tetikle — provideCodeLenses tekrar çağrılır
  updateResults(uri: string, results: LLMResult[]): void {
    this.pendingResults.set(uri, results);
    this._onDidChangeCodeLenses.fire();
  }
}

// extension.ts — Tetikleyicileri kaydet
export function activate(context: vscode.ExtensionContext) {
  const codeLensProvider = new AlchemistCodeLensProvider();
  let debounceTimer: NodeJS.Timeout;

  // TETIKLEYICI 1: Dosya kaydedildiğinde (en güvenli)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      await orchestrator.analyzeDocument(doc, codeLensProvider);
    })
  );

  // TETIKLEYICI 2: Seçim değiştiğinde — debounce ile (500ms)
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.selections[0].isEmpty) return; // Seçim yoksa çalışma
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await orchestrator.analyzeSelection(
          event.textEditor,
          event.selections[0],
          codeLensProvider
        );
      }, 500); // 500ms bekle — kullanıcı hâlâ yazıyorsa iptal et
    })
  );

  // TETİKLEYİCİ YOK: onDidChangeTextDocument — her tuşta çalışır, KULLANMA
}
\end{lstlisting}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{lXlr}
\toprule
\rowcolor{primary!10}
\textbf{Tetikleyici} & \textbf{Ne Zaman Çalışır} & \textbf{Güvenli mi?} & \textbf{Gecikme} \\
\midrule
\rowcolor{rowgray}
\texttt{onDidSaveTextDocument} & Ctrl+S basıldığında & \textcolor{gpt}{\textbf{Evet}} & 0ms \\
\texttt{onDidChangeSelection} + debounce & Seçim değişince,\newline 500ms sonra & \textcolor{gpt}{\textbf{Evet}} & 500ms \\
\rowcolor{rowgray}
\texttt{onDidChangeTextDocument} & Her tuş vuruşunda & \textcolor{accent}{\textbf{HAYIR}} & — \\
Zamanlayıcı (5s interval) & Periyodik & \textcolor{warning}{\textbf{Dikkatli}} & 5000ms \\
\bottomrule
\end{tabularx}
\caption{CodeLens Tetikleyici Güvenlik Karşılaştırması}
\end{table}

%% ══════════════════════════════════════════════════════════
\section{Asenkron Orchestration Katmanı}

\subsection{Paralel LLM Çağrıları ve Streaming}

\begin{lstlisting}[language=TypeScript, caption={Orchestrator — Promise.allSettled + SSE Streaming}]
// extension/src/orchestrator/LLMOrchestrator.ts
export class LLMOrchestrator {
  constructor(
    private readonly sidecar: SidecarManager,
    private readonly decorations: DecorationManager,
    private readonly codeLens: AlchemistCodeLensProvider,
    private readonly router: ModelRouter
  ) {}

  async analyzeSelection(
    editor: vscode.TextEditor,
    selection: vscode.Selection
  ): Promise<void> {
    const code = editor.document.getText(selection);
    const models = await this.router.route({ code, selection });

    // UI: hemen ``analiz ediliyor'' göster
    this.showProgressDecoration(editor, selection);

    // PARALEL çağrı — bir model yavaşsa diğerleri beklemez
    const promises = models.map((model) =>
      this.streamFromModel(model, code, editor, selection)
    );

    const results = await Promise.allSettled(promises);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        vscode.window.showWarningMessage(
          `${models[i].name} yanıt vermedi: ${r.reason}`
        );
      }
    });
  }

  private async streamFromModel(
    model: ModelConfig,
    code: string,
    editor: vscode.TextEditor,
    selection: vscode.Selection
  ): Promise<void> {
    const url = `${this.sidecar.getBaseUrl()}/analyze/stream`;

    // Server-Sent Events stream
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, model: model.id })
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulated += chunk;

      // Streaming sırasında her chunk'ta decoration güncelle
      const partialSummary = this.extractSummary(accumulated);
      this.decorations.applyDecoration(
        editor,
        model.decorationKey, // 'claude' | 'gemini' | 'gpt'
        selection,
        partialSummary + (done ? '' : ' ...')
      );
    }

    // Final CodeLens güncelle
    this.codeLens.updateResults(editor.document.uri.toString(), [{
      model: model.name,
      range: selection,
      summary: this.extractSummary(accumulated),
      fullContent: accumulated
    }]);
  }
}
\end{lstlisting}

\subsection{Python Backend Streaming Endpoint}

\begin{lstlisting}[language=Python, caption={FastAPI SSE Streaming Endpoint}]
# backend/server.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio, json

app = FastAPI()

@app.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    """SSE stream — her token geldiğinde gönder"""

    async def event_generator():
        model_client = model_factory(request.model)
        async for chunk in model_client.stream(request.code):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            await asyncio.sleep(0)  # event loop'a nefes ver
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
\end{lstlisting}

%% ══════════════════════════════════════════════════════════
\section{React Webview Adaptasyonu}

\subsection{API Seçimi: WebviewPanel mı, WebviewView mı?}

\begin{warnbox}
\textbf{Önemli Düzeltme:} Planda \texttt{WebviewPanel} kullanıldı. Bu API editörde \textit{sekme} (tab) olarak açılan bir panel oluşturur — GitHub Copilot veya ChatGPT eklentisi gibi \textbf{Activity Bar'da sabit duran} bir panel değil. Hedef ``sidebar'' ise doğru API \texttt{WebviewView}'dür.
\end{warnbox}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabularx}{\linewidth}{lXX}
\toprule
\rowcolor{primary!10}
\textbf{API} & \textbf{Davranış} & \textbf{Ne Zaman Kullanılır} \\
\midrule
\rowcolor{rowgray}
\texttt{WebviewPanel} & Editör sekmesi olarak açılır, kapatılabilir & Tam ekran analiz raporu, diff görüntüleyici \\
\texttt{WebviewView} & Activity Bar / Side Bar'da sabit durur & Copilot gibi daima görünür yardımcı panel \\
\bottomrule
\end{tabularx}
\caption{WebviewPanel vs WebviewView Karşılaştırması}
\end{table}

\begin{lstlisting}[language=TypeScript, caption={WebviewView ile Activity Bar Sidebar Kaydı}]
// extension/src/webview/AlchemistViewProvider.ts
export class AlchemistViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeAlchemist.sidebarView';

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.getHtmlContent(webviewView.webview);
  }
}

// extension.ts — activate() içinde kaydet
const provider = new AlchemistViewProvider(context.extensionUri);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    AlchemistViewProvider.viewType,
    provider
  )
);
\end{lstlisting}

\begin{lstlisting}[language=json, caption={package.json — Activity Bar katkısı}, numbers=none]
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "codeAlchemist",
        "title": "Code Alchemist",
        "icon": "$(beaker)"
      }]
    },
    "views": {
      "codeAlchemist": [{
        "type": "webview",
        "id": "codeAlchemist.sidebarView",
        "name": "Alchemist Panel"
      }]
    }
  }
}
\end{lstlisting}

\begin{infobox}
\textbf{Pratik Öneri:} İkisini birlikte kullanın. \texttt{WebviewView} (sidebar) daima açık asistan paneli için; \texttt{WebviewPanel} büyük diff/rapor görüntüleme için. Böylece hem \textit{native} deneyim hem de zengin görünüm sunulur.
\end{infobox}

\subsection{Temel Zorluklar ve Çözümler}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabularx}{\linewidth}{lXX}
\toprule
\rowcolor{primary!10}
\textbf{Zorluk} & \textbf{Neden Problem?} & \textbf{Çözüm} \\
\midrule
\rowcolor{rowgray}
CSP Kısıtlamaları & Webview, inline script + eval() yasaklıyor & nonce tabanlı CSP + webpack bundling \\
localStorage yok & Güvenlik sandboxu & \texttt{vscode.postMessage} → Memento \\
\rowcolor{rowgray}
React Router & URL tabanlı routing & \texttt{useReducer} state machine \\
WebSocket & ws:// engelli & postMessage köprüsü \\
\rowcolor{rowgray}
Hot Reload & Webview'de DevServer yok & vscode.webview.html yenileme \\
fetch() CORS & Webview origin = vscode & Sidecar proxy üzerinden \\
\bottomrule
\end{tabularx}
\caption{Webview Adaptasyon Zorlukları}
\end{table}

\subsection{State Yönetimi Köprüsü}

\begin{lstlisting}[language=TypeScript, caption={Extension ↔ Webview İletişim Köprüsü}]
// extension/src/webview/WebviewBridge.ts
export class WebviewBridge {
  constructor(private panel: vscode.WebviewPanel) {
    // Extension → Webview
    this.panel.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this));
  }

  // Extension'dan Webview'e veri gönder
  send(type: string, payload: unknown): void {
    this.panel.webview.postMessage({ type, payload });
  }

  private async handleWebviewMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ANALYZE_SELECTION':
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await orchestrator.analyzeSelection(editor, editor.selection);
        }
        break;

      case 'SAVE_API_KEY':
        await secrets.store(`alchemist.${msg.model}ApiKey`, msg.key);
        this.send('API_KEY_SAVED', { model: msg.model });
        break;

      case 'GET_ACTIVE_FILE':
        const doc = vscode.window.activeTextEditor?.document;
        this.send('ACTIVE_FILE', {
          path: doc?.fileName,
          language: doc?.languageId,
          content: doc?.getText()
        });
        break;
    }
  }
}

// React tarafı (Webview içinde)
// src/hooks/useVSCodeBridge.ts
const vscodeApi = (window as any).acquireVsCodeApi?.();

export function useVSCodeBridge() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      dispatch({ type: event.data.type, payload: event.data.payload });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const send = useCallback((type: string, payload?: unknown) => {
    vscodeApi?.postMessage({ type, payload });
  }, []);

  return { state, send };
}
\end{lstlisting}

%% ══════════════════════════════════════════════════════════
\section{Vizyoner Ek: Native Chat API Entegrasyonu}

\begin{infobox}
\textbf{İleriye Dönük Hedef:} VSCode son güncellemelerinde \textbf{Chat Participants API} özelliğini stabil hale getirdi. React Webview'inize ek olarak, kullanıcıların VSCode'un kendi yerleşik sohbet panelinde \texttt{@alchemist} ile etkileşim kurmasına olanak tanıyabilirsiniz.
\end{infobox}

\subsection{Chat Participant API Nedir?}

GitHub Copilot Chat panelinde \texttt{@workspace}, \texttt{@terminal} gibi gördüğünüz ``katılımcılar'' bu API ile üretilir. Siz de \texttt{@alchemist bu kodu refactor et} şeklinde çağrılabilen bir katılımcı kaydedebilirsiniz.

\begin{lstlisting}[language=TypeScript, caption={Chat Participant Kaydı — @alchemist}]
// extension/src/chat/AlchemistChatParticipant.ts
export function registerChatParticipant(
  context: vscode.ExtensionContext
): void {
  const participant = vscode.chat.createChatParticipant(
    'codeAlchemist.assistant',
    async (
      request: vscode.ChatRequest,
      chatContext: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ) => {
      // Kullanıcı: ``@alchemist bu fonksiyonu optimize et''
      const userQuery = request.prompt;

      // Aktif editörden kodu al
      const code = vscode.window.activeTextEditor?.document.getText(
        vscode.window.activeTextEditor.selection
      ) ?? '';

      stream.markdown('**Code Alchemist** analiz ediyor...\n\n');

      // Paralel LLM çağrıları — sonuçları chat'e stream et
      const models = await router.route({ code, query: userQuery });

      for (const model of models) {
        stream.markdown(`### ${model.name} Önerisi\n`);
        const result = await orchestrator.analyzeWithModel(model, code, token);
        stream.markdown(result);
        stream.markdown('\n\n---\n\n');
      }
    }
  );

  participant.iconPath = vscode.Uri.joinPath(
    context.extensionUri, 'media', 'alchemist-icon.png'
  );

  // Slash komutları: /debug, /refactor, /explain
  participant.followupProvider = {
    provideFollowups: () => [
      { prompt: '/debug Hataları bul', label: '$(bug) Debug' },
      { prompt: '/refactor Yeniden yapılandır', label: '$(wrench) Refactor' },
      { prompt: '/explain Açıkla', label: '$(info) Açıkla' }
    ]
  };

  context.subscriptions.push(participant);
}
\end{lstlisting}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{lXX}
\toprule
\rowcolor{primary!10}
\textbf{Özellik} & \textbf{React Webview} & \textbf{Chat Participant} \\
\midrule
\rowcolor{rowgray}
Arayüz zenginliği & \textcolor{gpt}{+++} (tam kontrol) & \textcolor{warning}{+} (markdown) \\
Native his & \textcolor{warning}{++} & \textcolor{gpt}{+++} \\
\rowcolor{rowgray}
Multi-LLM görselleştirme & \textcolor{gpt}{+++} & \textcolor{warning}{++} (metin) \\
Geliştirme maliyeti & \textcolor{warning}{++} (yüksek) & \textcolor{gpt}{+++} (düşük) \\
\rowcolor{rowgray}
Decoration entegrasyonu & \textcolor{gpt}{+++} & \textcolor{warning}{++} \\
\bottomrule
\end{tabularx}
\caption{React Webview vs Chat Participant — Karşılaştırma}
\end{table}

\begin{successbox}
\textbf{Strateji:} React Webview zengin görselleştirme (decoration'lar, diff viewer, model rozetleri) için birincil arayüz olarak kalır. Chat Participant ise hızlı sorgular ve Copilot kullanıcılarına ``native'' erişim noktası sunar. İkisi birbirini dışlamaz; birlikte kullanılınca eklentiye çok katmanlı bir deneyim kazandırır.
\end{successbox}

%% ══════════════════════════════════════════════════════════
\section{Proje Yapısı ve Dosya Organizasyonu}

\begin{lstlisting}[language=bash, caption={Önerilen Proje Dizin Yapısı}, numbers=none]
code-alchemist-vscode/
├── extension/                    # TypeScript VSCode eklentisi
│   ├── src/
│   │   ├── extension.ts          # Ana giriş noktası, activate()
│   │   ├── orchestrator/
│   │   │   ├── LLMOrchestrator.ts
│   │   │   └── ModelRouter.ts    # Python router'ın TS portu (basit)
│   │   ├── decorations/
│   │   │   └── DecorationManager.ts
│   │   ├── codelens/
│   │   │   └── AlchemistCodeLensProvider.ts
│   │   ├── webview/
│   │   │   ├── WebviewBridge.ts
│   │   │   └── WebviewPanel.ts
│   │   └── backend/
│   │       └── SidecarManager.ts
│   ├── package.json              # contributes, activationEvents
│   └── tsconfig.json
│
├── webview-ui/                   # React uygulaması (Vite bundled)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   └── useVSCodeBridge.ts
│   │   ├── components/
│   │   │   ├── SuggestionPanel.tsx
│   │   │   ├── ModelBadge.tsx    # Claude/Gemini/GPT rozetleri
│   │   │   └── DiffViewer.tsx
│   │   └── store/
│   │       └── reducer.ts
│   └── vite.config.ts
│
├── backend/                      # Python FastAPI sidecar
│   ├── server.py
│   ├── router.py                 # detect_intent (ML mantığı burada)
│   ├── models/
│   │   ├── claude_client.py
│   │   ├── gemini_client.py
│   │   └── gpt_client.py
│   ├── cache/
│   │   └── analysis_cache.py     # SQLAlchemy + SQLite
│   └── requirements.txt
│
└── scripts/
    ├── build.sh                  # ext + webview-ui birlikte build
    └── package-extension.sh      # .vsix oluşturma
\end{lstlisting}

%% ══════════════════════════════════════════════════════════
\section{API Maliyetleri ve Verimli Kullanım Planı}

\subsection{Model Fiyatlandırma Referans Tablosu (Mart 2025)}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabular}{llrrrr}
\toprule
\rowcolor{primary!15}
\textbf{Model} & \textbf{Sağlayıcı} & \textbf{Input} & \textbf{Output} & \textbf{Context} & \textbf{Güç} \\
 & & \textit{\$/1M tok} & \textit{\$/1M tok} & & \\
\midrule
\rowcolor{claude!8}
Claude 4.5 Sonnet & Anthropic & \$3.00 & \$15.00 & 200K & \textcolor{claude}{\textbf{Mimari}} \\
Claude 3 Haiku & Anthropic & \$0.25 & \$1.25 & 200K & \textcolor{gpt}{\textbf{Hızlı/Ucuz}} \\
\rowcolor{gemini!8}
Gemini 2.5 Flash & Google & \$0.10 & \$0.40 & 1M & \textcolor{gemini}{\textbf{Hız+Bütçe}} \\
Gemini 1.5 Pro & Google & \$1.25 & \$5.00 & 2M & \textcolor{gemini}{\textbf{Uzun ctx}} \\
\rowcolor{gpt!8}
GPT-4o & OpenAI & \$2.50 & \$10.00 & 128K & \textcolor{gpt}{\textbf{Genel}} \\
GPT-4o-mini & OpenAI & \$0.15 & \$0.60 & 128K & \textcolor{gpt}{\textbf{Ekonomik}} \\
\bottomrule
\end{tabular}
\caption{LLM Fiyatlandırma Tablosu (giriş verisi: 1M token başına USD)}
\end{table}

\subsection{Görev Bazlı Model Yönlendirme Stratejisi}

\begin{infobox}
\textbf{Temel Prensip:} Her göreve en ucuz ve en yetenekli modeli eşleştir. Pahalı modelleri yalnızca gerçekten gerektiren karmaşık görevler için kullan.
\end{infobox}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.7}
\begin{tabularx}{\linewidth}{lXlr}
\toprule
\rowcolor{primary!10}
\textbf{Görev Türü} & \textbf{Örnek İstek} & \textbf{Atanan Model} & \textbf{Tahmini Maliyet} \\
\midrule
\rowcolor{rowgray}
Mimari Tasarım & "Bu sınıf yapısını yeniden tasarla" & Claude 4.5 Sonnet & \$0.08–0.25 \\
Hata Ayıklama & "Bu stack trace'i analiz et" & Claude 4.5 Sonnet & \$0.05–0.15 \\
\rowcolor{rowgray}
Mantık Kontrolü & "Bu döngü doğru mu?" & Gemini 2.5 Flash & \$0.002–0.01 \\
Kod Açıklama & "Bu fonksiyon ne yapar?" & Gemini 2.5 Flash & \$0.001–0.005 \\
\rowcolor{rowgray}
Refactoring & "Daha temiz hale getir" & GPT-4o & \$0.04–0.12 \\
Basit Tamamlama & "Eksik import ekle" & GPT-4o-mini & \$0.0005–0.002 \\
\rowcolor{rowgray}
Kod İncelemesi & "PR review yap" & Gemini 1.5 Pro & \$0.03–0.20 \\
Dokümantasyon & "JSDoc ekle" & Claude 3 Haiku & \$0.002–0.008 \\
\bottomrule
\end{tabularx}
\caption{Görev-Model Eşleştirme ve Tahmini Birim Maliyetler (ortalama istek başına)}
\end{table}

\subsection{Günlük / Aylık Kullanım Senaryoları}

Üç farklı geliştirici profili için gerçekçi maliyet projeksiyonu:

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabular}{lrrrr}
\toprule
\rowcolor{primary!15}
\textbf{Profil} & \textbf{Günlük İstek} & \textbf{Ort. Token/istek} & \textbf{Aylık Maliyet} & \textbf{Yıllık} \\
\midrule
\rowcolor{rowgray}
Hafif Kullanıcı & 20 & 800 & \$2.50–5.00 & \$30–60 \\
Orta Kullanıcı & 60 & 1200 & \$12–25 & \$144–300 \\
\rowcolor{rowgray}
Yoğun Kullanıcı & 200 & 2000 & \$60–120 & \$720–1440 \\
Takım (5 kişi) & 300 (toplam) & 1500 & \$40–80 & \$480–960 \\
\bottomrule
\end{tabular}
\caption{Kullanıcı Profili Bazlı Maliyet Projeksiyonu}
\end{table}

\subsection{Maliyet Azaltma Teknikleri}

\subsubsection{1. Akıllı Önbellekleme (SQLite + Hash)}

\begin{lstlisting}[language=Python, caption={İçerik hash tabanlı önbellek}]
# backend/cache/analysis_cache.py
import hashlib, json
from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime, timedelta

class AnalysisCache(Base):
    __tablename__ = 'analysis_cache'
    code_hash   = Column(String(64), primary_key=True)
    model       = Column(String(32))
    result      = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)
    ttl_hours   = Column(Integer, default=24)  # 24 saat cache

def get_cached(code: str, model: str) -> str | None:
    code_hash = hashlib.sha256(
        f"{code.strip()}{model}".encode()
    ).hexdigest()

    result = db.query(AnalysisCache).filter(
        AnalysisCache.code_hash == code_hash,
        AnalysisCache.created_at > datetime.utcnow() - timedelta(hours=24)
    ).first()

    return json.loads(result.result) if result else None
\end{lstlisting}

\begin{successbox}
\textbf{Cache tasarrufu:} Tekrarlayan analizlerde (aynı kod bloğu) API çağrısı yapılmaz. Ortalama \%30--40 maliyet düşüşü beklenir.
\end{successbox}

\subsubsection{2. Token Optimizasyonu}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{lXr}
\toprule
\rowcolor{primary!10}
\textbf{Teknik} & \textbf{Açıklama} & \textbf{Tasarruf} \\
\midrule
\rowcolor{rowgray}
Seçim sınırlama & Max 100 satır seçim zorla & \%40–60 \\
Sistem prompt cache & Claude Prompt Caching API & \%80 (cached input) \\
\rowcolor{rowgray}
Kısa output modu & JSON şema ile yapılandırılmış çıktı & \%20–30 \\
Fallback zinciri & Başarısız → daha ucuz model & \%15–25 \\
\rowcolor{rowgray}
Debounce & 500ms bekle, son isteği gönder & \%50–70 (yazarken) \\
\bottomrule
\end{tabularx}
\caption{Token Optimizasyon Teknikleri}
\end{table}

\subsubsection{3. Claude Prompt Caching Kullanımı}

\begin{lstlisting}[language=Python, caption={Anthropic Prompt Caching — Sistem prompt'u cache'le}]
# backend/models/claude_client.py
import anthropic

client = anthropic.Anthropic()

SYSTEM_PROMPT = """Sen Code Alchemist asistanısın.
[... uzun sistem promptu — 2000+ token ...]
"""

async def analyze_with_caching(code: str) -> str:
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"}  # 5 dk cache
            }
        ],
        messages=[{"role": "user", "content": code}]
    )
    # Cache hit: sistem prompt tokenlari \%90 indirimli
    # ($3.00/1M -> $0.30/1M cache read)
    return response.content[0].text
\end{lstlisting}

\subsection{Ücretli API Güvenlik Protokolü}

\begin{warnbox}
\textbf{Kritik Güvenlik Kuralı:} API anahtarları hiçbir zaman \texttt{settings.json}, \texttt{.env} dosyası veya kod içinde saklanmamalıdır. VSCode \texttt{SecretStorage} API'si kullanılmalıdır.
\end{warnbox}

\begin{lstlisting}[language=TypeScript, caption={Güvenli API Key Yönetimi}]
// extension/src/security/SecretManager.ts
export class SecretManager {
  constructor(private secrets: vscode.SecretStorage) {}

  async storeKey(provider: 'anthropic' | 'openai' | 'google', key: string) {
    await this.secrets.store(`codeAlchemist.${provider}`, key);
  }

  async getKey(provider: 'anthropic' | 'openai' | 'google'): Promise<string> {
    const key = await this.secrets.get(`codeAlchemist.${provider}`);
    if (!key) throw new Error(`${provider} API anahtarı bulunamadı`);
    return key;
  }
}
// Kullanim — anahtarlar OS Keychain'de şifreli!
// macOS: Keychain, Windows: DPAPI, Linux: libsecret
\end{lstlisting}

\subsection{Bütçe Limiti ve Uyarı Sistemi}

\begin{lstlisting}[language=Python, caption={Aylık harcama takibi ve uyarı}]
# backend/budget/tracker.py
class BudgetTracker:
    MONTHLY_LIMITS = {
        'anthropic': 30.0,  # USD
        'openai':    20.0,
        'google':    10.0
    }

    def record_usage(self, provider: str, input_tokens: int,
                     output_tokens: int, model: str):
        cost = self._calculate_cost(provider, model,
                                    input_tokens, output_tokens)
        self._add_to_db(provider, cost)

        monthly_total = self._get_monthly_total(provider)
        limit = self.MONTHLY_LIMITS[provider]

        if monthly_total >= limit * 0.8:   # %80 uyarı
            self._notify_extension('BUDGET_WARNING', {
                'provider': provider,
                'used': monthly_total,
                'limit': limit,
                'percent': int(monthly_total / limit * 100)
            })

        if monthly_total >= limit:          # Limit aşıldı — durdur
            raise BudgetExceededError(provider)
\end{lstlisting}

%% ══════════════════════════════════════════════════════════
\section{Adım Adım Geliştirme Yol Haritası}

\subsection{Faz 1: Temel Altyapı (Hafta 1–2)}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{clXl}
\toprule
\rowcolor{primary!15}
\textbf{Gün} & \textbf{Görev} & \textbf{Detay} & \textbf{Öncelik} \\
\midrule
1–2 & \texttt{yo code} iskelet & TypeScript eklenti şablonu & \textcolor{accent}{\textbf{P0}} \\
\rowcolor{rowgray}
3–5 & \textbf{Python Bundling} & \textbf{PyInstaller CI + 3 platform binary} & \textcolor{accent}{\textbf{P0}} \\
6–7 & SidecarManager & Binary tabanlı process spawn & \textcolor{accent}{\textbf{P0}} \\
\rowcolor{rowgray}
8 & SecretStorage & API key yönetimi & \textcolor{accent}{\textbf{P0}} \\
9 & WebviewView & Activity Bar sidebar kaydı & \textcolor{warning}{\textbf{P1}} \\
\rowcolor{rowgray}
10 & DecorationTypes & 3 model için renk tanımları & \textcolor{warning}{\textbf{P1}} \\
\bottomrule
\end{tabularx}
\end{table}

\subsection{Faz 2: Core Özellikler (Hafta 3–4)}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{clXl}
\toprule
\rowcolor{primary!15}
\textbf{Gün} & \textbf{Görev} & \textbf{Detay} & \textbf{Öncelik} \\
\midrule
11–13 & Orchestrator & Promise.allSettled paralel çağrı & \textcolor{accent}{\textbf{P0}} \\
\rowcolor{rowgray}
14–15 & SSE Streaming & FastAPI stream endpoint & \textcolor{accent}{\textbf{P0}} \\
16–17 & DecorationManager & Canlı decoration uygulama & \textcolor{accent}{\textbf{P0}} \\
\rowcolor{rowgray}
18–19 & CodeLensProvider & Model özeti lensler & \textcolor{warning}{\textbf{P1}} \\
20 & ModelRouter port & detect\_intent TS heuristic & \textcolor{warning}{\textbf{P1}} \\
\bottomrule
\end{tabularx}
\end{table}

\subsection{Faz 3: React Webview (Hafta 5–6)}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{clXl}
\toprule
\rowcolor{primary!15}
\textbf{Gün} & \textbf{Görev} & \textbf{Detay} & \textbf{Öncelik} \\
\midrule
21–22 & Vite setup & CSP uyumlu bundle, nonce & \textcolor{accent}{\textbf{P0}} \\
\rowcolor{rowgray}
23–24 & WebviewView & Activity Bar sidebar (registerWebviewViewProvider) & \textcolor{accent}{\textbf{P0}} \\
25–26 & Bridge hook & \texttt{useVSCodeBridge} + reducer & \textcolor{accent}{\textbf{P0}} \\
\rowcolor{rowgray}
27–28 & Mevcut bileşenler & SuggestionPanel adaptasyonu & \textcolor{warning}{\textbf{P1}} \\
29 & DiffViewer & Patch uygulama (WebviewPanel) & \textcolor{warning}{\textbf{P1}} \\
\rowcolor{rowgray}
30 & Chat Participant & \texttt{@alchemist} kaydı (opsiyonel) & \textcolor{gpt}{\textbf{P2}} \\
\bottomrule
\end{tabularx}
\end{table}

\subsection{Faz 4: Üretim Hazırlığı (Hafta 7–8)}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{clXl}
\toprule
\rowcolor{primary!15}
\textbf{Gün} & \textbf{Görev} & \textbf{Detay} & \textbf{Öncelik} \\
\midrule
31–33 & Cache sistemi & SQLite + hash tabanlı & \textcolor{warning}{\textbf{P1}} \\
\rowcolor{rowgray}
34–35 & Bütçe takibi & BudgetTracker + uyarılar & \textcolor{warning}{\textbf{P1}} \\
36–37 & Hata yönetimi & Fallback zinciri + retry & \textcolor{warning}{\textbf{P1}} \\
\rowcolor{rowgray}
38–39 & VSIX paketleme & vsce package, imzalama & \textcolor{accent}{\textbf{P0}} \\
40 & Marketplace & VS Marketplace yayını & \textcolor{gpt}{\textbf{P2}} \\
\bottomrule
\end{tabularx}
\end{table}

%% ══════════════════════════════════════════════════════════
\section{Geliştirme Maliyet Planı}

\subsection{Geliştirme Süreci API Harcamaları}

\begin{infobox}
Geliştirme aşamasında API maliyetleri üretim kullanımından farklıdır. Aşağıdaki tablo gerçekçi test senaryolarına dayanmaktadır.
\end{infobox}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabular}{lrrrrr}
\toprule
\rowcolor{primary!15}
\textbf{Faz} & \textbf{Süre} & \textbf{Test/gün} & \textbf{Anthropic} & \textbf{OpenAI} & \textbf{Google} \\
\midrule
\rowcolor{rowgray}
Faz 1: Altyapı & 2 hafta & 10–20 & \$5–10 & \$3–6 & \$1–2 \\
Faz 2: Core & 2 hafta & 30–50 & \$15–25 & \$10–15 & \$3–5 \\
\rowcolor{rowgray}
Faz 3: Webview & 2 hafta & 20–40 & \$10–18 & \$7–12 & \$2–4 \\
Faz 4: Üretim & 2 hafta & 50–100 & \$20–35 & \$15–25 & \$5–8 \\
\midrule
\rowcolor{highlight!10}
\textbf{TOPLAM} & \textbf{8 hafta} & & \textbf{\$50–88} & \textbf{\$35–58} & \textbf{\$11–19} \\
\bottomrule
\end{tabular}
\caption{Geliştirme Süreci Tahmini API Maliyeti}
\end{table}

\textbf{Geliştirme toplamı: \$96–165 USD} (8 haftalık sprint)

\subsection{Diğer Altyapı Maliyetleri}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabularx}{\linewidth}{lXrr}
\toprule
\rowcolor{primary!15}
\textbf{Kalem} & \textbf{Açıklama} & \textbf{Aylık} & \textbf{Yıllık} \\
\midrule
\rowcolor{rowgray}
Azure/Heroku & Python backend (opsiyonel bulut) & \$7–15 & \$84–180 \\
VS Marketplace & Yayın ücreti (bir kez) & — & \$29 (tek seferlik) \\
\rowcolor{rowgray}
Sentry & Hata takibi (Hobby plan) & \$0 & \$0 \\
GitHub Actions & CI/CD (\textless{}2000 dk/ay) & \$0 & \$0 \\
\rowcolor{rowgray}
Domain/CDN & Opsiyonel landing page & \$5–10 & \$60–120 \\
\midrule
\rowcolor{gpt!8}
\textbf{Toplam (altyapı)} & & \textbf{\$12–25} & \textbf{\$173–329} \\
\bottomrule
\end{tabularx}
\caption{Altyapı ve Operasyonel Maliyetler}
\end{table}

\subsection{Ücretsiz Katmanlar ve Tasarruf Fırsatları}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.6}
\begin{tabularx}{\linewidth}{lXr}
\toprule
\rowcolor{primary!15}
\textbf{Platform} & \textbf{Ücretsiz Limit} & \textbf{Değer} \\
\midrule
\rowcolor{rowgray}
Google AI Studio & Gemini 2.5 Flash — 1M token/gün & \textasciitilde\$10/ay \\
OpenAI & Yeni hesap \$18 kredi & \$18 tek seferlik \\
\rowcolor{rowgray}
Anthropic & Yeni hesap \$5 kredi & \$5 tek seferlik \\
GitHub Copilot & Öğrenci: ücretsiz & Kıyaslama için \\
\rowcolor{rowgray}
Ollama (lokal) & Tamamen ücretsiz & Offline test \\
\midrule
\rowcolor{gpt!8}
\textbf{İlk ay potansiyel tasarruf} & & \textbf{\$30–50} \\
\bottomrule
\end{tabularx}
\caption{Ücretsiz Katmanlar ve Başlangıç Kredileri}
\end{table}

\subsection{ROI Analizi}

\begin{figure}[H]
\centering
\begin{tikzpicture}
\begin{axis}[
  width=12cm, height=6cm,
  xlabel={Ay},
  ylabel={Kümülatif Maliyet (USD)},
  legend pos=north west,
  grid=major,
  grid style={gray!20},
  xtick={1,2,3,4,5,6},
  ymin=0, ymax=500,
  title={\textbf{Maliyet Projeksiyonu (6 Ay)}},
  title style={color=primary}
]
\addplot[color=claude, thick, mark=square*] coordinates {
  (1,165)(2,205)(3,245)(4,285)(5,325)(6,365)
};
\addlegendentry{Tam geliştirme (kümülatif)}

\addplot[color=gemini, thick, mark=triangle*, dashed] coordinates {
  (1,50)(2,70)(3,90)(4,110)(5,130)(6,150)
};
\addlegendentry{Optimize (cache + bütçe limiti)}

\addplot[color=accent, thick, mark=o, dotted] coordinates {
  (1,0)(2,0)(3,30)(4,60)(5,90)(6,120)
};
\addlegendentry{Ücretsiz katmanlar ile}
\end{axis}
\end{tikzpicture}
\caption{6 Aylık Maliyet Senaryoları}
\end{figure}

%% ══════════════════════════════════════════════════════════
\section{Güvenlik ve En İyi Uygulamalar}

\subsection{VSCode Güvenlik Kontrol Listesi}

\begin{itemize}[leftmargin=2em, itemsep=0.4em]
  \item[\textcolor{gpt}{\checkmark}] \textbf{SecretStorage} — API anahtarları hiçbir zaman \texttt{settings.json}'a yazılmaz
  \item[\textcolor{gpt}{\checkmark}] \textbf{CSP nonce} — Webview'de her yüklemede rastgele nonce üretilir
  \item[\textcolor{gpt}{\checkmark}] \textbf{Girdi doğrulama} — Kullanıcı kodu LLM'e göndermeden önce boyut limiti kontrolü
  \item[\textcolor{gpt}{\checkmark}] \textbf{localhost only} — Sidecar process yalnızca \texttt{127.0.0.1} dinler
  \item[\textcolor{warning}{\textbf{!}}] \textbf{Telemetri izni} — Kullanıcıdan açık onay al (KVKK/GDPR)
  \item[\textcolor{warning}{\textbf{!}}] \textbf{Kod sızıntısı} — Kurumsal kullanıcılar için ``hassas dosya'' listesi tut
\end{itemize}

\subsection{Performans Optimizasyon Önerileri}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\begin{tabularx}{\linewidth}{lXr}
\toprule
\rowcolor{primary!10}
\textbf{Teknik} & \textbf{Açıklama} & \textbf{Kazanım} \\
\midrule
\rowcolor{rowgray}
Lazy activation & \texttt{onLanguage:python} tetikleyicisi & Hızlı başlangıç \\
Decoration debounce & 300ms sonra uygula & Titreşim önleme \\
\rowcolor{rowgray}
Worker threads & Orchestrator ayrı thread'de & UI donması yok \\
Incremental update & Sadece değişen satırları güncelle & \%60 az işlem \\
\rowcolor{rowgray}
Sidecar health-check & 5s ping, otomatik restart & Güvenilirlik \\
\bottomrule
\end{tabularx}
\caption{Performans Optimizasyon Tablosu}
\end{table}

%% ══════════════════════════════════════════════════════════
\section{Sonuç ve Eylem Planı}

\begin{successbox}
\textbf{Özet:} Code Alchemist'i VSCode eklentisine dönüştürmek için hibrit mimari (Python sidecar + TypeScript extension) en uygun seçimdir. Decoration API ile üç modelin önerileri aynı anda renk kodlu olarak gösterilebilir. Akıllı önbellekleme ve görev bazlı yönlendirme ile aylık API maliyeti \$15–30 aralığında tutulabilir.
\end{successbox}

\subsection{Hemen Atılacak Adımlar}

\begin{enumerate}[leftmargin=2em, itemsep=0.5em]
  \item \texttt{yo code} ile TypeScript eklenti iskeletini oluştur
  \item \textbf{GitHub Actions PyInstaller pipeline'ını kur} — 3 platform binary (Windows/macOS/Linux)
  \item Mevcut Flask \texttt{routes.py} dosyasını FastAPI'ye taşı; \texttt{SidecarManager}'ı binary çalıştıracak şekilde güncelle
  \item \texttt{vscode.window.registerWebviewViewProvider} ile Activity Bar sidebar'ı kaydet (\texttt{WebviewPanel} değil)
  \item \texttt{DecorationManager.ts} ile 3 model için renk şemasını tanımla
  \item \texttt{CodeLensProvider}'ı yalnızca \texttt{onDidSaveTextDocument} ve seçim olaylarına bağla
  \item Google AI Studio üzerinden \textbf{ücretsiz} Gemini API anahtarı al ve ilk testi yap
  \item Bütçe limitlerini kod bazında belirle (Anthropic \$30/ay, OpenAI \$20/ay)
  \item (Faz 4 sonrası) \texttt{@alchemist} Chat Participant kaydını ekle
\end{enumerate}

\vspace{1cm}
\begin{center}
\textcolor{gray}{\rule{0.8\linewidth}{0.5pt}}\\[0.3cm]
{\small\textcolor{gray}{Code Alchemist VSCode Migration --- Teknik Yol Haritası \& Maliyet Analizi}}\\
{\small\textcolor{gray}{Mart 2026 --- Tüm fiyatlar yaklaşık olup değişebilir}}
\end{center}

\end{document}