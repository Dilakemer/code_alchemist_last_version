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
        <div className="flex flex-wrap gap-2 mb-3 animate-fadeIn mobile-prompt-templates">
            {promptTemplates.map((template, index) => (
                <button
                    key={index}
                    onClick={() => onSelect(template.prompt)}
                    className={`
                        flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-medium
                        bg-gradient-to-r ${template.color} text-white
                        hover:scale-[1.02] hover:shadow-lg
                        transition-all duration-200 ease-out
                        border border-white/20
                        mobile-prompt-btn
                    `}
                    title={template.prompt}
                >
                    <span>{template.icon}</span>
                    <span>{template.label}</span>
                </button>
            ))}
        </div>
    );
};

export default PromptTemplates;
