const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 記憶體中的房間狀態管理
const rooms = new Map(); 

// 1分鐘檢查一次是否有過期房間
setInterval(() => {
    const now = Date.now();
    rooms.forEach((data, roomId) => {
        if (now - data.lastActive > 30 * 60 * 1000) { // 30分鐘
            io.to(roomId).emit('room-event', { type: 'closed', msg: '房間因長時間無動作已解散' });
            rooms.delete(roomId);
            console.log(`Room ${roomId} auto-closed due to inactivity.`);
        }
    });
}, 60000);

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artale R&J 副本合作工具</title>
    <style>
        body { font-family: sans-serif; background: #1a1a1a; color: #eee; display: flex; flex-direction: column; align-items: center; padding: 20px; }
        .hidden { display: none !important; }
        .card { background: #333; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 100%; }
        button { padding: 10px 20px; font-size: 1em; cursor: pointer; border: none; border-radius: 5px; background: #28a745; color: white; margin: 10px; }
        button.leave { background: #dc3545; }
        .info-text { color: #aaa; font-size: 0.9em; margin: 10px 0; }
        .share-link { background: #222; padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 10px 0; border: 1px dashed #555; }
        
        /* 網格樣式 */
        .grid-container { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
        .row { display: flex; gap: 8px; align-items: center; }
        .row-label { width: 50px; font-size: 0.8em; color: #888; }
        .cell { width: 50px; height: 50px; background: #444; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .cell.active { background: #ffca28; color: #5d4037; box-shadow: 0 0 10px #ffca28; }
    </style>
</head>
<body>

    <div id="home-view" class="card">
        <h2>R&J 合作工具</h2>
        <p class="info-text">目前運作中房間數: <span id="room-count">0</span> / 1000</p>
        <button onclick="createRoom()">創建新房間</button>
        <p class="info-text" id="join-error" style="color:#ff6b6b"></p>
    </div>

    <div id="room-view" class="hidden" style="width: 100%; max-width: 600px; text-align: center;">
        <div class="card" style="max-width: none;">
            <h3>房號: <span id="display-room-id"></span> (<span id="my-id">?</span> 號位)</h3>
            <div class="info-text">當前人數: <span id="member-count">1</span>/4</div>
            <div class="share-link" id="share-link-text"></div>
            <button class="leave" onclick="leaveRoom()">退出房間</button>
        </div>

        <div class="grid-container" id="grid"></div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let currentRoom = '';
        let myIdentity = 0;

        // 初始化網格 (10排 x 4格)
        const grid = document.getElementById('grid');
        for (let r = 1; r <= 10; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowDiv.innerHTML = '<div class="row-label">R' + r + '</div>';
            for (let c = 1; c <= 4; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.id = 'r' + r + 'c' + c;
                cell.onclick = () => toggleCell(r, c);
                rowDiv.appendChild(cell);
            }
            grid.appendChild(rowDiv);
        }

        // 自動檢查 URL 參數
        window.onload = () => {
            const params = new URLSearchParams(window.location.search);
            const roomParam = params.get('room');
            if (roomParam) {
                socket.emit('join-room', roomParam.toUpperCase());
            }
        };

        function createRoom() {
            socket.emit('create-room');
        }

        function leaveRoom() {
            location.href = '/'; // 直接重新導向回根目錄清空狀態
        }

        function toggleCell(r, c) {
            const cell = document.getElementById('r'+r+'c'+c);
            const state = cell.classList.toggle('active');
            socket.emit('grid-click', { room: currentRoom, r, c, state });
        }

        // 監聽後端事件
        socket.on('room-count-update', (count) => {
            document.getElementById('room-count').innerText = count;
        });

        socket.on('room-joined', (data) => {
            currentRoom = data.roomId;
            myIdentity = data.identity;
            
            document.getElementById('home-view').classList.add('hidden');
            document.getElementById('room-view').classList.remove('hidden');
            document.getElementById('display-room-id').innerText = currentRoom;
            document.getElementById('my-id').innerText = myIdentity;
            document.getElementById('member-count').innerText = data.memberCount;
            
            const url = window.location.origin + '/?room=' + currentRoom;
            document.getElementById('share-link-text').innerText = url;
            
            // 如果 URL 沒有參數，補上去但不要重新整理頁面
            window.history.replaceState({}, '', '?room=' + currentRoom);
        });

        socket.on('member-update', (count) => {
            document.getElementById('member-count').innerText = count;
        });

        socket.on('grid-update', (data) => {
            const cell = document.getElementById('r' + data.r + 'c' + data.c);
            if(data.state) cell.classList.add('active');
            else cell.classList.remove('active');
        });

        socket.on('error-msg', (msg) => {
            document.getElementById('join-error').innerText = msg;
            window.history.replaceState({}, '', '/'); // 清除錯誤參數
        });

        socket.on('room-event', (data) => {
            if(data.type === 'closed') {
                alert(data.msg);
                location.href = '/';
            }
        });
    </script>
</body>
</html>
    `);
});

// ---------------- Socket 邏輯 ----------------
io.on('connection', (socket) => {
    // 發送目前房間數給新連線的人
    socket.emit('room-count-update', rooms.size);

    // 創建房間
    socket.on('create-room', () => {
        if (rooms.size >= 1000) return socket.emit('error-msg', '系統房間數已達上限');
        
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms.set(roomId, {
            members: [socket.id],
            lastActive: Date.now()
        });
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identity: 1, memberCount: 1 });
        io.emit('room-count-update', rooms.size); // 廣播給所有人房間數更新
    });

    // 加入房間
    socket.on('join-room', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) return socket.emit('error-msg', '房間不存在或已解散');
        if (room.members.length >= 4) return socket.emit('error-msg', '房間已滿(4人)');
        
        room.members.push(socket.id);
        room.lastActive = Date.now();
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identity: room.members.length, memberCount: room.members.length });
        io.to(roomId).emit('member-update', room.members.length);
    });

    // 點擊同步
    socket.on('grid-click', (data) => {
        const room = rooms.get(data.room);
        if (room) {
            room.lastActive = Date.now(); // 更新活躍時間
            socket.to(data.room).emit('grid-update', data);
        }
    });

    // 斷線處理
    socket.on('disconnecting', () => {
        // 檢查該使用者參與的所有房間
        socket.rooms.forEach(roomId => {
            const room = rooms.get(roomId);
            if (room) {
                room.members = room.members.filter(id => id !== socket.id);
                if (room.members.length === 0) {
                    rooms.delete(roomId);
                    io.emit('room-count-update', rooms.size);
                } else {
                    io.to(roomId).emit('member-update', room.members.length);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Artale RJ Tool Pro running on port', PORT);
});