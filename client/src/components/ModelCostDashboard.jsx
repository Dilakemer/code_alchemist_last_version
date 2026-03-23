import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend
} from 'recharts';

const MODEL_PRICING = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'gemini-1.5-pro': { input: 0.00, output: 0.00 }, // Free tier requested by user
  'gemini-1.5-flash': { input: 0.00, output: 0.00 }, // Free tier
  'gemini-2.0-flash': { input: 0.00, output: 0.00 }, // Free tier
  'gemini-2.5-flash': { input: 0.00, output: 0.00 }, // Free tier
  'dall-e-3': { cost_per_img: 0.040 },
  'Unknown': { input: 0, output: 0 }
};

const COLORS = ['#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'];

const ModelCostDashboard = ({ onClose, apiBase, authHeaders }) => {
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const resp = await fetch(`${apiBase || ''}/api/stats/model-usage`, {
          headers: authHeaders || {}
        });
        if (!resp.ok) throw new Error('Failed to fetch stats');
        const data = await resp.json();

        if (data?.stats) {
          const AVG_INPUT_TOKENS = 500;
          const AVG_OUTPUT_TOKENS = 300;

          const enriched = data.stats.map(s => {
            const pricing = MODEL_PRICING[s.model] || MODEL_PRICING['Unknown'];
            let cost = 0;
            if (pricing.cost_per_img) {
              cost = s.count * pricing.cost_per_img;
            } else {
              cost = (s.count * AVG_INPUT_TOKENS * pricing.input / 1000000) +
                (s.count * AVG_OUTPUT_TOKENS * pricing.output / 1000000);
            }
            return { ...s, cost: parseFloat(cost.toFixed(4)) };
          });
          setStats(enriched);
        }
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const totalCost = stats.reduce((acc, s) => acc + s.cost, 0);
  const totalRequests = stats.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#1e1e1e] border border-gray-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-fuchsia-900/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-600 flex items-center justify-center shadow-lg shadow-fuchsia-600/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">AI Model Cost Dashboard</h2>
              <p className="text-xs text-gray-400">Monitor your LLM resource consumption and estimated costs</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-fuchsia-600/30 border-t-fuchsia-600 rounded-full animate-spin"></div>
              <p className="text-gray-400 animate-pulse">Aggregating consumption data...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-400 font-medium">Ops! Something went wrong.</p>
              <p className="text-sm text-gray-500 max-w-xs">{error.message}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-fuchsia-600/10 to-transparent border border-fuchsia-600/20 p-6 rounded-2xl">
                  <p className="text-sm text-fuchsia-300 font-medium mb-1 uppercase tracking-wider">Total Estimated Cost</p>
                  <p className="text-4xl font-black text-white">${totalCost.toFixed(2)}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                    </svg>
                    <span>Calculated based on actual API usage</span>
                  </div>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 p-6 rounded-2xl">
                  <p className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">Total AI Requests</p>
                  <p className="text-4xl font-black text-white">{totalRequests}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    <span>Across {stats.length} different models</span>
                  </div>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 p-6 rounded-2xl">
                  <p className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">Most Active Model</p>
                  <p className="text-2xl font-black text-white truncate">
                    {stats.sort((a,b) => b.count - a.count)[0]?.model || 'None'}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-fuchsia-400">
                    <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></div>
                    <span>{stats.sort((a,b) => b.count - a.count)[0]?.count || 0} calls processed</span>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribution Chart */}
                <div className="bg-gray-800/20 border border-gray-700 p-6 rounded-2xl h-[350px]">
                  <h3 className="text-sm font-bold text-gray-300 mb-6 flex items-center gap-2 uppercase tracking-wide">
                    <span className="w-1 h-4 bg-fuchsia-600 rounded-full"></span>
                    Usage Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={stats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="model" stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#d946ef' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Cost Pie Chart */}
                <div className="bg-gray-800/20 border border-gray-700 p-6 rounded-2xl h-[350px]">
                  <h3 className="text-sm font-bold text-gray-300 mb-6 flex items-center gap-2 uppercase tracking-wide">
                    <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                    Cost Contribution ($)
                  </h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie
                        data={stats}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="cost"
                        nameKey="model"
                      >
                        {stats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="bg-gray-800/20 border border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900/50 text-gray-400 font-medium uppercase text-[10px] tracking-widest border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-4">AI Model</th>
                      <th className="px-6 py-4">Request Count</th>
                      <th className="px-6 py-4">Est. Avg Cost</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {stats.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-700/30 transition-colors group">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border border-gray-700 group-hover:border-fuchsia-500/50 transition-colors`} style={{ color: COLORS[idx % COLORS.length] }}>
                            {row.model.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-200 font-medium">{row.model}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300">{row.count} reqs</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white font-mono font-bold">${row.cost.toFixed(3)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-900/40 text-green-400 border border-green-800/50">
                            OPTIMIZED
                          </span>
                        </td>
                      </tr>
                    ))}
                    {stats.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500 italic">
                          No AI usage data recorded in current session history.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-900/80 border-t border-gray-700 flex justify-between items-center">
          <p className="text-xs text-gray-500 italic">
            * Costs are estimates based on standard Tier 1 pricing. Actual billing may vary.
          </p>
          <button 
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all border border-gray-700"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelCostDashboard;
