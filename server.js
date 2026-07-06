const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// پوشه عمومی
app.use(express.static('public'));

// ذخیره‌سازی داده‌ها
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// فایل‌های داده
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

// حداکثر تعداد پیام در هر چت (برای مدیریت حافظه)
const MAX_MESSAGES_PER_CHAT = 200;

// تابع خواندن داده
function readData(file) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        return {};
    } catch (e) {
        return {};
    }
}

// تابع نوشتن داده
function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// داده‌های اولیه
let messages = readData(MESSAGES_FILE);
let users = readData(USERS_FILE);
let groups = readData(GROUPS_FILE);

// کاربران آنلاین
let onlineUsers = new Map();

// مدیریت پیام‌ها با محدودیت حافظه
function addMessage(chatId, message) {
    if (!messages[chatId]) {
        messages[chatId] = [];
    }
    
    messages[chatId].push(message);
    
    // اگر تعداد پیام‌ها بیشتر از حد مجاز شد، پیام‌های قدیمی حذف می‌شوند
    if (messages[chatId].length > MAX_MESSAGES_PER_CHAT) {
        messages[chatId] = messages[chatId].slice(-MAX_MESSAGES_PER_CHAT);
    }
    
    writeData(MESSAGES_FILE, messages);
}

// کاربر جدید
function addUser(username, nickname) {
    if (!users[username]) {
        users[username] = {
            username: username,
            nickname: nickname || username,
            bio: 'سلام! من از PYS استفاده می‌کنم 🖤💛',
            profilePic: '',
            status: 'online',
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            contacts: [],
            blocked: [],
            groups: []
        };
        writeData(USERS_FILE, users);
    }
    return users[username];
}

// سوکت‌ها
io.on('connection', (socket) => {
    console.log('کاربر جدید متصل شد:', socket.id);
    
    let currentUser = null;
    
    // ثبت نام / ورود
    socket.on('register', (data) => {
        const { username, nickname } = data;
        const user = addUser(username, nickname);
        currentUser = username;
        
        // ذخیره socket id
        onlineUsers.set(username, socket.id);
        user.status = 'online';
        user.lastSeen = new Date().toISOString();
        writeData(USERS_FILE, users);
        
        // ارسال اطلاعات کاربر
        socket.emit('userRegistered', {
            user: user,
            messages: messages,
            users: users,
            groups: groups
        });
        
        // اطلاع به همه کاربران
        io.emit('userOnline', {
            username: username,
            status: 'online'
        });
        
        // ارسال لیست آنلاین‌ها
        const onlineList = Array.from(onlineUsers.keys());
        io.emit('onlineList', onlineList);
    });
    
    // ارسال پیام
    socket.on('sendMessage', (data) => {
        const { chatId, message, type = 'text', replyTo = null } = data;
        
        if (!currentUser) return;
        
        const msg = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            from: currentUser,
            to: chatId,
            message: message,
            type: type,
            replyTo: replyTo,
            timestamp: new Date().toISOString(),
            read: false,
            edited: false,
            deleted: false
        };
        
        addMessage(chatId, msg);
        
        // ارسال به همه کاربران در چت
        io.to(chatId).emit('newMessage', msg);
        
        // اگر چت گروهی نیست، به کاربر مقابل هم ارسال شود
        if (!chatId.startsWith('group_')) {
            const targetSocket = onlineUsers.get(chatId);
            if (targetSocket) {
                io.to(targetSocket).emit('newMessage', msg);
            }
        }
    });
    
    // پیوستن به گروه
    socket.on('joinGroup', (data) => {
        const { groupId, username } = data;
        socket.join(groupId);
        
        if (!groups[groupId]) {
            groups[groupId] = {
                id: groupId,
                name: data.groupName || 'گروه جدید',
                members: [],
                admin: username,
                createdAt: new Date().toISOString(),
                avatar: ''
            };
        }
        
        if (!groups[groupId].members.includes(username)) {
            groups[groupId].members.push(username);
        }
        
        writeData(GROUPS_FILE, groups);
        socket.emit('groupJoined', groups[groupId]);
        io.emit('groupUpdated', groups);
    });
    
    // ویرایش پیام
    socket.on('editMessage', (data) => {
        const { chatId, messageId, newText } = data;
        if (messages[chatId]) {
            const msgIndex = messages[chatId].findIndex(m => m.id === messageId);
            if (msgIndex !== -1 && messages[chatId][msgIndex].from === currentUser) {
                messages[chatId][msgIndex].message = newText;
                messages[chatId][msgIndex].edited = true;
                messages[chatId][msgIndex].editedAt = new Date().toISOString();
                writeData(MESSAGES_FILE, messages);
                
                io.to(chatId).emit('messageEdited', {
                    chatId,
                    messageId,
                    newText,
                    editedAt: messages[chatId][msgIndex].editedAt
                });
            }
        }
    });
    
    // حذف پیام
    socket.on('deleteMessage', (data) => {
        const { chatId, messageId } = data;
        if (messages[chatId]) {
            const msgIndex = messages[chatId].findIndex(m => m.id === messageId);
            if (msgIndex !== -1 && messages[chatId][msgIndex].from === currentUser) {
                messages[chatId][msgIndex].deleted = true;
                messages[chatId][msgIndex].message = 'این پیام حذف شده است';
                writeData(MESSAGES_FILE, messages);
                
                io.to(chatId).emit('messageDeleted', {
                    chatId,
                    messageId
                });
            }
        }
    });
    
    // آپدیت وضعیت
    socket.on('updateStatus', (data) => {
        const { status } = data;
        if (currentUser && users[currentUser]) {
            users[currentUser].status = status;
            users[currentUser].lastSeen = new Date().toISOString();
            writeData(USERS_FILE, users);
            
            io.emit('userStatusChanged', {
                username: currentUser,
                status: status
            });
        }
    });
    
    // آپدیت بیوگرافی
    socket.on('updateBio', (data) => {
        const { bio } = data;
        if (currentUser && users[currentUser]) {
            users[currentUser].bio = bio;
            writeData(USERS_FILE, users);
            socket.emit('bioUpdated', { bio });
        }
    });
    
    // تایپ کردن
    socket.on('typing', (data) => {
        const { chatId } = data;
        socket.to(chatId).emit('userTyping', {
            username: currentUser,
            isTyping: true
        });
        
        // بعد از 3 ثانیه تایپینگ را متوقف کن
        setTimeout(() => {
            socket.to(chatId).emit('userTyping', {
                username: currentUser,
                isTyping: false
            });
        }, 3000);
    });
    
    // قطع اتصال
    socket.on('disconnect', () => {
        if (currentUser) {
            onlineUsers.delete(currentUser);
            if (users[currentUser]) {
                users[currentUser].status = 'offline';
                users[currentUser].lastSeen = new Date().toISOString();
                writeData(USERS_FILE, users);
                
                io.emit('userOffline', {
                    username: currentUser,
                    lastSeen: users[currentUser].lastSeen
                });
                
                const onlineList = Array.from(onlineUsers.keys());
                io.emit('onlineList', onlineList);
            }
        }
        console.log('کاربر قطع شد:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 سرور PYS روی پورت ${PORT} اجرا شد!`);
    console.log(`👤 طراحی شده توسط S A D R A`);
});
