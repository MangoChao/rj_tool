const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 核心配置 ---
const ROOM_EXPIRY_MS = 600000;  // 10 分鐘 (10 * 60 * 1000)
const MAX_ROOMS = 1000;
const ANIMAL_NAMES = ['小豬', '阿狗', '阿貓', '兔兔', '牛牛', '老羊', '小雞', '小蛇', '龍哥', '小鬼'];

const rooms = new Map();

setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (now - room.lastActive > ROOM_EXPIRY_MS) {
            // 通知房間內所有人
            io.to(roomId).emit('error-msg', '房間因 10 分鐘無動作已解散。');
            rooms.delete(roomId);
        }
    });
}, 60000); 

app.get('/api/stats', (req, res) => { 
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ count: rooms.size }); 
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>羅密歐與茱麗葉小助手</title>
    <meta name="description" content="我們會長敢吃屎, 你們的敢嗎?">
    
    <meta property="og:title" content="羅密歐與茱麗葉小助手">
    <meta property="og:description" content="我們會長敢吃屎, 你們的敢嗎?">
    <meta property="og:type" content="website">

    <style>
        :root { --bg: #121212; --card: #1e1e1e; --text: #e0e0e0; --my-green: #28a745; --other-red: #dc3545; --accent: #f9d000; }
        html, body { height: 100%; margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; }
        body { display: flex; justify-content: center; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .mobile-container { width: 100%; max-width: 400px; min-height: 100%; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; }
        .hidden { display: none !important; }
        #loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 8000; transition: opacity 0.3s; }
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid var(--my-green); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .card { background: var(--card); border-radius: 12px; padding: 12px; margin-bottom: 8px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
        .grid-container { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
        .row { display: flex; gap: 5px; align-items: center; height: 40px; }
        .row-label { width: 30px; font-size: 0.7em; color: #666; text-align: center; font-weight: bold; }
        .cell { flex: 1; height: 100%; background: #222; border-radius: 6px; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1em; border: 1px solid #333; user-select: none; color: #333; overflow: hidden; }
        .cell.mine-ok { background: var(--my-green) !important; color: #fff !important; }
        .cell.mine-wrong { background: #000 !important; color: var(--other-red) !important; }
        .cell.others-ok { background: var(--other-red) !important; color: #fff !important; opacity: 0.8; }
        .prob { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-weight: 900; line-height: 1; }
        .control-panel { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
        .code-display-box { background: #000; border: 1px solid #333; padding: 10px; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; }
        .code-text { color: var(--accent); font-family: monospace; font-size: 1.4em; font-weight: bold; letter-spacing: 2px; }
        .auto-copy-wrap { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 0.85em; color: #888; }
        .btn-group { display: flex; gap: 8px; padding-bottom: 20px; position: relative; z-index: 10; }
        button { flex: 1; padding: 15px; font-size: 1em; font-weight: bold; border: none; border-radius: 8px; background: var(--my-green); color: white; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .btn-danger { background: #333; color: #999; }
        .fixed-footer { color: var(--accent); font-size: 11px; font-weight: bold; text-align: center; padding: 5px 0 15px 0; user-select: none; }
        #modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: none; align-items: center; justify-content: center; z-index: 5000; backdrop-filter: blur(8px); }
        .modal-card { background: var(--card); width: 85%; max-width: 320px; border-radius: 16px; padding: 25px; border: 1px solid #444; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.8); position: relative; }
        #toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--my-green); color: white; padding: 8px 20px; border-radius: 25px; opacity: 0; transition: 0.3s; z-index: 6000; font-size: 14px; font-weight: bold; pointer-events: none; }
        .version-info { font-size: 10px; color: #555; margin-top: 10px; }
        .copy-hint { color: var(--other-red); font-size: 0.75em; display: block; margin-top: 8px; font-weight: bold; }
        .record-input { background: #000; border: 1px solid #555; color: var(--accent); width: 100%; padding: 12px; border-radius: 8px; font-size: 1.5em; text-align: center; letter-spacing: 5px; margin-bottom: 10px; outline: none; }
    </style>
</head>
<body oncontextmenu="return false;">
    <div id="loader"><div class="spinner"></div><div id="loader-text" style="font-size: 0.9em; color: #666;">載入中...</div></div>
    <div class="mobile-container">
        <div id="home-view" class="card hidden" style="margin-top: 5vh;">
            <h1 style="color:var(--my-green); font-size: 1.6em;">RJ 小助手</h1>
            <p style="font-size: 0.9em; color: #666;">運作房間: <span id="room-count">...</span> / 1000</p>
            <button onclick="initAction('create')">開始使用</button>
            <div style="text-align:left; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; margin-top:15px; border:1px solid #2a2a2a;">
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 左鍵：標記正確格子 / 錯誤格子</p>
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 右鍵：取消自己格子 (手機長按)</p>
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 右鍵雙擊：取消別人格子</p>
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 自動複製：每次點擊格子都會複製紀錄</p>
            </div>
            <div class="version-info">v1.1.5 | 最後更新: 2026-03-22 21:15</div>
            <div class="fixed-footer" style="padding-top: 10px;">Made by CC</div>
        </div>
        <div id="room-view" class="hidden">
            <div class="card" style="padding: 10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.85em; color:#888; align-items: center;">
                    <div style="text-align:left">房號: <b id="display-room-id" style="color:#eee"></b><br>人數: <b id="online-count-display" style="color:var(--accent)">0/4</b></div>
                    <div style="text-align:right">你是 <b id="my-name-display" style="color:var(--my-green)"></b></div>
                </div>
                <div id="share-link-text" style="font-size:0.75em; color:var(--my-green); border:1px solid #333; padding:8px; border-radius:6px; background:#000; margin-top:8px; cursor:pointer" onclick="copyLink()">點擊複製邀請連結</div>
            </div>
            <div class="grid-container" id="grid"></div>
            <div class="control-panel">
                <div class="code-display-box" onclick="copyMyCode()">
                    <span id="live-code" class="code-text">0000000000</span>
                </div>
                <div style="display:flex; gap:8px;">
                    <div class="auto-copy-wrap" style="flex:1; justify-content:flex-start;">
                        <input type="checkbox" id="auto-copy-toggle" style="transform: scale(1.3);"> 
                        <label for="auto-copy-toggle">開啟自動複製</label>
                    </div>
                    <button type="button" style="padding:8px 15px; font-size:0.85em; background:#444;" onclick="askLoadRecord()">載入紀錄</button>
                </div>
            </div>
            <div class="btn-group">
                <button type="button" class="btn-danger" onclick="askReset()">清空全部</button>
                <button type="button" class="btn-danger" onclick="askLeave()">退出</button>
            </div>
            <div class="fixed-footer">Made by CC</div>
        </div>
    </div>
    <div id="modal-overlay">
        <div class="modal-card">
            <div id="modal-content" style="margin-bottom:25px; line-height:1.6; font-size:1.1em; color:#fff; cursor:pointer;"></div>
            <div id="modal-btns" style="display:flex; gap:10px;"></div>
        </div>
    </div>
    <div id="toast">已複製</div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        let socket, currentRoomId = '', myName = '', globalGridData = {};
        let lastRightClick = 0, lastValidCode = "0000000000"; 
        let pendingRestoreCode = null; 

        window.onload = () => {
            getStats();
            const targetRoom = new URLSearchParams(location.search).get('room');
            if (targetRoom) { 
                currentRoomId = targetRoom.toUpperCase(); 
                initAction('join', targetRoom); 
            } else { 
                hideLoader(); 
                document.getElementById('home-view').classList.remove('hidden'); 
            }
        };

        function hideLoader() { const l = document.getElementById('loader'); if(l) { l.style.opacity='0'; setTimeout(()=>l.classList.add('hidden'), 300); } }
        function showLoader(msg = "載入中...") { 
            const l = document.getElementById('loader');
            if(!l) return;
            document.getElementById('loader-text').innerText = msg;
            l.classList.remove('hidden'); l.style.opacity='1';
        }
        function getStats() { fetch('/api/stats?t=' + Date.now()).then(res => res.json()).then(data => { document.getElementById('room-count').innerText = data.count; }).catch(()=>{}); }

        function initAction(type, roomID = null, autoRestore = false) {
            showLoader(type === 'join' ? "連線中..." : "載入中...");
            if (socket) { socket.disconnect(); socket = null; } 
            socket = io({ reconnection: false, timeout: 5000 });
            if (autoRestore) pendingRestoreCode = lastValidCode;
            setupSocketListeners();
            const rId = (roomID || currentRoomId).toUpperCase();
            if (type === 'create') socket.emit('create-room', { uid: sessionStorage.getItem('rj_uid') });
            else socket.emit('join-room', { roomId: rId, uid: sessionStorage.getItem('rj_uid') });
            setTimeout(hideLoader, 5000);
        }

        function updateMyGreenCode() {
            let code = "";
            for (let r = 1; r <= 10; r++) {
                let found = 0;
                for (let c = 1; c <= 4; c++) {
                    const states = globalGridData[r + '_' + c] || {};
                    if (states[myName] === 1) { found = c; break; }
                }
                code += found;
            }
            lastValidCode = code;
            if (document.getElementById('live-code')) document.getElementById('live-code').innerText = code;
            if (document.getElementById('auto-copy-toggle')?.checked) copyTextSilently(code);
            return code;
        }

        function copyMyCode() { copyText(lastValidCode); }
        function copyText(val) {
            if (!val || val === "0000000000") return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(val).then(() => showToast("已複製: " + val));
            } else {
                const ta = document.createElement("textarea"); ta.value = val; ta.style.position = "fixed"; ta.style.left = "-9999px";
                document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast("已複製: " + val); } catch (e) {} document.body.removeChild(ta);
            }
        }
        function copyTextSilently(val) { if (val && val !== "0000000000" && navigator.clipboard) navigator.clipboard.writeText(val); }

        function setupSocketListeners() {
            socket.on('connect_error', () => { hideLoader(); showToast("無法連線"); });
            socket.on('disconnect', () => { hideLoader(); showBackupModal('連線已中斷。', lastValidCode); });
            socket.on('room-joined', d => {
                hideLoader(); 
                currentRoomId = d.roomId; myName = d.identityName; sessionStorage.setItem('rj_uid', d.uid);
                document.getElementById('home-view').classList.add('hidden');
                document.getElementById('room-view').classList.remove('hidden');
                document.getElementById('display-room-id').innerText = d.roomId;
                document.getElementById('my-name-display').innerText = d.identityName;
                window.history.replaceState({}, '', '?room=' + d.roomId);
                globalGridData = d.gridState || {}; renderGrid(); updateMyGreenCode();
                if (pendingRestoreCode) {
                    const code = pendingRestoreCode;
                    pendingRestoreCode = null;
                    setTimeout(() => processLoadRecord(code), 300);
                }
                document.getElementById('modal-overlay').style.display = 'none';
            });
            socket.on('grid-sync', d => {
                const key = d.r + '_' + d.c;
                if (d.name === 'ALL_CLEAR') globalGridData[key] = {};
                else { if(!globalGridData[key]) globalGridData[key] = {}; if(d.state === 0) delete globalGridData[key][d.name]; else globalGridData[key][d.name] = d.state; }
                renderGrid(); updateMyGreenCode();
            });
            socket.on('update-members', (list) => {
                sessionStorage.setItem('rj_members', JSON.stringify(list));
                document.getElementById('online-count-display').innerText = list.length + '/4';
                renderGrid();
            });
            socket.on('error-msg', m => { 
                hideLoader(); 
                if (m === '房間無效。' || m === '房間因 10 分鐘無動作已解散。') showBackupModal(m, lastValidCode);
                else showConfirmModal(m, [{ text: '確定', callback: () => location.href='/' }]); 
            });
            socket.on('grid-reset-sync', () => { globalGridData = {}; lastValidCode = "0000000000"; if (document.getElementById('live-code')) document.getElementById('live-code').innerText = "0000000000"; renderGrid(); });
        }

        function showBackupModal(mainMsg, code) {
            const content = document.getElementById('modal-content');
            const btns = document.getElementById('modal-btns');
            const overlay = document.getElementById('modal-overlay');
            content.innerHTML = mainMsg + '<br>當前紀錄：' + code + '<br><span class="copy-hint">點擊複製</span>';
            content.onclick = () => copyText(code);
            btns.innerHTML = '';
            const retryBtn = document.createElement('button'); retryBtn.innerText = '嘗試重連';
            retryBtn.onclick = () => { overlay.style.display = 'none'; initAction('join', currentRoomId, true); };
            const homeBtn = document.createElement('button'); homeBtn.className = 'btn-danger'; homeBtn.innerText = '回到首頁';
            homeBtn.onclick = () => location.href='/';
            btns.appendChild(homeBtn); btns.appendChild(retryBtn);
            overlay.style.display = 'flex';
        }

        function askLoadRecord() {
            const content = document.getElementById('modal-content');
            const btns = document.getElementById('modal-btns');
            const overlay = document.getElementById('modal-overlay');
            content.innerHTML = '<div style="font-size:0.9em; margin-bottom:10px;">請輸入紀錄數字</div>' +
                               '<input type="tel" id="load-record-input" class="record-input" maxlength="10" placeholder="0000000000">';
            content.onclick = null;
            btns.innerHTML = '';
            const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn-danger'; cancelBtn.innerText = '取消';
            cancelBtn.onclick = () => overlay.style.display = 'none';
            const confirmBtn = document.createElement('button'); confirmBtn.innerText = '確認載入';
            confirmBtn.onclick = () => {
                let val = document.getElementById('load-record-input').value;
                if (!/^\\d+$/.test(val)) { alert('請輸入數字'); return; }
                processLoadRecord(val.padEnd(10, '0')); overlay.style.display = 'none';
            };
            btns.appendChild(cancelBtn); btns.appendChild(confirmBtn);
            overlay.style.display = 'flex';
            setTimeout(() => document.getElementById('load-record-input').focus(), 100);
        }

        function processLoadRecord(code) {
            const digits = code.split('');
            for (let r = 1; r <= 10; r++) {
                for (let c = 1; c <= 4; c++) {
                    const k = r + '_' + c;
                    if (globalGridData[k] && globalGridData[k][myName] === 1) syncAction(r, c, 0);
                }
            }
            digits.forEach((digit, index) => {
                const r = index + 1; const targetCol = parseInt(digit);
                if (targetCol >= 1 && targetCol <= 4) {
                    const k = r + '_' + targetCol;
                    if (!Object.keys(globalGridData[k] || {}).some(n => n !== myName && globalGridData[k][n] === 1)) syncAction(r, targetCol, 1);
                }
            });
            showToast("紀錄載入完成");
        }

        const grid = document.getElementById('grid');
        for (let r = 10; r >= 1; r--) {
            const row = document.createElement('div'); row.className = 'row'; row.innerHTML = '<div class="row-label">F'+r+'</div>';
            for (let c = 1; c <= 4; c++) {
                const cell = document.createElement('div'); cell.className = 'cell'; cell.id = 'r'+r+'c'+c; cell.innerHTML = '<span class="val"></span><div class="prob"></div>';
                cell.onclick = () => {
                    const key = r + '_' + c; const cur = (globalGridData[key] && globalGridData[key][myName]) || 0; let next = (cur === 1) ? 2 : 1;
                    if (next === 1) { if (Object.keys(globalGridData[key] || {}).some(n => n != myName && globalGridData[key][n] === 1)) return; for (let i=1; i<=4; i++) if (i !== c && globalGridData[r+'_'+i] && globalGridData[r+'_'+i][myName] === 1) syncAction(r, i, 0); }
                    syncAction(r, c, next);
                };
                cell.oncontextmenu = (e) => { e.preventDefault(); const now = Date.now(); if (now - lastRightClick < 400) socket.emit('grid-action', { room: currentRoomId, r, c, name: 'ALL_CLEAR', state: 0 }); else syncAction(r, c, 0); lastRightClick = now; };
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }

        function syncAction(r, c, s) { socket.emit('grid-action', { room: currentRoomId, r, c, name: myName, state: s }); const k = r+'_'+c; if(!globalGridData[k]) globalGridData[k]={}; if(s===0) delete globalGridData[k][myName]; else globalGridData[k][myName]=s; renderGrid(); updateMyGreenCode(); }

        function renderGrid() {
            const members = JSON.parse(sessionStorage.getItem('rj_members') || '[]');
            for (let r = 1; r <= 10; r++) {
                let finalOk = {}, myWrongs = [], playerPot = {};
                members.forEach(n => playerPot[n] = [1, 2, 3, 4]);
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
                    members.forEach(n => {
                        if (!Object.values(finalOk).includes(n)) {
                            let avail = (playerPot[n] || []).filter(col => !finalOk[col]);
                            if (avail.length === 1) { finalOk[avail[0]] = n; changed = true; }
                        }
                    });
                }
                for (let c = 1; c <= 4; c++) {
                    const cell = document.getElementById('r'+r+'c'+c);
                    const probDiv = cell.querySelector('.prob');
                    const states = globalGridData[r+'_'+c] || {};
                    cell.className = 'cell'; cell.querySelector('.val').innerText = '';
                    Object.keys(states).forEach(n => {
                        if (states[n] === 1) { cell.classList.add(n == myName ? 'mine-ok' : 'others-ok'); cell.querySelector('.val').innerText = n.substring(1); }
                        else if (n == myName && states[n] === 2) { cell.classList.add('mine-wrong'); cell.querySelector('.val').innerText = 'X'; }
                    });
                    if (Object.keys(states).some(n => states[n] === 1 || (n == myName && states[n] === 2))) { probDiv.innerText = ''; } else {
                        let pVal = 0;
                        const occupier = finalOk[c];
                        const myConfirmedCol = Object.keys(finalOk).find(k => finalOk[k] === myName);
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

        function showConfirmModal(m, opts) { 
            const content = document.getElementById('modal-content');
            const btns = document.getElementById('modal-btns');
            if (!content || !btns) return;
            content.innerText = m; btns.innerHTML = ''; 
            opts.forEach(o => { 
                const b = document.createElement('button'); b.type = 'button'; b.innerText = o.text; 
                b.style.background = (o.style === 'danger') ? '#444' : 'var(--my-green)';
                b.onclick = (e) => { e.stopPropagation(); o.callback(); }; btns.appendChild(b); 
            }); 
            document.getElementById('modal-overlay').style.display = 'flex'; 
        }

        function askReset() { showConfirmModal('清空全隊數據？', [{ text: '取消', style: 'danger', callback: () => document.getElementById('modal-overlay').style.display = 'none' },{ text: '確定', callback: () => { socket.emit('grid-reset', currentRoomId); document.getElementById('modal-overlay').style.display = 'none'; } }]); }
        function askLeave() { showConfirmModal('退出房間？', [{ text: '取消', style: 'danger', callback: () => document.getElementById('modal-overlay').style.display = 'none' },{ text: '離開', callback: () => { sessionStorage.removeItem('rj_uid'); location.href='/'; } }]); }
        function showToast(m) { const t = document.getElementById('toast'); t.innerText = m; t.style.opacity = '1'; setTimeout(() => t.style.opacity = '0', 1500); }
        function copyLink() {
            const url = location.origin + '/?room=' + currentRoomId;
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => showToast("已複製邀請連結"));
        }
    </script>
</body>
</html>
    `);
});

// --- Socket 邏輯 ---
io.on('connection', (socket) => {
    socket.on('create-room', (data = {}) => {
        if (rooms.size >= MAX_ROOMS) return socket.emit('error-msg', '目前房間已滿。');
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const uid = data.uid || Math.random().toString(36).substring(2, 15);
        const shuffled = [...ANIMAL_NAMES].sort(() => 0.5 - Math.random()).slice(0, 4);
        rooms.set(roomId, { members: [{ id: socket.id, uid, name: shuffled[0] }], namePool: shuffled, lastActive: Date.now(), gridState: {} });
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identityName: shuffled[0], gridState: {}, uid });
        io.to(roomId).emit('update-members', [shuffled[0]]);
    });

    socket.on('join-room', (data = {}) => {
        const { roomId, uid } = data;
        let room = rooms.get(roomId);
        
        // 若伺服器剛重啟，房間不存在，則自動以此 ID 重建
        if (!room) {
            const shuffled = [...ANIMAL_NAMES].sort(() => 0.5 - Math.random()).slice(0, 4);
            room = { members: [], namePool: shuffled, lastActive: Date.now(), gridState: {} };
            rooms.set(roomId, room);
        }

        let member = room.members.find(m => m.uid === uid);
        if (member) {
            member.id = socket.id;
        } else if (room.members.length < 4) {
            const assignedName = room.namePool.find(n => !room.members.map(m=>m.name).includes(n));
            member = { id: socket.id, uid: uid || Math.random().toString(36).substring(2, 15), name: assignedName };
            room.members.push(member);
        } else return socket.emit('error-msg', '房間已滿。');
        
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identityName: member.name, gridState: room.gridState, uid: member.uid });
        io.to(roomId).emit('update-members', room.members.map(m => m.name));
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            const idx = room.members.findIndex(m => m.id === socket.id);
            if (idx !== -1) { room.members.splice(idx, 1); io.to(roomId).emit('update-members', room.members.map(m => m.name)); }
        });
    });

    socket.on('grid-action', (data = {}) => {
        const room = rooms.get(data.room);
        if (room) {
            room.lastActive = Date.now();
            const key = data.r + '_' + data.c;
            if (data.name === 'ALL_CLEAR') room.gridState[key] = {}; 
            else { if (!room.gridState[key]) room.gridState[key] = {}; if (data.state === 0) delete room.gridState[key][data.name]; else room.gridState[key][data.name] = data.state; }
            io.to(data.room).emit('grid-sync', data);
        }
    });

    socket.on('grid-reset', (id) => {
        const room = rooms.get(id);
        if (room) { room.gridState = {}; room.lastActive = Date.now(); io.to(id).emit('grid-reset-sync'); }
    });
});

server.listen(3000, () => console.log('RJ Tool v1.1.5 Online.'));