const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 設定常數 ---
let ROOM_EXPIRY_MS = 1800000; // 預設 30 分鐘，測試時可改為 60000 (1分鐘)
const MAX_ROOMS = 1000;
const rooms = new Map();

// --- 快取機制：每 5 秒更新一次房間總數，避免 API 直接存取 Map ---
let cachedRoomCount = 0;
setInterval(() => {
    cachedRoomCount = rooms.size;
}, 5000);

// --- API: 取得房間數 (極省效能) ---
app.get('/api/stats', (req, res) => {
    // 這裡可以視需求加入簡單的 IP 頻率限制 (Express-rate-limit)
    res.json({ count: cachedRoomCount });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Artale R&J Pro</title>
    <style>
        :root { --bg: #121212; --card: #1e1e1e; --text: #e0e0e0; --my-green: #28a745; --other-red: #dc3545; }
        body { font-family: sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; justify-content: center; height: 100vh; overflow: hidden; }
        .mobile-container { width: 100%; max-width: 400px; height: 100%; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; }
        .hidden { display: none !important; }
        .card { background: var(--card); border-radius: 8px; padding: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); margin-bottom: 8px; text-align: center; }
        .grid-container { flex: 1; display: flex; flex-direction: column; gap: 3px; min-height: 0; }
        .row { display: flex; gap: 4px; align-items: center; flex: 1; min-height: 0; }
        .row-label { width: 30px; font-size: 0.65em; color: #555; text-align: center; }
        .cell { flex: 1; height: 95%; background: #222; border-radius: 4px; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2em; border: 1px solid #333; transition: 0.1s; user-select: none; color: #444; }
        .cell.mine-ok { background: var(--my-green) !important; color: #fff !important; }
        .cell.mine-wrong { background: #111 !important; color: #dc3545 !important; }
        .cell.others-ok { background: var(--other-red) !important; color: #fff !important; opacity: 0.7; }
        .prob { position: absolute; bottom: 2px; right: 2px; font-size: 10px; color: #ffca28; pointer-events: none; }
        .btn-group { display: flex; gap: 8px; margin-top: 5px; }
        button { flex: 1; padding: 12px; font-size: 0.85em; font-weight: bold; border: none; border-radius: 6px; background: var(--my-green); color: white; cursor: pointer; }
        .btn-danger { background: #444; color: #ccc; }
        #modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .modal-card { background: var(--card); width: 85%; max-width: 300px; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #333; }
        #toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--my-green); color: white; padding: 6px 16px; border-radius: 20px; opacity: 0; transition: 0.3s; z-index: 1001; font-size: 12px; }
    </style>
</head>
<body oncontextmenu="return false;">
    <div class="mobile-container">
        <div id="home-view" class="card" style="margin-top: 25vh;">
            <h2 style="color:var(--my-green)">R&J 智慧助手</h2>
            <p style="font-size: 0.8em; color: #666">目前房間: <span id="room-count">...</span> / 1000</p>
            <button onclick="initAction('create')">創建新房間</button>
            <p id="join-error" style="color:var(--other-red); font-size:12px; margin-top:10px"></p>
        </div>

        <div id="room-view" class="hidden" style="height: 100%; display: flex; flex-direction: column;">
            <div class="card">
                <div style="display:flex; justify-content:space-between; font-size:0.75em; color:#888; margin-bottom:5px">
                    <span>房號: <b id="display-room-id" style="color:#eee"></b></span>
                    <span>你: <b id="my-id-display" style="color:var(--my-green)"></b> 號位</span>
                </div>
                <div id="share-link-text" class="card" style="font-size:0.7em; color:var(--my-green); background:#000; margin:0; cursor:pointer" onclick="copyLink()">點擊複製邀請連結</div>
            </div>
            <div class="grid-container" id="grid"></div>
            <div class="btn-group">
                <button class="btn-danger" onclick="askReset()">全清</button>
                <button class="btn-danger" onclick="askLeave()">退出</button>
            </div>
        </div>
    </div>

    <div id="modal-overlay"><div class="modal-card"><div id="modal-content" style="margin-bottom:20px"></div><div id="modal-btns" class="btn-group"></div></div></div>
    <div id="toast">已複製邀請連結</div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        let socket; // 延後初始化
        let currentRoom = '', myNum = 0, globalGridData = {};
        let lastRightClick = 0;

        // --- 1. 首頁效能優化：只在必要時獲取人數 ---
        function getStats() {
            fetch('/api/stats').then(res => res.json()).then(data => {
                document.getElementById('room-count').innerText = data.count;
            });
        }

        // --- 2. 初始化連線 (只有要進房才連) ---
        function initAction(type, roomID = null) {
            if (!socket) {
                socket = io();
                setupSocketListeners();
            }
            if (type === 'create') {
                socket.emit('create-room', { uid: sessionStorage.getItem('rj_uid') });
            } else {
                socket.emit('join-room', { roomId: roomID.toUpperCase(), uid: sessionStorage.getItem('rj_uid') });
            }
        }

        function setupSocketListeners() {
            socket.on('room-joined', d => {
                currentRoom = d.roomId; myNum = d.identity; sessionStorage.setItem('rj_uid', d.uid);
                document.getElementById('home-view').classList.add('hidden');
                document.getElementById('room-view').classList.remove('hidden');
                document.getElementById('display-room-id').innerText = d.roomId;
                document.getElementById('my-id-display').innerText = d.identity;
                document.getElementById('share-link-text').innerText = location.origin + '/?room=' + d.roomId;
                globalGridData = d.gridState || {}; render();
            });

            socket.on('grid-sync', d => {
                if (d.num === -1) globalGridData[d.r+'_'+d.c] = {};
                else {
                    if(!globalGridData[d.r+'_'+d.c]) globalGridData[d.r+'_'+d.c] = {};
                    globalGridData[d.r+'_'+d.c][d.num] = d.state;
                }
                render();
            });

            socket.on('grid-reset-sync', () => { globalGridData = {}; render(); });
            socket.on('error-msg', m => { 
                showModal(m); 
                getStats(); // 失敗時才更新人數，增加資訊準確度
            });
            socket.on('room-event', d => { if(d.type==='closed') alert(d.msg), location.href='/'; });
        }

        // --- 3. 網格邏輯 (略，與前版相同) ---
        const grid = document.getElementById('grid');
        for (let r = 10; r >= 1; r--) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowDiv.innerHTML = '<div class="row-label">F' + r + '</div>';
            for (let c = 1; c <= 4; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.id = 'r' + r + 'c' + c;
                cell.innerHTML = '<span class="val"></span><div class="prob"></div>';
                cell.onclick = () => handleCellClick(r, c);
                cell.ondblclick = () => syncAction(r, c, 0);
                cell.oncontextmenu = (e) => {
                    e.preventDefault();
                    const now = Date.now();
                    if (now - lastRightClick < 500) socket.emit('grid-action', { room: currentRoom, r, c, num: -1, state: 0 });
                    lastRightClick = now;
                };
                rowDiv.appendChild(cell);
            }
            grid.appendChild(rowDiv);
        }

        function handleCellClick(r, c) {
            const key = r + '_' + c;
            const states = globalGridData[key] || {};
            const cur = states[myNum] || 0;
            let next = (cur + 1) % 3;
            if (next === 1) {
                const otherOk = Object.keys(states).find(p => p != myNum && states[p] === 1);
                if (otherOk) return showModal('隊友 ' + otherOk + ' 號已佔領。');
                for (let i=1; i<=4; i++) {
                    const k = r + '_' + i;
                    if (i !== c && globalGridData[k] && globalGridData[k][myNum] === 1) syncAction(r, i, 0);
                }
            }
            if (next === 2) {
                let xCount = 0;
                for (let i=1; i<=4; i++) if (i !== c && globalGridData[r+'_'+i] && globalGridData[r+'_'+i][myNum] === 2) xCount++;
                if (xCount >= 3) next = 1; 
            }
            syncAction(r, c, next);
        }

        function syncAction(r, c, state) {
            socket.emit('grid-action', { room: currentRoom, r, c, num: myNum, state });
            if(!globalGridData[r+'_'+c]) globalGridData[r+'_'+c] = {};
            globalGridData[r+'_'+c][myNum] = state;
            render();
        }

        function render() {
            for (let r = 1; r <= 10; r++) {
                let finalOkMap = {};
                let playerPotential = { 1: [1,2,3,4], 2: [1,2,3,4], 3: [1,2,3,4], 4: [1,2,3,4] };
                for (let c = 1; c <= 4; c++) {
                    const states = globalGridData[r+'_'+c] || {};
                    const cell = document.getElementById('r'+r+'c'+c);
                    cell.className = 'cell'; cell.querySelector('.val').innerText = '';
                    Object.keys(states).forEach(p => {
                        const s = states[p];
                        if (s === 1) finalOkMap[c] = p;
                        if (s === 2) playerPotential[p] = playerPotential[p].filter(v => v !== c);
                        if (s === 1) {
                            cell.classList.add(p == myNum ? 'mine-ok' : 'others-ok');
                            cell.querySelector('.val').innerText = p;
                        } else if (s === 2 && p == myNum) {
                            cell.classList.add('mine-wrong');
                            cell.querySelector('.val').innerText = 'X';
                        }
                    });
                }
                [1,2,3,4].forEach(p => {
                    if (!Object.values(finalOkMap).includes(p.toString())) {
                        let available = playerPotential[p].filter(col => !finalOkMap[col] || finalOkMap[col] == p);
                        if (available.length === 1) finalOkMap[available[0]] = p.toString();
                    }
                });
                for (let c = 1; c <= 4; c++) {
                    const probDiv = document.getElementById('r'+r+'c'+c).querySelector('.prob');
                    let pVal = 0;
                    if (finalOkMap[c] == myNum) pVal = 100;
                    else if (Object.values(finalOkMap).includes(myNum.toString()) || finalOkMap[c] || !playerPotential[myNum].includes(c)) pVal = 0;
                    else {
                        let myRemains = playerPotential[myNum].filter(col => !finalOkMap[col]);
                        pVal = Math.floor(100 / myRemains.length);
                    }
                    probDiv.innerText = pVal > 0 ? pVal + '%' : '';
                    probDiv.style.color = pVal === 100 ? '#ffca28' : '#888';
                }
            }
        }

        // --- 4. 基礎 UI (彈窗、複製) ---
        function showModal(m) {
            document.getElementById('modal-content').innerText = m;
            document.getElementById('modal-btns').innerHTML = '<button onclick="document.getElementById(\\'modal-overlay\\').style.display=\\'none\\'">確定</button>';
            document.getElementById('modal-overlay').style.display = 'flex';
        }
        function askReset() { socket.emit('grid-reset', currentRoom); }
        function askLeave() { sessionStorage.removeItem('rj_uid'); location.href='/'; }
        function copyLink() {
            navigator.clipboard.writeText(document.getElementById('share-link-text').innerText);
            const t = document.getElementById('toast'); t.style.opacity = '1'; setTimeout(()=>t.style.opacity='0',1500);
        }

        window.onload = () => {
            getStats(); // 初次進入抓取人數
            const r = new URLSearchParams(location.search).get('room');
            if(r) initAction('join', r);
        };
    </script>
</body>
</html>
    `);
});

// --- Socket 邏輯 (省略無異動部分，確保有帶入 data = {} 預設值) ---
io.on('connection', (socket) => {
    socket.on('create-room', (data = {}) => {
        if (rooms.size >= MAX_ROOMS) return socket.emit('error-msg', '目前房間已滿 (1000/1000)，請稍候再試。');
        const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const uid = data.uid || Math.random().toString(36).substring(2, 15);
        rooms.set(roomId, { members: [{ id: socket.id, uid, num: 1 }], lastActive: Date.now(), gridState: {} });
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identity: 1, gridState: {}, uid });
    });

    socket.on('join-room', (data = {}) => {
        const { roomId, uid } = data;
        const room = rooms.get(roomId);
        if (!room) return socket.emit('error-msg', '該房間不存在或已解散。');
        const exist = room.members.find(m => m.uid === uid);
        if (exist) {
            exist.id = socket.id;
            socket.join(roomId);
            socket.emit('room-joined', { roomId, identity: exist.num, gridState: room.gridState, uid });
        } else if (room.members.length < 4) {
            const used = room.members.map(m => m.num);
            let n = [1,2,3,4].find(i => !used.includes(i));
            const newUid = uid || Math.random().toString(36).substring(2, 15);
            room.members.push({ id: socket.id, uid: newUid, num: n });
            socket.join(roomId);
            socket.emit('room-joined', { roomId, identity: n, gridState: room.gridState, uid: newUid });
        } else {
            socket.emit('error-msg', '此房間已滿 4 人。');
        }
    });

    socket.on('grid-action', (data = {}) => {
        const room = rooms.get(data.room);
        if (room) {
            room.lastActive = Date.now();
            const key = data.r + '_' + data.c;
            if (data.num === -1) room.gridState[key] = {};
            else {
                if (!room.gridState[key]) room.gridState[key] = {};
                if (data.state === 0) delete room.gridState[key][data.num];
                else room.gridState[key][data.num] = data.state;
            }
            io.to(data.room).emit('grid-sync', data);
        }
    });

    socket.on('grid-reset', (id) => {
        const room = rooms.get(id);
        if (room) { room.gridState = {}; io.to(id).emit('grid-reset-sync'); }
    });
});

server.listen(3000, () => console.log('Performance Optimized RJ Pro running...'));