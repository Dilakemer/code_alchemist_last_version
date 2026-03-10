import React, { useState, useRef, useEffect } from 'react';

const options = [
  // Smart Routing
  { value: 'auto', label: 'Auto (Smart Model)' },

  // Google Gemini (Active Models)
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (New)' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash (Preview)' },

  // OpenAI
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },

  // Claude (Updated to 4.5)
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude 4.5 Opus' },
];

const ModelSelector = ({
  model,
  setModel,
  isMultiModel,
  setIsMultiModel,
  multiModels,
  setMultiModels
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLabel = (val) => options.find(o => o.value === val)?.label || val;

  const toggleModel = (val) => {
    if (multiModels.includes(val)) {
      setMultiModels(multiModels.filter(m => m !== val));
    } else {
      setMultiModels([...multiModels, val]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg text-sm text-gray-200 transition-all min-w-[200px] justify-between"
      >
        <span className="truncate max-w-[180px]">
          {isMultiModel
            ? `${multiModels.length} Models Selected`
            : getLabel(model)
          }
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header & Search */}
          <div className="p-3 border-b border-gray-800 space-y-3">
            {/* Multi Model Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Use Multi Model</span>
              <button
                onClick={() => setIsMultiModel(!isMultiModel)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isMultiModel ? 'bg-fuchsia-600' : 'bg-gray-700'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isMultiModel ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search model..."
                className="w-full bg-gray-800 text-gray-200 text-xs rounded-lg pl-8 pr-3 py-1.5 border border-gray-700 focus:border-fuchsia-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Model List */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (isMultiModel) {
                      toggleModel(opt.value);
                    } else {
                      setModel(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${(isMultiModel ? multiModels.includes(opt.value) : model === opt.value)
                    ? 'bg-fuchsia-900/30 text-fuchsia-300'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${(isMultiModel ? multiModels.includes(opt.value) : model === opt.value)
                    ? 'border-fuchsia-500 bg-fuchsia-500/20'
                    : 'border-gray-600'
                    }`}>
                    {(isMultiModel ? multiModels.includes(opt.value) : model === opt.value) && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-fuchsia-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {opt.label}
                  {isMultiModel && (
                    <span className="ml-auto text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                      1x
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-xs text-gray-500">Model not found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
