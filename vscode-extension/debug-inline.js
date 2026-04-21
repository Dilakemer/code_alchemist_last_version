
        /**
         * ── CodeAlchemist Sidebar State Machine ──
         * This script implements a deterministic FSM with Dual Readiness and 
         * RequestId Authority to ensure UI synchronization and robustness.
         **/

        const initialState = {"selectedModel":"auto","modelOptions":[{"value":"auto","label":"Auto"}],"initialHealth":"online","initialPhase":"IDLE"};
        const vscode = acquireVsCodeApi();
        let md;

        // Elements
        const chatContainer = document.getElementById('chat-container');
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const stopBtn = document.getElementById('stop-btn');
        const resetBtn = document.getElementById('reset-btn');
        const historyBtn = document.getElementById('history-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const historyDrawer = document.getElementById('history-drawer');
        const historyList = document.getElementById('history-list');
        const historySearch = document.getElementById('history-search');
        const modelSelect = document.getElementById('model-select');
        const requestStatus = document.getElementById('request-status');
        const requestStatusText = document.getElementById('request-status-text');

        // Application State (The Single Source of Truth)
        const appState = {
            // FSM Logic
            phase: initialState.initialPhase || 'IDLE',      // 'IDLE' | 'REQUEST_INITIATED' | 'REQUEST_STREAMING' | 'REQUEST_COMPLETED' | 'REQUEST_FAILED' | 'REQUEST_CANCELLED'
            health: initialState.initialHealth || 'connecting', // 'online' | 'offline' | 'connecting'
            requestId: '',      // Current active requestId authority
            statusText: '',
            
            // Boot Sequence Gating
            ready: {
                ui: false,
                provider: false
            },

            // Persistent Context
            chatSessions: [],
            activeSessionId: '',
            selectedModel: initialState.selectedModel || 'auto',
            historySearchTerm: '',

            // Stream state
            currentAiMessageElement: null,
            currentAiBubble: null,
            currentTraceContainer: null,
            currentFullText: ''
        };

        const MAX_SESSIONS = 30;
        const GREETING = 'Merhaba! Ben **CodeAlchemist Agent**. Kodunuzu inceleyebilir, dosya değişiklikleri yapabilir ve projelerinizde size eşlik edebilirim.' +
            String.fromCharCode(10) + String.fromCharCode(10) +
            '*Nasıl yardımcı olabilirim?*';

        // ── Deterministic FSM ──
        function dispatch(action) {
            logStateTransition(action);

            switch (action.type) {
                case 'BOOT_UI_READY':
                    appState.ready.ui = true;
                    break;
                case 'RECONCILE_SNAPSHOT':
                case 'RECONCILE_EVENT':
                    if (action.payload.requestId) {
                        appState.requestId = action.payload.requestId;
                    }
                    if (action.payload.phase) {
                        appState.phase = action.payload.phase;
                    }
                    if (action.payload.health) {
                        appState.health = action.payload.health;
                    }
                    if (action.payload.text) {
                        appState.statusText = action.payload.text;
                    }
                    if (action.type === 'RECONCILE_SNAPSHOT' || action.type === 'RECONCILE_EVENT') {
                        appState.ready.provider = true;
                    }
                    break;
                case 'UX_ASK':
                    if (appState.phase !== 'IDLE') return; // Guard
                    appState.phase = 'REQUEST_INITIATED';
                    appState.statusText = 'Working...';
                    break;
                case 'IDLE':
                    appState.phase = 'IDLE';
                    appState.statusText = '';
                    break;
                case 'HEALTH_UPDATE':
                    appState.health = action.payload;
                    appState.ready.provider = true;
                    break;
            }

            syncUi();
        }

        function logStateTransition(action) {
            console.log('[' + new Date().toISOString() + '] ACTION: ' + action.type + ' -> RequestId: ' + appState.requestId + ' | Phase: ' + appState.phase);
        }

        /**
         * ── Pure Renderer ──
         * Toggles DOM states based on appState.
         **/
        function syncUi() {
            const isFullyReady = appState.ready.ui && appState.ready.provider;
            const isIdle = appState.phase === 'IDLE';
            const isOnline = appState.health === 'online';
            const canAttemptRequest = appState.health !== 'offline';
            const isBusy = !isIdle;

            // Gating interaction
            sendBtn.disabled = !isFullyReady || !isIdle || !canAttemptRequest;
            chatInput.disabled = !isFullyReady || !isIdle || !canAttemptRequest;
            if (stopBtn) {
                stopBtn.disabled = !isFullyReady || !isBusy;
                stopBtn.classList.toggle('btn-hidden', !isBusy);
            }
            sendBtn.classList.toggle('btn-hidden', isBusy);
            chatInput.placeholder = isOnline ? "Sorunuzu sorun veya '/' ile komutları görün..." : "Bakım modunda veya çevrimdışı...";
            resetBtn.disabled = !isFullyReady;
            historyBtn.disabled = !isFullyReady;
            newChatBtn.disabled = !isFullyReady;

            // Status Bar Visibility
            if (isIdle || !isFullyReady) {
                requestStatus.classList.add('hidden');
            } else {
                requestStatus.classList.remove('hidden');
                requestStatus.classList.toggle('generating', appState.phase === 'REQUEST_STREAMING');
                requestStatus.classList.toggle('error', appState.phase === 'REQUEST_FAILED');
                requestStatusText.textContent = appState.statusText || getDefaultStatusText(appState.phase);
            }

            // Health Indicator UI
            const healthIndicator = document.getElementById('health-indicator');
            const healthText = document.getElementById('health-text');
            const reconnectArea = document.getElementById('reconnect-area');

            healthIndicator.className = 'health-indicator ' + appState.health;
            healthText.textContent = appState.health.charAt(0).toUpperCase() + appState.health.slice(1);
            
            if (appState.health === 'offline') {
                reconnectArea.classList.add('visible');
            } else {
                reconnectArea.classList.remove('visible');
            }
        }

        function getDefaultStatusText(phase) {
            switch(phase) {
                case 'REQUEST_INITIATED': return 'Working...';
                case 'REQUEST_STREAMING': return 'Generating...';
                case 'REQUEST_FAILED': return 'İstek başarısız oldu.';
                default: return 'Working...';
            }
        }

        // ── Boot Sequence ──
        function init() {
            setupMessageListener(); // Call this first to not miss early provider messages
            
            try {
                if (typeof window.markdownit === 'function') {
                    md = window.markdownit({ html: true, linkify: true, typographer: true });
                } else {
                    md = { render: (t) => t };
                }
            } catch (e) {
                console.error('Markdown-it failed:', e);
                md = { render: (t) => t };
            }

            loadInitialPersistentData();
            dispatch({ type: 'BOOT_UI_READY' });
            initModelPicker();
            renderActiveSession();
            renderHistory();
            vscode.postMessage({ command: 'webviewReady' });
            setTimeout(() => {
                if (!appState.ready.provider) {
                    appState.ready.provider = true;
                    syncUi();
                    vscode.postMessage({ command: 'webviewReady' });
                }
            }, 1500);
        }

        function setupMessageListener() {
            window.addEventListener('message', event => {
                const message = event.data;
                const rid = message.requestId;

                if (rid && appState.requestId && rid !== appState.requestId && message.command !== 'STATE_SNAPSHOT') {
                    console.warn('Ignoring message for stale requestId: ' + rid);
                    return;
                }

                switch (message.command) {
                    case 'STATE_SNAPSHOT':
                        dispatch({ type: 'RECONCILE_SNAPSHOT', payload: message });
                        break;
                    case 'STATE_EVENT':
                        dispatch({ type: 'RECONCILE_EVENT', payload: message });
                        break;
                    case 'HEALTH_STATUS':
                        dispatch({ type: 'HEALTH_UPDATE', payload: message.status });
                        break;
                    case 'stream_chunk':
                        updateAiMessage(message.text);
                        break;
                    case 'trace_step':
                        addTraceStep(message.tool, message.reasoning);
                        break;
                    case 'action_found':
                        handleActionFound(message.action);
                        break;
                    case 'action_result':
                        updateActionCard(message.actionId, message.status, message.message);
                        break;
                    case 'session_deleted':
                        deleteSession(message.sessionId);
                        break;
                }
            });
        }

        function nowIso() { return new Date().toISOString(); }

        function normalizeMessage(raw) {
            const role = raw && (raw.role === 'user' || raw.role === 'ai') ? raw.role : 'ai';
            const text = typeof raw?.text === 'string' ? raw.text : '';
            const createdAt = typeof raw?.createdAt === 'string' ? raw.createdAt : nowIso();
            return { role, text, createdAt };
        }

        function createSession() {
            const id = 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            return { id, title: 'Yeni Sohbet', createdAt: nowIso(), updatedAt: nowIso(), pinned: false, messages: [] };
        }

        function normalizeSession(raw) {
            return {
                id: typeof raw?.id === 'string' ? raw.id : ('session-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
                title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title : 'Yeni Sohbet',
                createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : nowIso(),
                updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : nowIso(),
                pinned: Boolean(raw?.pinned),
                messages: Array.isArray(raw?.messages) ? raw.messages.map(normalizeMessage) : [],
            };
        }

        function getActiveSession() {
            return appState.chatSessions.find((s) => s.id === appState.activeSessionId) || null;
        }

        function persist() {
            vscode.setState({
                chatSessions: appState.chatSessions,
                activeSessionId: appState.activeSessionId,
                selectedModel: appState.selectedModel
            });
        }

        function loadInitialPersistentData() {
            const saved = vscode.getState() || {};
            appState.chatSessions = Array.isArray(saved.chatSessions) ? saved.chatSessions.map(normalizeSession) : [];
            appState.activeSessionId = typeof saved.activeSessionId === 'string' ? saved.activeSessionId : '';
            appState.selectedModel = typeof saved.selectedModel === 'string' ? saved.selectedModel : appState.selectedModel;

            if (appState.chatSessions.length === 0) {
                const s = createSession();
                appState.chatSessions.push(s);
                appState.activeSessionId = s.id;
                setDefaultGreetingIfNeeded(s);
            } else {
                const found = appState.chatSessions.some((s) => s.id === appState.activeSessionId);
                if (!found) appState.activeSessionId = appState.chatSessions[0].id;
                setDefaultGreetingIfNeeded(getActiveSession());
            }

            persist();
        }

        function renderHistory() {
            historyList.innerHTML = '';
            const query = appState.historySearchTerm.trim().toLowerCase();
            const filtered = query
                ? appState.chatSessions.filter((s) => {
                    const title = typeof s.title === 'string' ? s.title : '';
                    return title.toLowerCase().includes(query) || s.messages.some((m) => (typeof m.text === 'string' ? m.text : '').toLowerCase().includes(query));
                })
                : [...appState.chatSessions];

            const sorted = filtered.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
            
            if (sorted.length === 0) {
                historyList.innerHTML = '<div class="history-empty">Henüz sohbet yok.</div>';
                return;
            }

            for (const session of sorted) {
                const item = document.createElement('div');
                item.className = 'history-item' + (session.id === appState.activeSessionId ? ' active' : '');
                item.innerHTML = '<div class="history-item-row">' +
                    '<div class="history-main">' +
                    '<div class="history-title">' + (session.pinned ? '📌 ' : '') + escapeHtml(session.title) + '</div>' +
                    '<div class="history-meta"><span>' + session.updatedAt.split('T')[0] + '</span></div>' +
                    '</div>' +
                    '<div class="history-actions">' +
                    '<button class="history-action-btn pin-btn ' + (session.pinned ? 'pinned' : '') + '">' +
                    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg>' +
                    '</button>' +
                    '<button class="history-action-btn delete-btn">' +
                    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
                    '</button>' +
                    '</div>' +
                    '</div>';

                const pinBtn = item.querySelector('.pin-btn');
                if (pinBtn) {
                    pinBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        window.togglePinSession(session.id);
                    });
                }

                const deleteBtn = item.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        window.requestDeleteSession(session.id, session.title);
                    });
                }

                item.onclick = () => switchSession(session.id);
                historyList.appendChild(item);
            }
        }

        window.togglePinSession = (sid) => {
            const s = appState.chatSessions.find(x => x.id === sid);
            if (s) { s.pinned = !s.pinned; s.updatedAt = nowIso(); renderHistory(); persist(); }
        };

        window.requestDeleteSession = (sid, title) => {
            console.log('[CodeAlchemist] requestDeleteSession clicked: ' + sid);
            try {
                vscode.postMessage({ command: 'requestDeleteSession', sessionId: sid, title });
            } catch (e) {
                console.error('[CodeAlchemist] postMessage failed for requestDeleteSession:', e);
            }
        };

        function deleteSession(sid) {
            appState.chatSessions = appState.chatSessions.filter(s => s.id !== sid);
            if (appState.chatSessions.length === 0) {
                const s = createSession();
                setDefaultGreetingIfNeeded(s);
                appState.chatSessions.push(s);
                appState.activeSessionId = s.id;
            } else if (appState.activeSessionId === sid) {
                appState.activeSessionId = appState.chatSessions[0].id;
            }
            renderActiveSession();
            renderHistory();
            persist();
        }

        function switchSession(sid) {
            appState.activeSessionId = sid;
            historyDrawer.classList.remove('open');
            renderActiveSession();
            renderHistory();
            persist();
        }

        const DEFAULT_FALLBACK_MODELS = [
            { value: 'auto', label: 'Auto (Smart Model)' },
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
            { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' }
        ];

        function initModelPicker() {
            modelSelect.innerHTML = '';
            const options = (initialState.modelOptions && initialState.modelOptions.length > 0) 
                ? initialState.modelOptions 
                : DEFAULT_FALLBACK_MODELS;
            
            for (const opt of options) {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.label;
                el.selected = opt.value === appState.selectedModel;
                modelSelect.appendChild(el);
            }
            modelSelect.onchange = () => {
                appState.selectedModel = modelSelect.value;
                persist();
                vscode.postMessage({ command: 'setModel', model: appState.selectedModel });
            };
        }

        function escapeHtml(s) { 
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); 
        }

        function renderActiveSession() {
            chatContainer.innerHTML = '';
            appState.currentAiMessageElement = null;
            appState.currentAiBubble = null;
            appState.currentTraceContainer = null;
            appState.currentFullText = '';
            const session = getActiveSession();
            if (session) {
                setDefaultGreetingIfNeeded(session);
            }
            if (session) session.messages.forEach(m => addMessage(m.text, m.role, false));
        }

        function setDefaultGreetingIfNeeded(session) {
            if (session && session.messages.length === 0) {
                session.messages.push({ role: 'ai', text: GREETING, createdAt: nowIso() });
            }
        }

        function addMessage(text, role, shouldPersist = true) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ' + role;
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble markdown-body';
            const safeText = typeof text === 'string' ? text : '';
            if (role === 'user') bubble.textContent = safeText;
            else {
                bubble.innerHTML = md.render(safeText);
                appState.currentFullText = safeText;
                appState.currentAiMessageElement = msgDiv;
                appState.currentAiBubble = bubble;
            }
            msgDiv.appendChild(bubble);
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            if (shouldPersist) {
                const session = getActiveSession();
                if (session) {
                    session.messages.push({ role, text: safeText, createdAt: nowIso() });
                    if (role === 'user' && session.title === 'Yeni Sohbet') session.title = safeText.slice(0, 40);
                    session.updatedAt = nowIso();
                    renderHistory();
                    persist();
                }
            }
            return bubble;
        }

        function updateAiMessage(chunk) {
            if (!appState.currentAiBubble) addMessage('', 'ai');
            appState.currentFullText += chunk;
            appState.currentAiBubble.innerHTML = md.render(appState.currentFullText);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            const session = getActiveSession();
            if (session && session.messages.length > 0) {
                const last = session.messages[session.messages.length - 1];
                if (last.role === 'ai') { last.text = appState.currentFullText; persist(); }
            }
        }

        function addTraceStep(tool, reasoning) {
            if (!appState.currentAiMessageElement) addMessage('', 'ai');
            if (!appState.currentTraceContainer) {
                appState.currentTraceContainer = document.createElement('div');
                appState.currentTraceContainer.className = 'trace-container';
                appState.currentAiMessageElement.appendChild(appState.currentTraceContainer);
            }
            const item = document.createElement('div');
            item.className = 'trace-item active';
            item.innerHTML = '<span class="trace-icon-dot"></span><div class="trace-flex"><div class="trace-main"><span class="trace-tool">' + escapeHtml(tool) + '</span></div><div class="trace-sub">' + escapeHtml(reasoning) + '</div></div>';
            const prev = appState.currentTraceContainer.querySelector('.active');
            if (prev) prev.classList.remove('active');
            appState.currentTraceContainer.appendChild(item);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function handleActionFound(action) {
            if (action.action === 'edit_file') addActionCard(action);
            else if (action.action === 'multi_edit') action.changes.forEach(c => addActionCard({ ...c, action: 'edit_file' }));
        }

        function bindActionCardButtons(card, cardId) {
            const keepBtn = card.querySelector('.action-keep-btn');
            if (keepBtn) {
                keepBtn.addEventListener('click', () => window.resolveCard(cardId, 'accept'));
            }

            const discardBtn = card.querySelector('.action-discard-btn');
            if (discardBtn) {
                discardBtn.addEventListener('click', () => window.resolveCard(cardId, 'reject'));
            }

            const previewBtn = card.querySelector('.action-preview-btn');
            if (previewBtn) {
                previewBtn.addEventListener('click', () => window.previewAction(cardId));
            }

            const undoBtn = card.querySelector('.action-undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => window.resolveCard(cardId, 'undo'));
            }
        }

        function addActionCard(action) {
            const cardId = 'card-' + Math.random().toString(36).slice(2, 9);
            const card = document.createElement('div');
            card.className = 'action-card';
            card.dataset.actionId = cardId;
            const renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
            card.innerHTML = '<div class="action-header"><div class="action-title"><span>File Change</span></div></div>' +
                '<div class="action-status">' + escapeHtml(action.file) + '</div>' +
                '<div class="action-footer">' +
                    '<button class="btn btn-primary action-keep-btn">Keep</button>' +
                    '<button class="btn btn-secondary action-discard-btn">Discard</button>' +
                    '<button class="btn btn-secondary action-preview-btn">Preview</button>' +
                    renderBtn +
                '</div>';
            card._actionData = action;
            bindActionCardButtons(card, cardId);
            appState.currentAiMessageElement.appendChild(card);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        window.resolveCard = (cid, decision) => {
            console.log('[CodeAlchemist] resolveCard clicked: ' + cid + ' -> ' + decision);
            const card = document.querySelector('[data-action-id="' + cid + '"]');
            if (!card) {
                console.warn('[CodeAlchemist] resolveCard: Card ' + cid + ' not found.');
                return;
            }
            try {
                vscode.postMessage({ command: 'resolveAction', decision, action: card._actionData, actionId: cid });
            } catch (e) {
                console.error('[CodeAlchemist] postMessage failed for resolveCard:', e);
            }
        };

        window.previewAction = (cid) => {
            console.log('[CodeAlchemist] previewAction clicked: ' + cid);
            const card = document.querySelector('[data-action-id="' + cid + '"]');
            if (!card) {
                console.warn('[CodeAlchemist] previewAction: Card ' + cid + ' not found.');
                return;
            }
            try {
                vscode.postMessage({ command: 'applyAction', action: card._actionData });
            } catch (e) {
                console.error('[CodeAlchemist] postMessage failed for previewAction:', e);
            }
        };

        function updateActionCard(aid, status, msg) {
            console.log('[CodeAlchemist] updateActionCard: ' + aid + ' -> ' + status);
            const card = document.querySelector('[data-action-id="' + aid + '"]');
            if (!card) return;
            card.querySelector('.action-status').textContent = msg || status;
            card.className = 'action-card ' + (status === 'applied' ? 'is-applied' : status === 'rejected' ? 'is-rejected' : status === 'reverted' ? '' : 'is-error');
            
            if (status === 'applied') {
                const footer = card.querySelector('.action-footer');
                footer.innerHTML = '<button class="btn btn-secondary action-undo-btn">Undo</button>';
                const action = card._actionData;
                if (action && action.render_url) {
                    footer.innerHTML += '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>';
                }
                bindActionCardButtons(card, aid);
            } else if (status === 'reverted') {
                const action = card._actionData;
                const renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
                card.querySelector('.action-footer').innerHTML = 
                    '<button class="btn btn-primary action-keep-btn">Keep</button>' +
                    '<button class="btn btn-secondary action-discard-btn">Discard</button>' +
                    '<button class="btn btn-secondary action-preview-btn">Preview</button>' +
                    renderBtn;
                bindActionCardButtons(card, aid);
            } else {
                card.querySelectorAll('button').forEach(b => b.disabled = true);
            }
        }

        function sendMsg() {
            const text = chatInput.value.trim();
            if (!text || appState.phase !== 'IDLE') return;
            addMessage(text, 'user');
            // Start a fresh AI container for this request before streaming begins.
            addMessage('', 'ai');
            chatInput.value = '';
            dispatch({ type: 'UX_ASK' });
            vscode.postMessage({ command: 'ask', text, model: appState.selectedModel });
        }

        if (sendBtn) {
            sendBtn.onclick = sendMsg;
        }
        if (stopBtn) {
            stopBtn.onclick = () => {
                vscode.postMessage({ command: 'stopAsk' });
            };
        }
        if (chatInput) {
            chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
        }
        if (newChatBtn) {
            newChatBtn.onclick = () => {
            const s = createSession();
            setDefaultGreetingIfNeeded(s);
            appState.chatSessions.unshift(s);
            appState.activeSessionId = s.id;
            renderActiveSession();
            renderHistory();
            persist();
            };
        }
        if (resetBtn) {
            resetBtn.onclick = () => {
            const s = getActiveSession();
            if (s) { s.messages = []; setDefaultGreetingIfNeeded(s); s.title='Yeni Sohbet'; renderActiveSession(); renderHistory(); persist(); }
            };
        }
        if (historyBtn && historyDrawer && historySearch) {
            historyBtn.onclick = () => { historyDrawer.classList.toggle('open'); if(historyDrawer.classList.contains('open')) historySearch.focus(); };
        }
        if (historySearch) {
            historySearch.oninput = () => { appState.historySearchTerm = historySearch.value; renderHistory(); };
        }

        const reconnectBtn = document.getElementById('reconnect-btn');
        if (reconnectBtn) {
            reconnectBtn.onclick = () => {
                dispatch({ type: 'HEALTH_UPDATE', payload: 'connecting' });
                vscode.postMessage({ command: 'healthCheck' });
            };
        }

        init();
    