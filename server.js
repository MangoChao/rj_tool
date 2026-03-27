const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOM_EXPIRY_MS = 600000;
const ANIMAL_NAMES = ['小豬', '阿狗', '阿貓', '兔兔', '牛牛', '老羊', '小雞', '小蛇', '小魚', '大象', '阿虎', '小龍', '勞鼠', '老猴', '小馬', '阿獅', '小狼', '小鹿'];
const rooms = new Map();

app.use(express.static('public'));

// API: 獲取房間統計
app.get('/api/stats', (req, res) => {
    res.json({ count: rooms.size });
});

// 定時清理房間
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (now - room.lastActive > ROOM_EXPIRY_MS) {
            io.to(roomId).emit('error-msg', '房間因長時間無動作已解散。');
            rooms.delete(roomId);
        }
    });
}, 60000);

io.on('connection', (socket) => {
    socket.on('join-room', (data) => {
        const { roomId } = data;
        let room = rooms.get(roomId);
        if (!room) {
            room = { members: [], lastActive: Date.now(), gridState: {} };
            rooms.set(roomId, room);
        }

        if (room.members.length >= 4) return socket.emit('error-msg', '房間人數已滿！');

        const usedNames = room.members.map(m => m.name);
        const name = ANIMAL_NAMES.filter(n => !usedNames.includes(n))[0];
        const usedColors = room.members.map(m => m.colorIndex);
        const color = [0, 1, 2, 3, 4, 5, 6, 7].filter(c => !usedColors.includes(c))[0];

        const member = { id: socket.id, name, colorIndex: color };
        room.members.push(member);

        socket.join(roomId);
        socket.emit('room-joined', { roomId, identityName: name, gridState: room.gridState });
        io.to(roomId).emit('update-members', room.members.map(m => ({ name: m.name, colorIndex: m.colorIndex })));
    });

    socket.on('update-profile', (d) => {
        const room = rooms.get(d.roomId);
        if (!room) return;
        const member = room.members.find(x => x.id === socket.id);
        if (!member) return;

        const oldName = member.name;
        const newName = d.newName.trim();

        // 1. 更新成員基本資料
        member.name = newName;
        member.colorIndex = d.colorIndex;

        // 2. 核心修正：判斷名字是否有實際變動才執行 Key 更換
        if (oldName !== newName) {
            for (let gridKey in room.gridState) {
                const cellData = room.gridState[gridKey];
                if (cellData && cellData[oldName] !== undefined) {
                    cellData[newName] = cellData[oldName]; // 將數據移給新名字
                    delete cellData[oldName];             // 刪除舊名字 Key
                }
            }
        }
        // 如果 oldName === newName，則完全不觸發 Key 的 delete，只更新 colorIndex

        // 3. 廣播最新狀態給全房間（確保顏色即時同步）
        const membersList = room.members.map(m => ({ name: m.name, colorIndex: m.colorIndex }));
        io.to(d.roomId).emit('update-members', membersList);
        io.to(d.roomId).emit('sync-full-state', { gridState: room.gridState });
        
        // 4. 通知發起者改名完成
        socket.emit('name-updated', { newName: newName });
    });

    socket.on('grid-action', (d) => {
        const room = rooms.get(d.room);
        if (!room) return;
        room.lastActive = Date.now();
        const k = `${d.r}_${d.c}`;
        if (d.name === 'ALL_CLEAR') room.gridState[k] = {};
        else {
            if (!room.gridState[k]) room.gridState[k] = {};
            if (d.state === 0) delete room.gridState[k][d.name];
            else room.gridState[k][d.name] = d.state;
        }
        io.to(d.room).emit('grid-sync', d);
    });

    socket.on('grid-reset', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.gridState = {};
            io.to(roomId).emit('grid-reset-sync');
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            room.members = room.members.filter(m => m.id !== socket.id);
            io.to(roomId).emit('update-members', room.members.map(m => ({ name: m.name, colorIndex: m.colorIndex })));
        });
    });
});

server.listen(3000, () => console.log('RJ Server v4.0 Online at http://localhost:3000'));