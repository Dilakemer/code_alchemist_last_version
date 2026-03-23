import React, { useState, useEffect, useMemo } from 'react';
import { diffLines } from 'diff';

const InteractiveMergeModal = ({ isOpen, onClose, originalCode, newCode, onApply }) => {
  const [decisions, setDecisions] = useState({});
  const [historyStack, setHistoryStack] = useState([]); // Array of decisions objects
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDecisions({});
      setHistoryStack([]);
    }
  }, [isOpen, originalCode, newCode]);

  // Compute diff and group them into context vs changes
  const groups = useMemo(() => {
    if (!originalCode && !newCode) return [];
    
    // Fallback empty strings
    const oldStr = originalCode || '';
    const newStr = newCode || '';
    
    // If entirely new code
    if (!oldStr.trim()) {
       return [{ type: 'change', original: '', ai: newStr, id: 'chg-all' }];
    }

    const diffs = diffLines(oldStr, newStr);
    const result = [];
    let currentGroup = null;

    diffs.forEach((part, index) => {
      // If no newline at end, add one for consistent rendering
      let val = part.value;
      if (!val.endsWith('\n')) val += '\n';

      if (!part.added && !part.removed) {
        if (currentGroup) {
          result.push(currentGroup);
          currentGroup = null;
        }
        result.push({ type: 'context', value: val, id: `ctx-${index}` });
      } else {
        if (!currentGroup) {
          currentGroup = { type: 'change', original: '', ai: '', id: `chg-${index}` };
        }
        if (part.removed) currentGroup.original += val;
        if (part.added) currentGroup.ai += val;
      }
    });
    
    if (currentGroup) result.push(currentGroup);
    return result;
  }, [originalCode, newCode]);

  const changeGroups = groups.filter(g => g.type === 'change');
  const unresolvedCount = changeGroups.filter(g => !decisions[g.id]).length;

  const handleDecision = (id, choice) => {
    setHistoryStack(prev => [...prev, { ...decisions }]); // Snapshot current state
    setDecisions(prev => ({ ...prev, [id]: choice }));
  };

  const handleUndo = () => {
    if (historyStack.length > 0) {
      const prevDecisions = historyStack[historyStack.length - 1];
      setDecisions(prevDecisions);
      setHistoryStack(prev => prev.slice(0, -1));
    }
  };

  const handleAcceptAllAI = () => {
    setHistoryStack(prev => [...prev, { ...decisions }]);
    const nextDecisions = { ...decisions };
    changeGroups.forEach(g => {
      if (!nextDecisions[g.id]) nextDecisions[g.id] = 'ai';
    });
    setDecisions(nextDecisions);
  };

  const handleFinalize = () => {
    let merged = '';
    groups.forEach(g => {
      if (g.type === 'context') {
        merged += g.value;
      } else {
        // Default to AI if no decision was made
        const decision = decisions[g.id] || 'ai';
        if (decision === 'ai') merged += g.ai;
        else if (decision === 'original') merged += g.original;
        else if (decision === 'both') {
          // Both: original first, then ai
          merged += g.original;
          if (!merged.endsWith('\n')) merged += '\n';
          merged += g.ai;
        }
      }
    });
    
    // Clean up trailing extra newline if it was artificial
    onApply(merged.trimEnd());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-all"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-6xl h-[85vh] bg-gray-900/90 border border-fuchsia-500/30 rounded-2xl shadow-[0_0_50px_rgba(217,70,239,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.2)]">
              <span className="text-xl">🔮</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Alchemical Merge</h2>
              <p className="text-xs text-gray-400">Review changes and transmute your code.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {historyStack.length > 0 && (
              <button 
                onClick={handleUndo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors border border-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                Undo Setup ({historyStack.length})
              </button>
            )}
            {unresolvedCount > 0 && (
              <button 
                onClick={handleAcceptAllAI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-900/40 hover:bg-fuchsia-800/60 text-fuchsia-300 text-xs font-medium transition-colors border border-fuchsia-500/30"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Accept All AI Options
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        
        {/* Diff View Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0d1117] p-4 space-y-2">
          {groups.map((g) => {
            if (g.type === 'context') {
              return (
                <div key={g.id} className="font-mono text-[13px] leading-relaxed px-4 py-2 text-gray-500 bg-transparent whitespace-pre-wrap break-all">
                  {g.value}
                </div>
              );
            }
            
            // It's a change block
            const decision = decisions[g.id];
            const isResolved = !!decision;
            
            return (
               <div key={g.id} className={`my-4 border rounded-xl overflow-hidden transition-all duration-300 ${isResolved ? 'border-gray-800' : 'border-fuchsia-500/40 shadow-[0_0_15px_rgba(217,70,239,0.1)]'}`}>
                 {/* Action Bar for this Conflict */}
                 <div className={`flex items-center justify-between px-4 py-2 ${isResolved ? 'bg-gray-900 text-gray-500' : 'bg-fuchsia-950/30 text-fuchsia-300'} text-xs font-medium border-b border-gray-800/50`}>
                   <span>{isResolved ? '✓ Resolved' : '⚡ Conflict Detected'}</span>
                   {!isResolved ? (
                     <div className="flex items-center gap-2">
                       <button onClick={() => handleDecision(g.id, 'original')} className="px-3 py-1 rounded bg-gray-800 hover:bg-red-900/50 text-gray-300 hover:text-red-300 border border-gray-700 transition-colors">
                         Keep Original
                       </button>
                       <button onClick={() => handleDecision(g.id, 'both')} className="px-3 py-1 rounded bg-gray-800 hover:bg-blue-900/50 text-gray-300 hover:text-blue-300 border border-gray-700 transition-colors">
                         Accept Both
                       </button>
                       <button onClick={() => handleDecision(g.id, 'ai')} className="px-3 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg transition-colors">
                         Accept AI
                       </button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2">
                       <span className="text-gray-500">
                         {decision === 'ai' && 'AI Selected'}
                         {decision === 'original' && 'Original Kept'}
                         {decision === 'both' && 'Both Merged'}
                       </span>
                       <button onClick={() => handleDecision(g.id, null)} className="ml-2 hover:text-white px-2 py-0.5 rounded border border-gray-700 hover:border-gray-500 transition-colors">
                         Revert
                       </button>
                     </div>
                   )}
                 </div>
                 
                 {/* Content Viewer */}
                 <div className="grid grid-cols-2 divide-x divide-gray-800/50">
                    {/* Left: Original */}
                    <div className={`relative ${decision === 'ai' ? 'opacity-30 grayscale' : ''} bg-[#160b0b]`}>
                      <div className="absolute top-0 right-0 px-2 py-1 text-[10px] text-red-500/70 select-none bg-red-950 rounded-bl-md">Original</div>
                      <pre className="font-mono text-[13px] leading-relaxed p-4 whitespace-pre-wrap break-all text-red-300/90 overflow-x-auto min-h-[60px] m-0">
                        {g.original || <span className="text-gray-600 italic">No original content (Addition)</span>}
                      </pre>
                    </div>
                    
                    {/* Right: AI */}
                    <div className={`relative ${decision === 'original' ? 'opacity-30 grayscale' : ''} bg-[#06140f]`}>
                      <div className="absolute top-0 right-0 px-2 py-1 text-[10px] text-green-500/70 select-none bg-green-950 rounded-bl-md">AI Suggestion</div>
                      <pre className="font-mono text-[13px] leading-relaxed p-4 whitespace-pre-wrap break-all text-green-300/90 overflow-x-auto min-h-[60px] m-0">
                        {g.ai || <span className="text-gray-600 italic">No AI content (Deletion)</span>}
                      </pre>
                    </div>
                 </div>
                 
                 {/* Post-Merge Preview (if "Both" selected) */}
                 {decision === 'both' && (
                   <div className="border-t border-blue-900/50 bg-[#0d1627] p-4">
                     <div className="text-[10px] text-blue-400 mb-2 uppercase tracking-wide">Resulting Blend:</div>
                     <pre className="font-mono text-[13px] leading-relaxed text-blue-300 whitespace-pre-wrap break-all m-0">
                       {g.original}
                       {g.ai}
                     </pre>
                   </div>
                 )}
               </div>
            );
          })}
        </div>
        
        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800/50 bg-gray-900/50">
          <div className="text-sm text-gray-400">
            {unresolvedCount > 0 ? (
              <span><strong className="text-fuchsia-400">{unresolvedCount}</strong> conflict{unresolvedCount > 1 ? 's' : ''} remaining. (Unresolved conflicts default to AI suggestion)</span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                All conflicts reviewed. Ready to transmute!
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-transparent border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={handleFinalize}
              className="group relative px-6 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white transition-all font-bold text-sm shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative flex items-center gap-2">
                🔮 Complete Merge
              </span>
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default InteractiveMergeModal;
