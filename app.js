const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 核心配置 ---
const ROOM_EXPIRY_MS = 1800000;  
const COUNTDOWN_SECONDS = 60;    
const MAX_ROOMS = 1000;
const ANIMAL_NAMES = ['小豬', '小狗', '小貓', '小兔', '小牛', '小羊', '小雞', '小人', '小蛇', '小龍', '小鬼'];

const rooms = new Map();

// 自動過期檢測
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (!room.isCountingDown && (now - room.lastActive > ROOM_EXPIRY_MS)) {
            room.isCountingDown = true;
            io.to(roomId).emit('start-countdown', COUNTDOWN_SECONDS);
            room.expiryTimeout = setTimeout(() => {
                io.to(roomId).emit('room-event', { type: 'closed', msg: '房間已解散' });
                rooms.delete(roomId);
            }, COUNTDOWN_SECONDS * 1000);
        }
    });
}, 10000);

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
    
    <title>Romeo and Juliet - 羅密歐與茱麗葉小助手</title>
    <meta name="description" content="專業 RJ 同步輔助工具，內建連鎖邏輯演算，自動標記 100% 確定位與 0% 邏輯排除。">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://rjtool.couchchao.com/">
    <meta property="og:title" content="Romeo and Juliet - 羅密歐與茱麗葉小助手">
    <meta property="og:description" content="我們會長敢吃屎 - 內建連鎖邏輯推論，讓隊伍效率翻倍！">

    <style>
        :root { --bg: #121212; --card: #1e1e1e; --text: #e0e0e0; --my-green: #28a745; --other-red: #dc3545; --accent: #f9d000; }
        
        /* 修正手機高度與捲動問題 */
        html, body { height: 100%; margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; }
        body { display: flex; justify-content: center; overflow-y: auto; -webkit-overflow-scrolling: touch; }

        .mobile-container { width: 100%; max-width: 400px; min-height: 100%; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; }
        .hidden { display: none !important; }
        
        #loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2000; transition: opacity 0.3s; }
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid var(--my-green); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .card { background: var(--card); border-radius: 12px; padding: 12px; margin-bottom: 8px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.4); }
        
        /* 縮小網格列高，確保 10 樓能塞進螢幕 */
        .grid-container { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
        .row { display: flex; gap: 5px; align-items: center; height: 40px; }
        .row-label { width: 30px; font-size: 0.7em; color: #666; text-align: center; font-weight: bold; }
        
        .cell { flex: 1; height: 100%; background: #222; border-radius: 6px; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1em; border: 1px solid #333; user-select: none; color: #333; overflow: hidden; }
        .cell.mine-ok { background: var(--my-green) !important; color: #fff !important; border-color: #34ce57; }
        .cell.mine-wrong { background: #000 !important; color: var(--other-red) !important; }
        .cell.others-ok { background: var(--other-red) !important; color: #fff !important; opacity: 0.8; }
        
        .prob { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-weight: 900; line-height: 1; }
        
        .btn-group { display: flex; gap: 8px; margin-top: 5px; padding-bottom: 15px; }
        button { flex: 1; padding: 12px; font-size: 0.95em; font-weight: bold; border: none; border-radius: 8px; background: var(--my-green); color: white; cursor: pointer; }
        .btn-danger { background: #333; color: #999; }
        
        .fixed-footer { color: var(--accent); font-size: 11px; font-weight: bold; text-align: center; padding: 5px 0; user-select: none; }
        #modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); display: none; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(6px); }
        .modal-card { background: var(--card); width: 85%; max-width: 320px; border-radius: 16px; padding: 25px; border: 1px solid #333; text-align: center; }
        #toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--my-green); color: white; padding: 8px 20px; border-radius: 25px; opacity: 0; transition: 0.3s; z-index: 1001; font-size: 14px; font-weight: bold; }
    </style>
</head>
<body oncontextmenu="return false;">
    <div id="loader"><div class="spinner"></div><div id="loader-text" style="font-size: 0.9em; color: #666;">載入中...</div></div>
    
    <div class="mobile-container">
        <div id="home-view" class="card hidden" style="margin-top: 5vh;">
            <h1 style="color:var(--my-green); font-size: 1.6em;">Romeo and Juliet Tool</h1>
            <p style="font-size: 0.9em; color: #666;">運作房間: <span id="room-count">...</span> / 1000</p>
            <button onclick="initAction('create')">開始使用</button>
            <div style="text-align:left; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; margin-top:15px; border:1px solid #2a2a2a;">
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 左鍵：標記正確格子 / 錯誤格子</p>
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 右鍵：取消自己格子</p>
                <p style="color:#aaa; font-size:0.85em; margin: 5px 0;">● 右鍵雙擊：取消別人格子</p>
            </div>
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
            
            <div style="font-size:0.7em; color:#555; text-align:center; margin-bottom:8px;">左鍵切換 | 右鍵取消 | 雙擊右鍵清他人</div>
            
            <div class="btn-group">
                <button class="btn-danger" onclick="askReset()">清空全部</button>
                <button class="btn-danger" onclick="askLeave()">退出</button>
            </div>
            <div class="fixed-footer">Made by CC</div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        let socket, currentRoom = '', myName = '', globalGridData = {};
        let lastRightClick = 0, countdownTimer = null;
        const targetRoom = new URLSearchParams(location.search).get('room');

        window.onload = () => {
            getStats();
            if (targetRoom) { document.getElementById('loader-text').innerText = '正在進入房間...'; initAction('join', targetRoom); }
            else { hideLoader(); document.getElementById('home-view').classList.remove('hidden'); }
        };

        function hideLoader() { const l = document.getElementById('loader'); if(l) { l.style.opacity='0'; setTimeout(()=>l.classList.add('hidden'), 300); } }
        function getStats() { fetch('/api/stats?t=' + Date.now()).then(res => res.json()).then(data => { document.getElementById('room-count').innerText = data.count; }); }

        function initAction(type, roomID = null) {
            if (!socket) { socket = io(); setupSocketListeners(); }
            if (type === 'create') socket.emit('create-room', { uid: sessionStorage.getItem('rj_uid') });
            else socket.emit('join-room', { roomId: roomID.toUpperCase(), uid: sessionStorage.getItem('rj_uid') });
        }

        function setupSocketListeners() {
            socket.on('room-joined', d => {
                hideLoader(); currentRoom = d.roomId; myName = d.identityName; sessionStorage.setItem('rj_uid', d.uid);
                document.getElementById('home-view').classList.add('hidden');
                document.getElementById('room-view').classList.remove('hidden');
                document.getElementById('display-room-id').innerText = d.roomId;
                document.getElementById('my-name-display').innerText = d.identityName;
                window.history.replaceState({}, '', '?room=' + d.roomId);
                globalGridData = d.gridState || {}; renderGrid();
            });
            socket.on('grid-sync', d => {
                const key = d.r + '_' + d.c;
                if (d.name === 'ALL_CLEAR') globalGridData[key] = {};
                else { if(!globalGridData[key]) globalGridData[key] = {}; if(d.state === 0) delete globalGridData[key][d.name]; else globalGridData[key][d.name] = d.state; }
                renderGrid();
            });
            socket.on('update-members', (list) => {
                sessionStorage.setItem('rj_members', JSON.stringify(list));
                document.getElementById('online-count-display').innerText = list.length + '/4';
                renderGrid();
            });
            socket.on('error-msg', m => { hideLoader(); window.history.replaceState({}, '', '/'); showConfirmModal(m, [{ text: '確定', callback: () => location.href='/' }]); });
            socket.on('grid-reset-sync', () => { globalGridData = {}; renderGrid(); });
            socket.on('room-event', d => { window.history.replaceState({}, '', '/'); showConfirmModal(d.msg, [{ text: '回首頁', callback: () => location.href='/' }]); });
            socket.on('start-countdown', (sec) => {
                let timeLeft = sec;
                const msg = () => '無操作，將於 ' + timeLeft + ' 秒後解散';
                showConfirmModal(msg(), [{ text: '我還在', callback: () => socket.emit('stay-alive', currentRoom) }]);
                if(countdownTimer) clearInterval(countdownTimer);
                countdownTimer = setInterval(() => { timeLeft--; const c = document.getElementById('modal-content'); if(c) c.innerText = msg(); if(timeLeft <= 0) clearInterval(countdownTimer); }, 1000);
            });
            socket.on('stop-countdown', () => { if(countdownTimer) clearInterval(countdownTimer); document.getElementById('modal-overlay').style.display = 'none'; });
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
                cell.oncontextmenu = (e) => { e.preventDefault(); const now = Date.now(); if (now - lastRightClick < 400) socket.emit('grid-action', { room: currentRoom, r, c, name: 'ALL_CLEAR', state: 0 }); else syncAction(r, c, 0); lastRightClick = now; };
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }

        function syncAction(r, c, s) { socket.emit('grid-action', { room: currentRoom, r, c, name: myName, state: s }); const k = r+'_'+c; if(!globalGridData[k]) globalGridData[k]={}; if(s===0) delete globalGridData[k][myName]; else globalGridData[k][myName]=s; renderGrid(); }

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

        function showConfirmModal(m, opts) { document.getElementById('modal-content').innerText = m; const a = document.getElementById('modal-btns'); a.innerHTML = ''; opts.forEach(o => { const b = document.createElement('button'); b.innerText = o.text; b.onclick = () => o.callback(); a.appendChild(b); }); document.getElementById('modal-overlay').style.display = 'flex'; }
        function askReset() { showConfirmModal('清空全隊數據？', [{ text: '取消', callback: () => document.getElementById('modal-overlay').style.display = 'none' },{ text: '確定', callback: () => { socket.emit('grid-reset', currentRoom); document.getElementById('modal-overlay').style.display = 'none'; } }]); }
        function askLeave() { showConfirmModal('退出房間？', [{ text: '取消', callback: () => document.getElementById('modal-overlay').style.display = 'none' },{ text: '離開', callback: () => { sessionStorage.removeItem('rj_uid'); location.href='/'; } }]); }
        function copyLink() {
            const url = location.origin + '/?room=' + currentRoom;
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(() => showToast()); }
            else { const ta = document.createElement("textarea"); ta.value = url; ta.style.position = "fixed"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); showToast(); } catch (e) {} document.body.removeChild(ta); }
        }
        function showToast() { const t = document.getElementById('toast'); t.style.opacity = '1'; setTimeout(() => t.style.opacity = '0', 1500); }
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
        rooms.set(roomId, { members: [{ id: socket.id, uid, name: shuffled[0] }], namePool: shuffled, lastActive: Date.now(), gridState: {}, isCountingDown: false });
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identityName: shuffled[0], gridState: {}, uid });
        io.to(roomId).emit('update-members', [shuffled[0]]);
    });

    socket.on('join-room', (data = {}) => {
        const { roomId, uid } = data;
        const room = rooms.get(roomId);
        if (!room) return socket.emit('error-msg', '房間無效。');
        let member = room.members.find(m => m.uid === uid);
        if (member) member.id = socket.id;
        else if (room.members.length < 4) {
            const activeNames = room.members.map(m => m.name);
            const assignedName = room.namePool.find(n => !activeNames.includes(n));
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

    socket.on('stay-alive', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.isCountingDown) { clearTimeout(room.expiryTimeout); room.isCountingDown = false; room.lastActive = Date.now(); io.to(roomId).emit('stop-countdown'); }
    });

    socket.on('grid-action', (data = {}) => {
        const room = rooms.get(data.room);
        if (room) {
            room.lastActive = Date.now();
            if(room.isCountingDown) { clearTimeout(room.expiryTimeout); room.isCountingDown = false; io.to(data.room).emit('stop-countdown'); }
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

server.listen(3000, () => console.log('Final RJ Tool - Master Version Online.'));