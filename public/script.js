// ============================================
// PYS Messenger v5.0 - Client Side
// Designed by S A D R A 🖤💛
// ============================================

const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// ===== متغیرهای جهانی =====
let currentUser = null;
let currentChat = null;
let chatHistory = {};
let allUsers = {};
let allGroups = {};
let onlineUsersList = [];
let authToken = null;
let isMessageSending = false;
let isAdmin = false;

// ===== عناصر DOM =====
const authPage = document.getElementById('authPage');
const mainPage = document.getElementById('mainPage');

// Auth elements
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const registerUsername = document.getElementById('registerUsername');
const registerNickname = document.getElementById('registerNickname');
const registerPassword = document.getElementById('registerPassword');
const registerConfirmPassword = document.getElementById('registerConfirmPassword');
const registerBtn = document.getElementById('registerBtn');
const authTabs = document.querySelectorAll('.auth-tab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Main elements
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
const profileNickname = document.getElementById('profileNickname');
const editBioBtn = document.getElementById('editBioBtn');
const editNicknameBtn = document.getElementById('editNicknameBtn');
const logoutBtn = document.getElementById('logoutBtn');
const searchChat = document.getElementById('searchChat');
const settingsBtn = document.getElementById('settingsBtn');
const newChatBtn = document.getElementById('newChatBtn');
const newGroupBtn = document.getElementById('newGroupBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const adminPanel = document.getElementById('adminPanel');
const closeAdmin = document.getElementById('closeAdmin');
const usersListContainer = document.getElementById('usersListContainer');
const totalUsers = document.getElementById('totalUsers');
const totalGroups = document.getElementById('totalGroups');
const specialBadge = document.getElementById('specialBadge');

// ===== توابع کمکی =====

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

function saveToken(token) {
    authToken = token;
    localStorage.setItem('pys_token', token);
}

function getToken() {
    if (!authToken) {
        authToken = localStorage.getItem('pys_token');
    }
    return authToken;
}

function clearToken() {
    authToken = null;
    localStorage.removeItem('pys_token');
}

// ===== مدیریت تب‌های احراز هویت =====

authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        if (tabName === 'login') {
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
        }
    });
});

// ===== ثبت نام =====

registerBtn.addEventListener('click', async () => {
    const username = registerUsername.value.trim();
    const nickname = registerNickname.value.trim();
    const password = registerPassword.value;
    const confirmPassword = registerConfirmPassword.value;
    
    if (!username || !password) {
        showNotification('لطفاً تمام فیلدهای ضروری را پر کنید!', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('نام کاربری باید حداقل 3 کاراکتر باشد!', 'error');
        return;
    }
    
    if (password.length < 4) {
        showNotification('رمز عبور باید حداقل 4 کاراکتر باشد!', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('رمز عبور و تکرار آن مطابقت ندارند!', 'error');
        return;
    }
    
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت نام...';
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, nickname })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ ثبت نام با موفقیت انجام شد! حالا وارد شوید.');
            authTabs.forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="login"]').classList.add('active');
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            loginUsername.value = username;
            loginPassword.value = '';
        } else {
            showNotification(data.error || 'خطا در ثبت نام!', 'error');
        }
    } catch (error) {
        showNotification('خطا در ارتباط با سرور!', 'error');
    }
    
    registerBtn.disabled = false;
    registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> ثبت نام در PYS';
});

// ===== ورود =====

loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    
    if (!username || !password) {
        showNotification('لطفاً نام کاربری و رمز عبور را وارد کنید!', 'error');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ورود...';
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            saveToken(data.token);
            currentUser = data.user;
            isAdmin = data.user.isAdmin || false;
            
            if (isAdmin) {
                adminPanelBtn.style.display = 'flex';
                showNotification('👑 خوش آمدید مدیر عزیز!');
            } else {
                showNotification(`✅ خوش آمدید ${currentUser.nickname}!`);
            }
            
            socket.emit('authenticate', { token: data.token });
        } else {
            showNotification(data.error || 'خطا در ورود!', 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به PYS';
        }
    } catch (error) {
        showNotification('خطا در ارتباط با سرور!', 'error');
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به PYS';
    }
});

// Enter key for login/register
loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});
registerConfirmPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerBtn.click();
});

// ===== Socket.IO Events =====

socket.on('authenticated', (data) => {
    currentUser = data.user;
    allUsers = data.users;
    allGroups = data.groups;
    chatHistory = data.messages || {};
    isAdmin = data.user.isAdmin || false;
    
    authPage.classList.remove('active');
    mainPage.classList.add('active');
    
    if (isAdmin) {
        adminPanelBtn.style.display = 'flex';
        showNotification('👑 به پنل مدیریت خوش آمدید!');
    }
    
    updateChatList();
    updateProfile();
    showNotification(`به PYS خوش آمدید ${currentUser.nickname}! 🖤💛`);
    
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به PYS';
});

socket.on('authError', (data) => {
    showNotification(data.message || 'خطا در احراز هویت!', 'error');
    clearToken();
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به PYS';
});

socket.on('error', (data) => {
    showNotification(data.message || 'خطایی رخ داد!', 'error');
});

// ===== مدیریت چت‌ها =====

function updateChatList() {
    chatList.innerHTML = '';
    
    if (!currentUser) return;
    
    // چت‌های خصوصی
    const contacts = Object.keys(allUsers).filter(u => u !== currentUser.username);
    
    if (contacts.length === 0 && Object.keys(allGroups).length === 0) {
        chatList.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-gray);opacity:0.5;">
                <i class="fas fa-users" style="font-size:3rem;display:block;margin-bottom:15px;"></i>
                <p>هنوز چتی وجود ندارد</p>
                <span style="font-size:0.9rem;">از دکمه + یا گروه برای شروع استفاده کنید</span>
            </div>
        `;
        return;
    }
    
    // چت‌های خصوصی
    contacts.forEach(username => {
        const user = allUsers[username];
        const chatId = username;
        const msgs = chatHistory[chatId] || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const isOnline = onlineUsersList.includes(username);
        const isSpecial = user.isSpecial || false;
        
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChat === chatId ? 'active' : ''}`;
        chatItem.dataset.chatId = chatId;
        chatItem.dataset.type = 'private';
        
        const avatarText = user.nickname ? user.nickname[0].toUpperCase() : username[0].toUpperCase();
        
        chatItem.innerHTML = `
            <div class="chat-avatar ${isSpecial ? 'special-glow' : ''}">
                ${avatarText}
                <div class="${isOnline ? 'online-dot' : 'offline-dot'}"></div>
                ${isSpecial ? `<div class="special-badge-small"><i class="fas fa-crown"></i></div>` : ''}
            </div>
            <div class="chat-info">
                <div class="chat-name ${isSpecial ? 'special-name' : ''}">
                    ${user.nickname || username}
                    ${isSpecial ? '<span class="special-tag">👑 ویژه</span>' : ''}
                </div>
                <div class="chat-last-msg">${lastMsg ? (lastMsg.deleted ? '🗑️ پیام حذف شده' : lastMsg.message.substring(0, 30)) : '💬 شروع چت...'}</div>
            </div>
            <div class="chat-time">${lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'}) : ''}</div>
        `;
        
        chatItem.addEventListener('click', () => openChat(chatId, 'private'));
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
            
            const msgs = chatHistory[groupId] || [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            
            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${group.name}</div>
                    <div class="chat-last-msg">${lastMsg ? lastMsg.message : 'گروه خالی'}</div>
                </div>
            `;
            
            chatItem.addEventListener('click', () => openChat(groupId, 'group'));
            chatList.appendChild(chatItem);
        }
    });
}

function openChat(chatId, type) {
    if (!chatId) return;
    
    currentChat = chatId;
    console.log('📂 باز کردن چت:', chatId);
    
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chatId);
    });
    
    if (type === 'private') {
        const user = allUsers[chatId];
        if (!user) {
            showNotification('کاربر یافت نشد!', 'error');
            return;
        }
        const isSpecial = user.isSpecial || false;
        chatUsername.textContent = user.nickname || chatId;
        chatUsername.style.color = isSpecial ? 'var(--gold)' : '';
        if (isSpecial) {
            chatUsername.textContent += ' 👑';
        }
        const isOnline = onlineUsersList.includes(chatId);
        chatStatus.textContent = isOnline ? '🟢 آنلاین' : '⚫ آفلاین';
        chatStatus.className = `chat-status ${isOnline ? 'online' : ''}`;
        chatAvatar.innerHTML = `<i class="fas fa-user-circle" style="font-size:2.5rem;"></i>`;
        if (isSpecial) {
            chatAvatar.style.background = 'linear-gradient(135deg, var(--gold), #FF6B00)';
            chatAvatar.style.boxShadow = '0 0 30px rgba(255,215,0,0.3)';
        } else {
            chatAvatar.style.background = '';
            chatAvatar.style.boxShadow = '';
        }
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
        chatAvatar.style.background = '';
        chatAvatar.style.boxShadow = '';
    }
    
    socket.emit('joinChat', { chatId });
    loadMessages(chatId);
    messageInput.focus();
}

function loadMessages(chatId) {
    messagesContainer.innerHTML = '';
    
    const msgs = chatHistory[chatId] || [];
    
    if (msgs.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>هیچ پیامی وجود ندارد</p>
                <span>اولین پیام را ارسال کنید</span>
            </div>
        `;
        return;
    }
    
    msgs.forEach(msg => appendMessage(msg));
    scrollToBottom();
}

function appendMessage(msg) {
    if (!msg) return;
    
    const existingMsg = document.querySelector(`[data-msg-id="${msg.id}"]`);
    if (existingMsg) return;
    
    const isSent = msg.from === currentUser.username;
    const isSpecial = allUsers[msg.from]?.isSpecial || false;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    msgDiv.dataset.msgId = msg.id;
    
    let content = '';
    
    if (msg.deleted) {
        content = `<div class="msg-text" style="opacity:0.4;font-style:italic;">🗑️ این پیام حذف شده است</div>`;
    } else {
        if (msg.replyTo) {
            const repliedMsg = chatHistory[msg.to]?.find(m => m.id === msg.replyTo);
            if (repliedMsg) {
                content += `<div class="msg-reply">${repliedMsg.message}</div>`;
            }
        }
        // نمایش نام فرستنده برای پیام‌های دریافتی
        if (!isSent && msg.from) {
            const sender = allUsers[msg.from]?.nickname || msg.from;
            content += `<div style="font-size:0.7rem;color:var(--gold);margin-bottom:4px;">${sender} ${isSpecial ? '👑' : ''}</div>`;
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
    
    if (isSent && !msg.deleted) {
        msgDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageMenu(msg.id, msg.to);
        });
    }
    
    const emptyState = messagesContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    messagesContainer.appendChild(msgDiv);
}

function showMessageMenu(msgId, chatId) {
    document.querySelector('.message-menu')?.remove();
    
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.innerHTML = `
        <button onclick="editMessage('${msgId}','${chatId}')" style="background:transparent;border:none;color:var(--gold);padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;border-radius:8px;transition:all 0.2s;">
            <i class="fas fa-edit"></i> ویرایش
        </button>
        <button onclick="deleteMessage('${msgId}','${chatId}')" style="background:transparent;border:none;color:#ff4444;padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;border-radius:8px;transition:all 0.2s;">
            <i class="fas fa-trash"></i> حذف
        </button>
    `;
    
    document.body.appendChild(menu);
    
    const rect = menu.getBoundingClientRect();
    let x = event.clientX;
    let y = event.clientY;
    
    if (x + rect.width > window.innerWidth) x = x - rect.width;
    if (y + rect.height > window.innerHeight) y = y - rect.height;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
}

window.editMessage = function(msgId, chatId) {
    const newText = prompt('متن جدید:', '');
    if (newText !== null && newText.trim()) {
        socket.emit('editMessage', { chatId, messageId: msgId, newText: newText.trim() });
    }
    document.querySelector('.message-menu')?.remove();
};

window.deleteMessage = function(msgId, chatId) {
    if (confirm('🗑️ آیا از حذف این پیام مطمئن هستید؟')) {
        socket.emit('deleteMessage', { chatId, messageId: msgId });
    }
    document.querySelector('.message-menu')?.remove();
};

function scrollToBottom() {
    const container = document.querySelector('.messages-container');
    if (container) {
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
    }
}

// ===== ارسال پیام =====

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
    
    if (isMessageSending) return;
    isMessageSending = true;
    
    socket.emit('sendMessage', {
        chatId: currentChat,
        message: text,
        type: 'text',
        replyTo: null
    });
    
    messageInput.value = '';
    messageInput.focus();
    
    setTimeout(() => { isMessageSending = false; }, 500);
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// ===== Socket Events =====

socket.on('newMessage', (msg) => {
    let chatId = msg.to;
    
    if (msg.to === currentUser.username) {
        chatId = msg.from;
    } else if (msg.from === currentUser.username) {
        chatId = msg.to;
    } else {
        return;
    }
    
    if (!chatHistory[chatId]) {
        chatHistory[chatId] = [];
    }
    
    const exists = chatHistory[chatId].some(m => m.id === msg.id);
    if (!exists) {
        chatHistory[chatId].push(msg);
        
        if (currentChat === chatId) {
            appendMessage(msg);
            scrollToBottom();
        }
        
        updateChatList();
        
        if (msg.from !== currentUser.username) {
            const sender = allUsers[msg.from]?.nickname || msg.from;
            showNotification(`📩 پیام جدید از ${sender}`);
        }
    }
});

socket.on('messageSent', (data) => {
    if (data.success) {
        console.log('✅ پیام ارسال شد:', data.messageId);
    }
});

socket.on('messageEdited', (data) => {
    const { chatId, messageId, newText } = data;
    if (chatHistory[chatId]) {
        const msg = chatHistory[chatId].find(m => m.id === messageId);
        if (msg) {
            msg.message = newText;
            msg.edited = true;
            const msgElement = document.querySelector(`[data-msg-id="${messageId}"]`);
            if (msgElement) {
                const textDiv = msgElement.querySelector('.msg-text');
                if (textDiv) textDiv.textContent = newText;
            }
            showNotification('✏️ پیام ویرایش شد');
        }
    }
});

socket.on('messageDeleted', (data) => {
    const { chatId, messageId } = data;
    if (chatHistory[chatId]) {
        const msg = chatHistory[chatId].find(m => m.id === messageId);
        if (msg) {
            msg.deleted = true;
            msg.message = 'این پیام حذف شده است';
            const msgElement = document.querySelector(`[data-msg-id="${messageId}"]`);
            if (msgElement) {
                const textDiv = msgElement.querySelector('.msg-text');
                if (textDiv) {
                    textDiv.textContent = '🗑️ این پیام حذف شده است';
                    textDiv.style.opacity = '0.4';
                    textDiv.style.fontStyle = 'italic';
                }
            }
            showNotification('🗑️ پیام حذف شد');
        }
    }
});

socket.on('userOnline', (data) => {
    if (!onlineUsersList.includes(data.username)) {
        onlineUsersList.push(data.username);
    }
    updateChatList();
    if (currentChat === data.username) {
        chatStatus.textContent = '🟢 آنلاین';
        chatStatus.className = 'chat-status online';
    }
});

socket.on('userOffline', (data) => {
    onlineUsersList = onlineUsersList.filter(u => u !== data.username);
    updateChatList();
    if (currentChat === data.username) {
        const time = new Date(data.lastSeen).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'});
        chatStatus.textContent = `⚫ آخرین بازدید: ${time}`;
        chatStatus.className = 'chat-status';
    }
});

socket.on('onlineList', (list) => {
    onlineUsersList = list;
    updateChatList();
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

// ===== پروفایل =====

function updateProfile() {
    if (!currentUser) return;
    const isSpecial = currentUser.isSpecial || false;
    
    profileName.textContent = currentUser.nickname || currentUser.username;
    if (isSpecial) {
        profileName.textContent += ' 👑';
        profileName.style.color = 'var(--gold)';
        specialBadge.style.display = 'flex';
    } else {
        profileName.style.color = '';
        specialBadge.style.display = 'none';
    }
    
    profileNickname.textContent = currentUser.nickname || currentUser.username;
    profileUsername.textContent = `@${currentUser.username}`;
    profileBio.textContent = currentUser.bio || 'بیوگرافی خود را وارد کنید';
    document.getElementById('memberSince').textContent = new Date(currentUser.createdAt).toLocaleDateString('fa-IR');
    document.getElementById('lastSeen').textContent = currentUser.status === 'online' ? 'همین الان' : new Date(currentUser.lastSeen).toLocaleString('fa-IR');
}

editBioBtn.addEventListener('click', () => {
    const newBio = prompt('بیوگرافی جدید:', currentUser.bio);
    if (newBio !== null && newBio.trim()) {
        socket.emit('updateBio', { bio: newBio.trim() });
        showNotification('📝 در حال به‌روزرسانی بیو...');
    }
});

editNicknameBtn.addEventListener('click', () => {
    const newNickname = prompt('نام نمایشی جدید:', currentUser.nickname);
    if (newNickname !== null && newNickname.trim()) {
        socket.emit('updateNickname', { nickname: newNickname.trim() });
        showNotification('📝 در حال به‌روزرسانی نام...');
    }
});

socket.on('bioUpdated', (data) => {
    currentUser.bio = data.bio;
    profileBio.textContent = data.bio;
    showNotification('✅ بیوگرافی به‌روزرسانی شد! ✨');
});

socket.on('nicknameUpdated', (data) => {
    currentUser.nickname = data.nickname;
    profileName.textContent = data.nickname;
    profileNickname.textContent = data.nickname;
    updateChatList();
    showNotification('✅ نام نمایشی به‌روزرسانی شد! ✨');
});

socket.on('userUpdated', (data) => {
    if (data.username === currentUser.username) {
        updateProfile();
        updateChatList();
    }
});

// ===== پنل مدیریت =====

adminPanelBtn.addEventListener('click', async () => {
    if (!isAdmin) {
        showNotification('❌ دسترسی فقط برای ادمین!', 'error');
        return;
    }
    
    if (adminPanel.classList.contains('open')) {
        adminPanel.classList.remove('open');
        return;
    }
    
    adminPanel.classList.add('open');
    await loadAdminPanel();
});

closeAdmin.addEventListener('click', () => {
    adminPanel.classList.remove('open');
});

async function loadAdminPanel() {
    try {
        const token = getToken();
        const response = await fetch(`/api/admin/users?token=${token}`);
        const data = await response.json();
        
        if (response.ok) {
            totalUsers.textContent = Object.keys(data).length;
            totalGroups.textContent = Object.keys(allGroups).length;
            
            usersListContainer.innerHTML = '';
            Object.keys(data).forEach(username => {
                const user = data[username];
                const isSpecial = user.isSpecial || false;
                
                const userItem = document.createElement('div');
                userItem.className = 'admin-user-item';
                userItem.innerHTML = `
                    <div class="user-info">
                        <div class="avatar">${user.nickname ? user.nickname[0].toUpperCase() : username[0].toUpperCase()}</div>
                        <div>
                            <div class="username">${user.nickname || username} ${isSpecial ? '👑' : ''}</div>
                            <div class="nickname">@${username}</div>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="edit-btn" onclick="editUser('${username}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${username !== 'MALEK' ? `<button class="delete-btn" onclick="deleteUser('${username}')">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </div>
                `;
                usersListContainer.appendChild(userItem);
            });
        }
    } catch (error) {
        showNotification('خطا در بارگذاری پنل مدیریت', 'error');
    }
}

window.editUser = function(username) {
    const user = allUsers[username];
    if (!user) return;
    
    const newNickname = prompt('نام نمایشی جدید:', user.nickname);
    if (newNickname !== null && newNickname.trim()) {
        fetch('/api/admin/edit-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: getToken(),
                targetUsername: username,
                updates: { nickname: newNickname.trim() }
            })
        }).then(res => res.json())
          .then(data => {
              if (data.success) {
                  showNotification('✅ کاربر به‌روزرسانی شد!');
                  loadAdminPanel();
                  allUsers[username].nickname = newNickname.trim();
                  updateChatList();
              }
          });
    }
};

window.deleteUser = function(username) {
    if (!confirm(`آیا از حذف کاربر ${username} مطمئن هستید؟`)) return;
    
    fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: getToken(),
            targetUsername: username
        })
    }).then(res => res.json())
      .then(data => {
          if (data.success) {
              showNotification('✅ کاربر حذف شد!');
              delete allUsers[username];
              loadAdminPanel();
              updateChatList();
          }
      });
};

// ===== خروج =====

logoutBtn.addEventListener('click', () => {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        socket.emit('logout');
        clearToken();
        setTimeout(() => {
            location.reload();
        }, 500);
    }
});

// ===== تنظیمات و پروفایل =====

settingsBtn.addEventListener('click', () => {
    profileSidebar.classList.toggle('open');
    updateProfile();
});

closeProfile.addEventListener('click', () => {
    profileSidebar.classList.remove('open');
});

// ===== جستجو =====

searchChat.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
});

// ===== چت جدید =====

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

// ===== گروه جدید =====

newGroupBtn.addEventListener('click', async () => {
    const groupName = prompt('📝 نام گروه:');
    if (!groupName || !groupName.trim()) return;
    
    const membersInput = prompt('👥 نام کاربران (با کاما جدا کنید):');
    const members = membersInput ? membersInput.split(',').map(m => m.trim()).filter(m => m && allUsers[m]) : [];
    
    if (!members.includes(currentUser.username)) {
        members.unshift(currentUser.username);
    }
    
    try {
        const response = await fetch('/api/groups/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: groupName.trim(),
                creator: currentUser.username,
                members: members
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            allGroups[data.group.id] = data.group;
            updateChatList();
            openChat(data.group.id, 'group');
            showNotification(`✅ گروه ${data.group.name} ایجاد شد!`);
        } else {
            showNotification(data.error || 'خطا در ایجاد گروه!', 'error');
        }
    } catch (error) {
        showNotification('خطا در ارتباط با سرور!', 'error');
    }
});

// ===== تایپینگ =====

messageInput.addEventListener('input', () => {
    if (currentChat) {
        socket.emit('typing', { chatId: currentChat });
    }
});

// ===== بارگذاری خودکار با توکن =====

async function autoLogin() {
    const token = getToken();
    if (!token) return;
    
    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            isAdmin = data.user.isAdmin || false;
            socket.emit('authenticate', { token });
            if (isAdmin) {
                adminPanelBtn.style.display = 'flex';
                showNotification('👑 خوش آمدید مدیر عزیز!');
            } else {
                showNotification(`🔄 خوش آمدید ${currentUser.nickname}!`);
            }
        } else {
            clearToken();
        }
    } catch (error) {
        clearToken();
    }
}

// ===== استایل‌های اضافی =====

const style = document.createElement('style');
style.textContent = `
    .message-menu button:hover {
        background: rgba(255,215,0,0.05) !important;
    }
    .notification {
        animation: slideUp 0.3s ease !important;
    }
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(style);

// ===== شروع =====

console.log('🖤💛 PYS Messenger v5.0 - Final Version');
console.log('👑 Special Account: MALEK');
console.log('👤 Designed by S A D R A');

socket.on('connect', () => {
    console.log('✅ Connected to server');
    autoLogin();
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    showNotification('⚠️ اتصال به سرور قطع شد!', 'error');
});

// ===== تابع رفرش =====
window.refreshChat = function() {
    if (currentChat) {
        loadMessages(currentChat);
        showNotification('🔄 پیام‌ها به‌روزرسانی شدند');
    }
};
console.log('💡 برای رفرش پیام‌ها: refreshChat()');
console.log('👑 اکانت ویژه: MALEK / MALEK11NEYMAR');
