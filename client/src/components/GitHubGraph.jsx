import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GitHubGraph = ({ repo, branch, conversationId, onClose, apiBase, authHeaders }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const containerRef = useRef();

    useEffect(() => {
        const fetchTree = async () => {
            try {
                // Fetch tree from our backend proxy endpoint
                const url = `${apiBase}/api/github/tree?conversation_id=${conversationId}`;
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

        ctx.fillStyle = node.type === 'root' ? '#ec4899' : (node.type === 'dir' ? '#3b82f6' : '#9ca3af');
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
        ctx.fill();

        // Node labels
        if (globalScale > 1.5 || node.type === 'root' || node.type === 'dir') {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.fillText(label, node.x, node.y + node.val + 2);
        }
    }, []);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/50">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-pink-500">🌌</span> Architecture Graph
                    </h2>
                    <p className="text-xs text-gray-400">{repo} ({branch})</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 relative" ref={containerRef}>
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
                        linkColor={() => 'rgba(255,255,255,0.1)'}
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

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 border border-white/10 px-6 py-2 rounded-full text-xs text-gray-400 flex gap-4 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pink-500" /> Root</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Directory</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400" /> File</div>
                <div className="ml-4 pl-4 border-l border-white/10">Mouse wheel to zoom, drag to pan/move nodes</div>
            </div>
        </div>
    );
};

export default GitHubGraph;
