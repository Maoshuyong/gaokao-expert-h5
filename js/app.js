// 高报专家 H5 应用

// 状态管理
const state = {
    isLoggedIn: false,
    user: null,
    messages: [],
    usageCount: 0,
    maxUsage: 10
};

// DOM 元素
const pages = {
    login: document.getElementById('login-page'),
    home: document.getElementById('home-page'),
    chat: document.getElementById('chat-page'),
    member: document.getElementById('member-page')
};

// 页面切换
function showPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    pages[pageName].classList.add('active');
}

// 登录相关
const phoneInput = document.getElementById('phone');
const codeInput = document.getElementById('code');
const sendCodeBtn = document.getElementById('send-code');
const loginBtn = document.getElementById('login-btn');
const wechatLoginBtn = document.getElementById('wechat-login');

// 发送验证码
let countdown = 0;
sendCodeBtn?.addEventListener('click', () => {
    const phone = phoneInput.value;
    if (!/^1\d{10}$/.test(phone)) {
        alert('请输入正确的手机号');
        return;
    }
    
    // 开始倒计时
    countdown = 60;
    sendCodeBtn.disabled = true;
    const timer = setInterval(() => {
        countdown--;
        sendCodeBtn.textContent = `${countdown}s`;
        if (countdown <= 0) {
            clearInterval(timer);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '获取验证码';
        }
    }, 1000);
    
    // TODO: 调用API发送验证码
    console.log('发送验证码到:', phone);
});

// 手机号登录
loginBtn?.addEventListener('click', () => {
    const phone = phoneInput.value;
    const code = codeInput.value;
    
    if (!/^1\d{10}$/.test(phone)) {
        alert('请输入正确的手机号');
        return;
    }
    if (!/^\d{6}$/.test(code)) {
        alert('请输入6位验证码');
        return;
    }
    
    // TODO: 调用API验证登录
    console.log('登录:', phone, code);
    
    // 模拟登录成功
    state.isLoggedIn = true;
    state.user = { phone };
    showPage('home');
});

// 微信登录
wechatLoginBtn?.addEventListener('click', () => {
    // TODO: 调用微信授权
    console.log('微信登录');
    alert('微信登录功能开发中，请使用手机号登录');
});

// 开始咨询
const startChatBtn = document.getElementById('start-chat');
startChatBtn?.addEventListener('click', () => {
    showPage('chat');
});

// 对话相关
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 发送消息
function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    // 添加用户消息
    addMessage(text, 'user');
    userInput.value = '';
    
    // TODO: 调用OpenClaw API
    console.log('发送消息:', text);
    
    // 模拟AI回复
    setTimeout(() => {
        addMessage('收到你的消息了！让我想想...', 'bot');
    }, 1000);
}

// 快捷回复
function sendQuickReply(text) {
    addMessage(text, 'user');
    
    // 移除快捷按钮
    const quickReplies = document.querySelector('.quick-replies');
    if (quickReplies) {
        quickReplies.remove();
    }
    
    // TODO: 调用OpenClaw API
    console.log('快捷回复:', text);
    
    // 模拟AI追问
    setTimeout(() => {
        if (text === '我是家长') {
            addMessage('好的，家长您好！请问孩子是今年高考吗？能告诉我孩子的分数和选科情况吗？', 'bot');
        } else {
            addMessage('好的，同学你好！今年高考感觉怎么样？有没有特别向往的专业或方向？', 'bot');
        }
    }, 1000);
}

// 添加消息到界面
function addMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = type === 'user' ? '👤' : '🎓';
    
    const content = document.createElement('div');
    content.className = 'msg-content';
    
    const p = document.createElement('p');
    p.textContent = text;
    content.appendChild(p);
    
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    
    messagesContainer.appendChild(msgDiv);
    
    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 输入框自动调整高度
userInput?.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

// 回车发送
userInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 初始化
function init() {
    // 检查登录状态
    const savedUser = localStorage.getItem('gaokao_user');
    if (savedUser) {
        state.isLoggedIn = true;
        state.user = JSON.parse(savedUser);
        showPage('home');
    }
    
    console.log('高报专家 H5 初始化完成');
}

init();
