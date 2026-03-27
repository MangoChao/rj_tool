const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ==========================================
// --- 核心配置 ---
// ==========================================
const ROOM_EXPIRY_MS = 600000;
const MAX_ROOMS = 500;
const ANIMAL_NAMES = ['小豬', '阿狗', '阿貓', '兔兔', '牛牛', '老羊', '小雞', '小蛇', '小魚', '大象', '阿虎', '小龍', '勞鼠', '老猴', '小馬', '阿獅', '小狼', '小鹿'];

const rooms = new Map();

// --- 房間清理 ---
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (now - room.lastActive > ROOM_EXPIRY_MS) {
            io.to(roomId).emit('error-msg', '房間因 10 分鐘無動作已解散。');
            rooms.delete(roomId);
        }
    });
}, 60000);

// ==========================================
// --- HTML 模板區塊 ---
// ==========================================

const HEAD_PART = '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><title>CCC 小助手 - 羅密歐與茱麗葉副本</title><meta name="description" content="操作說明：&#10;左鍵：標記正確格&#10;右鍵：標記錯誤格"><meta property="og:title" content="CCC 小助手 - 羅密歐與茱麗葉副本"><meta property="og:description" content="操作說明：&#10;● 左鍵：標記正確格&#10;● 右鍵：標記錯誤格"><link rel="icon" href="/favicon.ico" type="image/x-icon"><meta property="og:type" content="website">';

const CSS_PART = '<style>:root{--bg:#121212;--card:#1e1e1e;--text:#e0e0e0;--my-green:#28a745;--other-red:#dc3545;--accent:#f9d000}html,body{height:100%;margin:0;padding:0;background:var(--bg);color:var(--text);font-family:-apple-system,sans-serif}body{display:flex;justify-content:center;overflow-y:auto;-webkit-overflow-scrolling:touch}.mobile-container{width:100%;max-width:400px;min-height:100%;padding:10px;box-sizing:border-box;display:flex;flex-direction:column;position:relative}.hidden{display:none!important}#loader{position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:8000;transition:opacity .3s}.spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,0.1);border-top:4px solid var(--my-green);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:15px}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.card{background:var(--card);border-radius:12px;padding:12px;margin-bottom:8px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.4)}.grid-container{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}.row{display:flex;gap:5px;align-items:center;height:40px}.row-label{width:30px;font-size:.7em;color:#666;text-align:center;font-weight:700}.cell{flex:1;height:100%;background:#222;border-radius:6px;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.1em;border:1px solid #333;user-select:none;color:#333;overflow:hidden}.cell.mine-ok{background:var(--my-green)!important;color:#fff!important}.cell.mine-wrong{background:#000!important;color:var(--other-red)!important}.cell.others-ok{background:var(--other-red)!important;color:#fff!important;opacity:.8}.prob{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-weight:900;line-height:1}.control-panel{display:flex;flex-direction:column;gap:8px;margin-bottom:15px}.code-display-box{background:#000;border:1px solid #333;padding:10px;border-radius:8px;cursor:pointer;display:flex;justify-content:center;align-items:center;gap:10px}.code-text{color:var(--accent);font-family:monospace;font-size:1.4em;font-weight:700;letter-spacing:2px}.auto-copy-wrap{display:flex;align-items:center;justify-content:center;gap:10px;font-size:.85em;color:#888}.btn-group{display:flex;gap:8px;padding-bottom:20px;position:relative;z-index:10}button{flex:1;padding:15px;font-size:1em;font-weight:700;border:none;border-radius:8px;background:var(--my-green);color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent}.btn-danger{background:#333;color:#999}.fixed-footer{color:var(--accent);font-size:14px;font-weight:700;text-align:center;padding:5px 0 15px 0;user-select:none}.version-info{font-size:12px;color:#555;margin-top:10px}#modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:none;align-items:center;justify-content:center;z-index:5000;backdrop-filter:blur(8px)}.modal-card{background:var(--card);width:85%;max-width:320px;border-radius:16px;padding:25px;border:1px solid #444;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.8);position:relative}#toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--my-green);color:#fff;padding:10px 25px;border-radius:25px;opacity:0;transition:.3s;z-index:9999;font-size:14px;font-weight:700;pointer-events:none;box-shadow:0 4px 15px rgba(0,0,0,0.5)}#toast.error{background:var(--other-red)}.record-input{background:#000;border:1px solid #555;color:var(--accent);width:100%;padding:12px;border-radius:8px;font-size:1.5em;text-align:center;letter-spacing:5px;margin-bottom:10px;outline:0}.room-input{background:#000;border:1px solid #444;color:var(--accent);width:85%;padding:12px;border-radius:8px;font-size:1.3em;text-align:center;margin:5px auto;outline:0;display:block;letter-spacing:2px}.room-input:focus{border-color:var(--my-green)}.small-btn{padding:6px 5px;font-size:.9em;background:#333;color:#ccc;border-radius:6px;border:1px solid #444;flex:1;cursor:pointer;font-weight:700}.small-btn:active{background:#444}.manual-text{color:#aaa;font-size:1em;margin:8px 0;line-height:1.4}.edit-label{font-size:.85em;color:#666;margin-bottom:5px;display:block}.blink{animation:blinker 1.5s linear infinite;color:var(--my-green);font-weight:700}@keyframes blinker{50%{opacity:.3}}.edit-btn{cursor:pointer;margin-right:6px;vertical-align:middle;transition:.2s;display:inline-flex;align-items:center;justify-content:center}.edit-btn:hover{opacity:.6}.edit-btn svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.color-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:15px 0}.color-cell{aspect-ratio:1.3/1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9em;color:#fff;cursor:pointer;border:2px solid transparent;opacity:.3;transition:.2s}.color-cell.active{border-color:#fff;opacity:1;transform:scale(1.05)}.color-cell.disabled{cursor:not-allowed;border:none;opacity:1;box-shadow:inset 0 0 10px rgba(0,0,0,0.5)}.mode-toggle-bar{background:#1a1a1a;color:#888;padding:8px;border-radius:8px;margin-bottom:8px;font-size:0.85em;font-weight:bold;cursor:pointer;text-align:center;transition:0.3s;user-select:none;border:1px solid #333;position:relative;overflow:hidden}.mode-toggle-bar.active{color:#fff;border:1px solid transparent;background: linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(90deg, #ff4d4d, #f1c40f, #00ff7f, #1e90ff, #a020f0) border-box;animation: rainbow-border 3s linear infinite;}@keyframes rainbow-border{0%{background-image: linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(0deg, #ff4d4d, #f1c40f, #00ff7f, #1e90ff, #a020f0) border-box;}100%{background-image: linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(360deg, #ff4d4d, #f1c40f, #00ff7f, #1e90ff, #a020f0) border-box;}}</style>';

const HOME_VIEW_PART = `
    <div id="home-view" class="card hidden" style="margin-top: 5vh;">
        <h1 style="color:var(--my-green); font-size: 1.5em; margin-bottom: 5px;">CCC 小助手</h1>
        <div style="font-size: 0.9em; color: #888; margin-bottom: 20px; font-weight: normal;">
            羅密歐與茱麗葉副本專用
        </div>
        <p style="font-size: 0.9em; color: #666; margin-bottom: 20px;">運作房間: <span id="room-count">...</span> / 1000</p>
        
        <div style="text-align:left; background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #2a2a2a; font-size:0.9em; line-height:1.6;">
            <b style="color:var(--accent); display:block; margin-bottom:5px;">操作說明</b>
            <span style="color:var(--my-green)">左鍵：</span>循環 [ 正確 → 錯誤 → 取消 ]<br>
            <span style="color:#ff4d4d">右鍵：</span>快速 [ 錯誤 ⇄ 取消 ]<br>
            <span style="color:#aaa">右鍵點綠格：</span>直接取消該標記<br>
            <span style="color:var(--accent)">右鍵雙擊：</span>強制清除該格所有人標記
        </div>

        <span class="edit-label">▼ <span class="blink">自訂房號</span> (英數字 6-10字)</span>
        <input type="text" id="manual-room-id" class="room-input" maxlength="10" placeholder="輸入自訂房號" onfocus="this.select()">
        <button onclick="handleManualAction()" style="margin-top: 10px; width: 90%; font-size: 1.1em;">一般模式</button>
        <button onclick="openWindow()" style="margin-top: 10px; width: 90%; font-size: 0.9em; background: #407af8;">小窗模式</button>
        
        <div class="version-info" style="margin-top:20px;">v1.4.7 | 最後更新: 2026-03-27 15:14</div>
        <div class="fixed-footer" style="padding-top: 15px;">Made by CC</div>
    </div>
`;

const ROOM_VIEW_PART = '<div id="room-view" class="hidden"><div class="card" style="padding: 10px 12px;"><div style="margin-bottom: 8px;"><div style="font-size: 0.85em; color: #666; margin-bottom: 0px;">房號</div><div id="display-room-id" style="font-size: 1.8em; color: var(--accent); font-weight: bold; font-family: monospace; letter-spacing: 2px; line-height: 1.2;"></div></div><div style="display: flex; gap: 10px; margin-bottom: 12px;"><div class="small-btn" onclick="copyRoomID()">複製房號</div><div class="small-btn" onclick="copyLink()">複製連結</div><div class="small-btn" onclick="openWindow()">多開小窗</div></div><div style="display:flex; justify-content:space-between; font-size:1em; color:#bbb; border-top: 1px solid #333; padding-top: 10px;"><div style="display: flex; align-items: center;"><span class="edit-btn" onclick="openEditProfile()"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg></span>你是 <b id="my-name-display" style="color:var(--my-green); font-size: 1.1em; margin-left:4px;"></b></div><div>人數 <b id="online-count-display" style="color:var(--accent); font-size: 1.1em;">0/4</b></div></div></div><div id="mode-toggle" class="mode-toggle-bar" onclick="toggleColorMode()">當前模式：雙色</div><div class="grid-container" id="grid"></div><div class="control-panel"><div class="code-display-box" onclick="copyMyCode()"><span id="live-code" class="code-text">00000 00000</span></div><div style="display:flex; gap:8px;"><div class="auto-copy-wrap" style="flex:1; justify-content:flex-start;"><input type="checkbox" id="auto-copy-toggle" style="transform: scale(1.3);"><label for="auto-copy-toggle" style="margin-left: 8px; font-size: 0.95em;">開啟自動複製</label></div><button type="button" style="padding:6px 12px; font-size:0.9em; background:#444;" onclick="askLoadRecord()">載入紀錄</button></div></div><div class="btn-group"><button type="button" class="btn-danger" onclick="askReset()">清空全部</button><button type="button" class="btn-danger" onclick="askLeave()">退出</button></div><div class="fixed-footer">Made by CC</div></div>';

const JS_PART = `
<script src="/socket.io/socket.io.js"></script>
<script>
    let socket, currentRoomId = '', myName = '', globalGridData = {};
    let lastRightClick = 0, lastValidCode = "0000000000", pendingRestoreCode = null;
    let isColorMode = localStorage.getItem('rj_mode') === 'color';
    
    const RAINBOW_COLORS = ['#ff4d4d', '#00ff7f', '#1e90ff', '#ff1493', '#ffff00', '#a020f0', '#ff8c00', '#00ffff'];
    let selectedColorIdx = -1;

    window.onload = () => {
        const params = new URLSearchParams(location.search);
        if (params.get('isNew') === '1') {
            sessionStorage.removeItem('rj_uid'); // 移除舊身分 UID
            window.history.replaceState({}, '', '?room=' + params.get('room').toUpperCase());
        }
        getStats();
        renderGridStructure();
        
        const btn = document.getElementById('mode-toggle');
        if (isColorMode && btn) {
            btn.innerText = '當前模式：彩色';
            btn.classList.add('active');
        }

        const randomID = Math.random().toString(36).substring(2, 12).toUpperCase();
        const input = document.getElementById('manual-room-id');
        if(input) input.value = randomID;
        const targetRoom = new URLSearchParams(location.search).get('room');
        if (targetRoom) { currentRoomId = targetRoom.toUpperCase(); initAction('join', targetRoom); }
        else { hideLoader(); document.getElementById('home-view').classList.remove('hidden'); }
    };
    
    function openWindow() {
        const roomId = (currentRoomId || document.getElementById('manual-room-id').value).trim().toUpperCase();
        if (!roomId || roomId.length < 6) return showToast("請先輸入或加入房號", true);
        
        const url = window.location.origin + "/?room=" + roomId + "&isNew=1";
        window.open(url, "_blank", "width=400,height=850,menubar=no,toolbar=no,location=no");
    }

    function toggleColorMode() {
        isColorMode = !isColorMode;
        localStorage.setItem('rj_mode', isColorMode ? 'color' : 'dual');
        const btn = document.getElementById('mode-toggle');
        const myNameDisplay = document.getElementById('my-name-display');
        
        if (isColorMode) {
            btn.innerText = '當前模式：彩色';
            btn.classList.add('active');
        } else {
            btn.innerText = '當前模式：雙色';
            btn.classList.remove('active');
            if (myNameDisplay) myNameDisplay.style.color = 'var(--my-green)';
        }
        renderGrid();
    }

    function renderGridStructure() {
        const grid = document.getElementById('grid');
        if (!grid) return; grid.innerHTML = '';
        for (let r = 10; r >= 1; r--) {
            const row = document.createElement('div'); row.className = 'row';
            row.innerHTML = '<div class="row-label">F'+r+'</div>';
            for (let c = 1; c <= 4; c++) {
                const cell = document.createElement('div'); cell.className = 'cell'; cell.id = 'r'+r+'c'+c;
                cell.innerHTML = '<span class="val"></span><div class="prob"></div>';
                cell.onclick = () => {
                    const key = r + '_' + c;
                    const states = globalGridData[key] || {};
                    if (Object.keys(states).some(n => n !== myName && states[n] === 1)) return;
                    const cur = states[myName] || 0;
                    let next = (cur === 0) ? 1 : (cur === 1 ? 2 : 0);
                    if (next === 1) {
                        for (let i=1; i<=4; i++) if (i !== c && globalGridData[r+'_'+i] && globalGridData[r+'_'+i][myName] === 1) syncAction(r, i, 0);
                    }
                    syncAction(r, c, next);
                };
                cell.oncontextmenu = (e) => {
                    e.preventDefault(); const now = Date.now();
                    if (now - lastRightClick < 400) { socket.emit('grid-action', { room: currentRoomId, r, c, name: 'ALL_CLEAR', state: 0 }); lastRightClick = 0; return; }
                    lastRightClick = now;
                    const cur = (globalGridData[r+'_'+c] || {})[myName] || 0;
                    if (cur === 1) syncAction(r, c, 0);
                    else {
                        if (Object.keys(globalGridData[r+'_'+c] || {}).some(n => n !== myName && globalGridData[r+'_'+c][n] === 1)) return;
                        syncAction(r, c, (cur === 2) ? 0 : 2);
                    }
                };
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }
    }
        
    function showErrorModal(msg) {
        const c = document.getElementById('modal-content');
        const b = document.getElementById('modal-btns');
        const o = document.getElementById('modal-overlay');
        
        c.innerHTML = '<b style="color:var(--other-red)">無法進入房間</b><br>' + msg;
        c.onclick = null; // 移除點擊複製紀錄的功能，因為進不去房間通常也沒紀錄
        
        b.innerHTML = '';
        const h = document.createElement('button');
        h.style.width = '100%'; // 讓按鈕撐滿，視覺上更明確
        h.innerText = '回到首頁';
        h.onclick = () => location.href = '/';
        
        b.appendChild(h);
        o.style.display = 'flex';
    }

    function setupSocketListeners() {
        socket.on('connect_error', () => { hideLoader(); showToast("無法連線", true); });
        socket.on('disconnect', () => { hideLoader(); showBackupModal('連線已中斷。', lastValidCode); });
        socket.on('room-joined', d => {
            hideLoader(); currentRoomId = d.roomId; myName = d.identityName; sessionStorage.setItem('rj_uid', d.uid);
            document.getElementById('home-view').classList.add('hidden');
            document.getElementById('room-view').classList.remove('hidden');
            document.getElementById('display-room-id').innerText = d.roomId;
            document.getElementById('my-name-display').innerText = d.identityName;
            window.history.replaceState({}, '', '?room=' + d.roomId);
            globalGridData = d.gridState || {}; renderGrid(); updateMyGreenCode();
            if (pendingRestoreCode) { const c = pendingRestoreCode; pendingRestoreCode = null; setTimeout(() => processLoadRecord(c), 300); }
            document.getElementById('modal-overlay').style.display = 'none';
        });
        socket.on('sync-full-state', d => { globalGridData = d.gridState || {}; renderGrid(); updateMyGreenCode(); });
        socket.on('name-updated', d => { myName = d.newName; document.getElementById('my-name-display').innerText = d.newName; renderGrid(); });
        socket.on('grid-sync', d => {
            const key = d.r + '_' + d.c;
            if (d.name === 'ALL_CLEAR') globalGridData[key] = {};
            else { if(!globalGridData[key]) globalGridData[key] = {}; if(d.state === 0) delete globalGridData[key][d.name]; else globalGridData[key][d.name] = d.state; }
            renderGrid(); updateMyGreenCode();
        });
        socket.on('update-members', (list) => {
            sessionStorage.setItem('rj_members', JSON.stringify(list));
            if(document.getElementById('online-count-display')) document.getElementById('online-count-display').innerText = list.length + '/4';
            renderGrid();
        });
        socket.on('error-msg', m => {
            hideLoader();
            if (m.includes('滿')) {
                // 如果是房間已滿，直接顯示專用的錯誤 Modal，不給重連選項
                showErrorModal(m);
            } else if (m.includes('解散') || m.includes('無效')) {
                showBackupModal(m, lastValidCode);
            } else {
                showToast(m, true);
            }
        });
        socket.on('grid-reset-sync', () => { globalGridData = {}; lastValidCode = "0000000000"; updateMyGreenCode(); renderGrid(); });
    }

    function renderGrid() {
        const members = JSON.parse(sessionStorage.getItem('rj_members') || '[]');
        const memberNames = members.map(m => m.name);
        
        const myNameDisplay = document.getElementById('my-name-display');
        if (isColorMode && myNameDisplay) {
            const myData = members.find(m => m.name === myName);
            if (myData) myNameDisplay.style.color = RAINBOW_COLORS[myData.colorIndex];
        }

        for (let r = 1; r <= 10; r++) {
            let finalOk = {}, myWrongs = [], playerPot = {};
            memberNames.forEach(n => playerPot[n] = [1, 2, 3, 4]);
            for (let c = 1; c <= 4; c++) {
                const states = globalGridData[r+'_'+c] || {};
                Object.keys(states).forEach(n => {
                    if (states[n] === 1) finalOk[c] = n;
                    else if (states[n] === 2) { if (playerPot[n]) playerPot[n] = playerPot[n].filter(v => v !== c); if (n == myName) myWrongs.push(c); }
                });
            }
            let changed = true;
            while (changed) {
                changed = false;
                memberNames.forEach(n => {
                    if (!Object.values(finalOk).includes(n)) {
                        let avail = (playerPot[n] || []).filter(col => !finalOk[col]);
                        if (avail.length === 1) { finalOk[avail[0]] = n; changed = true; }
                    }
                });
                if (memberNames.length === 4) {
                    for (let c = 1; c <= 4; c++) {
                        if (!finalOk[c]) {
                            let possiblePlayers = memberNames.filter(n => !Object.values(finalOk).includes(n) && playerPot[n].includes(c));
                            if (possiblePlayers.length === 1) { finalOk[c] = possiblePlayers[0]; changed = true; }
                        }
                    }
                }
            }
            for (let c = 1; c <= 4; c++) {
                const cell = document.getElementById('r'+r+'c'+c);
                if (!cell) continue;
                const states = globalGridData[r+'_'+c] || {};
                const valSpan = cell.querySelector('.val');
                cell.className = 'cell'; 
                valSpan.innerText = '';
                valSpan.style.textShadow = '';
                cell.style.background = ''; 
                
                Object.keys(states).forEach(n => {
                    if (states[n] === 1) { 
                        if (!isColorMode) {
                            cell.classList.add(n === myName ? 'mine-ok' : 'others-ok');
                        } else {
                            const mData = members.find(m => m.name === n);
                            if (mData && mData.colorIndex !== undefined) {
                                cell.style.background = RAINBOW_COLORS[mData.colorIndex];
                                cell.style.color = '#fff';
                                valSpan.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.5)';
                            } else {
                                cell.classList.add(n === myName ? 'mine-ok' : 'others-ok');
                            }
                        }
                        valSpan.innerText = n.slice(-2);
                    }
                    else if (n === myName && states[n] === 2) { 
                        cell.classList.add('mine-wrong'); 
                        valSpan.innerText = 'X'; 
                    }
                });

                const probDiv = cell.querySelector('.prob');
                if (Object.keys(states).some(n => states[n] === 1 || (n === myName && states[n] === 2))) { 
                    probDiv.innerText = ''; 
                } else {
                    let pVal = 0; const occupier = finalOk[c]; const myConfirmedCol = Object.keys(finalOk).find(k => finalOk[k] === myName);
                    if (occupier === myName || myConfirmedCol == c) pVal = (myConfirmedCol == c || occupier === myName) ? 100 : 0;
                    else if (occupier || myConfirmedCol || myWrongs.includes(c)) pVal = 0;
                    else { let rem = (playerPot[myName] || []).filter(col => !finalOk[col]); if (rem.includes(c)) pVal = Math.floor(100 / (rem.length || 1)); else pVal = 0; }
                    probDiv.innerText = pVal + '%';
                    if (pVal === 100) { probDiv.style.fontSize = '85%'; probDiv.style.color = 'var(--accent)'; }
                    else if (pVal === 0) { probDiv.style.fontSize = '30%'; probDiv.style.color = '#444'; }
                    else {
                        let fs = 35 + (pVal - 25) * 0.8; probDiv.style.fontSize = fs + '%';
                        let ratio = (pVal - 25) / 75; if (ratio < 0) ratio = 0;
                        let r_v = Math.floor(102 + 147 * ratio), g_v = Math.floor(102 + 106 * ratio), b_v = Math.floor(102 - 102 * ratio);
                        probDiv.style.color = 'rgb(' + r_v + ',' + g_v + ',' + b_v + ')';
                    }
                }
            }
        }
    }

    function askLoadRecord() { 
        const content = document.getElementById('modal-content'); 
        const btns = document.getElementById('modal-btns'); 
        const overlay = document.getElementById('modal-overlay'); 
        content.onclick = null; 
        content.innerHTML = '<input type="tel" id="load-record-input" class="record-input" maxlength="11" placeholder="00000 00000">'; 
        btns.innerHTML = ''; 
        const cBtn = document.createElement('button'); cBtn.className = 'btn-danger'; cBtn.innerText = '取消'; 
        cBtn.onclick = () => overlay.style.display = 'none'; 
        const okBtn = document.createElement('button'); okBtn.innerText = '確認載入'; 
        okBtn.onclick = () => { let val = document.getElementById('load-record-input').value; processLoadRecord(val); overlay.style.display = 'none'; }; 
        btns.appendChild(cBtn); btns.appendChild(okBtn); 
        overlay.style.display = 'flex'; 
        setTimeout(() => document.getElementById('load-record-input').focus(), 100); 
    }

    function processLoadRecord(code) { 
        const cCode = cleanCode(code); if (!cCode) return;
        const digits = cCode.split(''); 
        for (let r = 1; r <= 10; r++) { 
            for (let c = 1; c <= 4; c++) { 
                const k = r + '_' + c; if (globalGridData[k] && globalGridData[k][myName] === 1) { socket.emit('grid-action', { room: currentRoomId, r, c, name: myName, state: 0 }); delete globalGridData[k][myName]; }
            } 
        } 
        digits.forEach((digit, index) => { 
            const r = index + 1; const targetCol = parseInt(digit); 
            if (targetCol >= 1 && targetCol <= 4) { 
                const k = r + '_' + targetCol; 
                if (!Object.keys(globalGridData[k] || {}).some(n => n !== myName && globalGridData[k][n] === 1)) {
                    socket.emit('grid-action', { room: currentRoomId, r, c: targetCol, name: myName, state: 1 });
                    if(!globalGridData[k]) globalGridData[k]={}; globalGridData[k][myName]=1;
                }
            } 
        }); 
        setTimeout(() => { renderGrid(); updateMyGreenCode(); }, 100);
        showToast("紀錄載入完成"); 
    }

    function openEditProfile() { 
        const members = JSON.parse(sessionStorage.getItem('rj_members') || '[]'); 
        const myData = members.find(m => m.name === myName); 
        selectedColorIdx = myData ? myData.colorIndex : -1; 
        const content = document.getElementById('modal-content'); 
        const btns = document.getElementById('modal-btns'); 
        const overlay = document.getElementById('modal-overlay'); 
        content.onclick = null; 
        let colorHtml = '<div class="color-grid">'; 
        RAINBOW_COLORS.forEach((hex, idx) => { 
            const occupier = members.find(m => m.colorIndex === idx); 
            const isMine = occupier && occupier.name === myName; 
            const isDisabled = occupier && !isMine; 
            colorHtml += '<div class="color-cell '+(isDisabled ? 'disabled' : '')+' '+(idx === selectedColorIdx ? 'active' : '')+'" style="background:'+hex+'" onclick="'+(isDisabled ? '' : 'selectColor(' + idx + ')')+'">'+(occupier ? occupier.name.slice(-2) : '')+'</div>'; 
        }); 
        colorHtml += '</div>'; 
        content.innerHTML = '<input type="text" id="edit-name-input" class="room-input" maxlength="6" value="'+myName+'" onfocus="this.select()">' + colorHtml; 
        btns.innerHTML = ''; 
        const cBtn = document.createElement('button'); cBtn.className = 'btn-danger'; cBtn.innerText = '取消'; 
        cBtn.onclick = () => overlay.style.display = 'none'; 
        const sBtn = document.createElement('button'); sBtn.innerText = '儲存修改'; 
        sBtn.onclick = () => { 
            const nN = document.getElementById('edit-name-input').value.trim(); 
            if (!nN || nN.length > 6) { showToast("請輸入名稱", true); return; } 
            const suffix = nN.slice(-2); 
            if (members.some(m => m.name !== myName && m.name.slice(-2) === suffix)) { showToast("後兩字不可重複", true); return; } 
            socket.emit('update-profile', { roomId: currentRoomId, uid: sessionStorage.getItem('rj_uid'), newName: nN, colorIndex: selectedColorIdx }); 
            overlay.style.display = 'none'; 
        }; 
        btns.appendChild(cBtn); btns.appendChild(sBtn); overlay.style.display = 'flex'; 
    }

    function selectColor(idx) { selectedColorIdx = idx; document.querySelectorAll('.color-cell').forEach((d, i) => { if (!d.classList.contains('disabled')) d.classList.toggle('active', i === idx); }); }
    function formatDisplayCode(rawCode) { if (!rawCode || rawCode.length !== 10) return rawCode; return rawCode.substring(0, 5) + " " + rawCode.substring(5); }
    function cleanCode(val) { return val.toString().replace(/\\D/g, ""); }
    function handleManualAction() { let val = document.getElementById('manual-room-id').value.trim().toUpperCase(); if (!/^[A-Z0-9]+$/.test(val)) { showToast("房號錯誤", true); return; } if (val.length < 6 || val.length > 10) { showToast("房號長度錯誤", true); return; } currentRoomId = val; initAction('join', val); }
    function showConfirmModal(m, opts) { const c = document.getElementById('modal-content'); const b = document.getElementById('modal-btns'); if (!c || !b) return; c.onclick = null; c.innerText = m; b.innerHTML = ''; opts.forEach(o => { const btn = document.createElement('button'); btn.type = 'button'; btn.innerText = o.text; btn.style.background = (o.style === 'danger') ? '#444' : 'var(--my-green)'; btn.onclick = (e) => { e.stopPropagation(); o.callback(); }; b.appendChild(btn); }); document.getElementById('modal-overlay').style.display = 'flex'; }
    function askReset() { showConfirmModal('清空全隊數據？', [{ text: '取消', style: 'danger', callback: () => document.getElementById('modal-overlay').style.display = 'none' },{ text: '確定', callback: () => { socket.emit('grid-reset', currentRoomId); document.getElementById('modal-overlay').style.display = 'none'; } }]); }
    function askLeave() { showConfirmModal('退出房間？', [{ text: '取消', style: 'danger', callback: () => document.getElementById('modal-overlay').style.display = 'none' },{ text: '離開', callback: () => { sessionStorage.removeItem('rj_uid'); location.href='/'; } }]); }
    function copyLink() { const url = location.origin + '/?room=' + currentRoomId; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => showToast("已複製連結")); }
    function showToast(m, isError = false) { const t = document.getElementById('toast'); t.innerText = m; if(isError) t.classList.add('error'); else t.classList.remove('error'); t.style.opacity = '1'; setTimeout(() => t.style.opacity = '0', 2000); }
    function copyText(val) { if (!val || cleanCode(val) === "0000000000") return; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(val).then(() => showToast("已複製紀錄")); } else { const ta = document.createElement("textarea"); ta.value = val; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast("已複製紀錄"); } catch (e) {} document.body.removeChild(ta); } }
    function copyTextSilently(val) { if (val && cleanCode(val) !== "0000000000" && navigator.clipboard) { navigator.clipboard.writeText(val); } }
    function hideLoader() { const l = document.getElementById('loader'); if(l) { l.style.opacity='0'; setTimeout(()=>l.classList.add('hidden'), 300); } }
    function showLoader(msg = "載入中...") { const l = document.getElementById('loader'); if(!l) return; document.getElementById('loader-text').innerText = msg; l.classList.remove('hidden'); l.style.opacity='1'; }
    function getStats() { fetch('/api/stats?t=' + Date.now()).then(res => res.json()).then(data => { document.getElementById('room-count').innerText = data.count; }).catch(()=>{}); }
    function initAction(type, roomID = null, autoRestore = false) { showLoader("連線中..."); if (socket) { socket.disconnect(); socket = null; } socket = io({ reconnection: false, timeout: 5000 }); if (autoRestore) pendingRestoreCode = lastValidCode; setupSocketListeners(); const rId = (roomID || currentRoomId).toUpperCase(); const savedUid = sessionStorage.getItem('rj_uid'); socket.emit('join-room', { roomId: rId, uid: savedUid }); setTimeout(hideLoader, 5000); }
    function copyMyCode() { copyText(formatDisplayCode(lastValidCode)); }
    function copyRoomID() { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(currentRoomId).then(() => showToast("已複製房號")); } }
    function syncAction(r, c, s) { socket.emit('grid-action', { room: currentRoomId, r, c, name: myName, state: s }); const k = r+'_'+c; if(!globalGridData[k]) globalGridData[k]={}; if(s===0) delete globalGridData[k][myName]; else globalGridData[k][myName]=s; renderGrid(); updateMyGreenCode(); }
    function showBackupModal(mainMsg, code) { 
        const c = document.getElementById('modal-content'); const b = document.getElementById('modal-btns'); const o = document.getElementById('modal-overlay'); const d = formatDisplayCode(code); 
        c.innerHTML = mainMsg + '<br>當前紀錄：' + d + '<br><span style="font-size:0.7em; color:#666;">點擊複製</span>'; 
        c.onclick = () => copyText(d); b.innerHTML = ''; 
        const r = document.createElement('button'); r.innerText = '嘗試重連'; r.onclick = () => { o.style.display = 'none'; initAction('join', currentRoomId, true); }; 
        const h = document.createElement('button'); h.className = 'btn-danger'; h.innerText = '回到首頁'; h.onclick = () => location.href='/'; 
        b.appendChild(h); b.appendChild(r); o.style.display = 'flex'; 
    }
    function updateMyGreenCode() { let code = ""; for (let r = 1; r <= 10; r++) { let found = 0; for (let c = 1; c <= 4; c++) { const states = globalGridData[r + '_' + c] || {}; if (states[myName] === 1) { found = c; break; } } code += found; } lastValidCode = code; const display = formatDisplayCode(code); const liveCodeEl = document.getElementById('live-code'); if (liveCodeEl) liveCodeEl.innerText = display; if (document.getElementById('auto-copy-toggle')?.checked) copyTextSilently(display); return code; }
</script>
`;

// ==========================================
// --- Express 路由 ---
// ==========================================
app.get('/favicon.ico', (req, res) => res.sendFile(__dirname + '/favicon.ico'));

app.get('/api/stats', (req, res) => { 
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ count: rooms.size }); 
});

app.get('/', (req, res) => {
    res.send(
        '<!DOCTYPE html><html lang="zh-TW"><head>' + HEAD_PART + CSS_PART + '</head>' +
        '<body oncontextmenu="return false;">' +
        '<div id="loader"><div class="spinner"></div><div id="loader-text" style="font-size: 0.9em; color: #666;">載入中...</div></div>' +
        '<div class="mobile-container">' + HOME_VIEW_PART + ROOM_VIEW_PART + '</div>' +
        '<div id="modal-overlay"><div class="modal-card"><div id="modal-content" style="margin-bottom:25px; line-height:1.6; font-size:1.1em; color:#fff; cursor:pointer;"></div><div id="modal-btns" style="display:flex; gap:10px;"></div></div></div>' +
        '<div id="toast">已複製</div>' +
        JS_PART + 
        '</body></html>'
    );
});

// ==========================================
// --- Socket 邏輯 ---
// ==========================================
io.on('connection', (socket) => {
    socket.on('join-room', (data = {}) => {
        const { roomId, uid } = data;
        if (!roomId || !/^[A-Z0-9]{6,10}$/.test(roomId)) return socket.emit('error-msg', '房號格式錯誤。');

        let room = rooms.get(roomId);
        if (!room) {
            if (rooms.size >= MAX_ROOMS) return socket.emit('error-msg', '伺服器房間已滿');
            room = { members: [], lastActive: Date.now(), gridState: {} };
            rooms.set(roomId, room);
        }

        let member = room.members.find(m => m.uid === uid);
        
        if (member) {
            member.id = socket.id;
        } else if (room.members.length < 4) {
            const usedNames = room.members.map(m => m.name);
            const availableNames = ANIMAL_NAMES.filter(n => !usedNames.includes(n));
            const assignedName = availableNames[Math.floor(Math.random() * availableNames.length)];
            
            const usedColors = room.members.map(m => m.colorIndex);
            const availableColors = [0,1,2,3,4,5,6,7].filter(c => !usedColors.includes(c));
            const assignedColor = availableColors[Math.floor(Math.random() * availableColors.length)];

            member = { 
                id: socket.id, 
                uid: uid || Math.random().toString(36).substring(2, 15), 
                name: assignedName, 
                colorIndex: assignedColor 
            };
            room.members.push(member);
        } else {
            return socket.emit('error-msg', '房間已滿');
        }
        
        socket.join(roomId);
        socket.emit('room-joined', { 
            roomId, 
            identityName: member.name, 
            gridState: room.gridState, 
            uid: member.uid 
        });
        
        io.to(roomId).emit('update-members', room.members.map(m => ({ 
            name: m.name, 
            colorIndex: m.colorIndex 
        })));
    });
    
    socket.on('update-profile', (data) => {
        const room = rooms.get(data.roomId);
        if (!room) return;
        const member = room.members.find(m => m.uid === data.uid);
        if (!member) return;
        const suffix = data.newName.slice(-2);
        if (room.members.some(m => m.uid !== data.uid && m.name.slice(-2) === suffix)) return socket.emit('error-msg', '名稱後兩字與隊友重複！');
        if (room.members.some(m => m.uid !== data.uid && m.colorIndex === data.colorIndex)) return socket.emit('error-msg', '顏色剛被隊友選走了！');

        const oldName = member.name;
        member.name = data.newName;
        member.colorIndex = data.colorIndex;

        if (oldName !== member.name) {
            for (let key in room.gridState) {
                if (room.gridState[key] && room.gridState[key][oldName]) {
                    room.gridState[key][member.name] = room.gridState[key][oldName];
                    delete room.gridState[key][oldName];
                }
            }
        }
        io.to(data.roomId).emit('update-members', room.members.map(m => ({ name: m.name, colorIndex: m.colorIndex })));
        socket.emit('name-updated', { newName: member.name });
        io.to(data.roomId).emit('sync-full-state', { gridState: room.gridState });
    });

    socket.on('grid-action', (data = {}) => {
        const room = rooms.get(data.room);
        if (room) {
            room.lastActive = Date.now();
            const key = data.r + '_' + data.c;
            if (data.name === 'ALL_CLEAR') {
                room.gridState[key] = {}; 
            } else {
                if (!room.gridState[key]) room.gridState[key] = {};
                if (data.state === 0) delete room.gridState[key][data.name];
                else room.gridState[key][data.name] = data.state;
            }
            io.to(data.room).emit('grid-sync', data);
        }
    });

    socket.on('disconnect', () => {
    });

    socket.on('grid-reset', (id) => {
        const room = rooms.get(id);
        if (room) { room.gridState = {}; room.lastActive = Date.now(); io.to(id).emit('grid-reset-sync'); }
    });
});

server.listen(3000, () => console.log('羅密歐與茱麗葉小助手 v1.4.1 Online.'));