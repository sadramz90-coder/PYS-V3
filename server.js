const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const OFFLINE_FILE = path.join(DATA_DIR, 'offline.json');

const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return {} } };
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

let accounts = read(ACCOUNTS_FILE);
let messages = read(MESSAGES_FILE);
let groups = read(GROUPS_FILE);
let sessions = read(SESSIONS_FILE);
let offline = read(OFFLINE_FILE);

const onlineUsers = new Map();

// ========== ایجاد اکانت ویژه ==========
(async () => {
    if (!accounts['MALEK']) {
        accounts['MALEK'] = {
            username: 'MALEK',
            password: await bcrypt.hash('MALEK11NEYMAR', 10),
            nickname: '👑 مالک ویژه',
            bio: '🧠 ادمین اصلی PYS',
            isSpecial: true,
            isAdmin: true,
            status: 'offline',
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            groups: []
        };
        write(ACCOUNTS_FILE, accounts);
        console.log('👑 اکانت ویژه ساخته شد');
    }
})();

// ========== API ==========
app.post('/api/register', async (req, res) => {
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز الزامیست' });
    if (accounts[username]) return res.status(400).json({ error: 'تکراری' });
    accounts[username] = {
        username,
        password: await bcrypt.hash(password, 10),
        nickname: nickname || username,
        bio: 'سلام! من از PYS استفاده میکنم 🖤💛',
        isSpecial: false,
        isAdmin: false,
        status: 'offline',
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        groups: []
    };
    write(ACCOUNTS_FILE, accounts);
    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = accounts[username];
    if (!user) return res.status(401).json({ error: 'نام کاربری یا رمز اشتباه' });
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'نام کاربری یا رمز اشتباه' });
    const token = Date.now() + Math.random().toString(36).substr(2, 10);
    sessions[token] = { username, createdAt: new Date().toISOString() };
    write(SESSIONS_FILE, sessions);
    res.json({ success: true, token, user: { ...user, password: undefined } });
});

app.post('/api/verify', (req, res) => {
    const { token } = req.body;
    const session = sessions[token];
    if (!session) return res.status(401).json({ error: 'نامعتبر' });
    const user = accounts[session.username];
    if (!user) return res.status(401).json({ error: 'نامعتبر' });
    res.json({ success: true, user: { ...user, password: undefined } });
});

app.get('/api/users/:username', (req, res) => {
    const list = {};
    Object.keys(accounts).forEach(u => {
        const acc = accounts[u];
        list[u] = {
            username: acc.username,
            nickname: acc.nickname,
            bio: acc.bio,
            isSpecial: acc.isSpecial || false,
            isAdmin: acc.isAdmin || false,
            status: onlineUsers.has(u) ? 'online' : 'offline',
            lastSeen: acc.lastSeen
        };
    });
    res.json(list);
});

app.get('/api/messages/:chatId', (req, res) => {
    res.json(messages[req.params.chatId] || []);
});

app.get('/api/groups', (req, res) => res.json(groups));

app.post('/api/groups/create', (req, res) => {
    const { name, creator, members } = req.body;
    const id = 'group_' + Date.now();
    groups[id] = { id, name, admin: creator, members: [creator, ...(members || [])], createdAt: new Date().toISOString() };
    write(GROUPS_FILE, groups);
    res.json({ success: true, group: groups[id] });
});

app.get('/api/admin/users', (req, res) => {
    const { token } = req.query;
    const session = sessions[token];
    if (!session || !accounts[session.username]?.isAdmin) return res.status(403).json({ error: 'دسترسی ندارید' });
    res.json(accounts);
});

app.post('/api/admin/edit-user', (req, res) => {
    const { token, targetUsername, updates } = req.body;
    const session = sessions[token];
    if (!session || !accounts[session.username]?.isAdmin) return res.status(403).json({ error: 'دسترسی ندارید' });
    if (!accounts[targetUsername]) return res.status(404).json({ error: 'یافت نشد' });
    Object.keys(updates).forEach(k => { if (k !== 'password' && k !== 'username') accounts[targetUsername][k] = updates[k] });
    write(ACCOUNTS_FILE, accounts);
    res.json({ success: true });
});

app.post('/api/admin/delete-user', (req, res) => {
    const { token, targetUsername } = req.body;
    const session = sessions[token];
    if (!session || !accounts[session.username]?.isAdmin) return res.status(403).json({ error: 'دسترسی ندارید' });
    if (targetUsername === 'MALEK') return res.status(400).json({ error: 'نمی‌توانید' });
    delete accounts[targetUsername];
    write(ACCOUNTS_FILE, accounts);
    res.json({ success: true });
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('authenticate', (data) => {
        const session = sessions[data.token];
        if (!session) return socket.emit('authError', { message: 'نامعتبر' });
        const user = accounts[session.username];
        if (!user) return socket.emit('authError', { message: 'نامعتبر' });

        currentUser = session.username;
        onlineUsers.set(currentUser, socket.id);
        user.status = 'online';
        user.lastSeen = new Date().toISOString();
        write(ACCOUNTS_FILE, accounts);

        // ✅ ارسال پیام‌های آفلاین
        if (offline[currentUser] && offline[currentUser].length > 0) {
            offline[currentUser].forEach(msg => socket.emit('newMessage', msg));
            delete offline[currentUser];
            write(OFFLINE_FILE, offline);
        }

        // ✅ ارسال تاریخچه کامل همه چت‌ها
        socket.emit('authenticated', {
            user: { ...user, password: undefined },
            messages: messages, // ← کل پیام‌ها، نه فیلتر شده
            groups: groups,
            users: accounts
        });

        io.emit('userOnline', { username: currentUser });
        io.emit('onlineList', Array.from(onlineUsers.keys()));
        console.log(`✅ ${currentUser} وارد شد`);
    });

    socket.on('joinChat', ({ chatId }) => {
        if (chatId) socket.join(chatId);
    });

    socket.on('sendMessage', (data) => {
        const { chatId, message } = data;
        if (!currentUser) return socket.emit('error', { message: 'وارد نشده‌اید' });

        const msg = {
            id: Date.now() + Math.random().toString(36).substr(2, 6),
            from: currentUser,
            to: chatId,
            message: message.trim(),
            timestamp: new Date().toISOString(),
            edited: false,
            deleted: false
        };

        if (!messages[chatId]) messages[chatId] = [];
        messages[chatId].push(msg);
        write(MESSAGES_FILE, messages);

        // ✅ ذخیره برای آفلاین
        const target = chatId.startsWith('group_') ? null : chatId;
        if (target && !onlineUsers.has(target)) {
            if (!offline[target]) offline[target] = [];
            offline[target].push(msg);
            write(OFFLINE_FILE, offline);
            console.log(`💾 پیام برای ${target} (آفلاین) ذخیره شد`);
        }

        // ✅ ارسال به همه
        io.to(chatId).emit('newMessage', msg);
        if (target) {
            const targetSocket = onlineUsers.get(target);
            if (targetSocket) io.to(targetSocket).emit('newMessage', msg);
        }

        socket.emit('messageSent', { success: true, messageId: msg.id });
    });

    socket.on('editMessage', ({ chatId, messageId, newText }) => {
        const msgs = messages[chatId];
        if (!msgs) return;
        const idx = msgs.findIndex(m => m.id === messageId);
        if (idx === -1 || msgs[idx].from !== currentUser) return;
        msgs[idx].message = newText.trim();
        msgs[idx].edited = true;
        write(MESSAGES_FILE, messages);
        io.to(chatId).emit('messageEdited', { chatId, messageId, newText: newText.trim() });
    });

    socket.on('deleteMessage', ({ chatId, messageId }) => {
        const msgs = messages[chatId];
        if (!msgs) return;
        const idx = msgs.findIndex(m => m.id === messageId);
        if (idx === -1 || msgs[idx].from !== currentUser) return;
        msgs[idx].deleted = true;
        msgs[idx].message = 'این پیام حذف شده است';
        write(MESSAGES_FILE, messages);
        io.to(chatId).emit('messageDeleted', { chatId, messageId });
    });

    socket.on('typing', ({ chatId }) => {
        if (currentUser) socket.to(chatId).emit('userTyping', { username: currentUser, isTyping: true });
        setTimeout(() => { socket.to(chatId).emit('userTyping', { username: currentUser, isTyping: false }); }, 3000);
    });

    socket.on('updateBio', ({ bio }) => {
        if (currentUser) { accounts[currentUser].bio = bio.trim(); write(ACCOUNTS_FILE, accounts); socket.emit('bioUpdated', { bio: bio.trim() }); }
    });

    socket.on('updateNickname', ({ nickname }) => {
        if (currentUser) { accounts[currentUser].nickname = nickname.trim(); write(ACCOUNTS_FILE, accounts); socket.emit('nicknameUpdated', { nickname: nickname.trim() }); io.emit('userUpdated', { username: currentUser }); }
    });

    socket.on('logout', () => {
        if (currentUser) {
            onlineUsers.delete(currentUser);
            accounts[currentUser].status = 'offline';
            accounts[currentUser].lastSeen = new Date().toISOString();
            write(ACCOUNTS_FILE, accounts);
            io.emit('userOffline', { username: currentUser, lastSeen: accounts[currentUser].lastSeen });
            io.emit('onlineList', Array.from(onlineUsers.keys()));
        }
    });

    socket.on('disconnect', () => {
        if (currentUser) {
            onlineUsers.delete(currentUser);
            accounts[currentUser].status = 'offline';
            accounts[currentUser].lastSeen = new Date().toISOString();
            write(ACCOUNTS_FILE, accounts);
            io.emit('userOffline', { username: currentUser, lastSeen: accounts[currentUser].lastSeen });
            io.emit('onlineList', Array.from(onlineUsers.keys()));
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 PYS v5.0 روی پورت ${PORT} اجرا شد`);
    console.log(`👑 MALEK / MALEK11NEYMAR`);
});
