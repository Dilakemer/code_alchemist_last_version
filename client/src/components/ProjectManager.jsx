import React, { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';

/**
 * ProjectManager — Çok dosyalı proje/workspace yöneticisi
 *
 * Props:
 *   apiBase      : string
 *   authHeaders  : object
 *   onSelectProject : (project) => void — seçili proje değiştiğinde
 *   activeProjectId : number | null
 */

const ProjectManager = ({ apiBase, authHeaders, onSelectProject, activeProjectId, onClose }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [newFile, setNewFile] = useState({ name: '', content: '', language: 'python' });
  const [addingFile, setAddingFile] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null });
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/projects`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error('Projects fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (projectId) => {
    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/files`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error('Files fetch error:', e);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name: newName, description: newDesc })
      });
      if (res.ok) {
        setNewName('');
        setNewDesc('');
        fetchProjects();
      }
    } catch (e) {
      console.error('Create project error:', e);
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = (id) => {
    setConfirmDelete({ show: true, id });
  };

  const confirmDeleteProject = async () => {
    const id = confirmDelete.id;
    setConfirmDelete({ show: false, id: null });
    try {
      const res = await fetch(`${apiBase}/api/projects/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        fetchProjects();
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setView('list');
        }
      } else {
        console.error('Delete project failed:', res.status);
      }
    } catch (e) {
      console.error('Delete project error:', e);
    }
  };

  const openProject = (project) => {
    setSelectedProject(project);
    setView('detail');
    fetchFiles(project.id);
  };

  const addFile = async (e) => {
    e.preventDefault();
    if (!newFile.name.trim() || !selectedProject) return;
    setAddingFile(true);
    setFileError('');
    try {
      const res = await fetch(`${apiBase}/api/projects/${selectedProject.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(newFile)
      });
      if (res.ok) {
        setNewFile({ name: '', content: '', language: 'python' });
        fetchFiles(selectedProject.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setFileError(data.error || `Dosya eklenemedi (${res.status}). Lütfen tekrar deneyin.`);
      }
    } catch (e) {
      console.error('Add file error:', e);
      setFileError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setAddingFile(false);
    }
  };

  const deleteFile = async (fileId) => {
    try {
      await fetch(`${apiBase}/api/projects/${selectedProject.id}/files/${fileId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      fetchFiles(selectedProject.id);
    } catch (e) {
      console.error('Delete file error:', e);
    }
  };

  const handleSelectAndClose = (project) => {
    onSelectProject?.(project);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-gray-900 border border-fuchsia-500/30 rounded-2xl w-full max-w-2xl shadow-2xl shadow-fuchsia-900/20 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700/60 bg-black/30">
          <div className="flex items-center gap-3">
            {view === 'detail' && (
              <button
                onClick={() => setView('list')}
                className="text-gray-400 hover:text-white transition-colors mr-1"
              >
                ← Back
              </button>
            )}
            <span className="text-2xl">📁</span>
            <div>
              <h2 className="text-lg font-bold text-white">
                {view === 'list' ? 'My Projects' : selectedProject?.name}
              </h2>
              <p className="text-xs text-gray-400">
                {view === 'list' ? 'Multi-file context workspace' : selectedProject?.description || 'No description'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {view === 'list' ? (
            <>
              {/* Create new project (ChatGPT Style) */}
              <form onSubmit={createProject} className="mb-6 space-y-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                      <line x1="9" y1="9" x2="9.01" y2="9"></line>
                      <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Proje ismi (örn. Web Uygulaması)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-gray-800/80 border border-gray-600 rounded-xl pl-10 pr-3 py-3 text-sm text-white focus:outline-none focus:border-gray-400 focus:bg-gray-800 transition-colors"
                    required
                  />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setNewName('Web Uygulaması')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs font-medium text-gray-300 transition-colors">
                    <span className="text-emerald-400">🌐</span> Web App
                  </button>
                  <button type="button" onClick={() => setNewName('API Entegrasyonu')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs font-medium text-gray-300 transition-colors">
                    <span className="text-blue-400">🔌</span> API
                  </button>
                  <button type="button" onClick={() => setNewName('Legacy Refactor')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs font-medium text-gray-300 transition-colors">
                    <span className="text-purple-400">🛠️</span> Refactor
                  </button>
                  <button type="button" onClick={() => setNewName('Debug Projesi')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-xs font-medium text-gray-300 transition-colors">
                    <span className="text-yellow-400">🐛</span> Debug
                  </button>
                </div>

                {/* Info Box */}
                <div className="flex items-start gap-3 bg-gray-800/50 p-4 rounded-xl text-gray-400 text-xs leading-relaxed">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p>
                    Projeler kod dosyalarınızı, yapılandırmalarınızı ve ortamınızı tek bir bağlamda tutar. 
                    AI asistanına aynı anda birden fazla dosyayı inceleme ve düzenleme yeteneği sağlar.
                  </p>
                </div>

                {/* Create Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="px-5 py-2.5 rounded-full bg-gray-200 hover:bg-white text-gray-900 text-sm font-semibold transition-all disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Oluşturuluyor...' : 'Proje oluştur'}
                  </button>
                </div>
              </form>
              
              <div className="w-full h-px bg-gray-700/50 my-4"></div>

              {/* Project list title */}
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Mevcut Projeler</h3>
              {loading ? (
                <div className="text-center text-gray-500 py-8">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  No projects yet. Create your first one above!
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map(p => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        activeProjectId === p.id
                          ? 'border-fuchsia-500 bg-fuchsia-900/20'
                          : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex-1" onClick={() => openProject(p)}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">📂</span>
                          <span className="text-sm font-medium text-white">{p.name}</span>
                          {activeProjectId === p.id && (
                            <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-300 px-1.5 py-0.5 rounded border border-fuchsia-500/30">Active</span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-gray-400 ml-6 mt-0.5">{p.description}</p>
                        )}
                        <p className="text-[10px] text-gray-600 ml-6 mt-1">{p.file_count || 0} files • {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={() => handleSelectAndClose(p)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-300 border border-fuchsia-500/30 transition-all"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => deleteProject(p.id)}
                          className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Project detail view */
            <>
              {/* Use this project */}
              <button
                onClick={() => handleSelectAndClose(selectedProject)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-sm font-semibold text-white hover:from-fuchsia-500 hover:to-purple-500 transition-all mb-2"
              >
                ✅ Use This Project Context in Chat
              </button>

              {/* Files list */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  📄 Project Files ({files.length})
                </h3>
                {files.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">No files yet. Add some below.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {files.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/40">
                        <div>
                          <span className="text-sm text-white font-mono">{f.name}</span>
                          <span className="ml-2 text-[10px] text-gray-500">{f.language} • {f.content?.length || 0} chars</span>
                        </div>
                        <button
                          onClick={() => deleteFile(f.id)}
                          className="text-red-400 hover:text-red-300 transition-colors text-xs ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add file form */}
              <form onSubmit={addFile} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 space-y-3">
                <h3 className="text-sm font-semibold text-fuchsia-300">➕ Add File</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="File name (e.g. app.py)"
                    value={newFile.name}
                    onChange={e => setNewFile(p => ({ ...p, name: e.target.value }))}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 font-mono"
                    required
                  />
                  <select
                    value={newFile.language}
                    onChange={e => setNewFile(p => ({ ...p, language: e.target.value }))}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-300 focus:outline-none"
                  >
                    {['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'cpp', 'sql', 'html', 'css'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  placeholder="Paste file content here..."
                  value={newFile.content}
                  onChange={e => setNewFile(p => ({ ...p, content: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 font-mono resize-none h-32 custom-scrollbar"
                />
                {fileError && (
                  <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                    {fileError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={addingFile || !newFile.name.trim()}
                  className="w-full py-2 rounded-lg bg-fuchsia-600/30 hover:bg-fuchsia-600/50 text-sm font-medium text-fuchsia-300 border border-fuchsia-500/30 transition-all disabled:opacity-50"
                >
                  {addingFile ? 'Ekleniyor...' : 'Add File to Project'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmDelete.show}
        onClose={() => setConfirmDelete({ show: false, id: null })}
        onConfirm={confirmDeleteProject}
        title="Projeyi Sil"
        message="Bu projeyi ve ona ait tüm sohbet geçmişini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        cancelText="İptal"
        isDanger={true}
      />
    </div>
  );
};

export default ProjectManager;
