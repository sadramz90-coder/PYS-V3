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
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const OFFLINE_FILE = path.join(DATA_DIR, 'offline.json');

const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const write = (f, d) => { fs.writeFileSync(f, JSON.stringify(d, null, 2)); };

let accounts = read(ACCOUNTS_FILE);
let messages = read(MESSAGES_FILE);
let groups = read(GROUPS_FILE);
let sessions = read(SESSIONS_FILE);
let offlineMessages = read(OFFLINE_FILE);

const onlineUsers = new Map();

// ========== ایجاد اکانت ویژه ==========
(async () => {
    if (!accounts['MALEK']) {
        accounts['MALEK'] = {
            username: 'MALEK',
            password: await bcrypt.hash('MALEK11NEYMAR', 10),
            nickname: '👑 مالک ویژه',
            bio: '🧠 ادمین اصلی PYS | طراحی شده توسط S A D R A',
            isSpecial: true,
            isAdmin: true,
            status: 'offline',
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            groups: []
        };
        write(ACCOUNTS_FILE, accounts);
        console.log('👑 اکانت ویژه MALEK ساخته شد');
    }
})();

// ========== API Routes ==========
app.post('/api/register', async (req, res) => {
    const { username, password, nickname } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز الزامی است' });
    if (accounts[username]) return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
    if (username.length < 3) return res.status(400).json({ error: 'نام کاربری حداقل ۳ کاراکتر' });
    if (password.length < 4) return res.status(400).json({ error: 'رمز عبور حداقل ۴ کاراکتر' });
    
    accounts[username] = {
        username,
        password: await bcrypt.hash(password, 10),
        nickname: nickname || username,
        bio: 'سلام! من از PYS استفاده می‌کنم 🖤💛',
        isSpecial: false,
        isAdmin: false,
        status: 'offline',
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        groups: []
    };
    write(ACCOUNTS_FILE, accounts);
    res.json({ success: true, message: 'ثبت نام با موفقیت انجام شد' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز الزامی است' });
    
    const user = accounts[username];
    if (!user) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    
    const token = Date.now().toString() + Math.random().toString(36).substr(2, 10);
    sessions[token] = { username, createdAt: new Date().toISOString() };
    write(SESSIONS_FILE, sessions);
    
    res.json({
        success: true,
        token,
        user: {
            username: user.username,
            nickname: user.nickname,
            bio: user.bio,
            isSpecial: user.isSpecial || false,
            isAdmin: user.isAdmin || false,
            createdAt: user.createdAt
        }
    });
});

app.post('/api/verify', (req, res) => {
    const { token } = req.body;
    if (!token || !sessions[token]) return res.status(401).json({ error: 'توکن نامعتبر است' });
    
    const user = accounts[sessions[token].username];
    if (!user) return res.status(401).json({ error: 'کاربر یافت نشد' });
    
    res.json({
        success: true,
        user: {
            username: user.username,
            nickname: user.nickname,
            bio: user.bio,
            isSpecial: user.isSpecial || false,
            isAdmin: user.isAdmin || false,
            createdAt: user.createdAt
        }
    });
});

app.get('/api/users', (req, res) => {
    const list = {};
    Object.keys(accounts).forEach(u => {
        const user = accounts[u];
        list[u] = {
            username: user.username,
            nickname: user.nickname,
            bio: user.bio,
            isSpecial: user.isSpecial || false,
            isAdmin: user.isAdmin || false,
            status: onlineUsers.has(u) ? 'online' : 'offline',
            lastSeen: user.lastSeen
        };
    });
    res.json(list);
});

app.get('/api/messages/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    res.json(messages[chatId] || []);
});

app.get('/api/groups', (req, res) => {
    res.json(groups);
});

app.post('/api/groups/create', (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) return res.status(400).json({ error: 'نام گروه و سازنده الزامی است' });
    
    const groupId = 'group_' + Date.now().toString();
    groups[groupId] = {
        id: groupId,
        name: name,
        admin: creator,
        members: [creator, ...(members || [])],
        createdAt: new Date().toISOString(),
        avatar: ''
    };
    write(GROUPS_FILE, groups);
    
    // اضافه کردن گروه به اکانت‌ها
    groups[groupId].members.forEach(m => {
        if (accounts[m]) {
            if (!accounts[m].groups) accounts[m].groups = [];
            if (!accounts[m].groups.includes(groupId)) accounts[m].groups.push(groupId);
        }
    });
    write(ACCOUNTS_FILE, accounts);
    
    res.json({ success: true, group: groups[groupId] });
});

// ========== Admin Routes ==========
app.get('/api/admin/users', (req, res) => {
    const { token } = req.query;
    if (!token || !sessions[token]) return res.status(401).json({ error: 'دسترسی غیرمجاز' });
    const user = accounts[sessions[token].username];
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'دسترسی فقط برای ادمین' });
    res.json(accounts);
});

app.post('/api/admin/edit-user', (req, res) => {
    const { token, targetUsername, updates } = req.body;
    if (!token || !sessions[token]) return res.status(401).json({ error: 'دسترسی غیرمجاز' });
    const user = accounts[sessions[token].username];
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'دسترسی فقط برای ادمین' });
    if (!accounts[targetUsername]) return res.status(404).json({ error: 'کاربر یافت نشد' });
    
    Object.keys(updates).forEach(key => {
        if (key !== 'password' && key !== 'username') {
            accounts[targetUsername][key] = updates[key];
        }
    });
    write(ACCOUNTS_FILE, accounts);
    res.json({ success: true });
});

app.post('/api/admin/delete-user', (req, res) => {
    const { token, targetUsername } = req.body;
    if (!token || !sessions[token]) return res.status(401).json({ error: 'دسترسی غیرمجاز' });
    const user = accounts[sessions[token].username];
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'دسترسی فقط برای ادمین' });
    if (targetUsername === 'MALEK') return res.status(400).json({ error: 'نمی‌توان اکانت ویژه را حذف کرد' });
    
    delete accounts[targetUsername];
    write(ACCOUNTS_FILE, accounts);
    res.json({ success: true });
});

// ========== Socket.IO ==========
io.on('connection', (socket) => {
    console.log('🔗 کاربر جدید متصل شد:', socket.id);
    let currentUser = null;

    socket.on('authenticate', (data) => {
        const session = sessions[data.token];
        if (!session) {
            socket.emit('authError', { message: 'توکن نامعتبر است' });
            return;
        }
        
        const user = accounts[session.username];
        if (!user) {
            socket.emit('authError', { message: 'کاربر یافت نشد' });
            return;
        }

        currentUser = session.username;
        onlineUsers.set(currentUser, socket.id);
        user.status = 'online';
        user.lastSeen = new Date().toISOString();
        write(ACCOUNTS_FILE, accounts);

        // ========== ارسال پیام‌های آفلاین ==========
        if (offlineMessages[currentUser] && offlineMessages[currentUser].length > 0) {
            console.log(`📨 ارسال ${offlineMessages[currentUser].length} پیام آفلاین به ${currentUser}`);
            offlineMessages[currentUser].forEach(msg => {
                socket.emit('newMessage', msg);
            });
            delete offlineMessages[currentUser];
            write(OFFLINE_FILE, offlineMessages);
        }

        // ========== ارسال همه چت‌ها (کامل) ==========
        socket.emit('authenticated', {
            user: {
                username: user.username,
                nickname: user.nickname,
                bio: user.bio,
                isSpecial: user.isSpecial || false,
                isAdmin: user.isAdmin || false,
                status: user.status,
                lastSeen: user.lastSeen,
                createdAt: user.createdAt
            },
            messages: messages, // ← همه پیام‌ها، بدون فیلتر
            groups: groups,
            users: accounts
        });

        // اطلاع به همه
        io.emit('userOnline', { username: currentUser });
        io.emit('onlineList', Array.from(onlineUsers.keys()));
        console.log(`✅ کاربر ${currentUser} احراز هویت شد`);
    });

    socket.on('joinChat', ({ chatId }) => {
        if (chatId) {
            socket.join(chatId);
            console.log(`📌 کاربر ${currentUser} به چت ${chatId} پیوست`);
        }
    });

    socket.on('sendMessage', (data) => {
        const { chatId, message } = data;
        if (!currentUser) {
            socket.emit('error', { message: 'لطفاً وارد شوید' });
            return;
        }
        if (!chatId || !message) {
            socket.emit('error', { message: 'اطلاعات پیام ناقص است' });
            return;
        }

        const msg = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
            from: currentUser,
            to: chatId,
            message: message.trim(),
            timestamp: new Date().toISOString(),
            edited: false,
            deleted: false
        };

        // ذخیره در messages
        if (!messages[chatId]) messages[chatId] = [];
        messages[chatId].push(msg);
        write(MESSAGES_FILE, messages);

        // ========== ذخیره برای آفلاین ==========
        const targetUser = chatId.startsWith('group_') ? null : chatId;
        if (targetUser && !onlineUsers.has(targetUser)) {
            if (!offlineMessages[targetUser]) offlineMessages[targetUser] = [];
            offlineMessages[targetUser].push(msg);
            write(OFFLINE_FILE, offlineMessages);
            console.log(`💾 پیام برای ${targetUser} (آفلاین) ذخیره شد`);
        }

        // ========== ارسال به همه ==========
        io.to(chatId).emit('newMessage', msg);
        
        // ارسال مستقیم به کاربر مقابل (اگر آنلاین باشد)
        if (targetUser) {
            const targetSocket = onlineUsers.get(targetUser);
            if (targetSocket) {
                io.to(targetSocket).emit('newMessage', msg);
                console.log(`📨 پیام به ${targetUser} (آنلاین) ارسال شد`);
            }
        }

        socket.emit('messageSent', { success: true, messageId: msg.id });
        console.log(`📤 پیام از ${currentUser} به ${chatId}: ${message.substring(0, 20)}...`);
    });

    socket.on('editMessage', ({ chatId, messageId, newText }) => {
        if (!currentUser || !chatId || !messageId) return;
        const msgs = messages[chatId];
        if (!msgs) return;
        const idx = msgs.findIndex(m => m.id === messageId);
        if (idx === -1 || msgs[idx].from !== currentUser) return;
        msgs[idx].message = newText.trim();
        msgs[idx].edited = true;
        msgs[idx].editedAt = new Date().toISOString();
        write(MESSAGES_FILE, messages);
        io.to(chatId).emit('messageEdited', { chatId, messageId, newText: newText.trim() });
    });

    socket.on('deleteMessage', ({ chatId, messageId }) => {
        if (!currentUser || !chatId || !messageId) return;
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
        if (currentUser && chatId) {
            socket.to(chatId).emit('userTyping', { username: currentUser, isTyping: true });
            setTimeout(() => {
                socket.to(chatId).emit('userTyping', { username: currentUser, isTyping: false });
            }, 3000);
        }
    });

    socket.on('updateBio', ({ bio }) => {
        if (currentUser && accounts[currentUser]) {
            accounts[currentUser].bio = bio.trim();
            write(ACCOUNTS_FILE, accounts);
            socket.emit('bioUpdated', { bio: bio.trim() });
        }
    });

    socket.on('updateNickname', ({ nickname }) => {
        if (currentUser && accounts[currentUser]) {
            accounts[currentUser].nickname = nickname.trim();
            write(ACCOUNTS_FILE, accounts);
            socket.emit('nicknameUpdated', { nickname: nickname.trim() });
            io.emit('userUpdated', { username: currentUser });
        }
    });

    socket.on('logout', () => {
        if (currentUser) {
            onlineUsers.delete(currentUser);
            accounts[currentUser].status = 'offline';
            accounts[currentUser].lastSeen = new Date().toISOString();
            write(ACCOUNTS_FILE, accounts);
            io.emit('userOffline', { username: currentUser, lastSeen: accounts[currentUser].lastSeen });
            io.emit('onlineList', Array.from(onlineUsers.keys()));
            console.log(`🔴 کاربر ${currentUser} خارج شد`);
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
            console.log(`🔴 کاربر ${currentUser} قطع شد`);
        }
        console.log('🔌 اتصال قطع شد:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   🚀 PYS Messenger v6.0 - FINAL          ║');
    console.log('║   👤 Designed by S A D R A 🖤💛          ║');
    console.log('║   📍 Port: ' + PORT + '                             ║');
    console.log('║   👑 MALEK / MALEK11NEYMAR               ║');
    console.log('║   💾 Offline Messages: ✓                 ║');
    console.log('║   📨 Full History: ✓                     ║');
    console.log('╚════════════════════════════════════════════╝');
});
