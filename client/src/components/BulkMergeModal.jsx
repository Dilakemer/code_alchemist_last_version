import React, { useState } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

const BulkMergeModal = ({ isOpen, onClose, pendingChanges, onApply }) => {
  const [selectedFiles, setSelectedFiles] = useState(new Set(pendingChanges.map(c => c.path)));
  const [expandedFile, setExpandedFile] = useState(pendingChanges.length > 0 ? pendingChanges[0].path : null);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredChanges = pendingChanges.filter(c => 
    c.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFile = (path) => {
    const next = new Set(selectedFiles);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedFiles(next);
  };

  const handleApplyAll = () => {
    const changesToApply = pendingChanges.filter(c => selectedFiles.has(c.path));
    onApply(changesToApply);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-[#0f1115] border border-gray-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900/50 to-transparent">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
              Review Changes
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              The agent suggested changes to {pendingChanges.length} files. Review and apply them below.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File List */}
          <div className="w-80 border-r border-gray-800 flex flex-col bg-gray-900/20">
            <div className="p-4 border-b border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Files</span>
                <button 
                  onClick={() => setSelectedFiles(new Set(selectedFiles.size === pendingChanges.length ? [] : pendingChanges.map(c => c.path)))}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                >
                  {selectedFiles.size === pendingChanges.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Filter files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {filteredChanges.map((change) => (
                <div 
                  key={change.path}
                  className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    expandedFile === change.path ? 'bg-indigo-500/10 border border-indigo-500/30' : 'hover:bg-gray-800/50 border border-transparent'
                  }`}
                  onClick={() => setExpandedFile(change.path)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedFiles.has(change.path)}
                    onChange={() => toggleFile(change.path)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">{change.path.split('/').pop()}</div>
                    <div className="text-[10px] text-gray-500 truncate">{change.path}</div>
                  </div>
                  {change.type === 'create' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">NEW</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Diff View */}
          <div className="flex-1 flex flex-col bg-black/20">
            {expandedFile ? (() => {
              const change = pendingChanges.find(c => c.path === expandedFile);
              return (
                <>
                  <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/30">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-indigo-300">{change.path}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0d0e12]">
                    <ReactDiffViewer
                      oldValue={change.originalContent || ''}
                      newValue={change.content || ''}
                      splitView={true}
                      useDarkTheme={true}
                      styles={{
                        variables: {
                          dark: {
                            diffViewerBackground: '#0d0e12',
                            addedBackground: '#064e3b',
                            addedColor: '#86efac',
                            removedBackground: '#7f1d1d',
                            removedColor: '#fca5a5',
                            wordAddedBackground: '#166534',
                            wordRemovedBackground: '#991b1b',
                            addedGutterBackground: '#064e3b',
                            removedGutterBackground: '#7f1d1d',
                            gutterBackground: '#0d0e12',
                            gutterBackgroundDark: '#0d0e12',
                            gutterColor: '#4b5563',
                            emptyLineBackground: '#0d0e12',
                          }
                        }
                      }}
                    />
                  </div>
                </>
              );
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Select a file to preview changes</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <span className="font-bold text-white">{selectedFiles.size}</span> files selected for application
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleApplyAll}
              disabled={selectedFiles.size === 0}
              className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              Accept {selectedFiles.size} Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkMergeModal;
