// 高报专家 H5 应用

// API 配置
// 自动检测：本地服务器用相对路径，公网用完整URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_CONFIG = isLocal ? {
    // 本地模式：通过同源代理，无CORS问题
    baseURL: '',
    token: '1654d4a2d9b7f9a8ba9551897f5321d1e56e8f1812c78703'
} : {
    // 公网模式：需要配置完整的API地址
    baseURL: 'https://2b6400909245f1.lhr.life',
    token: '1654d4a2d9b7f9a8ba9551897f5321d1e56e8f1812c78703'
};

console.log('当前模式:', isLocal ? '本地' : '公网', '- API地址:', API_CONFIG.baseURL || '(同源)');

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

// 调用 OpenClaw API
async function callOpenClawAPI(message) {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`
            },
            body: JSON.stringify({
                model: 'qclaw/modelroute',
                messages: [
                    {
                        role: 'system',
                        content: '你是高考志愿填报专家，擅长根据学生分数、排名、兴趣和职业规划，提供个性化的志愿填报建议。'
                    },
                    ...state.messages.map(m => ({
                        role: m.type === 'user' ? 'user' : 'assistant',
                        content: m.text
                    })),
                    { role: 'user', content: message }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API错误: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('API调用失败:', error);
        return '抱歉，服务暂时不可用，请稍后再试。';
    }
}

// 发送消息
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 添加用户消息
    addMessage(text, 'user');
    state.messages.push({ text, type: 'user' });
    userInput.value = '';

    // 显示加载状态
    const loadingMsg = addMessage('思考中...', 'bot');

    // 调用 OpenClaw API
    const reply = await callOpenClawAPI(text);

    // 移除加载消息，添加真实回复
    loadingMsg.remove();
    addMessage(reply, 'bot');
    state.messages.push({ text: reply, type: 'bot' });
}

// 快捷回复
async function sendQuickReply(text) {
    addMessage(text, 'user');
    state.messages.push({ text, type: 'user' });

    // 移除快捷按钮
    const quickReplies = document.querySelector('.quick-replies');
    if (quickReplies) {
        quickReplies.remove();
    }

    // 显示加载状态
    const loadingMsg = addMessage('思考中...', 'bot');

    // 调用 OpenClaw API
    const reply = await callOpenClawAPI(text);

    // 移除加载消息，添加真实回复
    loadingMsg.remove();
    addMessage(reply, 'bot');
    state.messages.push({ text: reply, type: 'bot' });
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

    return msgDiv;
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

// 检查 API 连接状态
async function checkConnection() {
    const statusEl = document.getElementById('conn-status');
    if (!statusEl) return;

    statusEl.textContent = '🟡'; // checking
    statusEl.className = 'conn-status checking';

    try {
        // 用简单的 chat 请求测试连接
        const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`
            },
            body: JSON.stringify({
                model: 'default',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            })
        });

        if (response.ok) {
            statusEl.textContent = '🟢'; // connected
            statusEl.className = 'conn-status connected';
            statusEl.title = 'API连接正常';
        } else {
            const errText = await response.text();
            console.error('API错误:', response.status, errText);
            // 弹窗显示错误，方便手机调试
            alert('API错误 ' + response.status + ':\n' + errText.substring(0, 200));
            statusEl.textContent = '🔴'; // disconnected
            statusEl.className = 'conn-status disconnected';
            statusEl.title = `API错误: ${response.status}`;
        }
    } catch (error) {
        console.error('连接失败:', error);
        // 弹窗显示错误，方便手机调试
        alert('连接失败:\n' + error.message + '\n\nAPI地址: ' + API_CONFIG.baseURL);
        statusEl.textContent = '🔴'; // disconnected
        statusEl.className = 'conn-status disconnected';
        statusEl.title = `连接失败: ${error.message}`;
    }
}

// 初始化
function init() {
    // 检查登录状态
    const savedUser = localStorage.getItem('gaokao_user');
    if (savedUser) {
        state.isLoggedIn = true;
        state.user = JSON.parse(savedUser);
        showPage('home');
    }

    // 检查 API 连接
    checkConnection();

    console.log('高报专家 H5 初始化完成');
}

init();
