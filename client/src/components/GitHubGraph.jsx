import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import html2pdf from 'html2pdf.js';
import ReactMarkdown from 'react-markdown';

const GitHubGraph = ({ repo, branch, conversationId, onClose, apiBase, authHeaders }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState("");
    const [fileLoading, setFileLoading] = useState(false);
    const [hoverNode, setHoverNode] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportData, setExportData] = useState(null);
    const containerRef = useRef();
    const pdfContentRef = useRef();

    const highlightNodes = useMemo(() => {
        const nodes = new Set();
        const activeNode = hoverNode || selectedFile;
        if (activeNode) {
            nodes.add(activeNode.id);
            graphData.links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                if (sourceId === activeNode.id) nodes.add(targetId);
                if (targetId === activeNode.id) nodes.add(sourceId);
            });
        }
        return nodes;
    }, [hoverNode, selectedFile, graphData]);

    const highlightLinks = useMemo(() => {
        const links = new Set();
        const activeNode = hoverNode || selectedFile;
        if (activeNode) {
            graphData.links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                if (sourceId === activeNode.id || targetId === activeNode.id) {
                    links.add(`${sourceId}-${targetId}`);
                }
            });
        }
        return links;
    }, [hoverNode, selectedFile, graphData]);

    useEffect(() => {
        const fetchTree = async () => {
            try {
                // Fetch tree from our backend proxy endpoint
                let url = `${apiBase}/api/github/tree?`;
                if (repo) {
                    url += `repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch || 'main')}`;
                    if (conversationId && conversationId !== 'null') {
                        url += `&conversation_id=${conversationId}`;
                    }
                } else if (conversationId && conversationId !== 'null') {
                    url += `conversation_id=${conversationId}`;
                } else {
                    throw new Error("Repository or Conversation ID required to load graph.");
                }

                const res = await fetch(url, {
                    headers: authHeaders
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to fetch tree from backend");
                }

                const data = await res.json();
                const tree = data.tree;

                // Construct nodes and links
                const nodes = [{ id: repo, name: repo, type: 'root', val: 10 }];
                const links = [];
                const nodeSet = new Set([repo]);

                tree.forEach(item => {
                    const parts = item.path.split('/');
                    let currentPath = '';
                    let parentId = repo;

                    parts.forEach((part, index) => {
                        currentPath = currentPath ? `${currentPath}/${part}` : part;

                        if (!nodeSet.has(currentPath)) {
                            nodes.push({
                                id: currentPath,
                                name: part,
                                type: index === parts.length - 1 && item.type === 'blob' ? 'file' : 'dir',
                                val: index === parts.length - 1 && item.type === 'blob' ? 3 : 5
                            });
                            nodeSet.add(currentPath);
                        }

                        links.push({
                            source: parentId,
                            target: currentPath
                        });

                        parentId = currentPath;
                    });
                });

                // Deduplicate links
                const uniqueLinks = [];
                const linkSet = new Set();
                links.forEach(l => {
                    const key = `${l.source}-${l.target}`;
                    if (!linkSet.has(key)) {
                        linkSet.add(key);
                        uniqueLinks.push(l);
                    }
                });

                setGraphData({ nodes, links: uniqueLinks });
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchTree();
    }, [repo, branch]);

    const handleNodePaint = useCallback((node, ctx, globalScale) => {
        const label = node.name;
        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;

        const isHighlighted = highlightNodes.has(node.id);
        const isSelected = selectedFile && selectedFile.id === node.id;

        // Base colors
        let color = node.type === 'root' ? '#ec4899' : (node.type === 'dir' ? '#3b82f6' : '#9ca3af');

        if (highlightNodes.size > 0 && !isHighlighted) {
            color = 'rgba(255,255,255,0.1)'; // Dim inactive nodes
        } else if (isSelected) {
            color = '#22c55e'; // Green for selected file
        } else if (isHighlighted && node.id !== (hoverNode?.id || selectedFile?.id)) {
            color = '#f59e0b'; // Amber for connected nodes
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, isSelected ? node.val * 1.5 : node.val, 0, 2 * Math.PI, false);
        ctx.fill();

        // Node labels
        if (globalScale > 1.5 || node.type === 'root' || node.type === 'dir' || isHighlighted) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isHighlighted ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)';
            ctx.fillText(label, node.x, node.y + node.val + 2);
        }
    }, [highlightNodes, selectedFile, hoverNode]);

    const handleNodeClick = useCallback(async (node) => {
        if (node.type !== 'file') return;

        setSelectedFile(node);
        setFileLoading(true);
        setFileContent("");

        try {
            const res = await fetch(`${apiBase}/api/github/file?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch || 'main')}&path=${encodeURIComponent(node.id)}`, {
                headers: authHeaders
            });

            if (!res.ok) throw new Error("Failed to fetch file");
            const data = await res.json();
            setFileContent(data.content || "");
        } catch (err) {
            console.error(err);
            setFileContent("Error loading file content.");
        } finally {
            setFileLoading(false);
        }
    }, [repo, branch, apiBase, authHeaders]);

    const handleExportBlueprint = async () => {
        setIsExporting(true);
        try {
            const res = await fetch(`${apiBase}/api/github/blueprint?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch || 'main')}`, {
                headers: authHeaders
            });

            if (!res.ok) throw new Error("Failed to generate blueprint");
            const data = await res.json();

            // Set data to render it invisibly for PDF generator
            setExportData(data.markdown);

            // Wait for React to render the markdown in the DOM
            setTimeout(() => {
                if (pdfContentRef.current) {
                    const opt = {
                        margin: 10,
                        filename: `${repo.split('/').pop()}-blueprint.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    html2pdf().set(opt).from(pdfContentRef.current).save().then(() => {
                        setIsExporting(false);
                        setExportData(null);
                    });
                } else {
                    setIsExporting(false);
                    setExportData(null);
                }
            }, 500);

        } catch (err) {
            console.error(err);
            alert("Error exporting blueprint: " + err.message);
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/50">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-pink-500">🌌</span> Architecture Graph
                    </h2>
                    <p className="text-xs text-gray-400">{repo} ({branch})</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportBlueprint}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
                    >
                        {isExporting ? (
                            <>
                                <span className="animate-spin text-lg">⚙️</span> Generating...
                            </>
                        ) : (
                            <>
                                <span className="text-lg">📄</span> Export Blueprint (PDF)
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={`flex-1 relative flex ${selectedFile ? 'flex-row' : ''}`}>
                <div className={`relative ${selectedFile ? 'w-2/3 border-r border-white/10' : 'w-full h-full'}`} ref={containerRef}>
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                            <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                            <p className="text-pink-400 font-mono text-sm animate-pulse">Mapping repository universe...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-red-500/20 text-red-400 px-6 py-4 rounded-xl border border-red-500/50">
                                Failed to load graph: {error}
                            </div>
                        </div>
                    )}

                    {!loading && !error && (
                        <ForceGraph2D
                            graphData={graphData}
                            nodeCanvasObject={handleNodePaint}
                            onNodeClick={handleNodeClick}
                            onNodeHover={(node) => setHoverNode(node)}
                            linkColor={(link) => {
                                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                                return highlightLinks.has(`${sourceId}-${targetId}`) ? '#f59e0b' : 'rgba(255,255,255,0.1)';
                            }}
                            linkWidth={(link) => {
                                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                                return highlightLinks.has(`${sourceId}-${targetId}`) ? 2 : 1;
                            }}
                            backgroundColor="#050505"
                            width={containerRef.current?.clientWidth}
                            height={containerRef.current?.clientHeight}
                            nodeLabel="id"
                            d3Force={(d3, force) => {
                                force('charge').strength(-50);
                                force('link').distance(40);
                            }}
                        />
                    )}
                </div>

                {selectedFile && (
                    <div className="w-1/3 bg-[#0a0a0a] flex flex-col h-full z-10 overflow-hidden relative">
                        <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/40">
                            <h3 className="text-white font-mono text-sm truncate">{selectedFile.id}</h3>
                            <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                            {fileLoading ? (
                                <div className="p-6 text-gray-400 animate-pulse font-mono text-sm">Loading code...</div>
                            ) : (
                                <SyntaxHighlighter
                                    language={selectedFile.name.split('.').pop() || 'text'}
                                    style={vscDarkPlus}
                                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                                    showLineNumbers={true}
                                >
                                    {fileContent}
                                </SyntaxHighlighter>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 border border-white/10 px-6 py-2 rounded-full text-xs text-gray-400 flex gap-4 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pink-500" /> Root</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Directory</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400" /> File</div>
                <div className="ml-4 pl-4 border-l border-white/10">Mouse wheel to zoom, drag to pan/move nodes</div>
            </div>

            {/* Hidden container for PDF export */}
            {exportData && (
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '210mm' }}>
                    <div ref={pdfContentRef} className="p-10 bg-white text-black font-sans markdown-body prose prose-slate max-w-none">
                        <style>
                            {`
                                .markdown-body h1 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.3em; }
                                .markdown-body h2 { color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; margin-top: 1.5em; }
                                .markdown-body h3 { color: #475569; }
                                .markdown-body p, .markdown-body li { color: #334155; line-height: 1.6; }
                                .markdown-body code { background: #f1f5f9; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
                                .markdown-body pre { background: #f8fafc; padding: 1em; border-radius: 6px; overflow-x: auto; border: 1px solid #e2e8f0; }
                            `}
                        </style>
                        <ReactMarkdown>{exportData}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GitHubGraph;
