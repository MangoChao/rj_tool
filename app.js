const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOM_EXPIRY_MS = 600000;
const MAX_ROOMS = 500;
const ANIMAL_NAMES = ['小豬', '阿狗', '阿貓', '兔兔', '牛牛', '老羊', '小雞', '小蛇', '小魚', '大象', '阿虎', '小龍', '勞鼠', '老猴', '小馬', '阿獅', '小狼', '小鹿'];
const rooms = new Map();

setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (now - room.lastActive > ROOM_EXPIRY_MS) {
            io.to(roomId).emit('error-msg', '房間已解散。');
            rooms.delete(roomId);
        }
    });
}, 60000);

const HEAD_PART = '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><title>羅密歐與茱麗葉小助手</title>';

const CSS_PART = `<style>
    :root{--bg:#121212;--card:#1e1e1e;--text:#e0e0e0;--my-green:#28a745;--other-red:#dc3545;--accent:#f9d000}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:-apple-system,sans-serif;min-height:100%}
    body{display:flex;flex-direction:column;align-items:center;overflow-x:hidden}
    .hidden{display:none!important}
    
    #loader{position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999}
    .spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,0.1);border-top:4px solid var(--my-green);border-radius:50%;animation:spin 1s linear infinite;}
    @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}

    .instances-wrapper { display:flex; flex-wrap:wrap; justify-content:center; gap:20px; padding:20px; width:100%; box-sizing:border-box; }
    .mobile-container{width:100%; max-width:380px; display:flex; flex-direction:column; flex-shrink:0;}
    
    .card{background:var(--card);border-radius:12px;padding:12px;margin-bottom:8px;box-shadow:0 4px 15px rgba(0,0,0,0.4);text-align:center}
    .grid-container{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
    .row{display:flex;gap:5px;align-items:center;height:40px}
    .row-label{width:30px;font-size:.7em;color:#666;font-weight:700;text-align:center}
    .cell{flex:1;height:100%;background:#222;border-radius:6px;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.1em;border:1px solid #333;user-select:none;color:#333;overflow:hidden}
    .cell.mine-ok{background:var(--my-green)!important;color:#fff!important}
    .cell.others-ok{background:var(--other-red)!important;color:#fff!important;opacity:.8}
    .cell.mine-wrong{background:#000!important;color:var(--other-red)!important}
    .prob{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-weight:900;line-height:1}
    
    .code-display-box{background:#000;border:1px solid #333;padding:10px;border-radius:8px;cursor:pointer;display:flex;justify-content:center;align-items:center;margin-bottom:10px}
    .code-text{color:var(--accent);font-family:monospace;font-size:1.4em;font-weight:700;letter-spacing:2px}
    
    .global-footer { display:flex; gap:10px; padding:20px; width:100%; max-width:400px; justify-content:center; margin-top:auto }
    button{flex:1;padding:12px;font-size:1em;font-weight:700;border:none;border-radius:8px;background:var(--my-green);color:#fff;cursor:pointer}
    .btn-danger{background:#333;color:#999}
    .small-btn{padding:6px 5px;font-size:.9em;background:#333;color:#ccc;border-radius:6px;border:1px solid #444;flex:1;cursor:pointer;font-weight:700;text-align:center}
    
    .mode-toggle-bar{background:#1a1a1a;color:#888;padding:8px;border-radius:8px;margin-bottom:8px;font-size:0.85em;font-weight:bold;cursor:pointer;text-align:center;user-select:none;border:1px solid #333}
    .mode-toggle-bar.active{color:#fff;border:1px solid transparent;background: linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(0deg, #ff4d4d, #f1c40f, #2ecc71, #3498db, #9b59b6) border-box;animation: rainbow-border 3s linear infinite;}
    @keyframes rainbow-border{0%{background-image: linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(0deg, #ff4d4d, #f1c40f, #2ecc71, #3498db, #9b59b6) border-box;}100%{background-image: linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(360deg, #ff4d4d, #f1c40f, #2ecc71, #3498db, #9b59b6) border-box;}}

    #modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:none;align-items:center;justify-content:center;z-index:9000;backdrop-filter:blur(8px)}
    .modal-card{background:var(--card);width:85%;max-width:320px;border-radius:16px;padding:25px;border:1px solid #444;text-align:center}
    .color-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:15px 0}
    .color-cell{aspect-ratio:1.3/1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9em;color:#fff;cursor:pointer;border:2px solid transparent;opacity:.3;transition:.2s}
    .color-cell.active{border-color:#fff;opacity:1}
    #toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(--my-green);color:#fff;padding:10px 25px;border-radius:25px;opacity:0;transition:.3s;z-index:9999;font-weight:700;pointer-events:none}
    .record-input{background:#000;border:1px solid #555;color:var(--accent);width:100%;padding:12px;border-radius:8px;font-size:1.5em;text-align:center;letter-spacing:5px;margin-bottom:10px;outline:0}
    .room-input{background:#000;border:1px solid #444;color:var(--accent);width:85%;padding:12px;border-radius:8px;font-size:1.3em;text-align:center;margin:5px auto;outline:0;display:block}
</style>`;

const HOME_VIEW_PART = `
    <div id="home-view" class="card hidden" style="margin-top: 10vh; width:360px; padding:30px;">
        <h1 style="color:var(--my-green); font-size: 2em; margin-bottom: 20px;">RJ 小助手</h1>
        <input type="text" id="manual-room-id" class="room-input" maxlength="10" placeholder="房號">
        <button onclick="handleManualAction()" style="margin-top: 10px; width: 90%;">進入房間</button>
    </div>
`;

// ==========================================
// --- 核心 JS (產生器) ---
// ==========================================
const JS_PART = `
<script src="/socket.io/socket.io.js"></script>
<script>
    let currentRoomId = '', globalGridData = {};
    let instances = [], isColorMode = localStorage.getItem('rj_mode') === 'color';
    const RAINBOW_COLORS = ['#ff4d4d', '#00ff7f', '#1e90ff', '#ff1493', '#ffff00', '#a020f0', '#ff8c00', '#00ffff'];

    window.onload = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const room = urlParams.get('room');
        if (room) {
            currentRoomId = room.toUpperCase();
            addInstance(); // 啟動第一個
        } else {
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('home-view').classList.remove('hidden');
            document.getElementById('manual-room-id').value = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
    };

    function addInstance() {
        if (instances.length >= 4) return showToast("房間視窗已達 4 個上限", true);
        const uid = Math.random().toString(36).substring(7);
        const inst = new RJInstance(uid);
        instances.push(inst);
    }

    class RJInstance {
        constructor(uid) {
            this.uid = uid;
            this.myName = '';
            this.lastValidCode = '0000000000';
            this.isAutoCopy = false;
            this.socket = io({ reconnection: true });
            this.createDOM();
            this.setupSocket();
        }

        createDOM() {
            const wrapper = document.getElementById('instances-container');
            const html = \`
                <div id="inst_\${this.uid}" class="mobile-container">
                    <div class="card" style="padding: 10px 12px;">
                        <div style="font-size: 0.8em; color: #666; display:flex; justify-content:space-between; margin-bottom:8px">
                            <span>房號: \${currentRoomId}</span>
                            <span style="color:var(--my-green); cursor:pointer; font-weight:bold" onclick="addInstance()">+ 多開</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #333; padding-top:10px;">
                            <div>你是 <b class="name-label" style="color:var(--my-green)">載入中...</b></div>
                            <span style="color:#555; font-size:0.7em; cursor:pointer" onclick="removeInstance('\${this.uid}')">關閉</span>
                        </div>
                    </div>
                    <div class="mode-toggle-bar \${isColorMode?'active':''}" onclick="toggleColorMode()">當前模式：\${isColorMode?'彩色':'雙色'}</div>
                    <div class="grid-container"></div>
                    <div class="code-display-box" onclick="instances.find(i=>i.uid=='\${this.uid}').copyMyCode()">
                        <span class="live-code code-text">00000 00000</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:0 5px; margin-bottom:10px">
                        <label style="font-size:0.8em; color:#666"><input type="checkbox" class="auto-copy-cb"> 自動複製</label>
                        <div class="small-btn" style="flex:none; padding:4px 10px" onclick="instances.find(i=>i.uid=='\${this.uid}').askLoadRecord()">載入紀錄</div>
                    </div>
                </div>\`;
            wrapper.insertAdjacentHTML('beforeend', html);
            this.buildGrid();
        }

        buildGrid() {
            const grid = document.querySelector(\`#inst_\${this.uid} .grid-container\`);
            for (let r = 10; r >= 1; r--) {
                const row = document.createElement('div'); row.className = 'row';
                row.innerHTML = '<div class="row-label">F'+r+'</div>';
                for (let c = 1; c <= 4; c++) {
                    const cell = document.createElement('div'); cell.className = 'cell'; cell.id = \`u\${this.uid}r\${r}c\${c}\`;
                    cell.innerHTML = '<span class="val"></span><div class="prob"></div>';
                    cell.onclick = () => this.handleAction(r, c, 1);
                    cell.oncontextmenu = (e) => { e.preventDefault(); this.handleAction(r, c, 2); };
                    row.appendChild(cell);
                }
                grid.appendChild(row);
            }
        }

        setupSocket() {
            this.socket.emit('join-room', { roomId: currentRoomId, uid: null });
            this.socket.on('room-joined', d => {
                document.getElementById('loader').classList.add('hidden');
                document.getElementById('workspace').classList.remove('hidden');
                this.myName = d.identityName;
                document.querySelector(\`#inst_\${this.uid} .name-label\`).innerText = this.myName;
                globalGridData = d.gridState || {};
                this.render();
            });
            this.socket.on('grid-sync', d => {
                const key = d.r + '_' + d.c;
                if (d.name === 'ALL_CLEAR') globalGridData[key] = {};
                else { if(!globalGridData[key]) globalGridData[key] = {}; if(d.state === 0) delete globalGridData[key][d.name]; else globalGridData[key][d.name] = d.state; }
                this.render(); this.updateCode();
            });
            this.socket.on('update-members', list => { sessionStorage.setItem('rj_members', JSON.stringify(list)); this.render(); });
            this.socket.on('sync-full-state', d => { globalGridData = d.gridState || {}; this.render(); });
            this.socket.on('grid-reset-sync', () => { globalGridData = {}; this.render(); });
        }

        handleAction(r, c, type) {
            const key = r + '_' + c, states = globalGridData[key] || {};
            if (Object.keys(states).some(n => n !== this.myName && states[n] === 1)) return;
            let cur = states[this.myName] || 0, next = 0;
            if (type === 1) next = (cur === 0) ? 1 : (cur === 1 ? 2 : 0);
            else {
                const now = Date.now();
                if (now - lastRightClick < 400) { this.socket.emit('grid-action', { room: currentRoomId, r, c, name: 'ALL_CLEAR', state: 0 }); lastRightClick=0; return; }
                lastRightClick = now; next = (cur === 1) ? 0 : (cur === 2 ? 0 : 2);
            }
            if (next === 1) { for (let i=1; i<=4; i++) if (i !== c && (globalGridData[r+'_'+i]||{})[this.myName] === 1) this.socket.emit('grid-action', { room: currentRoomId, r, c: i, name: this.myName, state: 0 }); }
            this.socket.emit('grid-action', { room: currentRoomId, r, c, name: this.myName, state: next });
        }

        render() {
            const members = JSON.parse(sessionStorage.getItem('rj_members') || '[]');
            const memberNames = members.map(m => m.name);
            const nl = document.querySelector(\`#inst_\${this.uid} .name-label\`);
            if(isColorMode) {
                const m = members.find(mx => mx.name === this.myName);
                if(m) nl.style.color = RAINBOW_COLORS[m.colorIndex];
            } else { nl.style.color = 'var(--my-green)'; }

            for (let r = 1; r <= 10; r++) {
                let finalOk = {}, myWrongs = [], playerPot = {};
                memberNames.forEach(n => playerPot[n] = [1, 2, 3, 4]);
                for (let c = 1; c <= 4; c++) {
                    const s = globalGridData[r+'_'+c] || {};
                    Object.keys(s).forEach(n => {
                        if (s[n] === 1) finalOk[c] = n;
                        else if (s[n] === 2) { if(playerPot[n]) playerPot[n] = playerPot[n].filter(v => v !== c); if(n === this.myName) myWrongs.push(c); }
                    });
                }
                let changed = true;
                while(changed) {
                    changed = false;
                    memberNames.forEach(n => {
                        if (!Object.values(finalOk).includes(n)) {
                            let av = (playerPot[n] || []).filter(col => !finalOk[col]);
                            if(av.length === 1) { finalOk[av[0]] = n; changed = true; }
                        }
                    });
                }
                for (let c = 1; c <= 4; c++) {
                    const cell = document.getElementById(\`u\${this.uid}r\${r}c\${c}\`);
                    if(!cell) continue;
                    const s = globalGridData[r+'_'+c] || {}, valSpan = cell.querySelector('.val'), probDiv = cell.querySelector('.prob');
                    cell.className = 'cell'; cell.style.background = ''; valSpan.innerText = '';
                    Object.keys(s).forEach(n => {
                        if (s[n] === 1) {
                            if (!isColorMode) cell.classList.add(n === this.myName ? 'mine-ok' : 'others-ok');
                            else { const m = members.find(mx => mx.name === n); if(m) { cell.style.background = RAINBOW_COLORS[m.colorIndex]; cell.style.color = '#fff'; valSpan.style.textShadow = '1px 1px 2px #000'; } }
                            valSpan.innerText = n.slice(-2);
                        } else if (n === this.myName && s[n] === 2) { cell.classList.add('mine-wrong'); valSpan.innerText = 'X'; }
                    });
                    if (Object.keys(s).some(n => s[n] === 1 || (n === this.myName && s[n] === 2))) probDiv.innerText = '';
                    else {
                        let rem = playerPot[this.myName].filter(col => !finalOk[col]);
                        let pVal = (finalOk[c] === this.myName) ? 100 : (finalOk[c] || myWrongs.includes(c) ? 0 : Math.floor(100/(rem.length||1)));
                        probDiv.innerText = pVal + '%'; probDiv.style.color = pVal === 100 ? 'var(--accent)' : (pVal === 0 ? '#444' : '#888');
                        probDiv.style.fontSize = pVal === 100 ? '0.9em' : '0.6em';
                    }
                }
            }
        }

        updateCode() {
            let code = ""; for (let r = 1; r <= 10; r++) { let f = 0; for (let c = 1; c <= 4; c++) { if ((globalGridData[r + '_' + c] || {})[this.myName] === 1) { f = c; break; } } code += f; }
            this.lastValidCode = code;
            document.querySelector(\`#inst_\${this.uid} .live-code\`).innerText = code.substring(0, 5) + " " + code.substring(5);
            const cb = document.querySelector(\`#inst_\${this.uid} .auto-copy-cb\`);
            if (cb && cb.checked && code !== "0000000000") navigator.clipboard.writeText(code.substring(0, 5) + " " + code.substring(5)).catch(()=>{});
        }

        copyMyCode() { navigator.clipboard.writeText(this.lastValidCode); showToast("已複製紀錄"); }
        askLoadRecord() { 
            let c = prompt('輸入紀錄 (10位數字)');
            if(c) {
                const val = c.replace(/\\D/g, "");
                for(let r=1; r<=10; r++) for(let c=1; c<=4; c++) if((globalGridData[r+'_'+c]||{})[this.myName]===1) this.socket.emit('grid-action', { room: currentRoomId, r, c, name: this.myName, state: 0 });
                val.split('').forEach((col, i) => { if(col >= 1 && col <= 4) this.socket.emit('grid-action', { room: currentRoomId, r: i+1, c: parseInt(col), name: this.myName, state: 1 }); });
            }
        }
    }

    function toggleColorMode() {
        isColorMode = !isColorMode;
        localStorage.setItem('rj_mode', isColorMode ? 'color' : 'dual');
        document.querySelectorAll('.mode-toggle-bar').forEach(btn => {
            btn.innerText = isColorMode ? '當前模式：彩色' : '當前模式：雙色';
            btn.classList.toggle('active', isColorMode);
        });
        instances.forEach(i => i.render());
    }

    function removeInstance(uid) {
        const inst = instances.find(i => i.uid === uid);
        if (inst) { inst.socket.disconnect(); document.getElementById('inst_' + uid).remove(); instances = instances.filter(i => i.uid !== uid); }
        if (instances.length === 0) window.location.href = '/';
    }

    function handleManualAction() { const id = document.getElementById('manual-room-id').value.toUpperCase(); if(id.length>=6) window.location.href = '/?room=' + id; }
    function askReset() { if(confirm('清空數據？')) instances[0].socket.emit('grid-reset', currentRoomId); }
    function askLeave() { window.location.href = '/'; }
    function showToast(m, e){ const t=document.getElementById('toast'); t.innerText=m; t.style.background=e?'var(--other-red)':'var(--my-green)'; t.style.opacity=1; setTimeout(()=>t.style.opacity=0, 2000); }
    function getStats() { fetch('/api/stats?t=' + Date.now()).then(res => res.json()).then(data => { if(document.getElementById('room-count')) document.getElementById('room-count').innerText = data.count; }); }
    function saveUids() {} // 暫不實作複雜的 session 恢復以求穩定
</script>
`;

app.get('/api/stats', (req, res) => { res.json({ count: rooms.size }); });
app.get('/', (req, res) => {
    res.send('<!DOCTYPE html><html lang="zh-TW"><head>' + HEAD_PART + CSS_PART + '</head>' +
        '<body><div id="loader"><div class="spinner"></div></div>' +
        HOME_VIEW_PART +
        '<div id="workspace" class="hidden" style="width:100%">' +
            '<div class="instances-wrapper" id="instances-container"></div>' +
            '<div class="global-footer"><button class="btn-danger" onclick="askReset()">清空全隊</button><button class="btn-danger" onclick="askLeave()">退出房間</button></div>' +
        '</div>' +
        '<div id="toast"></div>' + JS_PART + '</body></html>');
});

io.on('connection', (socket) => {
    socket.on('join-room', (data) => {
        const { roomId } = data;
        let room = rooms.get(roomId);
        if (!room) { room = { members: [], lastActive: Date.now(), gridState: {} }; rooms.set(roomId, room); }
        if (room.members.length >= 4) return socket.emit('error-msg', '房間已滿。');
        const n = ANIMAL_NAMES.filter(x => !room.members.map(m=>m.name).includes(x))[0];
        const c = [0,1,2,3,4,5,6,7].filter(x => !room.members.map(m=>m.colorIndex).includes(x))[0];
        const member = { id: socket.id, name: n, colorIndex: c };
        room.members.push(member);
        socket.join(roomId);
        socket.emit('room-joined', { roomId, identityName: n, gridState: room.gridState });
        io.to(roomId).emit('update-members', room.members.map(m=>({name:m.name, colorIndex:m.colorIndex})));
    });
    socket.on('grid-action', (d) => {
        const room = rooms.get(d.room); if(!room) return; room.lastActive = Date.now();
        const k = d.r+'_'+d.c;
        if (d.name === 'ALL_CLEAR') room.gridState[k] = {};
        else { if(!room.gridState[k]) room.gridState[k]={}; if(d.state===0) delete room.gridState[k][d.name]; else room.gridState[k][d.name]=d.state; }
        io.to(d.room).emit('grid-sync', d);
    });
    socket.on('grid-reset', (id) => { const r = rooms.get(id); if(r){ r.gridState={}; io.to(id).emit('grid-reset-sync'); }});
    socket.on('disconnect', () => {
        rooms.forEach((room, roomId) => {
            room.members = room.members.filter(m => m.id !== socket.id);
            io.to(roomId).emit('update-members', room.members.map(m=>({name:m.name, colorIndex:m.colorIndex})));
        });
    });
});

server.listen(3000, () => console.log('RJ Ultimate Pro v3.0.0 Online.'));