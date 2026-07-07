const socket = io({ transports: ['websocket', 'polling'] });

let currentUser = null;
let currentChat = null;
let chatHistory = {};
let allUsers = {};
let allGroups = {};
let onlineUsersList = [];
let token = null;
let isAdmin = false;

// ========== DOM Elements ==========
const authPage = document.getElementById('authPage');
const mainPage = document.getElementById('mainPage');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const registerUsername = document.getElementById('registerUsername');
const registerNickname = document.getElementById('registerNickname');
const registerPassword = document.getElementById('registerPassword');
const registerConfirm = document.getElementById('registerConfirmPassword');
const registerBtn = document.getElementById('registerBtn');
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

// ========== Utilities ==========
function notif(msg, type = 'info') {
    const d = document.createElement('div');
    d.className = 'notification';
    d.textContent = msg;
    d.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ff4444' : '#1a1a1a'};
        border: 1px solid ${type === 'error' ? '#ff4444' : 'rgba(255,215,0,0.2)'};
        border-radius: 15px;
        padding: 15px 30px;
        color: #fff;
        z-index: 99999;
        font-family: 'Vazirmatn', sans-serif;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        max-width: 90%;
        text-align: center;
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(d);
    setTimeout(() => {
        d.style.opacity = '0';
        d.style.transition = 'opacity 0.3s';
        setTimeout(() => d.remove(), 300);
    }, 3000);
}

function saveToken(t) { token = t; localStorage.setItem('pys_token', t); }
function getToken() { return token || localStorage.getItem('pys_token'); }
function clearToken() { token = null; localStorage.removeItem('pys_token'); }

// ========== Auth ==========
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('loginForm').style.display = tab.dataset.tab === 'login' ? 'flex' : 'none';
        document.getElementById('registerForm').style.display = tab.dataset.tab === 'register' ? 'flex' : 'none';
    });
});

registerBtn.addEventListener('click', async () => {
    const u = registerUsername.value.trim();
    const n = registerNickname.value.trim();
    const p = registerPassword.value;
    const c = registerConfirm.value;
    if (!u || !p) return notif('لطفاً فیلدها را پر کنید', 'error');
    if (u.length < 3) return notif('نام کاربری حداقل ۳ کاراکتر', 'error');
    if (p.length < 4) return notif('رمز عبور حداقل ۴ کاراکتر', 'error');
    if (p !== c) return notif('رمز عبور و تکرار آن مطابقت ندارند', 'error');
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p, nickname: n })
    });
    const data = await res.json();
    registerBtn.disabled = false;
    registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> ثبت نام';
    if (data.success) {
        notif('✅ ثبت نام با موفقیت انجام شد! حالا وارد شوید.');
        document.querySelector('[data-tab="login"]').click();
        loginUsername.value = u;
        loginPassword.value = '';
    } else {
        notif(data.error || 'خطا در ثبت نام', 'error');
    }
});

loginBtn.addEventListener('click', async () => {
    const u = loginUsername.value.trim();
    const p = loginPassword.value;
    if (!u || !p) return notif('نام کاربری و رمز عبور را وارد کنید', 'error');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ورود به PYS';
    if (data.success) {
        saveToken(data.token);
        currentUser = data.user;
        isAdmin = data.user.isAdmin || false;
        socket.emit('authenticate', { token: data.token });
    } else {
        notif(data.error || 'خطا در ورود', 'error');
    }
});

loginPassword.addEventListener('keypress', e => { if (e.key === 'Enter') loginBtn.click(); });
registerConfirm.addEventListener('keypress', e => { if (e.key === 'Enter') registerBtn.click(); });

// ========== Socket Events ==========
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
        notif('👑 خوش آمدید مدیر عزیز!');
    }
    updateChatList();
    updateProfile();
    notif(`به PYS خوش آمدید ${currentUser.nickname}! 🖤💛`);
});

socket.on('authError', (data) => {
    notif(data.message || 'خطا در احراز هویت', 'error');
    clearToken();
});

socket.on('error', (data) => {
    notif(data.message || 'خطایی رخ داد', 'error');
});

// ========== Chat Functions ==========
function updateChatList() {
    chatList.innerHTML = '';
    if (!currentUser) return;
    const contacts = Object.keys(allUsers).filter(u => u !== currentUser.username);
    if (contacts.length === 0 && Object.keys(allGroups).length === 0) {
        chatList.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--text-gray);opacity:0.5;">
                <i class="fas fa-comments" style="font-size:3rem;display:block;margin-bottom:15px;"></i>
                <p>هنوز چتی وجود ندارد</p>
                <span style="font-size:0.9rem;">از دکمه + برای شروع استفاده کنید</span>
            </div>
        `;
        return;
    }
    contacts.forEach(username => {
        const user = allUsers[username];
        const msgs = chatHistory[username] || [];
        const last = msgs.length ? msgs[msgs.length - 1] : null;
        const online = onlineUsersList.includes(username);
        const special = user.isSpecial || false;
        const div = document.createElement('div');
        div.className = `chat-item ${currentChat === username ? 'active' : ''}`;
        div.dataset.chatId = username;
        div.innerHTML = `
            <div class="chat-avatar ${special ? 'special-glow' : ''}">
                ${user.nickname ? user.nickname[0].toUpperCase() : username[0].toUpperCase()}
                <div class="${online ? 'online-dot' : 'offline-dot'}"></div>
                ${special ? '<div class="special-badge-small"><i class="fas fa-crown"></i></div>' : ''}
            </div>
            <div class="chat-info">
                <div class="chat-name ${special ? 'special-name' : ''}">
                    ${user.nickname || username}
                    ${special ? '👑' : ''}
                </div>
                <div class="chat-last-msg">${last ? (last.deleted ? '🗑️ حذف شده' : last.message.substring(0, 30)) : '💬 شروع چت...'}</div>
            </div>
            <div class="chat-time">${last ? new Date(last.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}) : ''}</div>
        `;
        div.addEventListener('click', () => openChat(username, 'private'));
        chatList.appendChild(div);
    });
    Object.keys(allGroups).forEach(gid => {
        const group = allGroups[gid];
        if (group.members.includes(currentUser.username)) {
            const msgs = chatHistory[gid] || [];
            const last = msgs.length ? msgs[msgs.length - 1] : null;
            const div = document.createElement('div');
            div.className = `chat-item ${currentChat === gid ? 'active' : ''}`;
            div.dataset.chatId = gid;
            div.innerHTML = `
                <div class="chat-avatar"><i class="fas fa-users"></i></div>
                <div class="chat-info">
                    <div class="chat-name">${group.name}</div>
                    <div class="chat-last-msg">${last ? last.message : 'گروه خالی'}</div>
                </div>
            `;
            div.addEventListener('click', () => openChat(gid, 'group'));
            chatList.appendChild(div);
        }
    });
}

function openChat(chatId, type) {
    currentChat = chatId;
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chatId);
    });
    if (type === 'private') {
        const user = allUsers[chatId];
        if (!user) return notif('کاربر یافت نشد', 'error');
        chatUsername.textContent = user.nickname || chatId;
        if (user.isSpecial) chatUsername.textContent += ' 👑';
        chatUsername.style.color = user.isSpecial ? 'var(--gold)' : '';
        chatStatus.textContent = onlineUsersList.includes(chatId) ? '🟢 آنلاین' : '⚫ آفلاین';
        chatStatus.className = `chat-status ${onlineUsersList.includes(chatId) ? 'online' : ''}`;
        chatAvatar.innerHTML = `<i class="fas fa-user-circle" style="font-size:2.5rem;"></i>`;
        chatAvatar.style.background = user.isSpecial ? 'linear-gradient(135deg, var(--gold), #FF6B00)' : '';
        chatAvatar.style.boxShadow = user.isSpecial ? '0 0 30px rgba(255,215,0,0.3)' : '';
    } else {
        const group = allGroups[chatId];
        chatUsername.textContent = group.name;
        chatUsername.style.color = 'var(--gold)';
        chatStatus.textContent = `👥 ${group.members.length} عضو`;
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
    msgs.forEach(m => appendMessage(m));
    scrollToBottom();
}

function appendMessage(msg) {
    if (document.querySelector(`[data-msg-id="${msg.id}"]`)) return;
    const isSent = msg.from === currentUser.username;
    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    div.dataset.msgId = msg.id;
    let content = '';
    if (msg.deleted) {
        content = `<div class="msg-text" style="opacity:0.4;font-style:italic;">🗑️ این پیام حذف شده است</div>`;
    } else {
        if (!isSent && msg.from) {
            const sender = allUsers[msg.from]?.nickname || msg.from;
            const special = allUsers[msg.from]?.isSpecial || false;
            content += `<div style="font-size:0.7rem;color:var(--gold);margin-bottom:4px;">${sender} ${special ? '👑' : ''}</div>`;
        }
        content += `<div class="msg-text">${msg.message}</div>`;
        if (msg.edited) content += `<span class="msg-edited">✏️ ویرایش شده</span>`;
    }
    const time = new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'});
    content += `<div class="msg-time">${time}${isSent && !msg.deleted ? ' <i class="fas fa-check-double" style="font-size:0.7rem;"></i>' : ''}</div>`;
    div.innerHTML = content;
    if (isSent && !msg.deleted) {
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMenu(msg.id, msg.to);
        });
    }
    const empty = messagesContainer.querySelector('.empty-state');
    if (empty) empty.remove();
    messagesContainer.appendChild(div);
}

function showMenu(msgId, chatId) {
    document.querySelector('.message-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.innerHTML = `
        <button onclick="editMsg('${msgId}','${chatId}')" style="background:transparent;border:none;color:var(--gold);padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;border-radius:8px;">
            <i class="fas fa-edit"></i> ویرایش
        </button>
        <button onclick="deleteMsg('${msgId}','${chatId}')" style="background:transparent;border:none;color:#ff4444;padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;text-align:right;font-family:'Vazirmatn',sans-serif;border-radius:8px;">
            <i class="fas fa-trash"></i> حذف
        </button>
    `;
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    let x = event.clientX, y = event.clientY;
    if (x + rect.width > window.innerWidth) x = x - rect.width;
    if (y + rect.height > window.innerHeight) y = y - rect.height;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
}

window.editMsg = function(id, chatId) {
    const txt = prompt('متن جدید:');
    if (txt && txt.trim()) socket.emit('editMessage', { chatId, messageId: id, newText: txt.trim() });
    document.querySelector('.message-menu')?.remove();
};

window.deleteMsg = function(id, chatId) {
    if (confirm('آیا از حذف این پیام مطمئن هستید؟')) {
        socket.emit('deleteMessage', { chatId, messageId: id });
    }
    document.querySelector('.message-menu')?.remove();
};

function scrollToBottom() {
    const c = document.querySelector('.messages-container');
    if (c) setTimeout(() => c.scrollTop = c.scrollHeight, 100);
}

// ========== Send Message ==========
sendBtn.addEventListener('click', send);
messageInput.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

function send() {
    const text = messageInput.value.trim();
    if (!text) return notif('لطفاً پیام بنویسید', 'error');
    if (!currentChat) return notif('لطفاً یک چت انتخاب کنید', 'error');
    socket.emit('sendMessage', { chatId: currentChat, message: text });
    messageInput.value = '';
    messageInput.focus();
}

// ========== Socket Message Events ==========
socket.on('newMessage', (msg) => {
    let chatId = msg.to;
    if (msg.to === currentUser.username) chatId = msg.from;
    else if (msg.from === currentUser.username) chatId = msg.to;
    else return;
    if (!chatHistory[chatId]) chatHistory[chatId] = [];
    if (!chatHistory[chatId].some(m => m.id === msg.id)) {
        chatHistory[chatId].push(msg);
        if (currentChat === chatId) {
            appendMessage(msg);
            scrollToBottom();
        }
        updateChatList();
        if (msg.from !== currentUser.username) {
            const sender = allUsers[msg.from]?.nickname || msg.from;
            notif(`📩 پیام جدید از ${sender}`);
        }
    }
});

socket.on('messageSent', () => {});
socket.on('messageEdited', ({ chatId, messageId, newText }) => {
    const msgs = chatHistory[chatId];
    if (!msgs) return;
    const m = msgs.find(x => x.id === messageId);
    if (m) {
        m.message = newText;
        m.edited = true;
        const el = document.querySelector(`[data-msg-id="${messageId}"]`);
        if (el) {
            const t = el.querySelector('.msg-text');
            if (t) t.textContent = newText;
        }
    }
});
socket.on('messageDeleted', ({ chatId, messageId }) => {
    const msgs = chatHistory[chatId];
    if (!msgs) return;
    const m = msgs.find(x => x.id === messageId);
    if (m) {
        m.deleted = true;
        m.message = 'این پیام حذف شده است';
        const el = document.querySelector(`[data-msg-id="${messageId}"]`);
        if (el) {
            const t = el.querySelector('.msg-text');
            if (t) {
                t.textContent = '🗑️ این پیام حذف شده است';
                t.style.opacity = '0.4';
                t.style.fontStyle = 'italic';
            }
        }
    }
});

socket.on('userOnline', (data) => {
    if (!onlineUsersList.includes(data.username)) onlineUsersList.push(data.username);
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
        const time = new Date(data.lastSeen).toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'});
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

// ========== Profile ==========
function updateProfile() {
    if (!currentUser) return;
    const special = currentUser.isSpecial || false;
    profileName.textContent = currentUser.nickname + (special ? ' 👑' : '');
    profileName.style.color = special ? 'var(--gold)' : '';
    specialBadge.style.display = special ? 'flex' : 'none';
    profileNickname.textContent = currentUser.nickname;
    profileUsername.textContent = `@${currentUser.username}`;
    profileBio.textContent = currentUser.bio || 'بیوگرافی خود را وارد کنید';
    document.getElementById('memberSince').textContent = new Date(currentUser.createdAt).toLocaleDateString('fa-IR');
    document.getElementById('lastSeen').textContent = currentUser.status === 'online' ? 'همین الان' : new Date(currentUser.lastSeen).toLocaleString('fa-IR');
}

editBioBtn.addEventListener('click', () => {
    const b = prompt('بیوگرافی جدید:', currentUser.bio);
    if (b && b.trim()) socket.emit('updateBio', { bio: b.trim() });
});

editNicknameBtn.addEventListener('click', () => {
    const n = prompt('نام نمایشی جدید:', currentUser.nickname);
    if (n && n.trim()) socket.emit('updateNickname', { nickname: n.trim() });
});

socket.on('bioUpdated', (data) => {
    currentUser.bio = data.bio;
    profileBio.textContent = data.bio;
    notif('✅ بیوگرافی به‌روزرسانی شد! ✨');
});

socket.on('nicknameUpdated', (data) => {
    currentUser.nickname = data.nickname;
    updateProfile();
    updateChatList();
    notif('✅ نام نمایشی به‌روزرسانی شد! ✨');
});

socket.on('userUpdated', () => {
    updateProfile();
    updateChatList();
});

// ========== Admin Panel ==========
adminPanelBtn.addEventListener('click', async () => {
    if (!isAdmin) return notif('❌ دسترسی فقط برای ادمین', 'error');
    if (adminPanel.classList.contains('open')) {
        adminPanel.classList.remove('open');
        return;
    }
    adminPanel.classList.add('open');
    const token = getToken();
    const res = await fetch(`/api/admin/users?token=${token}`);
    const data = await res.json();
    if (res.ok) {
        totalUsers.textContent = Object.keys(data).length;
        totalGroups.textContent = Object.keys(allGroups).length;
        usersListContainer.innerHTML = '';
        Object.keys(data).forEach(u => {
            const user = data[u];
            const div = document.createElement('div');
            div.className = 'admin-user-item';
            div.innerHTML = `
                <div class="user-info">
                    <div class="avatar">${user.nickname ? user.nickname[0].toUpperCase() : u[0].toUpperCase()}</div>
                    <div>
                        <div class="username">${user.nickname || u} ${user.isSpecial ? '👑' : ''}</div>
                        <div class="nickname">@${u}</div>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="edit-btn" onclick="adminEdit('${u}')"><i class="fas fa-edit"></i></button>
                    ${u !== 'MALEK' ? `<button class="delete-btn" onclick="adminDelete('${u}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
            usersListContainer.appendChild(div);
        });
    }
});

closeAdmin.addEventListener('click', () => adminPanel.classList.remove('open'));

window.adminEdit = function(u) {
    const nick = prompt('نام نمایشی جدید:', allUsers[u]?.nickname);
    if (nick && nick.trim()) {
        fetch('/api/admin/edit-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: getToken(),
                targetUsername: u,
                updates: { nickname: nick.trim() }
            })
        }).then(res => res.json())
          .then(data => {
              if (data.success) {
                  allUsers[u].nickname = nick.trim();
                  updateChatList();
                  adminPanelBtn.click();
                  notif('✅ کاربر به‌روزرسانی شد!');
              }
          });
    }
};

window.adminDelete = function(u) {
    if (!confirm(`آیا از حذف کاربر ${u} مطمئن هستید؟`)) return;
    fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: getToken(),
            targetUsername: u
        })
    }).then(res => res.json())
      .then(data => {
          if (data.success) {
              delete allUsers[u];
              updateChatList();
              adminPanelBtn.click();
              notif('✅ کاربر حذف شد!');
          }
      });
};

// ========== Other Functions ==========
logoutBtn.addEventListener('click', () => {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        socket.emit('logout');
        clearToken();
        setTimeout(() => location.reload(), 500);
    }
});

settingsBtn.addEventListener('click', () => {
    profileSidebar.classList.toggle('open');
    updateProfile();
});

closeProfile.addEventListener('click', () => profileSidebar.classList.remove('open'));

searchChat.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.chat-item').forEach(el => {
        const name = el.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
        el.style.display = name.includes(q) ? 'flex' : 'none';
    });
});

newChatBtn.addEventListener('click', () => {
    const u = prompt('👤 نام کاربری مخاطب:');
    if (u && u.trim() && u.trim() !== currentUser.username) {
        if (allUsers[u.trim()]) openChat(u.trim(), 'private');
        else notif('❌ کاربر مورد نظر یافت نشد', 'error');
    }
});

newGroupBtn.addEventListener('click', async () => {
    const name = prompt('📝 نام گروه:');
    if (!name || !name.trim()) return;
    const membersInput = prompt('👥 نام کاربران (با کاما جدا کنید):');
    const members = membersInput ? membersInput.split(',').map(m => m.trim()).filter(m => m && allUsers[m]) : [];
    if (!members.includes(currentUser.username)) members.unshift(currentUser.username);
    const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), creator: currentUser.username, members })
    });
    const data = await res.json();
    if (data.success) {
        allGroups[data.group.id] = data.group;
        updateChatList();
        openChat(data.group.id, 'group');
        notif('✅ گروه با موفقیت ایجاد شد!');
    }
});

messageInput.addEventListener('input', () => {
    if (currentChat) socket.emit('typing', { chatId: currentChat });
});

// ========== Auto Login ==========
async function autoLogin() {
    const t = getToken();
    if (!t) return;
    const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t })
    });
    const data = await res.json();
    if (data.success) {
        currentUser = data.user;
        isAdmin = data.user.isAdmin || false;
        socket.emit('authenticate', { token: t });
        if (isAdmin) adminPanelBtn.style.display = 'flex';
    } else {
        clearToken();
    }
}

// ========== Start ==========
socket.on('connect', autoLogin);
socket.on('disconnect', () => notif('⚠️ اتصال به سرور قطع شد!', 'error'));

console.log('🖤💛 PYS Messenger v6.0 - FINAL');
console.log('👑 Special Account: MALEK / MALEK11NEYMAR');
console.log('👤 Designed by S A D R A');
