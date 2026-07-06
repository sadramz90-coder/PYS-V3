// اتصال به سرور
const socket = io();

// متغیرهای جهانی
let currentUser = null;
let currentChat = null;
let chatHistory = {};
let allUsers = {};
let allGroups = {};
let onlineUsersList = [];

// عناصر DOM
const loginPage = document.getElementById('loginPage');
const mainPage = document.getElementById('mainPage');
const usernameInput = document.getElementById('usernameInput');
const nicknameInput = document.getElementById('nicknameInput');
const loginBtn = document.getElementById('loginBtn');
const chatList = document.getElementById('chatList');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatUsername = document.getElementById('chatUsername');
const chatStatus = document.getElementById('chatStatus');
const chatAvatar = document.getElementById('chatAvatar');
const profileSidebar = document.getElementById('profileSidebar');
const closeProfile = document.getElementById('closeProfile');
const profileName = document.getElementById('profileName');
const profileUsername = document.getElementById('profileUsername');
const profileBio = document.getElementById('profileBio');
const editBioBtn = document.getElementById('editBioBtn');
const logoutBtn = document.getElementById('logoutBtn');
const searchChat = document.getElementById('searchChat');
const settingsBtn = document.getElementById('settingsBtn');
const newChatBtn = document.getElementById('newChatBtn');

// تابع نمایش اعلان
function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ff4444' : '#1a1a1a'};
        border: 1px solid ${type === 'error' ? '#ff4444' : 'rgba(255,215,0,0.2)'};
        border-radius: 15px;
        padding: 15px 30px;
        color: white;
        z-index: 10000;
        font-family: 'Vazirmatn', sans-serif;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        animation: slideUp 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transition = 'opacity 0.3s';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// تابع ورود
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const nickname = nicknameInput.value.trim();
    
    if (!username) {
        showNotification('لطفاً نام کاربری را وارد کنید!', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('نام کاربری باید حداقل 3 کاراکتر باشد!', 'error');
        return;
    }
    
    // نمایش وضعیت
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال اتصال...';
    loginBtn.disabled = true;
    
    socket.emit('register', { username, nickname });
});

// Enter برای لاگین
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

// دریافت اطلاعات پس از ثبت نام
socket.on('userRegistered', (data) => {
    currentUser = data.user;
    allUsers = data.users;
    allGroups = data.groups;
    chatHistory = data.messages;
    
    loginPage.classList.remove('active');
    mainPage.classList.add('active');
    
    updateChatList();
    updateProfile();
    showNotification(`به PYS خوش آمدید ${currentUser.nickname || currentUser.username}! 🖤💛`);
    
    // بازیابی دکمه لاگین
    loginBtn.innerHTML = '<i class="fas fa-rocket"></i> ورود به PYS';
    loginBtn.disabled = false;
});

// خطاها
socket.on('error', (data) => {
    showNotification(data.message || 'خطایی رخ داد!', 'error');
    loginBtn.innerHTML = '<i class="fas fa-rocket"></i> ورود به PYS';
    loginBtn.disabled = false;
});

// به‌روزرسانی لیست چت‌ها
function updateChatList() {
    chatList.innerHTML = '';
    
    if (!currentUser) return;
    
    // چت‌های خصوصی
    const contacts = Object.keys(allUsers).filter(u => u !== currentUser.username);
    
    if (contacts.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align:center;padding:40px 20px;color:var(--text-gray);opacity:0.5;';
        emptyDiv.innerHTML = `
            <i class="fas fa-users" style="font-size:3rem;display:block;margin-bottom:15px;"></i>
            <p>هنوز کاربری برای چت وجود ندارد</p>
            <span style="font-size:0.9rem;">از دکمه + برای شروع چت استفاده کنید</span>
        `;
        chatList.appendChild(emptyDiv);
        return;
    }
    
    contacts.forEach(username => {
        const user = allUsers[username];
        const chatId = username;
        const lastMsg = chatHistory[chatId] && chatHistory[chatId].length > 0 ? 
            chatHistory[chatId][chatHistory[chatId].length - 1] : null;
        const isOnline = onlineUsersList.includes(username);
        
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChat === chatId ? 'active' : ''}`;
        chatItem.dataset.chatId = chatId;
        chatItem.dataset.type = 'private';
        
        const avatarText = user.nickname ? user.nickname[0].toUpperCase() : username[0].toUpperCase();
        
        chatItem.innerHTML = `
            <div class="chat-avatar">
                ${avatarText}
                <div class="${isOnline ? 'online-dot' : 'offline-dot'}"></div>
            </div>
            <div class="chat-info">
                <div class="chat-name">${user.nickname || username}</div>
                <div class="chat-last-msg">${lastMsg ? (lastMsg.deleted ? '🗑️ پیام حذف شده' : lastMsg.message.substring(0, 30)) : '💬 شروع چت...'}</div>
            </div>
            <div class="chat-time">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'}) : ''}</div>
        `;
        
        chatItem.addEventListener('click', () => {
            openChat(chatId, 'private');
        });
        
        chatList.appendChild(chatItem);
    });
    
    // چت‌های گروهی
    Object.keys(allGroups).forEach(groupId => {
        const group = allGroups[groupId];
        if (group.members && group.members.includes(currentUser.username)) {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${currentChat === groupId ? 'active' : ''}`;
            chatItem.dataset.chatId = groupId;
            chatItem.dataset.type = 'group';
            
            const lastMsg = chatHistory[groupId] && chatHistory[groupId].length > 0 ? 
                chatHistory[groupId][chatHistory[groupId].length - 1] : null;
            
            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${group.name}</div>
                    <div class="chat-last-msg">${lastMsg ? lastMsg.message : 'گروه خالی'}</div>
                </div>
            `;
            
            chatItem.addEventListener('click', () => {
                openChat(groupId, 'group');
            });
            
            chatList.appendChild(chatItem);
        }
    });
}

// باز کردن چت
function openChat(chatId, type) {
    if (!chatId) return;
    
    currentChat = chatId;
    console.log('📂 باز کردن چت:', chatId, 'نوع:', type);
    
    // به‌روزرسانی لیست
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chatId);
    });
    
    // آپدیت هدر
    if (type === 'private') {
        const user = allUsers[chatId];
        if (!user) {
            showNotification('کاربر یافت نشد!', 'error');
            return;
        }
        chatUsername.textContent = user.nickname || chatId;
        chatUsername.style.color = '';
        const isOnline = onlineUsersList.includes(chatId);
        chatStatus.textContent = isOnline ? '🟢 آنلاین' : '⚫ آفلاین';
        chatStatus.className = `chat-status ${isOnline ? 'online' : ''}`;
        chatAvatar.innerHTML = `<i class="fas fa-user-circle" style="font-size:2.5rem;"></i>`;
    } else {
        const group = allGroups[chatId];
        if (!group) {
            showNotification('گروه یافت نشد!', 'error');
            return;
        }
        chatUsername.textContent = group.name;
        chatUsername.style.color = 'var(--gold)';
        chatStatus.textContent = `👥 ${group.members ? group.members.length : 0} عضو`;
        chatStatus.className = 'chat-status';
        chatAvatar.innerHTML = `<i class="fas fa-users" style="font-size:2.5rem;"></i>`;
    }
    
    // پیوستن به اتاق
    socket.emit('joinChat', { chatId });
    
    // نمایش پیام‌ها
    loadMessages(chatId);
    
    // فوکوس روی اینپوت
    messageInput.focus();
}

// بارگذاری پیام‌ها
function loadMessages(chatId) {
    messagesContainer.innerHTML = '';
    
    if (!chatHistory[chatId] || chatHistory[chatId].length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>هیچ پیامی وجود ندارد</p>
                <span>اولین پیام را ارسال کنید</span>
            </div>
        `;
        return;
    }
    
    // نمایش پیام‌ها به ترتیب
    chatHistory[chatId].forEach(msg => {
        appendMessage(msg);
    });
    
    scrollToBottom();
}

// افزودن پیام به صفحه
function appendMessage(msg) {
    if (!msg) return;
    
    const isSent = msg.from === currentUser.username;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    msgDiv.dataset.msgId = msg.id;
    
    let content = '';
    
    if (msg.deleted) {
        content = `<div class="msg-text" style="opacity:0.4;font-style:italic;">🗑️ این پیام حذف شده است</div>`;
    } else {
        // ریپلای
        if (msg.replyTo) {
            const repliedMsg = chatHistory[msg.to]?.find(m => m.id === msg.replyTo);
            if (repliedMsg) {
                content += `<div class="msg-reply">${repliedMsg.message}</div>`;
            }
        }
        
        content += `<div class="msg-text">${msg.message}</div>`;
        
        if (msg.edited) {
            content += `<span class="msg-edited">✏️ ویرایش شده</span>`;
        }
    }
    
    const time = new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'});
    content += `<div class="msg-time">${time}`;
    if (isSent && !msg.deleted) {
        content += ` <i class="fas fa-check-double" style="font-size:0.7rem;"></i>`;
    }
    content += `</div>`;
    
    msgDiv.innerHTML = content;
    
    // کلیک راست برای منوی حذف/ویرایش (فقط برای پیام‌های خود)
    if (isSent && !msg.deleted) {
        msgDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageMenu(msg.id, msg.to);
        });
    }
    
    messagesContainer.appendChild(msgDiv);
}

// منوی پیام
function showMessageMenu(msgId, chatId) {
    // حذف منوی قبلی
    document.querySelector('.message-menu')?.remove();
    
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.style.cssText = `
        position: fixed;
        background: #1a1a1a;
        border: 1px solid rgba(255,215,0,0.2);
        border-radius: 12px;
        padding: 8px;
        z-index: 9999;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        min-width: 150px;
    `;
    
    menu.innerHTML = `
        <button onclick="editMessage('${msgId}','${chatId}')" style="background:transparent;border:none;color:var(--gold);padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;border-radius:8px;transition:all 0.2s;">
            <i class="fas fa-edit"></i> ویرایش
        </button>
        <button onclick="deleteMessage('${msgId}','${chatId}')" style="background:transparent;border:none;color:#ff4444;padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;border-radius:8px;transition:all 0.2s;">
            <i class="fas fa-trash"></i> حذف
        </button>
    `;
    
    document.body.appendChild(menu);
    
    // موقعیت منو
    const rect = menu.getBoundingClientRect();
    let x = event.clientX;
    let y = event.clientY;
    
    if (x + rect.width > window.innerWidth) {
        x = x - rect.width;
    }
    if (y + rect.height > window.innerHeight) {
        y = y - rect.height;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    // بستن منو با کلیک خارج
    setTimeout(() => {
        document.addEventListener('click', () => {
            menu.remove();
        }, { once: true });
    }, 100);
}

// ویرایش پیام (دسترسی global)
window.editMessage = function(msgId, chatId) {
    const newText = prompt('متن جدید:', '');
    if (newText !== null && newText.trim()) {
        socket.emit('editMessage', { chatId, messageId: msgId, newText: newText.trim() });
        showNotification('✏️ پیام در حال ویرایش...');
    }
    document.querySelector('.message-menu')?.remove();
};

// حذف پیام (دسترسی global)
window.deleteMessage = function(msgId, chatId) {
    if (confirm('🗑️ آیا از حذف این پیام مطمئن هستید؟')) {
        socket.emit('deleteMessage', { chatId, messageId: msgId });
        showNotification('🗑️ پیام حذف شد');
    }
    document.querySelector('.message-menu')?.remove();
};

// اسکرول به پایین
function scrollToBottom() {
    const container = document.querySelector('.messages-container');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }
}

// ارسال پیام
function sendMessage() {
    const text = messageInput.value.trim();
    
    if (!text) {
        showNotification('لطفاً پیام بنویسید!', 'error');
        return;
    }
    
    if (!currentChat) {
        showNotification('لطفاً یک چت انتخاب کنید!', 'error');
        return;
    }
    
    console.log('📤 ارسال پیام به:', currentChat, 'متن:', text.substring(0, 20));
    
    // ارسال پیام به سرور
    socket.emit('sendMessage', {
        chatId: currentChat,
        message: text,
        type: 'text',
        replyTo: null
    });
    
    // پاک کردن اینپوت
    messageInput.value = '';
    messageInput.focus();
    
    // نمایش پیام به صورت موقت در سمت کلاینت
    const tempMsg = {
        id: 'temp_' + Date.now(),
        from: currentUser.username,
        to: currentChat,
        message: text,
        type: 'text',
        timestamp: new Date().toISOString(),
        deleted: false,
        edited: false
    };
    
    // اضافه به تاریخچه
    if (!chatHistory[currentChat]) {
        chatHistory[currentChat] = [];
    }
    chatHistory[currentChat].push(tempMsg);
    appendMessage(tempMsg);
    scrollToBottom();
}

// رویداد ارسال پیام (دکمه)
sendBtn.addEventListener('click', sendMessage);

// رویداد ارسال پیام (Enter)
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// دریافت پیام جدید
socket.on('newMessage', (msg) => {
    console.log('📨 پیام جدید دریافت شد:', msg.from, '->', msg.to);
    
    // ذخیره در تاریخچه
    if (!chatHistory[msg.to]) {
        chatHistory[msg.to] = [];
    }
    
    // بررسی تکراری نبودن
    const exists = chatHistory[msg.to].some(m => m.id === msg.id);
    if (!exists) {
        chatHistory[msg.to].push(msg);
        
        // اگر چت باز است، نمایش بده
        if (currentChat === msg.to) {
            // حذف پیام موقت (اگر وجود داشته باشد)
            const tempIndex = chatHistory[msg.to].findIndex(m => m.id.startsWith('temp_'));
            if (tempIndex !== -1) {
                chatHistory[msg.to].splice(tempIndex, 1);
            }
            loadMessages(msg.to);
        }
        
        updateChatList();
    }
});

// تأیید ارسال پیام
socket.on('messageSent', (data) => {
    if (data.success) {
        console.log('✅ پیام با موفقیت ارسال شد:', data.messageId);
    }
});

// ویرایش پیام
socket.on('messageEdited', (data) => {
    const { chatId, messageId, newText } = data;
    if (chatHistory[chatId]) {
        const msg = chatHistory[chatId].find(m => m.id === messageId);
        if (msg) {
            msg.message = newText;
            msg.edited = true;
            if (currentChat === chatId) {
                loadMessages(chatId);
            }
            showNotification('✏️ پیام ویرایش شد');
        }
    }
});

// حذف پیام
socket.on('messageDeleted', (data) => {
    const { chatId, messageId } = data;
    if (chatHistory[chatId]) {
        const msg = chatHistory[chatId].find(m => m.id === messageId);
        if (msg) {
            msg.deleted = true;
            msg.message = 'این پیام حذف شده است';
            if (currentChat === chatId) {
                loadMessages(chatId);
            }
        }
    }
});

// وضعیت آنلاین
socket.on('userOnline', (data) => {
    if (!onlineUsersList.includes(data.username)) {
        onlineUsersList.push(data.username);
    }
    updateChatList();
    if (currentChat === data.username) {
        chatStatus.textContent = '🟢 آنلاین';
        chatStatus.className = 'chat-status online';
    }
    console.log('🟢 کاربر آنلاین شد:', data.username);
});

socket.on('userOffline', (data) => {
    onlineUsersList = onlineUsersList.filter(u => u !== data.username);
    updateChatList();
    if (currentChat === data.username) {
        const time = new Date(data.lastSeen).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'});
        chatStatus.textContent = `⚫ آخرین بازدید: ${time}`;
        chatStatus.className = 'chat-status';
    }
    console.log('🔴 کاربر آفلاین شد:', data.username);
});

socket.on('onlineList', (list) => {
    onlineUsersList = list;
    updateChatList();
    console.log('👥 لیست آنلاین‌ها:', list);
});

// آپدیت پروفایل
function updateProfile() {
    if (!currentUser) return;
    profileName.textContent = currentUser.nickname || currentUser.username;
    profileUsername.textContent = `@${currentUser.username}`;
    profileBio.textContent = currentUser.bio || 'بیوگرافی خود را وارد کنید';
    document.getElementById('memberSince').textContent = new Date(currentUser.createdAt).toLocaleDateString('fa-IR');
    document.getElementById('lastSeen').textContent = currentUser.status === 'online' ? 'همین الان' : new Date(currentUser.lastSeen).toLocaleString('fa-IR');
}

// ویرایش بیو
editBioBtn.addEventListener('click', () => {
    const newBio = prompt('بیوگرافی جدید:', currentUser.bio);
    if (newBio !== null && newBio.trim()) {
        socket.emit('updateBio', { bio: newBio.trim() });
        showNotification('📝 در حال به‌روزرسانی بیو...');
    }
});

socket.on('bioUpdated', (data) => {
    currentUser.bio = data.bio;
    profileBio.textContent = data.bio;
    showNotification('✅ بیوگرافی به‌روزرسانی شد! ✨');
});

// خروج
logoutBtn.addEventListener('click', () => {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        socket.emit('updateStatus', { status: 'offline' });
        setTimeout(() => {
            location.reload();
        }, 500);
    }
});

// باز کردن پروفایل
settingsBtn.addEventListener('click', () => {
    profileSidebar.classList.toggle('open');
    updateProfile();
});

closeProfile.addEventListener('click', () => {
    profileSidebar.classList.remove('open');
});

// جستجو
searchChat.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// چت جدید
newChatBtn.addEventListener('click', () => {
    const username = prompt('👤 نام کاربری مخاطب:');
    if (username && username.trim()) {
        const target = username.trim();
        if (target === currentUser.username) {
            showNotification('❌ نمی‌توانید با خودتان چت کنید!', 'error');
            return;
        }
        if (allUsers[target]) {
            openChat(target, 'private');
            showNotification(`💬 چت با ${allUsers[target].nickname || target} باز شد!`);
        } else {
            showNotification('❌ کاربر مورد نظر یافت نشد!', 'error');
        }
    }
});

// نمایش تایپینگ
let typingTimeout = null;
messageInput.addEventListener('input', () => {
    if (currentChat) {
        socket.emit('typing', { chatId: currentChat });
    }
});

socket.on('userTyping', (data) => {
    if (currentChat && data.username !== currentUser.username) {
        if (data.isTyping) {
            chatStatus.textContent = '✏️ در حال تایپ...';
            chatStatus.className = 'chat-status';
        } else {
            const isOnline = onlineUsersList.includes(data.username);
            chatStatus.textContent = isOnline ? '🟢 آنلاین' : '⚫ آفلاین';
            chatStatus.className = `chat-status ${isOnline ? 'online' : ''}`;
        }
    }
});

// اضافه کردن استایل برای منوی پیام
const style = document.createElement('style');
style.textContent = `
    .message-menu button:hover {
        background: rgba(255,215,0,0.05) !important;
    }
    .notification {
        animation: slideUp 0.3s ease !important;
    }
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;
document.head.appendChild(style);

// لاگ در کنسول
console.log('🖤💛 PYS Messenger v2.0');
console.log('👤 طراحی شده توسط S A D R A');
console.log('📡 اتصال به سرور...');

// تست اتصال
socket.on('connect', () => {
    console.log('✅ اتصال به سرور برقرار شد!');
});

socket.on('disconnect', () => {
    console.log('❌ اتصال به سرور قطع شد!');
    showNotification('⚠️ اتصال به سرور قطع شد!', 'error');
});
