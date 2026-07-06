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
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.remove();
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
});

// به‌روزرسانی لیست چت‌ها
function updateChatList() {
    chatList.innerHTML = '';
    
    // چت‌های خصوصی
    const contacts = Object.keys(allUsers).filter(u => u !== currentUser.username);
    
    contacts.forEach(username => {
        const user = allUsers[username];
        const chatId = username;
        const lastMsg = chatHistory[chatId] ? chatHistory[chatId][chatHistory[chatId].length - 1] : null;
        const isOnline = onlineUsersList.includes(username);
        
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${currentChat === chatId ? 'active' : ''}`;
        chatItem.dataset.chatId = chatId;
        chatItem.dataset.type = 'private';
        
        chatItem.innerHTML = `
            <div class="chat-avatar">
                ${user.profilePic ? `<img src="${user.profilePic}" alt="">` : user.nickname ? user.nickname[0].toUpperCase() : username[0].toUpperCase()}
                <div class="${isOnline ? 'online-dot' : 'offline-dot'}"></div>
            </div>
            <div class="chat-info">
                <div class="chat-name">${user.nickname || username}</div>
                <div class="chat-last-msg">${lastMsg ? (lastMsg.deleted ? 'پیام حذف شده' : lastMsg.message) : 'شروع چت...'}</div>
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
        if (group.members.includes(currentUser.username)) {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${currentChat === groupId ? 'active' : ''}`;
            chatItem.dataset.chatId = groupId;
            chatItem.dataset.type = 'group';
            
            chatItem.innerHTML = `
                <div class="chat-avatar">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${group.name}</div>
                    <div class="chat-last-msg">${chatHistory[groupId] && chatHistory[groupId].length > 0 ? chatHistory[groupId][chatHistory[groupId].length - 1].message : 'گروه خالی'}</div>
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
    currentChat = chatId;
    
    // به‌روزرسانی لیست
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chatId);
    });
    
    // آپدیت هدر
    if (type === 'private') {
        const user = allUsers[chatId];
        chatUsername.textContent = user.nickname || chatId;
        chatUsername.style.color = '';
        chatStatus.textContent = onlineUsersList.includes(chatId) ? '🟢 آنلاین' : '⚫ آفلاین';
        chatStatus.className = `chat-status ${onlineUsersList.includes(chatId) ? 'online' : ''}`;
        document.getElementById('chatAvatar').innerHTML = user.profilePic ? 
            `<img src="${user.profilePic}" style="width:100%;height:100%;border-radius:50%;">` : 
            `<i class="fas fa-user-circle" style="font-size:2rem;"></i>`;
    } else {
        const group = allGroups[chatId];
        chatUsername.textContent = group.name;
        chatUsername.style.color = 'var(--gold)';
        chatStatus.textContent = `👥 ${group.members.length} عضو`;
        chatStatus.className = 'chat-status';
        document.getElementById('chatAvatar').innerHTML = `<i class="fas fa-users" style="font-size:2rem;"></i>`;
    }
    
    // نمایش پیام‌ها
    loadMessages(chatId);
    
    // پیوستن به اتاق
    socket.emit('joinChat', { chatId });
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
    
    chatHistory[chatId].forEach(msg => {
        if (msg.deleted) {
            appendMessage(msg, true);
        } else {
            appendMessage(msg);
        }
    });
    
    scrollToBottom();
}

// افزودن پیام به صفحه
function appendMessage(msg, isDeleted = false) {
    const isSent = msg.from === currentUser.username;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    msgDiv.dataset.msgId = msg.id;
    
    let content = '';
    
    if (isDeleted) {
        content = `<div class="msg-text" style="opacity:0.4;font-style:italic;">این پیام حذف شده است</div>`;
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
            content += `<span class="msg-edited">(ویرایش شده)</span>`;
        }
    }
    
    content += `<div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'})}`;
    if (isSent && !isDeleted) {
        content += ` <i class="fas fa-check-double" style="font-size:0.7rem;"></i>`;
    }
    content += `</div>`;
    
    msgDiv.innerHTML = content;
    
    // کلیک راست برای منوی حذف/ویرایش
    if (isSent && !isDeleted) {
        msgDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageMenu(msg.id, msg.to);
        });
    }
    
    messagesContainer.appendChild(msgDiv);
}

// منوی پیام
function showMessageMenu(msgId, chatId) {
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.style.cssText = `
        position: fixed;
        background: var(--dark);
        border: 1px solid rgba(255,215,0,0.1);
        border-radius: 12px;
        padding: 10px;
        z-index: 1000;
        box-shadow: var(--shadow);
    `;
    
    menu.innerHTML = `
        <button onclick="editMessage('${msgId}','${chatId}')" style="background:transparent;border:none;color:var(--gold);padding:8px 15px;cursor:pointer;display:block;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;">
            <i class="fas fa-edit"></i> ویرایش
        </button>
        <button onclick="deleteMessage('${msgId}','${chatId}')" style="background:transparent;border:none;color:#ff4444;padding:8px 15px;cursor:pointer;display:block;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;">
            <i class="fas fa-trash"></i> حذف
        </button>
    `;
    
    document.body.appendChild(menu);
    
    const rect = menu.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x + rect.width > window.innerWidth) {
        menu.style.left = x - rect.width + 'px';
    } else {
        menu.style.left = x + 'px';
    }
    
    if (y + rect.height > window.innerHeight) {
        menu.style.top = y - rect.height + 'px';
    } else {
        menu.style.top = y + 'px';
    }
    
    // بستن منو با کلیک خارج
    setTimeout(() => {
        document.addEventListener('click', () => {
            menu.remove();
        }, { once: true });
    }, 100);
}

// ویرایش پیام
function editMessage(msgId, chatId) {
    const newText = prompt('متن جدید:');
    if (newText && newText.trim()) {
        socket.emit('editMessage', { chatId, messageId: msgId, newText: newText.trim() });
    }
    document.querySelector('.message-menu')?.remove();
}

// حذف پیام
function deleteMessage(msgId, chatId) {
    if (confirm('آیا از حذف این پیام مطمئن هستید؟')) {
        socket.emit('deleteMessage', { chatId, messageId: msgId });
    }
    document.querySelector('.message-menu')?.remove();
}

// اسکرول به پایین
function scrollToBottom() {
    const container = document.querySelector('.messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ارسال پیام
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChat) return;
    
    socket.emit('sendMessage', {
        chatId: currentChat,
        message: text,
        type: 'text',
        replyTo: null
    });
    
    messageInput.value = '';
    messageInput.focus();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// دریافت پیام جدید
socket.on('newMessage', (msg) => {
    if (!chatHistory[msg.to]) {
        chatHistory[msg.to] = [];
    }
    chatHistory[msg.to].push(msg);
    
    if (currentChat === msg.to) {
        appendMessage(msg);
        scrollToBottom();
    }
    
    updateChatList();
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
});

socket.on('userOffline', (data) => {
    onlineUsersList = onlineUsersList.filter(u => u !== data.username);
    updateChatList();
    if (currentChat === data.username) {
        chatStatus.textContent = `⚫ آخرین بازدید: ${new Date(data.lastSeen).toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'})}`;
        chatStatus.className = 'chat-status';
    }
});

socket.on('onlineList', (list) => {
    onlineUsersList = list;
    updateChatList();
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
    if (newBio !== null) {
        socket.emit('updateBio', { bio: newBio.trim() });
    }
});

socket.on('bioUpdated', (data) => {
    currentUser.bio = data.bio;
    profileBio.textContent = data.bio;
    showNotification('بیوگرافی به‌روزرسانی شد! ✨');
});

// خروج
logoutBtn.addEventListener('click', () => {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        socket.emit('updateStatus', { status: 'offline' });
        location.reload();
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
    const username = prompt('نام کاربری مخاطب:');
    if (username && username !== currentUser.username) {
        if (allUsers[username]) {
            openChat(username, 'private');
            showNotification(`چت با ${username} باز شد! 💬`);
        } else {
            showNotification('کاربر مورد نظر یافت نشد!', 'error');
        }
    }
});

// نمایش تایپینگ
messageInput.addEventListener('input', () => {
    if (currentChat) {
        socket.emit('typing', { chatId: currentChat });
    }
});

socket.on('userTyping', (data) => {
    if (currentChat && data.username !== currentUser.username) {
        chatStatus.textContent = `${data.isTyping ? '✏️ در حال تایپ...' : '🟢 آنلاین'}`;
        if (!data.isTyping) {
            chatStatus.textContent = onlineUsersList.includes(data.username) ? '🟢 آنلاین' : '⚫ آفلاین';
        }
    }
});

// پیام خوش‌آمدگویی
console.log('🖤💛 PYS Messenger - Designed by S A D R A');
console.log('✨ پیام‌رسان طلایی - نسخه 1.0');
