import React, { useState } from 'react';

const DemoModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto custom-scrollbar group/modal">
    <div className="relative w-full max-w-4xl bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl my-auto">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all"
      >
        ✕
      </button>
      <div className="p-6 md:p-10 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-fuchsia-600 to-blue-600 rounded-2xl flex items-center justify-center text-3xl md:text-4xl mx-auto mb-6 shadow-lg shadow-fuchsia-600/30">
          ⚗️
        </div>
        <h3 className="text-xl md:text-2xl font-black text-white mb-2">See CodeAlchemist in Action</h3>
        <p className="text-gray-400 text-xs md:text-sm mb-6 md:mb-8 max-w-lg mx-auto">
          Watch how CodeAlchemist transforms your code with multi-model AI, real-time diff control, and autonomous patching.
        </p>
        <div className="aspect-video bg-[#1a1a1a] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-4 mb-6">
          <div className="w-20 h-20 bg-fuchsia-600/20 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-fuchsia-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">Demo Coming Soon</p>
          <p className="text-gray-600 text-xs">Try the live app — it's free with Gemini!</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-fuchsia-600/20"
          >
            Try it Now →
          </button>
          <a
            href="https://github.com/Dilakemer/code_alchemist_last_version"
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all border border-white/10"
          >
            View on GitHub ⭐
          </a>
        </div>
      </div>
    </div>
  </div>
);

const LandingPage = ({ onGetStarted, onLogin }) => {
  const [showDemo, setShowDemo] = useState(false);

  const features = [
    {
      title: "Autonomous Patching",
      desc: "AI suggests surgical code changes. One-click apply with full undo capability and conflict detection.",
      icon: "⚡",
      gradient: "from-fuchsia-600/20 to-fuchsia-600/5",
      border: "border-fuchsia-600/20"
    },
    {
      title: "Multi-Model AI",
      desc: "Blend GPT-4o, Claude, and Gemini responses. Pick the best answer or fuse them into one.",
      icon: "🧠",
      gradient: "from-blue-600/20 to-blue-600/5",
      border: "border-blue-600/20"
    },
    {
      title: "Context Intelligence",
      desc: "Real-time token monitor, semantic project search, and codebase health dashboard.",
      icon: "🧩",
      gradient: "from-indigo-600/20 to-indigo-600/5",
      border: "border-indigo-600/20"
    },
    {
      title: "Cost Transparency",
      desc: "Full AI cost dashboard with per-model analytics. Know exactly what you spend.",
      icon: "📊",
      gradient: "from-emerald-600/20 to-emerald-600/5",
      border: "border-emerald-600/20"
    },
    {
      title: "Monaco Editor",
      desc: "VS Code-grade editor with syntax highlighting, IntelliSense, and auto-completion.",
      icon: "✏️",
      gradient: "from-amber-600/20 to-amber-600/5",
      border: "border-amber-600/20"
    },
    {
      title: "GitHub Integration",
      desc: "Link repos, browse code graph, open PRs, and generate AI-powered fixes directly.",
      icon: "🐙",
      gradient: "from-purple-600/20 to-purple-600/5",
      border: "border-purple-600/20"
    },
  ];

  return (
    <>
      {showDemo && <DemoModal onClose={() => { setShowDemo(false); }} />}

      <div className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden selection:bg-fuchsia-500/30">
        {/* Background Blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-fuchsia-600/8 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/8 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] bg-indigo-600/5 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
        </div>

        {/* Navigation */}
        <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="relative group flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <img
                src="/code_alchemist_logo.png"
                alt="CodeAlchemist logo"
                className="relative h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] transition-transform duration-500 group-hover:scale-110"
                onError={(e) => { e.currentTarget.src = '/alchemy_wave.png'; }}
              />
            </div>
            <span className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              CodeAlchemist
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDemo(true)}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Demo
            </button>
            <button
              onClick={onLogin}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5"
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:bg-gray-100 transition-all transform active:scale-95 shadow-xl shadow-white/5"
            >
              Get Started →
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 pt-6 pb-14 px-6 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/5 border border-fuchsia-500/10 text-[9px] font-bold uppercase tracking-widest text-fuchsia-400 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-fuchsia-500 animate-pulse" />
            New: AI Patch Control & Cost Dashboard
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-[0.9]">
            <span className="block italic text-gray-500/80">Transmute</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500">
              Ideas into Reality.
            </span>
          </h1>

          <p className="text-sm md:text-base text-gray-500 max-w-xl mx-auto mb-8 font-medium leading-relaxed">
            The next-generation autonomous AI coding companion. Multi-model brain, real-time patch control, and complete transparency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-fuchsia-600/20 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              Start Transmuting Free ✨
            </button>
            <button
              onClick={() => setShowDemo(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group lg:min-w-[180px] cursor-pointer"
            >
              <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-fuchsia-600/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="font-semibold text-xs">Watch the Demo</span>
            </button>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-4 text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-6">
            <span className="flex items-center gap-1"><span className="text-emerald-500/70">✓</span> Free w/ Gemini</span>
            <span className="flex items-center gap-1"><span className="text-emerald-500/70">✓</span> No CC</span>
            <span className="flex items-center gap-1"><span className="text-emerald-500/70">✓</span> Open Source</span>
          </div>

          {/* Dashboard Preview Mockup - High Contrast & Sharp */}
          <div className="mt-8 relative max-w-4xl mx-auto group">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-20 pointer-events-none" />
            <div className="absolute -inset-0.5 bg-gradient-to-r from-fuchsia-500/40 to-blue-500/40 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-1000" />
            <div className="relative bg-[#0d0d0e] border border-white/20 rounded-2xl overflow-hidden shadow-2xl group-hover:shadow-[0_0_50px_rgba(192,38,211,0.2)] transition-all duration-500 aspect-video flex contrast-125 brightness-110">
              {/* Sidebar */}
              <div className="w-14 border-r border-white/10 p-3 flex flex-col gap-3 bg-black/40">
                {['🏠', '💬', '📊', '⚙️'].map((icon, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-white/${i === 1 ? '15' : '5'} border border-white/10 shadow-inner translate-y-0.5`}>
                    {icon}
                  </div>
                ))}
              </div>
              
              {/* Main Content Area */}
              <div className="flex-1 p-6 text-left bg-gradient-to-br from-[#0d0d0e] to-fuchsia-900/5 overflow-hidden">
                {/* Header Mockup */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]" />
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-2.5 bg-white/20 rounded-full" />
                      <div className="w-16 h-1.5 bg-white/10 rounded-full" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-16 h-6 bg-white/5 border border-white/10 rounded-lg" />
                    <div className="w-16 h-6 bg-fuchsia-600/20 border border-fuchsia-500/30 rounded-lg" />
                  </div>
                </div>

                {/* Dashboard Grid Mockup */}
                <div className="grid grid-cols-12 gap-5 h-full">
                  {/* Stats Column */}
                  <div className="col-span-4 space-y-5">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 shadow-sm">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Health Status</div>
                      <div className="flex items-end gap-1 mb-2">
                        <div className="text-2xl font-black text-white">98%</div>
                        <div className="text-[10px] text-emerald-400 mb-1">▲ 2.4%</div>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="w-[98%] h-full bg-gradient-to-r from-fuchsia-500 to-emerald-500" />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 shadow-sm">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Model Logic</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] text-gray-300">
                          <span>Gemini 1.5 Pro</span>
                          <span className="text-white">Active</span>
                        </div>
                        <div className="h-1 w-full bg-fuchsia-500/20 rounded-full" />
                      </div>
                    </div>
                  </div>

                  {/* Code/Flow Column */}
                  <div className="col-span-8 p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-[9px] text-gray-300 leading-relaxed shadow-inner overflow-hidden relative">
                    <div className="absolute top-2 right-4 text-fuchsia-400 animate-pulse">● Applying Patch...</div>
                    <div className="text-fuchsia-300/80 mb-2">// Atomic transmuter active</div>
                    <div className="mb-1"><span className="text-purple-400">async</span> <span className="text-blue-400">function</span> <span className="text-yellow-400">transmute</span>(prompt) {'{'}</div>
                    <div className="pl-4 mb-1 text-gray-500">const context = await fetchContext();</div>
                    <div className="pl-4 mb-1"><span className="text-purple-400">if</span> (context.isReady) {'{'}</div>
                    <div className="pl-8 mb-1 bg-fuchsia-500/10 border-l-2 border-fuchsia-500 text-fuchsia-100 py-0.5">return solveTask(prompt, context);</div>
                    <div className="pl-4 mb-1">{'}'}</div>
                    <div className="pl-4 h-1.5 w-32 bg-white/5 rounded-full mt-2" />
                    <div className="pl-4 h-1.5 w-48 bg-white/5 rounded-full mt-2" />
                    <div className="pl-4 h-1.5 w-40 bg-white/5 rounded-full mt-2" />
                    <div className="mt-6 flex gap-2">
                      <div className="w-20 h-5 bg-fuchsia-600/30 border border-fuchsia-500/40 rounded flex items-center justify-center text-white font-bold">Apply Solution</div>
                      <div className="w-16 h-5 bg-white/5 border border-white/10 rounded flex items-center justify-center">Undo</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="relative z-10 py-12 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-black mb-3 text-gray-200">Everything you need.</h2>
            <p className="text-gray-500 text-xs max-w-md mx-auto font-medium">Powered by most capable AI models, engineered for speed.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={i} className={`p-6 rounded-2xl bg-gradient-to-br ${f.gradient} border ${f.border} hover:scale-[1.01] transition-all duration-300 group cursor-default shadow-sm hover:shadow-lg`}>
                <div className="text-2xl mb-4 group-hover:scale-110 transition-transform inline-block">{f.icon}</div>
                <h3 className="text-base font-black mb-1.5 text-white">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="relative z-10 pt-12 pb-8 border-t border-white/5 text-center px-6">
          <h2 className="text-2xl md:text-4xl font-black mb-2 text-white">Evolve your workflow.</h2>
          <p className="text-gray-500 text-xs mb-8 max-w-sm mx-auto font-medium">Join developers building faster with AI intelligence.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              onClick={onGetStarted}
              className="px-8 py-3.5 bg-white text-black rounded-xl text-sm font-black hover:bg-gray-100 transition-all shadow-xl cursor-pointer"
            >
              Get Started Free 🧪
            </button>
            <button
              onClick={onLogin}
              className="px-8 py-3.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-bold hover:bg-white/10 transition-all cursor-pointer"
            >
              Sign In →
            </button>
          </div>
          <p className="mt-8 text-[10px] text-gray-700 font-bold tracking-[0.2em] uppercase">
            © 2026 CodeAlchemist • Engineering the Future
          </p>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
