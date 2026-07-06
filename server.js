const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

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

// پوشه عمومی
app.use(express.static('public'));

// ذخیره‌سازی داده‌ها
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// فایل‌های داده
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

// حداکثر تعداد پیام در هر چت
const MAX_MESSAGES_PER_CHAT = 200;

// تابع خواندن داده
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

// تابع نوشتن داده
function writeData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error writing data:', e);
    }
}

// داده‌های اولیه
let messages = readData(MESSAGES_FILE);
let users = readData(USERS_FILE);
let groups = readData(GROUPS_FILE);

// کاربران آنلاین (با socket id)
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
    return message;
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
    console.log('🔗 کاربر جدید متصل شد:', socket.id);
    let currentUser = null;
    
    // ثبت نام / ورود
    socket.on('register', (data) => {
        try {
            const { username, nickname } = data;
            console.log('📝 ثبت نام:', username);
            
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
            
            console.log('✅ کاربر ثبت شد:', username);
            console.log('👥 کاربران آنلاین:', onlineList);
            
        } catch (error) {
            console.error('❌ خطا در ثبت نام:', error);
            socket.emit('error', { message: 'خطا در ثبت نام' });
        }
    });
    
    // پیوستن به چت
    socket.on('joinChat', (data) => {
        try {
            const { chatId } = data;
            socket.join(chatId);
            console.log(`📌 کاربر ${currentUser} به چت ${chatId} پیوست`);
            
            // ارسال تاریخچه چت به کاربر
            if (messages[chatId]) {
                socket.emit('chatHistory', {
                    chatId: chatId,
                    messages: messages[chatId]
                });
            }
        } catch (error) {
            console.error('❌ خطا در پیوستن به چت:', error);
        }
    });
    
    // ارسال پیام - بخش اصلی با رفع باگ
    socket.on('sendMessage', (data) => {
        try {
            const { chatId, message, type = 'text', replyTo = null } = data;
            
            if (!currentUser) {
                console.error('❌ کاربر احراز هویت نشده');
                socket.emit('error', { message: 'لطفاً ابتدا وارد شوید' });
                return;
            }
            
            if (!chatId) {
                console.error('❌ شناسه چت نامعتبر');
                return;
            }
            
            console.log(`📤 ارسال پیام از ${currentUser} به ${chatId}: ${message.substring(0, 20)}...`);
            
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
            
            // ذخیره پیام
            addMessage(chatId, msg);
            
            // *** راه حل اصلی: ارسال به همه کاربران در اتاق ***
            // 1. ارسال به همه کاربرانی که در این اتاق هستند (از جمله فرستنده و گیرنده)
            io.to(chatId).emit('newMessage', msg);
            console.log(`📨 پیام به اتاق ${chatId} ارسال شد`);
            
            // 2. اگر چت خصوصی است، به کاربر مقابل هم ارسال شود (به صورت مستقیم)
            if (!chatId.startsWith('group_')) {
                const targetSocketId = onlineUsers.get(chatId);
                if (targetSocketId) {
                    // ارسال مستقیم به کاربر مقابل
                    io.to(targetSocketId).emit('newMessage', msg);
                    console.log(`📨 پیام به کاربر ${chatId} ارسال شد (مستقیم)`);
                } else {
                    console.log(`⚠️ کاربر ${chatId} آفلاین است`);
                }
            }
            
            // 3. تأیید ارسال به فرستنده
            socket.emit('messageSent', { 
                success: true, 
                messageId: msg.id,
                chatId: chatId 
            });
            
        } catch (error) {
            console.error('❌ خطا در ارسال پیام:', error);
            socket.emit('error', { message: 'خطا در ارسال پیام' });
        }
    });
    
    // پیوستن به گروه
    socket.on('joinGroup', (data) => {
        try {
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
            console.log(`👥 کاربر ${username} به گروه ${groupId} پیوست`);
            
        } catch (error) {
            console.error('❌ خطا در پیوستن به گروه:', error);
        }
    });
    
    // ویرایش پیام
    socket.on('editMessage', (data) => {
        try {
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
                    console.log(`✏️ پیام ${messageId} ویرایش شد`);
                }
            }
        } catch (error) {
            console.error('❌ خطا در ویرایش پیام:', error);
        }
    });
    
    // حذف پیام
    socket.on('deleteMessage', (data) => {
        try {
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
                    console.log(`🗑️ پیام ${messageId} حذف شد`);
                }
            }
        } catch (error) {
            console.error('❌ خطا در حذف پیام:', error);
        }
    });
    
    // آپدیت وضعیت
    socket.on('updateStatus', (data) => {
        try {
            const { status } = data;
            if (currentUser && users[currentUser]) {
                users[currentUser].status = status;
                users[currentUser].lastSeen = new Date().toISOString();
                writeData(USERS_FILE, users);
                
                io.emit('userStatusChanged', {
                    username: currentUser,
                    status: status
                });
                console.log(`🔄 وضعیت ${currentUser}: ${status}`);
            }
        } catch (error) {
            console.error('❌ خطا در آپدیت وضعیت:', error);
        }
    });
    
    // آپدیت بیوگرافی
    socket.on('updateBio', (data) => {
        try {
            const { bio } = data;
            if (currentUser && users[currentUser]) {
                users[currentUser].bio = bio;
                writeData(USERS_FILE, users);
                socket.emit('bioUpdated', { bio });
                console.log(`📝 بیوگرافی ${currentUser} به‌روزرسانی شد`);
            }
        } catch (error) {
            console.error('❌ خطا در آپدیت بیو:', error);
        }
    });
    
    // تایپ کردن
    socket.on('typing', (data) => {
        try {
            const { chatId } = data;
            if (currentUser) {
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
            }
        } catch (error) {
            console.error('❌ خطا در تایپ:', error);
        }
    });
    
    // دریافت پیام‌های قبلی
    socket.on('getChatHistory', (data) => {
        try {
            const { chatId } = data;
            if (messages[chatId]) {
                socket.emit('chatHistory', {
                    chatId: chatId,
                    messages: messages[chatId]
                });
                console.log(`📜 تاریخچه چت ${chatId} ارسال شد`);
            }
        } catch (error) {
            console.error('❌ خطا در دریافت تاریخچه:', error);
        }
    });
    
    // قطع اتصال
    socket.on('disconnect', () => {
        try {
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
                    
                    console.log(`🔴 کاربر ${currentUser} قطع شد`);
                }
            }
            console.log('🔌 اتصال قطع شد:', socket.id);
        } catch (error) {
            console.error('❌ خطا در قطع اتصال:', error);
        }
    });
});

// مسیر تست
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'PYS Messenger is running!',
        designer: 'S A D R A',
        users: Object.keys(users).length,
        groups: Object.keys(groups).length,
        onlineUsers: Array.from(onlineUsers.keys())
    });
});

server.listen(PORT, () => {
    console.log(`🚀 PYS Messenger راه‌اندازی شد!`);
    console.log(`📍 پورت: ${PORT}`);
    console.log(`👤 طراحی شده توسط S A D R A 🖤💛`);
    console.log(`📊 کاربران: ${Object.keys(users).length}`);
    console.log(`💬 گروه‌ها: ${Object.keys(groups).length}`);
});
