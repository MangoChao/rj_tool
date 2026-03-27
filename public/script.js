let currentRoomId = '', globalGridData = {};
let instances = [], isColorMode = localStorage.getItem('rj_mode') === 'color', lastRightClick = 0;
const RAINBOW_COLORS = ['#ff4d4d', '#00ff7f', '#1e90ff', '#ff1493', '#ffff00', '#a020f0', '#ff8c00', '#00ffff'];

window.onload = () => {
    getStats();
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (room) {
        currentRoomId = room.toUpperCase();
        addInstance();
    } else {
        hideLoader();
        document.getElementById('home-view').classList.remove('hidden');
        document.getElementById('manual-room-id').value = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
};

function addInstance() {
    if (instances.length >= 4) return showToast("上限為 4 人", true);
    const uid = Math.random().toString(36).substring(7);
    instances.push(new RJInstance(uid));
}

class RJInstance {
    constructor(uid) {
        this.uid = uid;
        this.myName = '';
        this.lastValidCode = '0000000000';
        this.socket = io();
        this.selectedColorIdx = -1;
        this.init();
    }

    init() {
        this.createDOM();
        this.setupSocket();
    }

    createDOM() {
        const wrapper = document.getElementById('instances-container');
        const html = `
            <div id="inst_${this.uid}" class="mobile-container">
                <div class="card">
                    <div style="font-size:0.8em; color:#666; display:flex; justify-content:space-between; margin-bottom:10px">
                        <span>房號: <b style="color:var(--accent)">${currentRoomId}</b></span>
                        <span style="color:var(--my-green); cursor:pointer; font-weight:bold" onclick="addInstance()">+ 多開</span>
                    </div>
                    <div style="display:flex; gap:5px; margin-bottom:10px">
                        <div class="small-btn" onclick="copyText('${currentRoomId}', '房號已複製')">複製房號</div>
                        <div class="small-btn" onclick="copyLink()">複製連結</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #333; padding-top:10px">
                        <div style="display:flex; align-items:center">
                            <span style="cursor:pointer; margin-right:8px" onclick="instances.find(i=>i.uid=='${this.uid}').openEditProfile()">
                                <svg style="width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                            </span>
                            你是 <b class="name-label" style="color:var(--my-green)">載入中...</b>
                        </div>
                        <span style="color:#444; font-size:0.7em; cursor:pointer" onclick="removeInstance('${this.uid}')">關閉</span>
                    </div>
                </div>
                <div class="mode-toggle-bar ${isColorMode?'active':''}" onclick="toggleColorMode()">當前模式: ${isColorMode?'彩色':'雙色'}</div>
                <div class="grid-container"></div>
                <div class="control-panel">
                    <div class="code-display-box" onclick="instances.find(i=>i.uid=='${this.uid}').copyCode()">
                        <span class="live-code code-text">00000 00000</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:0 5px">
                        <label style="font-size:0.8em; color:#666"><input type="checkbox" class="auto-copy-cb"> 自動複製</label>
                        <div class="small-btn" style="flex:none; padding:4px 10px" onclick="instances.find(i=>i.uid=='${this.uid}').askLoadRecord()">載入紀錄</div>
                    </div>
                </div>
            </div>`;
        wrapper.insertAdjacentHTML('beforeend', html);
        this.buildGrid();
    }

    buildGrid() {
        const grid = document.querySelector(`#inst_${this.uid} .grid-container`);
        grid.innerHTML = '';
        for (let r = 10; r >= 1; r--) {
            const row = document.createElement('div');
            row.className = 'row';
            row.innerHTML = `<div class="row-label">F${r}</div>`;
            for (let c = 1; c <= 4; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.id = `u${this.uid}r${r}c${c}`;
                cell.innerHTML = '<span class="val"></span><div class="prob"></div>';
                cell.onclick = () => this.handleAction(r, c, 1);
                cell.oncontextmenu = (e) => { e.preventDefault(); this.handleAction(r, c, 2); };
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }
    }

    setupSocket() {
        this.socket.emit('join-room', { roomId: currentRoomId });
        this.socket.on('room-joined', d => {
            hideLoader();
            document.getElementById('home-view').classList.add('hidden');
            document.getElementById('workspace').classList.remove('hidden');
            this.myName = d.identityName;
            document.querySelector(`#inst_${this.uid} .name-label`).innerText = this.myName;
            globalGridData = d.gridState || {};
            this.render();
        });
        this.socket.on('grid-sync', d => {
            const k = `${d.r}_${d.c}`;
            if (d.name === 'ALL_CLEAR') globalGridData[k] = {};
            else {
                if(!globalGridData[k]) globalGridData[k] = {};
                if(d.state === 0) delete globalGridData[k][d.name]; else globalGridData[k][d.name] = d.state;
            }
            this.render(); this.updateCode();
        });
        this.socket.on('update-members', list => { sessionStorage.setItem('rj_members', JSON.stringify(list)); this.render(); });
        this.socket.on('name-updated', d => {
            this.myName = d.newName;
            const nameEl = document.querySelector(`#inst_${this.uid} .name-label`);
            if (nameEl) nameEl.innerText = this.myName;
        });

        this.socket.on('sync-full-state', d => {
            globalGridData = d.gridState || {};
            this.render();
            this.updateCode();
        });
        this.socket.on('error-msg', m => {
            hideLoader();
            showToast(m, true); 
            if (m.includes('滿')) {
                const el = document.getElementById(`inst_${this.uid}`);
                if (el) el.remove();
                instances = instances.filter(i => i.uid !== this.uid);
                if (instances.length === 0) location.href = '/';
            }
        });
        this.socket.on('grid-reset-sync', () => {
            globalGridData = {};
            this.render();
            this.updateCode();
            showToast("全隊數據已重置");
        });
    }

    handleAction(r, c, type) {
        const key = `${r}_${c}`, s = globalGridData[key] || {};
        if (Object.keys(s).some(n => n !== this.myName && s[n] === 1)) return;
        let cur = s[this.myName] || 0, next = 0;
        if (type === 1) next = (cur === 0) ? 1 : (cur === 1 ? 2 : 0);
        else {
            const now = Date.now();
            if (now - lastRightClick < 400) { this.socket.emit('grid-action', { room: currentRoomId, r, c, name: 'ALL_CLEAR' }); return; }
            lastRightClick = now; next = (cur === 1) ? 0 : (cur === 2 ? 0 : 2);
        }
        if (next === 1) { 
            for (let i=1; i<=4; i++) if (i !== c && (globalGridData[`${r}_${i}`]||{})[this.myName] === 1) this.socket.emit('grid-action', { room: currentRoomId, r, c: i, name: this.myName, state: 0 }); 
        }
        this.socket.emit('grid-action', { room: currentRoomId, r, c, name: this.myName, state: next });
    }

    render() {
        const members = JSON.parse(sessionStorage.getItem('rj_members') || '[]');
        const nl = document.querySelector(`#inst_${this.uid} .name-label`);
        if (isColorMode) {
            const m = members.find(mx => mx.name === this.myName);
            if (m) nl.style.color = RAINBOW_COLORS[m.colorIndex];
        } else nl.style.color = 'var(--my-green)';

        for (let r = 1; r <= 10; r++) {
            let finalOk = {}, myWrongs = [], playerPot = {};
            members.forEach(m => playerPot[m.name] = [1, 2, 3, 4]);
            for (let c = 1; c <= 4; c++) {
                const s = globalGridData[`${r}_${c}`] || {};
                Object.keys(s).forEach(n => {
                    if (s[n] === 1) finalOk[c] = n;
                    else if (s[n] === 2) { 
                        if(playerPot[n]) playerPot[n] = playerPot[n].filter(v => v !== c);
                        if(n === this.myName) myWrongs.push(c);
                    }
                });
            }
            let changed = true;
            while(changed) {
                changed = false;
                Object.keys(playerPot).forEach(n => {
                    if(!Object.values(finalOk).includes(n)) {
                        let av = playerPot[n].filter(col => !finalOk[col]);
                        if(av.length === 1) { finalOk[av[0]] = n; changed = true; }
                    }
                });
            }
            for (let c = 1; c <= 4; c++) {
                const cell = document.getElementById(`u${this.uid}r${r}c${c}`);
                if(!cell) continue;
                const s = globalGridData[`${r}_${c}`] || {}, val = cell.querySelector('.val'), pb = cell.querySelector('.prob');
                cell.className = 'cell'; cell.style.background = ''; val.innerText = '';
                Object.keys(s).forEach(n => {
                    if (s[n] === 1) {
                        if (!isColorMode) cell.classList.add(n === this.myName ? 'mine-ok' : 'others-ok');
                        else {
                            const m = members.find(mx => mx.name === n);
                            if(m) { cell.style.background = RAINBOW_COLORS[m.colorIndex]; cell.style.color = '#fff'; }
                        }
                        val.innerText = n.slice(-2);
                    } else if (n === this.myName && s[n] === 2) { cell.classList.add('mine-wrong'); val.innerText = 'X'; }
                });
                if (Object.keys(s).some(n => s[n] === 1 || (n === this.myName && s[n] === 2))) pb.innerText = '';
                else {
                    let rem = playerPot[this.myName].filter(col => !finalOk[col]);
                    let p = (finalOk[c] === this.myName) ? 100 : (finalOk[c] || myWrongs.includes(c) ? 0 : Math.floor(100/(rem.length||1)));
                    pb.innerText = p + '%'; pb.style.color = p === 100 ? 'var(--accent)' : (p === 0 ? '#444' : '#888');
                    pb.style.fontSize = p === 100 ? '0.9em' : '0.6em';
                }
            }
        }
    }

    updateCode() {
        let code = "";
        for (let r = 1; r <= 10; r++) {
            let f = 0; for (let c = 1; c <= 4; c++) { if ((globalGridData[`${r}_${c}`] || {})[this.myName] === 1) { f = c; break; } }
            code += f;
        }
        this.lastValidCode = code;
        const display = code.substring(0, 5) + " " + code.substring(5);
        const liveCodeEl = document.querySelector(`#inst_${this.uid} .live-code`);
        if(liveCodeEl) liveCodeEl.innerText = display;
        const cb = document.querySelector(`#inst_${this.uid} .auto-copy-cb`);
        if (cb && cb.checked && code !== "0000000000") navigator.clipboard.writeText(display).catch(()=>{});
    }

    copyCode() { if(this.lastValidCode!=="0000000000") copyText(this.lastValidCode.substring(0,5) + " " + this.lastValidCode.substring(5), "紀錄已複製"); }

    openEditProfile() {
        const members = JSON.parse(sessionStorage.getItem('rj_members') || '[]');
        const mD = members.find(m => m.name === this.myName);
        this.selectedColorIdx = mD ? mD.colorIndex : -1;
        const c = document.getElementById('modal-content'), b = document.getElementById('modal-btns'), o = document.getElementById('modal-overlay');
        let html = `<b>修改名稱</b><input type="text" id="edit-name" class="room-input" value="${this.myName}" style="margin:10px 0"><div class="color-grid">`;
        RAINBOW_COLORS.forEach((hex, idx) => {
            const occ = members.find(m => m.colorIndex === idx);
            const isM = occ && occ.name === this.myName, dis = occ && !isM;
            html += `<div class="color-cell ${dis?'disabled':''} ${idx===this.selectedColorIdx?'active':''}" style="background:${hex}" onclick="${dis?'':'selectColor('+idx+')'}">${occ?occ.name.slice(-2):''}</div>`;
        });
        c.innerHTML = html + '</div>';
        b.innerHTML = `<button onclick="saveProfile('${this.uid}')">儲存</button><button class="btn-danger" onclick="closeModal()">取消</button>`;
        o.style.display = 'flex';
    }

    askLoadRecord() {
        const c = document.getElementById('modal-content'), b = document.getElementById('modal-btns'), o = document.getElementById('modal-overlay');
        c.innerHTML = `<b>載入紀錄</b><p style="font-size:0.8em;color:#888">請輸入紀錄數字 (1-4 代表位置，0 為清空)</p><input type="tel" id="load-val" class="record-input" placeholder="00000 00000">`;
        b.innerHTML = `<button onclick="processLoad('${this.uid}')">確認載入</button><button class="btn-danger" onclick="closeModal()">取消</button>`;
        o.style.display = 'flex';
        setTimeout(() => document.getElementById('load-val').focus(), 100);
    }
}

function toggleColorMode() {
    isColorMode = !isColorMode;
    localStorage.setItem('rj_mode', isColorMode ? 'color' : 'dual');
    document.querySelectorAll('.mode-toggle-bar').forEach(btn => {
        btn.innerText = isColorMode ? '當前模式: 彩色' : '當前模式: 雙色';
        btn.classList.toggle('active', isColorMode);
    });
    instances.forEach(i => i.render());
}

function selectColor(idx) {
    const inst = instances.find(i => document.getElementById('modal-overlay').style.display === 'flex');
    if(inst) {
        inst.selectedColorIdx = idx;
        document.querySelectorAll('.color-cell').forEach((el, i) => el.classList.toggle('active', i === idx));
    }
}

function saveProfile(uid) {
    const inst = instances.find(i => i.uid === uid);
    const newNameInput = document.getElementById('edit-name');
    if (!inst || !newNameInput) return;
    const newName = newNameInput.value.trim();
    if (!newName) return showToast("請輸入名稱", true);
    inst.socket.emit('update-profile', { roomId: currentRoomId, newName: newName, colorIndex: inst.selectedColorIdx });
    closeModal();
}

function processLoad(uid) {
    const inst = instances.find(i => i.uid === uid);
    const inputVal = document.getElementById('load-val').value.replace(/\D/g, "");
    if (inputVal.length === 0) return closeModal();
    inputVal.split('').forEach((colChar, i) => {
        const r = i + 1; if (r > 10) return;
        const c = parseInt(colChar);
        if (c === 0) {
            for (let targetCol = 1; targetCol <= 4; targetCol++) {
                if ((globalGridData[`${r}_${targetCol}`] || {})[inst.myName] === 1) {
                    inst.socket.emit('grid-action', { room: currentRoomId, r, c: targetCol, name: inst.myName, state: 0 });
                }
            }
        } else if (c >= 1 && c <= 4) {
            inst.socket.emit('grid-action', { room: currentRoomId, r, c, name: inst.myName, state: 1 });
        }
    });
    closeModal();
    showToast("紀錄已更新");
}

function removeInstance(uid) {
    const inst = instances.find(i => i.uid === uid);
    if (inst) { inst.socket.disconnect(); document.getElementById('inst_' + uid).remove(); instances = instances.filter(i => i.uid !== uid); }
    if (instances.length === 0) location.href = '/';
}

function handleManualAction() { const id = document.getElementById('manual-room-id').value.toUpperCase(); if(id.length>=6) location.href = '/?room=' + id; }
function askReset() {
    const c = document.getElementById('modal-content'), b = document.getElementById('modal-btns'), o = document.getElementById('modal-overlay');
    c.innerHTML = `<b style="color:var(--other-red)">危險操作</b><p>確定要清空「全隊」所有人的標記嗎？</p>`;
    b.innerHTML = `<button class="btn-danger" onclick="executeReset()">確定清空</button><button onclick="closeModal()">取消</button>`;
    o.style.display = 'flex';
}
function executeReset() { if (instances[0]) instances[0].socket.emit('grid-reset', currentRoomId); closeModal(); }
function askLeave() { location.href = '/'; }
function copyLink() { copyText(window.location.origin + '/?room=' + currentRoomId, "連結已複製"); }
function copyText(v, m) { navigator.clipboard.writeText(v).then(() => showToast(m)); }
function showToast(m, e){ const t=document.getElementById('toast'); t.innerText=m; t.style.background=e?'var(--other-red)':'var(--my-green)'; t.style.opacity=1; setTimeout(()=>t.style.opacity=0, 2000); }
function hideLoader(){ document.getElementById('loader').classList.add('hidden'); }
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function getStats() { fetch('/api/stats').then(res => res.json()).then(data => { document.getElementById('room-count').innerText = data.count; }); }