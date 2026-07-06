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
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// پوشه داده‌ها
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// فایل‌های داده
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// توابع خواندن/نوشتن داده
function readData(file) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        return {};
    } catch (e) {
        console.error('Error reading data:', e);
        return {};
    }
}

function writeData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing data:', e);
    }
}

// داده‌های اولیه
let accounts = readData(ACCOUNTS_FILE);
let messages = readData(MESSAGES_FILE);
let groups = readData(GROUPS_FILE);
let sessions = readData(SESSIONS_FILE);

// کاربران آنلاین
let onlineUsers = new Map();

// حداکثر پیام در هر چت
const MAX_MESSAGES_PER_CHAT = 500;

// ============ API Routes ============

// ثبت نام کاربر جدید
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, nickname } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'نام کاربری باید حداقل 3 کاراکتر باشد' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'رمز عبور باید حداقل 4 کاراکتر باشد' });
        }
        
        if (accounts[username]) {
            return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        accounts[username] = {
            username: username,
            password: hashedPassword,
            nickname: nickname || username,
            bio: 'سلام! من از PYS استفاده می‌کنم 🖤💛',
            profilePic: '',
            status: 'offline',
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            contacts: [],
            groups: []
        };
        
        writeData(ACCOUNTS_FILE, accounts);
        
        res.json({ 
            success: true, 
            message: 'ثبت نام با موفقیت انجام شد',
            user: {
                username: username,
                nickname: accounts[username].nickname
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'خطا در ثبت نام' });
    }
});

// ورود کاربر
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
        }
        
        const account = accounts[username];
        if (!account) {
            return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }
        
        const isValid = await bcrypt.compare(password, account.password);
        if (!isValid) {
            return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
        }
        
        // ایجاد توکن سشن
        const token = Date.now().toString() + Math.random().toString(36).substr(2, 10);
        sessions[token] = {
            username: username,
            createdAt: new Date().toISOString()
        };
        writeData(SESSIONS_FILE, sessions);
        
        res.json({
            success: true,
            token: token,
            user: {
                username: account.username,
                nickname: account.nickname,
                bio: account.bio,
                profilePic: account.profilePic,
                createdAt: account.createdAt
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'خطا در ورود' });
    }
});

// دریافت اطلاعات کاربر با توکن
app.post('/api/verify', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token || !sessions[token]) {
            return res.status(401).json({ error: 'توکن نامعتبر است' });
        }
        
        const session = sessions[token];
        const account = accounts[session.username];
        
        if (!account) {
            return res.status(401).json({ error: 'کاربر یافت نشد' });
        }
        
        res.json({
            success: true,
            user: {
                username: account.username,
                nickname: account.nickname,
                bio: account.bio,
                profilePic: account.profilePic,
                createdAt: account.createdAt
            }
        });
        
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ error: 'خطا در验证' });
    }
});

// دریافت لیست کاربران
app.get('/api/users', (req, res) => {
    try {
        const userList = {};
        Object.keys(accounts).forEach(username => {
            const acc = accounts[username];
            userList[username] = {
                username: acc.username,
                nickname: acc.nickname,
                bio: acc.bio,
                profilePic: acc.profilePic,
                status: onlineUsers.has(username) ? 'online' : 'offline',
                lastSeen: acc.lastSeen
            };
        });
        res.json(userList);
    } catch (error) {
        res.status(500).json({ error: 'خطا در دریافت کاربران' });
    }
});

// دریافت پیام‌ها
app.get('/api/messages/:chatId', (req, res) => {
    try {
        const { chatId } = req.params;
        res.json(messages[chatId] || []);
    } catch (error) {
        res.status(500).json({ error: 'خطا در دریافت پیام‌ها' });
    }
});

// دریافت گروه‌ها
app.get('/api/groups', (req, res) => {
    try {
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'خطا در دریافت گروه‌ها' });
    }
});

// ایجاد گروه جدید
app.post('/api/groups/create', (req, res) => {
    try {
        const { name, creator, members } = req.body;
        
        if (!name || !creator) {
            return res.status(400).json({ error: 'نام گروه و سازنده الزامی است' });
        }
        
        const groupId = 'group_' + Date.now().toString();
        groups[groupId] = {
            id: groupId,
            name: name,
            admin: creator,
            members: [creator, ...(members || [])],
            createdAt: new Date().toISOString(),
            avatar: ''
        };
        
        writeData(GROUPS_FILE, groups);
        
        // اضافه کردن گروه به اکانت‌های اعضا
        groups[groupId].members.forEach(username => {
            if (accounts[username]) {
                if (!accounts[username].groups) {
                    accounts[username].groups = [];
                }
                if (!accounts[username].groups.includes(groupId)) {
                    accounts[username].groups.push(groupId);
                }
            }
        });
        writeData(ACCOUNTS_FILE, accounts);
        
        res.json({ 
            success: true, 
            group: groups[groupId] 
        });
        
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'خطا در ایجاد گروه' });
    }
});

// اضافه کردن عضو به گروه
app.post('/api/groups/add-member', (req, res) => {
    try {
        const { groupId, username } = req.body;
        
        if (!groups[groupId]) {
            return res.status(404).json({ error: 'گروه یافت نشد' });
        }
        
        if (!groups[groupId].members.includes(username)) {
            groups[groupId].members.push(username);
            writeData(GROUPS_FILE, groups);
            
            if (accounts[username]) {
                if (!accounts[username].groups) {
                    accounts[username].groups = [];
                }
                if (!accounts[username].groups.includes(groupId)) {
                    accounts[username].groups.push(groupId);
                }
                writeData(ACCOUNTS_FILE, accounts);
            }
        }
        
        res.json({ 
            success: true, 
            group: groups[groupId] 
        });
        
    } catch (error) {
        res.status(500).json({ error: 'خطا در اضافه کردن عضو' });
    }
});

// ============ Socket.IO ============

io.on('connection', (socket) => {
    console.log('🔗 کاربر جدید متصل شد:', socket.id);
    let currentUser = null;
    
    // احراز هویت با توکن
    socket.on('authenticate', (data) => {
        try {
            const { token } = data;
            
            if (!token || !sessions[token]) {
                socket.emit('authError', { message: 'توکن نامعتبر است' });
                return;
            }
            
            const session = sessions[token];
            const username = session.username;
            
            if (!accounts[username]) {
                socket.emit('authError', { message: 'کاربر یافت نشد' });
                return;
            }
            
            currentUser = username;
            onlineUsers.set(username, socket.id);
            
            accounts[username].status = 'online';
            accounts[username].lastSeen = new Date().toISOString();
            writeData(ACCOUNTS_FILE, accounts);
            
            // ارسال اطلاعات کامل
            socket.emit('authenticated', {
                user: accounts[username],
                messages: messages,
                groups: groups,
                users: accounts
            });
            
            // اطلاع به همه
            io.emit('userOnline', { username: username });
            io.emit('onlineList', Array.from(onlineUsers.keys()));
            
            console.log('✅ کاربر احراز هویت شد:', username);
            
        } catch (error) {
            console.error('Auth error:', error);
            socket.emit('authError', { message: 'خطا در احراز هویت' });
        }
    });
    
    // پیوستن به چت
    socket.on('joinChat', (data) => {
        try {
            const { chatId } = data;
            if (chatId) {
                socket.join(chatId);
                console.log(`📌 کاربر ${currentUser} به چت ${chatId} پیوست`);
            }
        } catch (error) {
            console.error('Join chat error:', error);
        }
    });
    
    // ارسال پیام
    socket.on('sendMessage', (data) => {
        try {
            const { chatId, message, type = 'text', replyTo = null } = data;
            
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
                type: type,
                replyTo: replyTo,
                timestamp: new Date().toISOString(),
                read: false,
                edited: false,
                deleted: false
            };
            
            // ذخیره پیام
            if (!messages[chatId]) {
                messages[chatId] = [];
            }
            messages[chatId].push(msg);
            
            // محدودیت حافظه
            if (messages[chatId].length > MAX_MESSAGES_PER_CHAT) {
                messages[chatId] = messages[chatId].slice(-MAX_MESSAGES_PER_CHAT);
            }
            writeData(MESSAGES_FILE, messages);
            
            // ارسال به همه در اتاق
            io.to(chatId).emit('newMessage', msg);
            
            // ارسال مستقیم به کاربر مقابل (برای چت خصوصی)
            if (!chatId.startsWith('group_')) {
                const targetSocketId = onlineUsers.get(chatId);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('newMessage', msg);
                }
            }
            
            socket.emit('messageSent', { 
                success: true, 
                messageId: msg.id 
            });
            
            console.log(`📤 پیام از ${currentUser} به ${chatId}: ${message.substring(0, 20)}...`);
            
        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: 'خطا در ارسال پیام' });
        }
    });
    
    // ویرایش پیام
    socket.on('editMessage', (data) => {
        try {
            const { chatId, messageId, newText } = data;
            
            if (!currentUser || !chatId || !messageId) return;
            
            const msgs = messages[chatId];
            if (!msgs) return;
            
            const msgIndex = msgs.findIndex(m => m.id === messageId);
            if (msgIndex === -1) return;
            
            if (msgs[msgIndex].from !== currentUser) {
                socket.emit('error', { message: 'شما اجازه ویرایش این پیام را ندارید' });
                return;
            }
            
            msgs[msgIndex].message = newText.trim();
            msgs[msgIndex].edited = true;
            msgs[msgIndex].editedAt = new Date().toISOString();
            writeData(MESSAGES_FILE, messages);
            
            io.to(chatId).emit('messageEdited', {
                chatId,
                messageId,
                newText: newText.trim()
            });
            
        } catch (error) {
            console.error('Edit message error:', error);
        }
    });
    
    // حذف پیام
    socket.on('deleteMessage', (data) => {
        try {
            const { chatId, messageId } = data;
            
            if (!currentUser || !chatId || !messageId) return;
            
            const msgs = messages[chatId];
            if (!msgs) return;
            
            const msgIndex = msgs.findIndex(m => m.id === messageId);
            if (msgIndex === -1) return;
            
            if (msgs[msgIndex].from !== currentUser) {
                socket.emit('error', { message: 'شما اجازه حذف این پیام را ندارید' });
                return;
            }
            
            msgs[msgIndex].deleted = true;
            msgs[msgIndex].message = 'این پیام حذف شده است';
            writeData(MESSAGES_FILE, messages);
            
            io.to(chatId).emit('messageDeleted', {
                chatId,
                messageId
            });
            
        } catch (error) {
            console.error('Delete message error:', error);
        }
    });
    
    // تایپ کردن
    socket.on('typing', (data) => {
        try {
            const { chatId } = data;
            if (currentUser && chatId) {
                socket.to(chatId).emit('userTyping', {
                    username: currentUser,
                    isTyping: true
                });
                
                setTimeout(() => {
                    socket.to(chatId).emit('userTyping', {
                        username: currentUser,
                        isTyping: false
                    });
                }, 3000);
            }
        } catch (error) {
            console.error('Typing error:', error);
        }
    });
    
    // به‌روزرسانی بیوگرافی
    socket.on('updateBio', (data) => {
        try {
            const { bio } = data;
            if (currentUser && accounts[currentUser]) {
                accounts[currentUser].bio = bio.trim();
                writeData(ACCOUNTS_FILE, accounts);
                socket.emit('bioUpdated', { bio: bio.trim() });
            }
        } catch (error) {
            console.error('Update bio error:', error);
        }
    });
    
    // به‌روزرسانی نام نمایشی
    socket.on('updateNickname', (data) => {
        try {
            const { nickname } = data;
            if (currentUser && accounts[currentUser]) {
                accounts[currentUser].nickname = nickname.trim();
                writeData(ACCOUNTS_FILE, accounts);
                socket.emit('nicknameUpdated', { nickname: nickname.trim() });
                io.emit('userUpdated', { username: currentUser });
            }
        } catch (error) {
            console.error('Update nickname error:', error);
        }
    });
    
    // خروج از حساب
    socket.on('logout', () => {
        if (currentUser) {
            onlineUsers.delete(currentUser);
            if (accounts[currentUser]) {
                accounts[currentUser].status = 'offline';
                accounts[currentUser].lastSeen = new Date().toISOString();
                writeData(ACCOUNTS_FILE, accounts);
            }
            io.emit('userOffline', { 
                username: currentUser,
                lastSeen: accounts[currentUser]?.lastSeen
            });
            io.emit('onlineList', Array.from(onlineUsers.keys()));
            console.log(`🔴 کاربر ${currentUser} خارج شد`);
        }
    });
    
    // قطع اتصال
    socket.on('disconnect', () => {
        if (currentUser) {
            onlineUsers.delete(currentUser);
            if (accounts[currentUser]) {
                accounts[currentUser].status = 'offline';
                accounts[currentUser].lastSeen = new Date().toISOString();
                writeData(ACCOUNTS_FILE, accounts);
            }
            io.emit('userOffline', { 
                username: currentUser,
                lastSeen: accounts[currentUser]?.lastSeen
            });
            io.emit('onlineList', Array.from(onlineUsers.keys()));
            console.log(`🔴 کاربر ${currentUser} قطع شد`);
        }
        console.log('🔌 اتصال قطع شد:', socket.id);
    });
});

// ============ Server Start ============

server.listen(PORT, () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   🚀 PYS Messenger v3.0               ║');
    console.log('║   👤 Designed by S A D R A 🖤💛       ║');
    console.log('║   📍 Port: ' + PORT + '                         ║');
    console.log('║   📊 Users: ' + Object.keys(accounts).length + '                         ║');
    console.log('║   💬 Groups: ' + Object.keys(groups).length + '                         ║');
    console.log('╚════════════════════════════════════════╝');
});
