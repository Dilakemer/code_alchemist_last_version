
        (function() {
            window.onerror = function(msg, url, line, col, error) {
                var err = "[Webview:ERROR:B4] " + msg + " at " + line + ":" + col;
                console.error(err);
                if (window.vscode) window.vscode.postMessage({ command: 'DEBUG_LOG', message: err });
            };
            console.log('[Webview:Boot] Block 4 Shell Active');

            var vscode = window.vscode;
            var appState = window.appState;
            var logToProvider = window.logToProvider;
            var GREETING = window.GREETING;
            var SLASH_COMMANDS = window.SLASH_COMMANDS;
            var md = null;

            // Elements
            var chatContainer = document.getElementById('chat-container');
            var chatInput = document.getElementById('chat-input');
            var sendBtn = document.getElementById('send-btn');
            var stopBtn = document.getElementById('stop-btn');
            var resetBtn = document.getElementById('reset-btn');
            var historyBtn = document.getElementById('history-btn');
            var newChatBtn = document.getElementById('new-chat-btn');
            var historyDrawer = document.getElementById('history-drawer');
            var historyList = document.getElementById('history-list');
            var modelSelect = document.getElementById('model-select');
            var requestStatus = document.getElementById('request-status');
            var requestStatusText = document.getElementById('request-status-text');
            var slashSuggest = document.getElementById('slash-suggest');
            var logoutBtn = document.getElementById('logout-btn');
            var authCta = document.getElementById('auth-cta');
            var authLoginBtn = document.getElementById('auth-login-btn');
            var tokenBadge = document.getElementById('token-badge');
            var tokenBalanceEl = document.getElementById('token-balance');

            var slashSelectionIndex = 0;
            var slashVisibleItems = [];

            // ── FSM Logic ──
            function dispatch(action) {
                logStateTransition(action);
                switch (action.type) {
                    case 'BOOT_UI_READY': appState.ready.ui = true; break;
                    case 'RECONCILE_SNAPSHOT':
                    case 'RECONCILE_EVENT':
                        if (appState.phase === 'REQUEST_CANCELLED' && action.payload && action.payload.requestId === appState.requestId && (action.payload.phase === 'REQUEST_INITIATED' || action.payload.phase === 'REQUEST_STREAMING')) break;
                        if (action.payload.requestId) appState.requestId = action.payload.requestId;
                        if (action.payload.phase) {
                            appState.phase = action.payload.phase;
                            if (action.payload.phase === 'IDLE') appState.requestId = '';
                        }
                        if (action.payload.health) appState.health = action.payload.health;
                        if (action.payload.text) appState.statusText = action.payload.text;
                        else if (action.payload.phase === 'REQUEST_CANCELLED') appState.statusText = 'Yan\\u0131t durduruluyor...';
                        if (action.type === 'RECONCILE_SNAPSHOT' || action.type === 'RECONCILE_EVENT') appState.ready.provider = true;
                        break;
                    case 'UX_ASK':
                        if (appState.phase !== 'IDLE') return;
                        appState.phase = 'REQUEST_INITIATED';
                        appState.statusText = 'Working...';
                        break;
                    case 'IDLE': appState.phase = 'IDLE'; appState.statusText = ''; break;
                    case 'HEALTH_UPDATE': appState.health = action.payload; appState.ready.provider = true; break;
                }
                syncUi();
            }

            function logStateTransition(action) {
                console.log('[' + new Date().toISOString() + '] ACTION: ' + action.type + ' -> RequestId: ' + appState.requestId + ' | Phase: ' + appState.phase);
            }

            function syncUi() {
                var isFullyReady = appState.ready.ui; 
                var isIdle = appState.phase === 'IDLE';
                var isOnline = appState.health === 'online' || appState.health === 'connecting';
                var canAttemptRequest = appState.health !== 'offline';
                var isBusy = !isIdle;
                var isAuthenticated = !appState.authRequired;

                sendBtn.disabled = !isFullyReady || !isIdle || !canAttemptRequest || !isAuthenticated;
                chatInput.disabled = !isFullyReady || !isIdle || !canAttemptRequest || !isAuthenticated;
                if (stopBtn) {
                    stopBtn.disabled = !isFullyReady || !isBusy;
                    stopBtn.classList.toggle('btn-hidden', !isBusy);
                }
                sendBtn.classList.toggle('btn-hidden', isBusy);
                chatInput.placeholder = appState.authRequired
                    ? '\\u00D6nce giri\\u015F yap\\u0131n...'
                    : (isOnline ? "Sorunuzu sorun veya '/' ile komutlar\\u0131 g\\u00F6r\\u00FCn..." : "Bak\\u0131m modunda veya \\u00E7evrimd\\u0131\\u015F\\u0131...");
                
                resetBtn.disabled = !isFullyReady;
                historyBtn.disabled = !isFullyReady || !isAuthenticated;
                newChatBtn.disabled = !isFullyReady || !isAuthenticated;

                if (logoutBtn) {
                    logoutBtn.disabled = !isFullyReady || !isAuthenticated;
                    logoutBtn.style.opacity = (!isFullyReady || !isAuthenticated) ? '0.45' : '1';
                }
                if (authCta) authCta.classList.toggle('visible', appState.authRequired);
                if (authLoginBtn) authLoginBtn.disabled = !appState.ready.ui;

                if (isIdle || !isFullyReady) {
                    requestStatus.classList.add('hidden');
                } else {
                    requestStatus.classList.remove('hidden');
                    requestStatus.classList.toggle('generating', appState.phase === 'REQUEST_STREAMING');
                    requestStatus.classList.toggle('error', appState.phase === 'REQUEST_FAILED');
                    var defText = 'Working...';
                    if (appState.phase === 'REQUEST_STREAMING') defText = 'Generating...';
                    requestStatusText.textContent = appState.statusText || defText;
                }

                var healthIndicator = document.getElementById('health-indicator');
                var healthText = document.getElementById('health-text');
                var reconnectArea = document.getElementById('reconnect-area');
                if (reconnectArea) {
                    if (appState.health === 'offline') reconnectArea.classList.add('visible');
                    else reconnectArea.classList.remove('visible');
                }
            }

            // ── State Control ──
            function nowIso() { return new Date().toISOString(); }
            function normalizeMessage(raw) { return { role: raw?.role || 'ai', text: raw?.text || '', createdAt: raw?.createdAt || nowIso() }; }
            
            function createSession() {
                var id = 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                return { id: id, title: 'Yeni Sohbet', createdAt: nowIso(), updatedAt: nowIso(), pinned: false, messages: [] };
            }

            function normalizeSession(raw) {
                return {
                    id: raw?.id || ('session-' + Date.now()),
                    title: raw?.title || 'Yeni Sohbet',
                    createdAt: raw?.createdAt || nowIso(),
                    updatedAt: raw?.updatedAt || nowIso(),
                    pinned: Boolean(raw?.pinned),
                    messages: Array.isArray(raw?.messages) ? raw.messages.map(normalizeMessage) : []
                };
            }

            function persist() {
                if (!vscode) return;
                var scopedKey = (appState.authRequired) ? '' : (String(appState.authIdentityKey || '').trim() || 'default-user');
                var saved = vscode.getState() || {};
                var chatByIdentity = saved.chatByIdentity || {};
                chatByIdentity[scopedKey] = {
                    chatSessions: appState.chatSessions,
                    activeSessionId: appState.activeSessionId
                };
                vscode.setState({ chatByIdentity: chatByIdentity });
            }

            function loadIdentityScopedData() {
                var saved = vscode.getState() || {};
                var scopedKey = (appState.authRequired) ? '' : (String(appState.authIdentityKey || '').trim() || 'default-user');
                var bucket = saved.chatByIdentity ? saved.chatByIdentity[scopedKey] : null;
                appState.chatSessions = Array.isArray(bucket?.chatSessions) ? bucket.chatSessions.map(normalizeSession) : [];
                appState.activeSessionId = bucket?.activeSessionId || '';
                
                if (appState.chatSessions.length === 0) {
                    var s = createSession();
                    appState.chatSessions.push(s);
                    appState.activeSessionId = s.id;
                    setDefaultGreetingIfNeeded(s);
                }
            }

            // ── Rendering & Session Management ──
            function getActiveSession() {
                return appState.chatSessions.find(function(s) { return s.id === appState.activeSessionId; });
            }

            function renderHistory() {
                if (!historyList) return;
                historyList.innerHTML = '';
                var query = appState.historySearchTerm.trim().toLowerCase();
                var filtered = query
                    ? appState.chatSessions.filter(function(s) {
                        var title = typeof s.title === 'string' ? s.title : '';
                        return title.toLowerCase().includes(query) || s.messages.some(function(m) { return (typeof m.text === 'string' ? m.text : '').toLowerCase().includes(query); });
                    })
                    : appState.chatSessions.slice();

                var sorted = filtered.sort(function(a, b) {
                    var pinDiff = (Number(b.pinned || 0) - Number(a.pinned || 0));
                    if (pinDiff !== 0) return pinDiff;
                    var dateA = new Date(a.updatedAt || 0).getTime();
                    var dateB = new Date(b.updatedAt || 0).getTime();
                    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                });
                
                if (sorted.length === 0) {
                    historyList.innerHTML = '<div class="history-empty">Hen\\u00FCz sohbet yok.</div>';
                    return;
                }

                for (var i = 0; i < sorted.length; i++) {
                    (function() {
                        var session = sorted[i];
                        var item = document.createElement('div');
                        item.className = 'history-item' + (session.id === appState.activeSessionId ? ' active' : '');
                        item.innerHTML = '<div class="history-item-row">' +
                            '<div class="history-main">' +
                            '<div class="history-title">' + (session.pinned ? '\\uD83D\\uDCCC ' : '') + escapeHtml(session.title) + '</div>' +
                            '<div class="history-meta"><span>' + (session.updatedAt ? session.updatedAt.split('T')[0] : '---') + '</span></div>' +
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

                        var pinBtn = item.querySelector('.pin-btn');
                        if (pinBtn) {
                            pinBtn.addEventListener('click', function(event) {
                                event.stopPropagation();
                                window.togglePinSession(session.id);
                            });
                        }

                        var deleteBtn = item.querySelector('.delete-btn');
                        if (deleteBtn) {
                            deleteBtn.addEventListener('click', function(event) {
                                event.stopPropagation();
                                window.requestDeleteSession(session.id, session.title);
                            });
                        }

                        item.onclick = function() { switchSession(session.id); };
                        historyList.appendChild(item);
                    })();
                }
            }

            window.togglePinSession = function(sid) {
                var s = appState.chatSessions.find(function(x) { return x.id === sid; });
                if (s) { s.pinned = !s.pinned; s.updatedAt = nowIso(); renderHistory(); persist(); }
            };

            window.requestDeleteSession = function(sid, title) {
                console.log('[CodeAlchemist] requestDeleteSession clicked: ' + sid);
                try {
                    vscode.postMessage({ command: 'requestDeleteSession', sessionId: sid, title: title });
                } catch (e) {
                    console.error('[CodeAlchemist] postMessage failed for requestDeleteSession:', e);
                }
            };

            function deleteSession(sid) {
                appState.chatSessions = appState.chatSessions.filter(function(s) { return s.id !== sid; });
                if (appState.chatSessions.length === 0) {
                    var s = createSession();
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
                if (historyDrawer) historyDrawer.classList.remove('open');
                renderActiveSession();
                renderHistory();
                persist();
            }

            function escapeHtml(s) { 
                return String(s || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function renderActiveSession() {
                if (!chatContainer) {
                    logToProvider('Render', 'chatContainer is missing!');
                    return;
                }
                try {
                    chatContainer.innerHTML = '';
                    appState.currentAiMessageElement = null;
                    appState.currentAiBubble = null;
                    appState.currentTraceContainer = null;
                    appState.currentFullText = '';

                    var session = getActiveSession();
                    if (session) {
                        setDefaultGreetingIfNeeded(session);
                        for (var i = 0; i < session.messages.length; i++) {
                            var m = session.messages[i];
                            addMessage(m.text, m.role, false);
                        }
                    } else {
                        logToProvider('Render', 'No active session found during renderActiveSession');
                    }
                } catch (err) {
                    logToProvider('Render', 'Failed to render active session', { error: err.message });
                }
            }

            function setDefaultGreetingIfNeeded(session) {
                if (session && (session.messages.length === 0)) {
                    session.messages.push({ role: 'ai', text: GREETING, createdAt: nowIso() });
                }
            }


            function addMessage(text, role, shouldPersist) {
                if (shouldPersist === undefined) shouldPersist = true;
                var msgDiv = document.createElement('div');
                msgDiv.className = 'message ' + role;
                var bubble = document.createElement('div');
                bubble.className = 'message-bubble markdown-body';
                var safeText = typeof text === 'string' ? text : '';
                if (role === 'user') bubble.textContent = safeText;
                else {
                    try {
                        bubble.innerHTML = (md && typeof md.render === 'function') ? md.render(safeText) : safeText;
                    } catch (e) {
                        logToProvider('Render', 'Markdown render failed', { error: e.message });
                        bubble.textContent = safeText;
                    }
                    appState.currentFullText = safeText;
                    appState.currentAiMessageElement = msgDiv;
                    appState.currentAiBubble = bubble;
                }
                msgDiv.appendChild(bubble);
                chatContainer.appendChild(msgDiv);
                chatContainer.scrollTop = chatContainer.scrollHeight;
                if (shouldPersist) {
                    var session = getActiveSession();
                    if (session) {
                        session.messages.push({ role: role, text: safeText, createdAt: nowIso() });
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
                if (md && typeof md.render === 'function') {
                    appState.currentAiBubble.innerHTML = md.render(appState.currentFullText);
                } else {
                    appState.currentAiBubble.textContent = appState.currentFullText;
                }
                chatContainer.scrollTop = chatContainer.scrollHeight;
                var session = getActiveSession();
                if (session && session.messages.length > 0) {
                    var last = session.messages[session.messages.length - 1];
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
                var item = document.createElement('div');
                item.className = 'trace-item active';
                item.innerHTML = '<span class="trace-icon-dot"></span><div class="trace-flex"><div class="trace-main"><span class="trace-tool">' + escapeHtml(tool) + '</span></div><div class="trace-sub">' + escapeHtml(reasoning) + '</div></div>';
                var prev = appState.currentTraceContainer.querySelector('.active');
                if (prev) prev.classList.remove('active');
                appState.currentTraceContainer.appendChild(item);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function handleActionFound(action) {
                if (action.action === 'edit_file') addActionCard(action);
                else if (action.action === 'multi_edit') {
                    for (var i = 0; i < action.changes.length; i++) {
                        var c = action.changes[i];
                        addActionCard({
                            file: c.file,
                            action: 'edit_file',
                            render_url: c.render_url
                        });
                    }
                }
                else if (action.action === 'run_command') addRunCommandCard(action);
            }

            function bindActionCardButtons(card, cardId) {
                var keepBtn = card.querySelector('.action-keep-btn');
                if (keepBtn) { keepBtn.addEventListener('click', function() { window.resolveCard(cardId, 'accept'); }); }

                var discardBtn = card.querySelector('.action-discard-btn');
                if (discardBtn) { discardBtn.addEventListener('click', function() { window.resolveCard(cardId, 'reject'); }); }

                var previewBtn = card.querySelector('.action-preview-btn');
                if (previewBtn) { previewBtn.addEventListener('click', function() { window.previewAction(cardId); }); }

                var undoBtn = card.querySelector('.action-undo-btn');
                if (undoBtn) { undoBtn.addEventListener('click', function() { window.resolveCard(cardId, 'undo'); }); }
            }

            function addRunCommandCard(action) {
                var cardId = 'card-' + Math.random().toString(36).slice(2, 9);
                var card = document.createElement('div');
                card.className = 'command-card';
                card.dataset.actionId = cardId;

                var relPath = '...';
                if (action.cwd) {
                    relPath = '...\u005c\u005c' + action.cwd.replace(/\//g, '\u005c\u005c');
                } else if (appState.workspaceRoot) {
                    var parts = appState.workspaceRoot.split(/[\\\/]/);
                    relPath = '...\u005c\u005c' + parts[parts.length - 1];
                }
                var displayTitle = relPath + ' > ' + action.command;

                card.innerHTML = 
                    '<div class="command-card-header">Ran command</div>' +
                    '<div class="command-card-body">' +
                        '<div class="command-card-title">' + 
                            '<span>' + escapeHtml(displayTitle) + '</span>' +
                        '</div>' +
                        '<div class="command-card-output" id="out-' + cardId + '"></div>' +
                    '</div>' +
                    '<div class="command-card-footer">' +
                        '<div class="command-actions-left">' +
                            '<button class="btn-invisible action-run-accept-btn">Run</button>' +
                            '<button class="btn-invisible action-run-cmd-btn">Always run ^</button>' +
                        '</div>' +
                        '<span class="command-exit-code" id="exit-' + cardId + '">Pending</span>' +
                    '</div>';
                card._actionData = action;
                card.dataset.type = 'run_command';
                
                var acceptBtn = card.querySelector('.action-run-accept-btn');
                if (acceptBtn) {
                    acceptBtn.addEventListener('click', function() {
                        acceptBtn.parentElement.style.opacity = '0.5';
                        acceptBtn.parentElement.style.pointerEvents = 'none';
                        window.resolveCard(cardId, 'accept');
                    });
                }

                var alwaysBtn = card.querySelector('.action-run-cmd-btn');
                if (alwaysBtn) {
                    alwaysBtn.addEventListener('click', function() {
                        alwaysBtn.parentElement.style.opacity = '0.5';
                        alwaysBtn.parentElement.style.pointerEvents = 'none';
                        window.resolveCard(cardId, 'always');
                    });
                }

                if (appState.currentAiMessageElement) appState.currentAiMessageElement.appendChild(card);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            function addActionCard(action) {
                var cardId = 'card-' + Math.random().toString(36).slice(2, 9);
                var card = document.createElement('div');
                card.className = 'action-card';
                card.dataset.actionId = cardId;
                card.dataset.type = 'edit_file';
                var renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
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
                if (appState.currentAiMessageElement) appState.currentAiMessageElement.appendChild(card);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            window.resolveCard = function(cid, decision) {
                var card = document.querySelector('[data-action-id="' + cid + '"]');
                if (!card) return;
                try {
                    vscode.postMessage({ command: 'resolveAction', decision: decision, action: card._actionData, actionId: cid });
                } catch (e) {
                    console.error('[CodeAlchemist] postMessage failed for resolveCard:', e);
                }
            };

            window.previewAction = function(cid) {
                var card = document.querySelector('[data-action-id="' + cid + '"]');
                if (!card) return;
                try {
                    vscode.postMessage({ command: 'applyAction', action: card._actionData });
                } catch (e) {
                    console.error('[CodeAlchemist] postMessage failed for previewAction:', e);
                }
            };

            function updateActionCard(aid, status, msg, outputText, exitCode) {
                var card = document.querySelector('[data-action-id="' + aid + '"]');
                if (!card) return;

                if (card.dataset.type === 'run_command') {
                    var outNode = card.querySelector('#out-' + aid);
                    var exitNode = card.querySelector('#exit-' + aid);
                    if (outNode && typeof outputText === 'string') {
                        outNode.textContent = outputText.trim() === '' ? '(Sessiz çıkış)' : outputText;
                        outNode.classList.add('has-content');
                    }
                    if (exitNode && typeof exitCode === 'number') {
                        exitNode.textContent = 'Exit code ' + exitCode;
                    } else if (exitNode && status === 'error') {
                        exitNode.textContent = 'Failed';
                    }
                    
                    var btn = card.querySelector('.action-run-cmd-btn');
                    if (btn) btn.disabled = true;
                    return;
                }

                var statusNode = card.querySelector('.action-status');
                if (statusNode) statusNode.textContent = msg || status;
                card.className = 'action-card ' + (status === 'applied' ? 'is-applied' : status === 'rejected' ? 'is-rejected' : status === 'reverted' ? '' : 'is-error');
                
                if (status === 'applied') {
                    var footer = card.querySelector('.action-footer');
                    if (footer) {
                        footer.innerHTML = '<button class="btn btn-secondary action-undo-btn">Undo</button>';
                        var action = card._actionData;
                        if (action && action.render_url) {
                            footer.innerHTML += '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>';
                        }
                        bindActionCardButtons(card, aid);
                    }
                } else if (status === 'reverted') {
                    var action = card._actionData;
                    var renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
                    var footer = card.querySelector('.action-footer');
                    if (footer) {
                        footer.innerHTML = 
                            '<button class="btn btn-primary action-keep-btn">Keep</button>' +
                            '<button class="btn btn-secondary action-discard-btn">Discard</button>' +
                            '<button class="btn btn-secondary action-preview-btn">Preview</button>' +
                            renderBtn;
                        bindActionCardButtons(card, aid);
                    }
                } else {
                    var btns = card.querySelectorAll('button');
                    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
                }
            }

            // ── Interactive Logic ──

            function getSlashTokenInfo(rawValue) {
                var value = String(rawValue || '');
                if (!value.startsWith('/')) return null;
                var firstBreak = value.search(/\\s/);
                var token = firstBreak === -1 ? value : value.slice(0, firstBreak);
                var rest = firstBreak === -1 ? '' : value.slice(firstBreak);
                return { token: token.toLowerCase(), rest: rest };
            }

            function hideSlashSuggestions() {
                slashVisibleItems = [];
                slashSelectionIndex = 0;
                if (!slashSuggest) return;
                slashSuggest.classList.remove('visible');
                slashSuggest.innerHTML = '';
            }

            function applySlashCommand(cmd) {
                if (!chatInput) return;
                var info = getSlashTokenInfo(chatInput.value);
                var suffix = info ? info.rest : (chatInput.value ? ' ' + chatInput.value : '');
                var safeSuffix = suffix.trimStart();
                chatInput.value = safeSuffix ? (cmd + ' ' + safeSuffix) : (cmd + ' ');
                hideSlashSuggestions();
                chatInput.focus();
            }

            function renderSlashSuggestions(filteredCommands) {
                if (!slashSuggest) return;
                slashVisibleItems = filteredCommands.slice();
                if (slashVisibleItems.length === 0) {
                    hideSlashSuggestions();
                    return;
                }
                if (slashSelectionIndex >= slashVisibleItems.length) slashSelectionIndex = 0;
                slashSuggest.innerHTML = '';
                for (var i = 0; i < slashVisibleItems.length; i++) {
                    (function(idx) {
                        var item = slashVisibleItems[idx];
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'slash-item' + (idx === slashSelectionIndex ? ' active' : '');
                        btn.setAttribute('role', 'option');
                        btn.innerHTML = '<span class="slash-cmd">' + escapeHtml(item.cmd) + '</span>' +
                            '<span class="slash-desc">' + escapeHtml(item.desc) + '</span>';
                        btn.addEventListener('mousedown', function(event) { event.preventDefault(); });
                        btn.addEventListener('click', function() { applySlashCommand(item.cmd); });
                        slashSuggest.appendChild(btn);
                    })(i);
                }
                slashSuggest.classList.add('visible');
            }

            function updateSlashSuggestions() {
                if (!chatInput || (appState.phase !== 'IDLE')) {
                    hideSlashSuggestions();
                    return;
                }
                var info = getSlashTokenInfo(chatInput.value);
                if (!info) {
                    hideSlashSuggestions();
                    return;
                }
                var token = info.token;
                var filtered = SLASH_COMMANDS.filter(function(item) { return item.cmd.indexOf(token) === 0; });
                renderSlashSuggestions(filtered);
            }

            function moveSlashSelection(delta) {
                if (!slashVisibleItems.length) return;
                slashSelectionIndex = (slashSelectionIndex + delta + slashVisibleItems.length) % slashVisibleItems.length;
                renderSlashSuggestions(slashVisibleItems);
            }

            function acceptSelectedSlashCommand() {
                if (!slashVisibleItems.length) return false;
                var selected = slashVisibleItems[slashSelectionIndex];
                if (!selected) return false;
                applySlashCommand(selected.cmd);
                return true;
            }

            function handleOptimizationMeta(meta) {
                if (!meta) return;
                if (typeof meta.balance === 'number') updateTokenBadge(meta.balance);
                if (!meta.optimization_score || !appState.currentAiMessageElement) return;
                var existingBadge = appState.currentAiMessageElement.querySelector('.optimization-badge');
                if (existingBadge) existingBadge.remove();
                var badge = document.createElement('div');
                badge.className = 'optimization-badge';
                var score = meta.optimization_score;
                var iconColor = (score >= 0.8) ? '#34d399' : (score >= 0.5 ? '#fbbf24' : '#f87171');
                badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Optimized (Score: ' + score + ')';
                appState.currentAiMessageElement.appendChild(badge);
            }

            function setupMessageListener() {
                window.addEventListener('message', function(event) {
                    var message = event.data;
                    switch (message.command) {
                        case 'STATE_SNAPSHOT': dispatch({ type: 'RECONCILE_SNAPSHOT', payload: message }); break;
                        case 'STATE_EVENT': dispatch({ type: 'RECONCILE_EVENT', payload: message }); break;
                        case 'HEALTH_STATUS': dispatch({ type: 'HEALTH_UPDATE', payload: message.status }); break;
                        case 'AUTH_STATE':
                            appState.authRequired = Boolean(message.required);
                            appState.authIdentityKey = String(message.identityKey || '');
                            appState.ready.provider = true; 
                            loadIdentityScopedData();
                            renderActiveSession();
                            renderHistory();
                            syncUi();
                            break;
                        case 'stream_chunk': updateAiMessage(message.text); break;
                        case 'optimization_meta': handleOptimizationMeta(message.meta); break;
                        case 'trace_step': addTraceStep(message.tool, message.reasoning); break;
                        case 'action_found': handleActionFound(message.action); break;
                        case 'action_result': updateActionCard(message.actionId, message.status, message.message, message.outputText, message.exitCode); break;
                        case 'token_balance': updateTokenBadge(message.balance); break;
                        case 'session_deleted': deleteSession(message.sessionId); break;
                        case 'clear_history':
                            appState.chatSessions = [];
                            appState.activeSessionId = '';
                            loadIdentityScopedData();
                            renderActiveSession();
                            renderHistory();
                            persist();
                            break;
                    }
                });
            }

            var DEFAULT_FALLBACK_MODELS = [
                { value: 'auto', label: 'Auto (Smart Model)' },
                { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
                { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' }
            ];

            function initModelPicker() {
                if (!modelSelect) return;
                modelSelect.innerHTML = '';
                var stateEl = document.getElementById('initial-state');
                var raw = stateEl ? stateEl.textContent : '';
                var initialState = {};
                try { initialState = raw ? JSON.parse(raw) : {}; } catch(e) {}
                
                var options = (initialState && initialState.modelOptions && initialState.modelOptions.length > 0) 
                    ? initialState.modelOptions 
                    : DEFAULT_FALLBACK_MODELS;
                
                for (var i = 0; i < options.length; i++) {
                    var opt = options[i];
                    var el = document.createElement('option');
                    el.value = opt.value;
                    el.textContent = opt.label;
                    el.selected = opt.value === appState.selectedModel;
                    modelSelect.appendChild(el);
                }
                modelSelect.onchange = function() {
                    appState.selectedModel = modelSelect.value;
                    persist();
                    vscode.postMessage({ command: 'setModel', model: appState.selectedModel });
                };
            }

            function sendMsg() {
                var text = chatInput.value.trim();
                if (!text || (appState.phase !== 'IDLE')) return;
                hideSlashSuggestions();
                addMessage(text, 'user');
                var session = getActiveSession();
                if (!session) {
                    logToProvider('SendMsg', 'No active session found, aborting send.');
                    return;
                }
                var history = session.messages
                    .filter(function(m) { return (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string' && m.text.trim().length > 0; })
                    .slice(-12)
                    .map(function(m) { return { role: m.role, text: m.text, createdAt: m.createdAt }; });
                
                addMessage('', 'ai');
                chatInput.value = '';
                dispatch({ type: 'UX_ASK' });
                vscode.postMessage({ command: 'ask', text: text, model: appState.selectedModel, history: history, sessionId: session.id });
            }

            function attachEventListeners() {
                if (sendBtn) sendBtn.onclick = sendMsg;
                if (stopBtn) {
                    stopBtn.onclick = function() {
                        dispatch({
                            type: 'RECONCILE_EVENT',
                            payload: {
                                requestId: appState.requestId,
                                phase: 'REQUEST_CANCELLED',
                                text: 'Yan\\u0131t durduruluyor...'
                            }
                        });
                        vscode.postMessage({ command: 'stopAsk' });
                    };
                }
                if (chatInput) {
                    chatInput.addEventListener('input', updateSlashSuggestions);
                    chatInput.addEventListener('blur', function() { setTimeout(function() { hideSlashSuggestions(); }, 120); });
                    chatInput.onkeydown = function(e) {
                        if (slashVisibleItems.length > 0) {
                            if (e.key === 'ArrowDown') { e.preventDefault(); moveSlashSelection(1); return; }
                            if (e.key === 'ArrowUp') { e.preventDefault(); moveSlashSelection(-1); return; }
                            if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                                if (acceptSelectedSlashCommand()) { e.preventDefault(); return; }
                            }
                            if (e.key === 'Escape') { hideSlashSuggestions(); return; }
                        }
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
                    };
                }

                document.querySelectorAll('[data-slash-cmd]').forEach(function(node) {
                    node.addEventListener('click', function() {
                        var cmd = node.getAttribute('data-slash-cmd');
                        if (cmd) applySlashCommand(cmd);
                    });
                });

                if (newChatBtn) {
                    newChatBtn.onclick = function() {
                        var s = createSession();
                        setDefaultGreetingIfNeeded(s);
                        appState.chatSessions.unshift(s);
                        appState.activeSessionId = s.id;
                        renderActiveSession();
                        renderHistory();
                        persist();
                    };
                }
                if (resetBtn) {
                    resetBtn.onclick = function() {
                        var s = getActiveSession();
                        if (s) { 
                            s.messages = []; 
                            setDefaultGreetingIfNeeded(s); 
                            s.title = 'Yeni Sohbet'; 
                            renderActiveSession(); 
                            renderHistory(); 
                            persist(); 
                        }
                    };
                }
                if (historyBtn && historyDrawer) {
                    historyBtn.onclick = function() { 
                        historyDrawer.classList.toggle('open'); 
                        if (historyDrawer.classList.contains('open') && document.getElementById('history-search')) {
                            document.getElementById('history-search').focus(); 
                        }
                    };
                }
                var historySearch = document.getElementById('history-search');
                if (historySearch) {
                    historySearch.oninput = function() { 
                        appState.historySearchTerm = historySearch.value; 
                        renderHistory(); 
                    };
                }

                var reconnectBtn = document.getElementById('reconnect-btn');
                if (reconnectBtn) {
                    reconnectBtn.onclick = function() {
                        dispatch({ type: 'HEALTH_UPDATE', payload: 'connecting' });
                        vscode.postMessage({ command: 'healthCheck' });
                    };
                }

                if (tokenBadge) {
                    tokenBadge.onclick = function() {
                        if (appState.authRequired) { vscode.postMessage({ command: 'openLoginFlow' }); return; }
                        vscode.postMessage({ command: 'openTokenPanel' });
                    };
                }

                if (authLoginBtn) {
                    authLoginBtn.onclick = function() { vscode.postMessage({ command: 'openLoginFlow' }); };
                }

                if (logoutBtn) {
                    logoutBtn.onclick = function() { vscode.postMessage({ command: 'logout' }); };
                }
            }

            function updateTokenBadge(balance) {
                if (!tokenBalanceEl || !tokenBadge) return;
                if (typeof balance !== 'number') { tokenBalanceEl.textContent = '...'; return; }
                tokenBalanceEl.textContent = balance >= 1000 ? (balance / 1000).toFixed(1) + 'k' : String(balance);
                tokenBadge.classList.toggle('low', balance <= 20);
                tokenBadge.title = balance <= 10
                    ? '\\u26A0 Kritik: Token bitti \\u00FCzere! T\\u0131kla \\u2192 Token al'
                    : balance <= 20
                        ? '(!D\\u00FC\\u015F\\u00FCk) Bakiye: ' + balance + ' token kald\\u0131. T\\u0131kla -> Sat\\u0131n Al'
                        : 'Bakiye: ' + balance + ' token - T\\u0131kla -> Sat\\u0131n Al';
            }

            function fetchTokenBalance() {
                vscode.postMessage({ command: 'getTokenBalance' });
            }

            function init() {
                logToProvider('Boot', 'Initializing boot sequence...');
                setupMessageListener(); 
                try {
                    if (typeof window.markdownit === 'function') {
                        md = window.markdownit({ html: true, linkify: true, typographer: true });
                        logToProvider('Boot', 'Markdown-it ready.');
                    } else { md = { render: function(t) { return t; } }; }
                } catch (e) { md = { render: function(t) { return t; } }; }

                try {
                    loadIdentityScopedData();
                    dispatch({ type: 'BOOT_UI_READY' });
                    initModelPicker();
                    renderActiveSession();
                    renderHistory();
                    attachEventListeners();
                    vscode.postMessage({ command: 'webviewReady' });
                    setTimeout(function() {
                        if (!appState.ready.provider) {
                            appState.ready.provider = true;
                            syncUi();
                            vscode.postMessage({ command: 'webviewReady' });
                        }
                    }, 1500);
                } catch (err) {
                    logToProvider('Boot', 'CRITICAL FAILURE', { error: err.message });
                    appState.ready.ui = true;
                    syncUi();
                }
            }

            init();
            fetchTokenBalance();
            setInterval(fetchTokenBalance, 60000);
        })();
    