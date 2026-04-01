import React, { useState, useEffect, useRef } from 'react';
import HistoryList from './HistoryList';

const LANGUAGES = ['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'cpp', 'sql', 'html', 'css', 'plaintext'];

const MODELS = [
  { value: 'auto', label: '⚡ Auto' },
  { value: 'gemini-3.1-flash-lite-preview', label: '✦ Gemini 3.1 Flash Lite (Preview)' },
  { value: 'gemini-2.5-flash', label: '✦ Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: '✦ Gemini Flash Lite' },
  { value: 'gpt-4o', label: '◎ GPT-4o' },
  { value: 'claude-sonnet-4-5-20250929', label: '◆ Claude 4.5 Sonnet' },
  { value: 'claude-opus-4-5-20251101', label: '◆ Claude 4.5 Opus' },
];

const EXT_LANG = {
  py: 'python', js: 'javascript', ts: 'typescript', go: 'go', rs: 'rust',
  java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', sql: 'sql',
  html: 'html', htm: 'html', css: 'css', json: 'plaintext', md: 'plaintext', txt: 'plaintext',
};

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/xml',
  'application/x-sh',
  'image/svg+xml',
]);

const BINARY_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'zip', 'rar', '7z',
  'gz', 'tar', 'exe', 'dll', 'so', 'dylib', 'woff', 'woff2', 'ttf', 'otf', 'mp3',
  'mp4', 'mov', 'avi', 'mkv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
]);

const ProjectWorkspace = ({ project, apiBase, authHeaders, onNewChat, onOpenChat, onDeleteChat, model, setModel }) => {
  const [activeTab, setActiveTab] = useState('chats');
  const [projectChats, setProjectChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');

  // Resources state
  const [projectFiles, setProjectFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [addMode, setAddMode] = useState(null); // 'upload' | 'text'
  const [sourceName, setSourceName] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [sourceLang, setSourceLang] = useState('plaintext');
  const [addingSource, setAddingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [sourceSuccess, setSourceSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!sourceSuccess) return;
    const timer = setTimeout(() => setSourceSuccess(''), 3500);
    return () => clearTimeout(timer);
  }, [sourceSuccess]);

  useEffect(() => {
    if (project) {
      fetchProjectChats();
      fetchProjectFiles();
    }
  }, [project]);

  const fetchProjectChats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/conversations?project_id=${project.id}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setProjectChats(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch project chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectFiles = async () => {
    setFilesLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/projects/${project.id}/files`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setProjectFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to fetch project files:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleCreateChat = async (e) => {
    if (e) e.preventDefault();
    if (!newChatTitle.trim()) return;
    try {
      const res = await fetch(`${apiBase}/api/conversations`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChatTitle, project_id: project.id })
      });
      if (res.ok) {
        const data = await res.json();
        setNewChatTitle('');
        fetchProjectChats();
        if (onNewChat) onNewChat(data.conversation, newChatTitle);
      }
    } catch (err) {
      console.error('Failed to create project chat:', err);
    }
  };

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });

  const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const uploadDocumentAsContext = async (file, docType) => {
    setAddingSource(true);
    setSourceError('');
    setSourceSuccess(`${docType.toUpperCase()} yukleniyor ve metin cikariliyor...`);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const base64Content = arrayBufferToBase64(buffer);
      const res = await fetch(`${apiBase}/api/projects/${project.id}/files`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          content: base64Content,
          language: docType,
          encoding: 'base64',
          mime_type: file.type || (docType === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        })
      });

      if (res.ok) {
        setSourceSuccess(`'${file.name}' eklendi. ${docType.toUpperCase()} metni proje baglamina aktarildi.`);
        setShowAddSource(false);
        setAddMode(null);
        setSourceName('');
        setSourceContent('');
        setSourceLang('plaintext');
        fetchProjectFiles();
      } else {
        const d = await res.json().catch(() => ({}));
        setSourceError(d.error || `${docType.toUpperCase()} eklenemedi (Hata: ${res.status})`);
        setSourceSuccess('');
      }
    } catch {
      setSourceError(`${docType.toUpperCase()} okunamadi veya baglanti hatasi olustu.`);
      setSourceSuccess('');
    } finally {
      setAddingSource(false);
    }
  };

  const isLikelyTextFile = (file, ext) => {
    if (EXT_LANG[ext]) return true;
    if (BINARY_EXTENSIONS.has(ext)) return false;
    if (file.type?.startsWith('text/')) return true;
    if (TEXT_MIME_TYPES.has(file.type)) return true;
    return false;
  };

  const handleFileDrop = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      await uploadDocumentAsContext(file, 'pdf');
      return;
    }
    if (ext === 'docx') {
      await uploadDocumentAsContext(file, 'docx');
      return;
    }
    if (!isLikelyTextFile(file, ext)) {
      setSourceError('Bu dosya tipi metin tabanli degil. Desteklenenler: metin dosyalari, PDF ve DOCX.');
      setSourceSuccess('');
      return;
    }
    const lang = EXT_LANG[ext] || 'plaintext';
    try {
      const content = await readFileAsText(file);
      setSourceError('');
      setSourceName(file.name);
      setSourceContent(content);
      setSourceLang(lang);
      setAddMode('text');
      setSourceSuccess(`'${file.name}' yüklendi. Gerekirse düzenleyip Ekle butonuna basın.`);
    } catch {
      setSourceError('Dosya okunamadı.');
      setSourceSuccess('');
    }
  };

  const handleFileInput = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileDrop(files);
    }
    e.target.value = '';
  };

  const handleAddSource = async () => {
    if (!sourceName.trim() || !sourceContent.trim()) {
      setSourceError('Dosya adı ve içerik gereklidir.');
      return;
    }
    setAddingSource(true);
    setSourceError('');
    try {
      const safeName = sourceName.trim();
      const res = await fetch(`${apiBase}/api/projects/${project.id}/files`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: safeName, content: sourceContent, language: sourceLang })
      });
      if (res.ok) {
        setSourceSuccess(`'${safeName}' proje bağlamına eklendi.`);
        setShowAddSource(false);
        setAddMode(null);
        setSourceName('');
        setSourceContent('');
        setSourceLang('plaintext');
        fetchProjectFiles();
      } else {
        const d = await res.json().catch(() => ({}));
        setSourceError(d.error || `Hata: ${res.status}`);
        setSourceSuccess('');
      }
    } catch {
      setSourceError('Bağlantı hatası.');
      setSourceSuccess('');
    } finally {
      setAddingSource(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await fetch(`${apiBase}/api/projects/${project.id}/files/${fileId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      fetchProjectFiles();
    } catch (err) {
      console.error('Delete file error:', err);
    }
  };

  const resetAddSource = () => {
    setShowAddSource(false);
    setAddMode(null);
    setSourceName('');
    setSourceContent('');
    setSourceLang('plaintext');
    setSourceError('');
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-4 md:p-8 overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-2xl shadow-inner">
          {project.name.toLowerCase().includes('web') ? '🌐' : 
           project.name.toLowerCase().includes('api') ? '🔌' : 
           project.name.toLowerCase().includes('refactor') ? '🛠️' : 
           project.name.toLowerCase().includes('debug') ? '🐛' : '📁'}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{project.name}</h2>
          <p className="text-sm text-gray-400">Proje Workspace</p>
        </div>
      </div>

      {/* Main Action Input */}
      <form onSubmit={handleCreateChat} className="mb-6 group">
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-fuchsia-400 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
             </svg>
          </div>
          <input
            type="text"
            value={newChatTitle}
            onChange={(e) => setNewChatTitle(e.target.value)}
            placeholder={`${project.name} içinde yeni bir sohbet başlat...`}
            className="w-full bg-gray-900/50 hover:bg-gray-900/80 focus:bg-gray-900 border border-gray-800 focus:border-fuchsia-500/50 rounded-2xl py-5 pl-14 pr-16 text-lg text-white placeholder-gray-500 transition-all outline-none shadow-2xl backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
             <button
               type="submit"
               disabled={!newChatTitle.trim()}
               className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.429a1 1 0 001.169-1.409l-7-14z" />
               </svg>
             </button>
          </div>
        </div>
        {/* Model Selector */}
        <div className="flex items-center gap-2 mt-2.5 px-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>
          <span className="text-xs text-gray-500">Model:</span>
          <select
            value={model || 'auto'}
            onChange={(e) => setModel && setModel(e.target.value)}
            className="bg-gray-800/80 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-fuchsia-500/50 hover:border-gray-600 transition-colors cursor-pointer"
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </form>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-800/50 pb-px">
        <button
          onClick={() => setActiveTab('chats')}
          className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
            activeTab === 'chats' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Sohbetler
          {activeTab === 'chats' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
            activeTab === 'resources' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Kaynaklar
          {activeTab === 'resources' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activeTab === 'chats' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
            {loading ? (
               <div className="col-span-full py-20 text-center text-gray-500 animate-pulse">Sohbetler yükleniyor...</div>
            ) : projectChats.length > 0 ? (
              projectChats.map(chat => (
                <div 
                  key={chat.id}
                  onClick={() => onOpenChat(chat)}
                  className="p-4 rounded-xl bg-gray-900/30 border border-gray-800 hover:border-gray-700 hover:bg-gray-800/40 transition-all cursor-pointer group flex items-center justify-between shadow-sm"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-medium text-gray-200 truncate pr-4">{chat.title}</span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(chat.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={async (e) => { e.stopPropagation(); await onDeleteChat(chat.id); fetchProjectChats(); }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
                      title="Sil"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <p className="text-sm font-medium mb-1">Henüz sohbet yok</p>
                <p className="text-xs">Bu proje için ilk sohbetinizi başlatın.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="pb-8">
            {sourceSuccess && (
              <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {sourceSuccess}
              </div>
            )}

            {/* Add Source Modal / Panel */}
            {showAddSource && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={resetAddSource}>
                <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-5 border-b border-gray-800">
                    <h3 className="text-base font-semibold text-white">Kaynakları ekle</h3>
                    <button onClick={resetAddSource} className="text-gray-400 hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>

                  {addMode === null ? (
                    <>
                      {/* Drag & Drop Area */}
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); handleFileDrop(e.dataTransfer.files); }}
                        className={`m-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-14 transition-colors cursor-pointer ${dragOver ? 'border-fuchsia-500 bg-fuchsia-900/10' : 'border-gray-700 bg-gray-800/20 hover:border-gray-600'}`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m0 0a8 8 0 018 8H4a8 8 0 018-8zm0 0V3m-2 9h4m-2-2v4"/><rect x="8" y="12" width="8" height="8" rx="1" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 12v4m0 0l-2-2m2 2l2-2"/></svg>
                        <span className="text-sm text-gray-400">Kaynakları buraya sürükle</span>
                        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
                      </div>
                      {sourceError && (
                        <div className="mx-5 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {sourceError}
                        </div>
                      )}
                      {sourceSuccess && (
                        <div className="mx-5 mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                          {sourceSuccess}
                        </div>
                      )}
                      <p className="px-5 pb-3 text-[11px] text-gray-500">
                        Not: "Karsiya yukle" ile metin dosyalari, PDF ve DOCX dogrudan eklenebilir.
                      </p>
                      {/* Action Buttons */}
                      <div className="flex gap-3 px-5 pb-5">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                          <span className="text-xs text-gray-300 font-medium">Karşıya yükle</span>
                        </button>
                        <button
                          onClick={() => setAddMode('text')}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          <span className="text-xs text-gray-300 font-medium">Metin girdisi</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Text / File Input Form */
                    <div className="p-5 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Dosya adı (örn. main.py)"
                          value={sourceName}
                          onChange={e => setSourceName(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 font-mono"
                        />
                        <select
                          value={sourceLang}
                          onChange={e => setSourceLang(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-300 focus:outline-none"
                        >
                          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <textarea
                        placeholder="İçeriği buraya yapıştır..."
                        value={sourceContent}
                        onChange={e => setSourceContent(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 font-mono resize-none h-48 custom-scrollbar"
                      />
                      {sourceError && (
                        <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">{sourceError}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setAddMode(null)} className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all">
                          Geri
                        </button>
                        <button
                          onClick={handleAddSource}
                          disabled={addingSource || !sourceName.trim() || !sourceContent.trim()}
                          className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {addingSource ? 'Ekleniyor...' : 'Ekle'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File List */}
            {filesLoading ? (
              <div className="py-10 text-center text-gray-500 animate-pulse text-sm">Kaynaklar yükleniyor...</div>
            ) : projectFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/10 p-8 text-center">
                <div className="flex items-center gap-2 mb-5 pointer-events-none">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-xl opacity-50 border border-gray-700">📝</div>
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-xl opacity-50 border border-gray-700">📦</div>
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-xl border border-gray-600">📎</div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Kod Alchemist'e daha fazla bağlam ver</h3>
                <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
                  Projeniz hakkında daha derin bir bağlam sağlamak için kaynakları yükleyin veya dosya ekleyin.
                </p>
                <button
                  onClick={() => setShowAddSource(true)}
                  className="px-8 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-all shadow-xl hover:scale-105 active:scale-95"
                >
                  Ekle
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-300">📄 Kaynaklar ({projectFiles.length})</span>
                  <button
                    onClick={() => setShowAddSource(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black text-xs font-semibold hover:bg-gray-200 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                    Ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {projectFiles.map(f => (
                    <div key={f.id} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">📄</span>
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-white truncate">{f.name}</p>
                          <p className="text-xs text-gray-500">{f.language} · {f.content?.length || 0} karakter</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFile(f.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all ml-3"
                        title="Sil"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectWorkspace;
