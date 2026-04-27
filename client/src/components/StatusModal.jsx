import React from 'react';
import { createPortal } from 'react-dom';

const StatusModal = ({ isOpen, onClose, message, type = 'info' }) => {
    if (!isOpen) return null;

    const getConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ),
                    bgColor: 'bg-emerald-900/30',
                    borderColor: 'border-emerald-500/50',
                    title: 'Başarılı',
                    buttonClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/20'
                };
            case 'error':
                return {
                    icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ),
                    bgColor: 'bg-red-900/30',
                    borderColor: 'border-red-500/50',
                    title: 'Hata',
                    buttonClass: 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-red-900/20'
                };
            default:
                return {
                    icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ),
                    bgColor: 'bg-sky-900/30',
                    borderColor: 'border-sky-500/50',
                    title: 'Bilgi',
                    buttonClass: 'bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 shadow-fuchsia-900/20'
                };
        }
    };

    const config = getConfig();

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto"
            role="alert"
            aria-modal="true"
        >
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={onClose}
            />
            
            <div 
                className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors"
                    aria-label="Kapat"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center">
                    <div className={`w-20 h-20 rounded-2xl ${config.bgColor} flex items-center justify-center mx-auto mb-6 border ${config.borderColor} shadow-inner`}>
                        {config.icon}
                    </div>

                    <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                        {config.title}
                    </h3>
                    <p className="text-slate-400 mb-8 text-sm font-medium leading-relaxed">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        autoFocus
                        className={`w-full ${config.buttonClass} text-white py-3.5 rounded-xl font-black transition-all shadow-lg active:scale-95`}
                    >
                        Tamam
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default StatusModal;
