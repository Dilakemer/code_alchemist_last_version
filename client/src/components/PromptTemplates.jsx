import React from 'react';

const promptTemplates = [
    {
        icon: '🔍',
        label: 'Explain',
        prompt: 'Explain this code in detail, step by step:',
        color: 'from-blue-500 to-cyan-500'
    },
    {
        icon: '🐛',
        label: 'Debug',
        prompt: 'Debug this code and find any issues or bugs:',
        color: 'from-red-500 to-orange-500'
    },
    {
        icon: '✨',
        label: 'Optimize',
        prompt: 'Optimize this code for better performance:',
        color: 'from-purple-500 to-pink-500'
    },
    {
        icon: '🧪',
        label: 'Test',
        prompt: 'Write unit tests for this code:',
        color: 'from-green-500 to-emerald-500'
    },
    {
        icon: '📝',
        label: 'Comment',
        prompt: 'Add detailed comments to this code:',
        color: 'from-yellow-500 to-amber-500'
    },
    {
        icon: '🔄',
        label: 'Refactor',
        prompt: 'Refactor this code to follow best practices:',
        color: 'from-indigo-500 to-violet-500'
    }
];

const PromptTemplates = ({ onSelect, visible = true }) => {
    if (!visible) return null;

    return (
        <div className="flex flex-wrap gap-2 mb-4 animate-fadeIn mobile-prompt-templates">
            {promptTemplates.map((template, index) => (
                <button
                    key={index}
                    onClick={() => onSelect(template.prompt)}
                    className="
                        flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold
                        bg-slate-800/40 border border-slate-700/50 text-slate-300
                        hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-white
                        transition-all duration-300 ease-out backdrop-blur-sm
                        mobile-prompt-btn group
                    "
                    title={template.prompt}
                >
                    <span className="opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                        {template.icon}
                    </span>
                    <span>{template.label}</span>
                </button>
            ))}
        </div>
    );
};

export default PromptTemplates;
