import React, { useEffect, useState } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

const CodeHealthDashboard = ({ repo, branch, onClose, apiBase, authHeaders }) => {
    const [metrics, setMetrics] = useState(null);
    const [narrative, setNarrative] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [typingNarrative, setTypingNarrative] = useState("");

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch(`${apiBase}/api/github/health?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch || 'main')}`, {
                    headers: authHeaders
                });

                if (!res.ok) throw new Error("Failed to fetch health metrics");
                const data = await res.json();

                // Animate progress bars entry
                setTimeout(() => {
                    setMetrics(data.metrics);
                }, 500);

                setNarrative(data.narrative);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchHealth();
    }, [repo, branch, apiBase, authHeaders]);

    // Typing effect for the AI Narrative
    useEffect(() => {
        if (!narrative) return;
        let i = 0;
        setTypingNarrative("");
        const interval = setInterval(() => {
            setTypingNarrative(prev => prev + narrative.charAt(i));
            i++;
            if (i >= narrative.length) clearInterval(interval);
        }, 30); // 30ms per character for Cyberpunk terminal feel

        return () => clearInterval(interval);
    }, [narrative]);

    const getColorForScore = (score) => {
        if (score >= 80) return '#22c55e'; // Green
        if (score >= 60) return '#eab308'; // Yellow
        return '#ef4444'; // Red
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[110] flex items-center justify-center p-4 selection:bg-pink-500/30 font-mono">
            {/* Ambient background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-cyan-900/20 blur-[120px] rounded-full point-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-fuchsia-900/20 blur-[100px] rounded-full point-events-none" />

            <div className="relative w-full max-w-4xl bg-gray-900/80 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col items-center">

                {/* Header */}
                <div className="w-full flex justify-between items-center p-4 border-b border-cyan-500/20 bg-black/50">
                    <div className="flex items-center gap-3">
                        <span className="text-cyan-400 animate-pulse">⚡</span>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-widest uppercase">
                            SYSTEM HEALTH
                        </h2>
                    </div>
                    <div className="text-xs text-cyan-700 uppercase tracking-widest">{repo} • {branch}</div>
                    <button
                        onClick={onClose}
                        className="p-2 text-cyan-500 hover:text-white hover:bg-cyan-500/20 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {loading && (
                    <div className="flex flex-col items-center justify-center p-20 gap-6 w-full">
                        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-[spin_1s_linear_infinite]" />
                        <p className="text-cyan-400/70 text-sm tracking-[0.2em] animate-pulse">INITIALIZING NEURAL LINK...</p>
                    </div>
                )}

                {error && (
                    <div className="p-10 w-full text-center">
                        <div className="inline-block border border-red-500/50 bg-red-900/20 text-red-400 px-6 py-4 rounded-lg">
                            <span className="font-bold">CRITICAL FAILURE:</span> {error}
                        </div>
                    </div>
                )}

                {!loading && !error && (
                    <div className="w-full flex justify-center items-center py-12 px-8 gap-12 border-b border-white/5 bg-gradient-to-b from-transparent to-black/40">
                        {/* Gauge 1: Security */}
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="w-36 h-36 transition-transform group-hover:scale-105 duration-500">
                                <CircularProgressbar
                                    value={metrics?.security || 0}
                                    text={`${metrics?.security || 0}`}
                                    strokeWidth={8}
                                    styles={buildStyles({
                                        textColor: '#fff',
                                        pathColor: getColorForScore(metrics?.security),
                                        trailColor: 'rgba(255,255,255,0.05)',
                                        pathTransitionDuration: 1.5,
                                    })}
                                />
                            </div>
                            <div className="text-sm font-semibold text-gray-400 tracking-wider">SECURITY</div>
                        </div>

                        {/* Gauge 2: Test Coverage */}
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="w-36 h-36 transition-transform group-hover:scale-105 duration-500">
                                <CircularProgressbar
                                    value={metrics?.test_coverage || 0}
                                    text={`${metrics?.test_coverage || 0}`}
                                    strokeWidth={8}
                                    styles={buildStyles({
                                        textColor: '#fff',
                                        pathColor: getColorForScore(metrics?.test_coverage),
                                        trailColor: 'rgba(255,255,255,0.05)',
                                        pathTransitionDuration: 1.8,
                                    })}
                                />
                            </div>
                            <div className="text-sm font-semibold text-gray-400 tracking-wider">COVERAGE</div>
                        </div>

                        {/* Gauge 3: Readability */}
                        <div className="flex flex-col items-center gap-4 group">
                            <div className="w-36 h-36 transition-transform group-hover:scale-105 duration-500">
                                <CircularProgressbar
                                    value={metrics?.readability || 0}
                                    text={`${metrics?.readability || 0}`}
                                    strokeWidth={8}
                                    styles={buildStyles({
                                        textColor: '#fff',
                                        pathColor: getColorForScore(metrics?.readability),
                                        trailColor: 'rgba(255,255,255,0.05)',
                                        pathTransitionDuration: 2.1,
                                    })}
                                />
                            </div>
                            <div className="text-sm font-semibold text-gray-400 tracking-wider">READABILITY</div>
                        </div>
                    </div>
                )}

                {/* AI Narrator Output */}
                {!loading && !error && (
                    <div className="w-full bg-black/80 p-6 flex flex-col gap-2 min-h-[120px] relative overflow-hidden">
                        {/* Scanline effect */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-50 z-10" />

                        <div className="text-xs text-fuchsia-500 font-bold tracking-widest uppercase mb-1 flex items-center gap-2">
                            <div className="w-2 h-2 bg-fuchsia-500 rounded-full animate-ping" />
                            OMNI-NET REPORT
                        </div>
                        <p className="text-sm text-green-400 leading-relaxed font-mono drop-shadow-[0_0_2px_rgba(74,222,128,0.5)] z-20">
                            <span className="text-emerald-300 mr-2">{'>'}</span>
                            {typingNarrative}
                            <span className="animate-pulse bg-green-400 w-2 h-4 inline-block align-middle ml-1" />
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
};

export default CodeHealthDashboard;
