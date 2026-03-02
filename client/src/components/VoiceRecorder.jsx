import React, { useState, useRef, useEffect } from 'react';

const VoiceRecorder = ({ onRecordComplete, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                onRecordComplete(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Microphone access denied or not available.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <div className={`flex items-center transition-all duration-300 ${isRecording ? 'gap-3 bg-gray-900/80 backdrop-blur-md border border-fuchsia-500/30 p-2 px-4 rounded-full shadow-lg h-[40px] animate-fadeIn' : ''}`}>
            {isRecording ? (
                <>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-75" />
                        </div>
                        <span className="text-xs font-mono text-red-400">{formatTime(recordingTime)}</span>
                    </div>

                    {/* Visualizer Mockup (Alchemist Bubbles) */}
                    <div className="flex gap-1 h-4 items-center px-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div
                                key={i}
                                className="w-1 bg-fuchsia-400 rounded-full animate-bounce"
                                style={{
                                    height: `${Math.random() * 100}%`,
                                    animationDuration: `${0.5 + Math.random()}s`,
                                    animationDelay: `${i * 0.1}s`
                                }}
                            />
                        ))}
                    </div>

                    <button
                        onClick={stopRecording}
                        className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white p-1.5 rounded-full transition-all group"
                        title="Stop Recording"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <rect x="6" y="6" width="8" height="8" rx="1" />
                        </svg>
                    </button>
                    {onCancel && (
                        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 ml-1" title="Cancel">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </>
            ) : (
                <button
                    onClick={startRecording}
                    className="p-2 text-gray-400 hover:text-fuchsia-400 hover:bg-gray-800/50 rounded-lg transition-colors"
                    title="Voice Alchemy Message"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default VoiceRecorder;
