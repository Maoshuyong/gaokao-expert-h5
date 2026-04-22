// 高报专家 H5 - WorkBuddy Agent 版
// LLM 后端：WorkBuddy Agent（替代原 QClaw 网关）

// ─── API 配置 ───────────────────────────────────────────
// server.js 统一代理，前端始终用同源相对路径
const API_CONFIG = {
    baseURL: '',          // 同源，server.js 负责转发到 WorkBuddy Agent
    token: 'gkzhuanye2026'
};

console.log('高报专家 H5 已启动（WorkBuddy Agent 版）');

// ─── 状态管理 ────────────────────────────────────────────
const state = {
    isLoggedIn: false,
    user: null,
    userRole: 'personal',  // 'personal' | 'institution'
    profiles: [],          // 机构模式下的考生档案列表
    currentProfileId: null, // 当前选中的考生档案 ID
    messages: [],       // { role: 'user'|'assistant', content: string }
    usageCount: 0,
    maxUsage: Infinity,
    year: 0,            // 高考年份（0 表示未选择，默认当前年）
    province: '',        // 当前选中的考生省份
    category: '',        // 当前选类的科类（文科/理科/物理类/历史类）
    mbti: null           // MBTI 测试结果 { type, name, tags, majors, desc }
};

// ─── 省份→科类映射（区分新高考/老高考） ─────────────────────
const PROVINCE_CURRICULUM = {
    // 新高考 3+1+2（物理类/历史类）
    '广东': ['物理类', '历史类'], '湖南': ['物理类', '历史类'],
    '湖北': ['物理类', '历史类'], '河北': ['物理类', '历史类'],
    '辽宁': ['物理类', '历史类'], '江苏': ['物理类', '历史类'],
    '福建': ['物理类', '历史类'], '重庆': ['物理类', '历史类'],
    '安徽': ['物理类', '历史类'], '江西': ['物理类', '历史类'],
    // 新高考 3+3（综合）
    '山东': ['综合'], '浙江': ['综合'], '海南': ['综合'],
    '北京': ['综合'], '天津': ['综合'], '上海': ['综合'],
    // 老高考（文科/理科）
    '陕西': ['文科', '理科'], '河南': ['文科', '理科'],
    '山西': ['文科', '理科'], '四川': ['文科', '理科'],
    '云南': ['文科', '理科'], '贵州': ['文科', '理科'],
    '广西': ['文科', '理科'], '甘肃': ['文科', '理科'],
    '青海': ['文科', '理科'], '宁夏': ['文科', '理科'],
    '新疆': ['文科', '理科'], '西藏': ['文科', '理科'],
    '内蒙古': ['文科', '理科'], '黑龙江': ['文科', '理科'],
    '吉林': ['文科', '理科'],
};

// 新高考 3+1+2 实施年份（该年份及之后按新高考科目）
const NEW_GAOKAO_312_YEAR = {
    // 第三批：2021 年落地
    '广东': 2021, '湖南': 2021, '湖北': 2021, '河北': 2021,
    '辽宁': 2021, '江苏': 2021, '福建': 2021, '重庆': 2021,
    // 第四批：2024 年落地
    '黑龙江': 2024, '甘肃': 2024, '吉林': 2024, '安徽': 2024,
    '江西': 2024, '贵州': 2024, '广西': 2024,
    // 第五批：2025 年落地
    '陕西': 2025, '四川': 2025, '河南': 2025, '山西': 2025,
    '内蒙古': 2025, '云南': 2025, '宁夏': 2025, '青海': 2025,
    // 第六批：2027 年落地
    '新疆': 2027,
};
// 新高考 3+3 实施年份
const NEW_GAOKAO_33_YEAR = {
    '山东': 2020, '浙江': 2020, '海南': 2020,
    '北京': 2020, '天津': 2020, '上海': 2017,
};

// 根据省份+年份获取科类选项
function getCategoriesForYear(province, year) {
    if (!province || !year) return [];
    const y312 = NEW_GAOKAO_312_YEAR[province];
    const y33 = NEW_GAOKAO_33_YEAR[province];
    if (y312 && year >= y312) return ['物理类', '历史类'];
    if (y33 && year >= y33) return ['综合'];
    // 老高考或未知的年份
    return ['文科', '理科'];
}

// ─── 页面元素 ────────────────────────────────────────────
const pages = {
    role:     document.getElementById('role-page'),
    login:    document.getElementById('login-page'),
    home:     document.getElementById('home-page'),
    chat:     document.getElementById('chat-page'),
    report:   document.getElementById('report-page'),
    member:   document.getElementById('member-page'),
    mbti:     document.getElementById('mbti-page'),
    profiles: document.getElementById('profiles-page')
};

// ─── 页面切换 ────────────────────────────────────────────
function showPage(pageName) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[pageName].classList.add('active');
    if (pageName === 'chat') {
        checkConnection();
    }
}

// ─── 角色选择 ────────────────────────────────────────────
function selectRole(role) {
    state.userRole = role;
    localStorage.setItem('gaokao_role', role);
    console.log('角色选择:', role === 'personal' ? '个人用户' : '机构用户');
    showPage('login');
}

// 切换回角色选择页（从会员页）
function resetRole() {
    if (!confirm('切换身份将清空当前对话记录，确定继续？')) return;
    localStorage.removeItem('gaokao_role');
    localStorage.removeItem('gaokao_profiles');
    localStorage.removeItem('gaokao_current_profile');
    localStorage.removeItem('gaokao_messages');
    localStorage.removeItem('gaokao_usage_count');
    state.userRole = 'personal';
    state.profiles = [];
    state.currentProfileId = null;
    state.messages = [];
    state.usageCount = 0;
    showPage('role');
}

// ─── 登录逻辑 ────────────────────────────────────────────
const phoneInput   = document.getElementById('phone');
const codeInput    = document.getElementById('code');
const sendCodeBtn  = document.getElementById('send-code');
const loginBtn     = document.getElementById('login-btn');
const guestLoginBtn = document.getElementById('guest-login');

// 发送验证码（倒计时 UI，后端 TODO）
let countdown = 0;
sendCodeBtn?.addEventListener('click', () => {
    const phone = phoneInput.value;
    if (!/^1\d{10}$/.test(phone)) { alert('请输入正确的手机号'); return; }
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
    console.log('TODO: 调用短信 API 发送验证码到', phone);
});

// 手机号登录（当前为模拟，TODO: 接真实验证）
loginBtn?.addEventListener('click', () => {
    const phone = phoneInput.value;
    const code  = codeInput.value;
    if (!/^1\d{10}$/.test(phone)) { alert('请输入正确的手机号'); return; }
    if (!/^\d{6}$/.test(code))    { alert('请输入6位验证码'); return; }
    doLogin({ phone, name: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') });
});

// 体验入口（无需登录）
guestLoginBtn?.addEventListener('click', () => {
    doLogin({ phone: 'guest', name: '体验用户' });
});

function doLogin(user) {
    state.isLoggedIn = true;
    state.user = user;
    localStorage.setItem('gaokao_user', JSON.stringify(user));
    updateUserUI();
    updateMemberRoleUI();

    if (state.userRole === 'institution') {
        updateProfileSwitcherUI();
        if (state.profiles.length > 0 && !state.currentProfileId) {
            switchProfile(state.profiles[0].id);
        } else if (state.currentProfileId) {
            const p = state.profiles.find(x => x.id === state.currentProfileId);
            if (p) {
                loadProfileMessages(state.currentProfileId);
                const greetEl = document.getElementById('greeting-text');
                if (greetEl) greetEl.textContent = `Hi，${p.name}`;
            }
        } else {
            resetHomePanel();
        }
    }

    showPage('home');
}

function updateUserUI() {
    if (!state.user) return;
    const name = state.user.name || state.user.phone;
    const greetEl   = document.getElementById('greeting-text');
    const statusEl  = document.getElementById('user-status-text');
    const memberEl  = document.getElementById('member-name-text');
    if (greetEl)  greetEl.textContent  = `Hi，${name}`;
    if (memberEl) memberEl.textContent = name;
}

function updateUsageUI() {
    const pct = Math.min((state.usageCount / state.maxUsage) * 100, 100);
    const progressEl = document.getElementById('usage-progress');
    const usedEl     = document.getElementById('usage-used-text');
    const remainEl   = document.getElementById('usage-remain-text');
    const statUsed   = document.getElementById('stat-used');
    if (progressEl) progressEl.style.width = pct + '%';
    if (usedEl)     usedEl.textContent  = `已使用 ${state.usageCount} 次`;
    if (remainEl)   remainEl.textContent = `剩余 ${Math.max(state.maxUsage - state.usageCount, 0)} 次`;
    if (statUsed)   statUsed.textContent = state.usageCount;
}

// ─── 高考年份选择（首页面板） ──────────────────────────────
const quickYearSelect = document.getElementById('quick-year');

function initYearSelect() {
    if (!quickYearSelect) return;
    const currentYear = new Date().getFullYear();
    // 填充 2017 ~ 当前年份 + 1（留一年余量）
    for (let y = currentYear + 1; y >= 2017; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '年';
        if (y === currentYear) opt.selected = true;
        quickYearSelect.appendChild(opt);
    }
    // 默认当前年份
    state.year = currentYear;
    // 恢复上次选择
    const saved = localStorage.getItem('gaokao_year');
    if (saved) {
        state.year = parseInt(saved, 10) || currentYear;
        quickYearSelect.value = state.year;
    }
}

quickYearSelect?.addEventListener('change', () => {
    const y = parseInt(quickYearSelect.value, 10);
    state.year = y || 0;
    localStorage.setItem('gaokao_year', state.year);
    // 年份变化时刷新科类选项
    refreshCategoryOptions();
    console.log('年份切换:', state.year || '未选择');
});

// ─── 科类动态刷新 ──────────────────────────────────────
function refreshCategoryOptions() {
    if (!quickCategorySelect) return;
    quickCategorySelect.innerHTML = '';
    if (!state.province || !state.year) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = !state.province ? '请先选择省份和年份' : '请先选择年份';
        quickCategorySelect.appendChild(opt);
        state.category = '';
        localStorage.removeItem('gaokao_category');
        return;
    }
    const cats = getCategoriesForYear(state.province, state.year);
    if (!cats.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '暂无该省份科类数据';
        quickCategorySelect.appendChild(opt);
        state.category = '';
        localStorage.removeItem('gaokao_category');
        return;
    }
    // 默认项
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '请选择科类';
    quickCategorySelect.appendChild(defaultOpt);
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        quickCategorySelect.appendChild(opt);
    });
    // 如果之前选的科类仍在列表中，自动恢复
    const savedCat = localStorage.getItem('gaokao_category');
    if (savedCat && cats.includes(savedCat)) {
        state.category = savedCat;
        quickCategorySelect.value = savedCat;
    } else {
        state.category = '';
        localStorage.removeItem('gaokao_category');
    }
}

// ─── 省份选择（首页面板） ──────────────────────────────────
const quickProvinceSelect = document.getElementById('quick-province');

const PROVINCES = [
    '陕西','河南','广东','四川','湖北','湖南','山东','江苏','河北','安徽','浙江',
    '北京','上海','天津','重庆','福建','江西','山西','辽宁','吉林','黑龙江',
    '内蒙古','广西','海南','贵州','云南','西藏','甘肃','青海','宁夏','新疆'
];

function initProvinceSelect() {
    if (!quickProvinceSelect) return;
    PROVINCES.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        quickProvinceSelect.appendChild(opt);
    });
    // 恢复上次选择
    const saved = localStorage.getItem('gaokao_province');
    if (saved) {
        state.province = saved;
        quickProvinceSelect.value = saved;
    }
}

quickProvinceSelect?.addEventListener('change', () => {
    state.province = quickProvinceSelect.value;
    localStorage.setItem('gaokao_province', state.province);
    // 省份变化时刷新科类选项
    refreshCategoryOptions();
    console.log('省份切换:', state.province || '未选择');
});

// ─── 科类选择（首页面板） ──────────────────────────────────
const quickCategorySelect = document.getElementById('quick-category');

quickCategorySelect?.addEventListener('change', () => {
    state.category = quickCategorySelect.value;
    localStorage.setItem('gaokao_category', state.category);
    console.log('科类切换:', state.category || '未选择');
});

// ─── 开始咨询 ────────────────────────────────────────────
document.getElementById('start-chat')?.addEventListener('click', () => {
    // 必填校验
    if (!state.year) {
        alert('请先选择高考年份');
        quickYearSelect?.focus();
        return;
    }
    if (!state.province) {
        alert('请先选择考生省份');
        quickProvinceSelect?.focus();
        return;
    }
    if (!state.category) {
        alert('请先选择科类');
        quickCategorySelect?.focus();
        return;
    }

    showPage('chat');

    // 如果用户在首页填了分数/位次，自动发送为第一条消息
    const score = document.getElementById('quick-score')?.value?.trim();
    const rank = document.getElementById('quick-rank')?.value?.trim();

    if (score || rank || state.mbti) {
        let infoMsg = '';
        if (state.mbti) {
            infoMsg += `我的MBTI是${state.mbti.type}（${state.mbti.name}）`;
        }
        if (score || rank) {
            if (infoMsg) infoMsg += '，';
            infoMsg += '我的成绩信息：';
            if (score) infoMsg += `高考${score}分`;
            if (rank) infoMsg += `，省排名${Number(rank).toLocaleString()}名`;
            if (score && !rank) infoMsg += '，但我不知道位次';
            if (!score && rank) infoMsg += '，但我不知道具体分数';
        }
        infoMsg += `（${state.year}年${state.province}${state.category}）`;

        // 延迟 300ms 发送，让页面切换动画完成
        setTimeout(() => dispatchMessage(infoMsg), 300);
    }
});

// ─── 对话核心 ────────────────────────────────────────────
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');

// 调用 LLM（SSE 流式）
async function callLLM(userMessage, onChunk, onStatus) {
    // 把用户消息追加到历史
    state.messages.push({ role: 'user', content: userMessage });

    const payload = {
        model: 'default',
        messages: state.messages,
        stream: true,   // 启用流式
        max_tokens: 4000,
        temperature: 0.7
    };
    if (state.province) payload.province = state.province;
    if (state.category) payload.category = state.category;
    if (state.year) payload.year = state.year;

    const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.token}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    // SSE 解析
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
                const parsed = JSON.parse(dataStr);

                // tool_status 事件：显示工具调用进度
                if (parsed.type === 'tool_status' && onStatus) {
                    onStatus(parsed.content);
                    continue;
                }

                // done 事件
                if (parsed.type === 'done') {
                    continue;
                }

                // 标准 SSE chunk
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                    fullContent += delta;
                    if (onChunk) onChunk(fullContent);
                }
            } catch (e) {
                // 忽略非 JSON 行
            }
        }
    }

    // 流结束后保存完整回复
    if (fullContent) {
        state.messages.push({ role: 'assistant', content: fullContent });
    }
    return fullContent || '（无回复）';
}

// 发送消息（来自输入框）
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = '';
    userInput.style.height = 'auto';
    await dispatchMessage(text);
}

// 快捷按钮（欢迎语区的，保留兼容）
async function sendQuickReply(text) {
    document.querySelector('.quick-replies')?.remove();
    await dispatchMessage(text);
}

// ─── 常驻快捷按钮栏 ─────────────────────────────────────
const QUICK_ACTIONS = {
    // 初始按钮（未填成绩时）
    initial: [
        { text: '帮我查位次', style: 'qa-primary', msg: '帮我查一下位次对应什么分数' },
        { text: '能上什么大学', style: 'qa-primary', msg: '根据我的成绩，能上什么层次的大学？' },
        { text: '一分一段表', style: 'qa-data', msg: '帮我查一分一段表' },
        { text: '志愿填报策略', style: 'qa-advice', msg: '教我志愿填报的策略，怎么冲稳保搭配？' },
        { text: '推荐专业', style: 'qa-advice', msg: '帮我推荐适合我的专业方向' },
        { text: '中外合作办学', style: 'qa-data', msg: '介绍一下中外合作办学，哪些值得考虑？' },
        { text: '了解MBTI', style: 'qa-advice', msg: '我想通过MBTI测试了解自己适合什么专业' },
    ],
    // 已知成绩后的按钮
    withScore: [
        { text: '录取概率', style: 'qa-primary', msg: '帮我算一下录取概率' },
        { text: '冲稳保方案', style: 'qa-primary', msg: '帮我制定冲稳保志愿方案' },
        { text: '查院校分数线', style: 'qa-data', msg: '帮我查某所院校的历年录取分数' },
        { text: '位次换算', style: 'qa-data', msg: '帮我做位次和分数的换算' },
        { text: '省控线', style: 'qa-data', msg: '查一下历年省控线' },
        { text: '志愿填报策略', style: 'qa-advice', msg: '教我志愿填报的策略，怎么冲稳保搭配？' },
        { text: '专业推荐', style: 'qa-advice', msg: '根据我的成绩推荐一些专业' },
    ]
};

let currentActionSet = 'initial';

function renderQuickActions() {
    const container = document.getElementById('quick-actions');
    if (!container) return;

    // 根据是否有成绩数据切换按钮组
    const score = document.getElementById('quick-score')?.value?.trim();
    const rank = document.getElementById('quick-rank')?.value?.trim();
    // 也检查消息历史里是否有成绩信息
    const hasScoreInChat = state.messages.some(m =>
        m.content.match(/\d+分/) || m.content.match(/\d+名/));
    const actionKey = (score || rank || hasScoreInChat) ? 'withScore' : 'initial';
    currentActionSet = actionKey;

    const actions = QUICK_ACTIONS[actionKey];
    container.innerHTML = actions.map(a =>
        `<button class="qa-btn ${a.style}" onclick="handleQuickAction(this)" data-msg="${a.msg.replace(/"/g, '&quot;')}">${a.text}</button>`
    ).join('');
}

async function handleQuickAction(btn) {
    const msg = btn.dataset.msg;
    if (!msg) return;
    await dispatchMessage(msg);
    // 刷新按钮组（可能切换到 withScore）
    renderQuickActions();
}

// 初始化渲染
renderQuickActions();

// 统一分发入口
async function dispatchMessage(text) {
    if (state.usageCount >= state.maxUsage) {
        alert('免费对话次数已用完，请升级会员继续使用。');
        return;
    }

    addMessage(text, 'user');
    state.usageCount++;
    updateUsageUI();
    persistState();

    // 创建流式消息容器（先显示 loading 状态）
    const botMsgEl = addStreamingMessage('正在分析你的信息...');
    document.getElementById('send-btn').disabled = true;

    try {
        const reply = await callLLM(
            text,
            // onChunk: 每收到一段文本就更新渲染
            (partialContent) => {
                updateStreamingMessage(botMsgEl, partialContent);
            },
            // onStatus: 工具调用状态更新
            (statusText) => {
                updateStreamingStatus(botMsgEl, statusText);
            }
        );
        // 流结束，将消息固定为最终版本
        finalizeStreamingMessage(botMsgEl, reply);
    } catch (err) {
        console.error('LLM 调用失败:', err);
        finalizeStreamingMessage(botMsgEl, `⚠️ 服务暂时不可用，请稍后再试。\n（${err.message}）`);
    } finally {
        document.getElementById('send-btn').disabled = false;
        renderQuickActions(); // 刷新快捷按钮（可能切换按钮组）
    }
}

// 渲染消息气泡
function addMessage(text, role, isLoading = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🎓';

    const content = document.createElement('div');
    content.className = 'msg-content';

    if (isLoading) {
        content.innerHTML = '<p class="loading-dots">思考中<span>.</span><span>.</span><span>.</span></p>';
    } else {
        content.innerHTML = `<div class="md-content">${renderMarkdown(text)}</div>`;
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv;
}

// ─── Markdown → HTML 渲染（统一函数） ───────────────────────
function renderMarkdown(text) {
    if (!text) return '';
    const raw = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 按行分块处理
    const lines = raw.split('\n');
    const blocks = [];  // { type: 'table'|'list-ul'|'list-ol'|'heading'|'hr'|'quote'|'empty', content: string }
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 空行 → 段落分隔
        if (!line.trim()) {
            blocks.push({ type: 'empty' });
            i++;
            continue;
        }

        // 表格：| 开头，连续行组成完整表格
        if (line.trim().startsWith('|')) {
            let tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            // 至少需要表头 + 分隔线
            if (tableLines.length >= 2 && /^\|[\s-:|]+\|$/.test(tableLines[1].trim())) {
                const headers = tableLines[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
                const rows = tableLines.slice(2).map(row => {
                    const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');
                blocks.push({ type: 'table', content: `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>` });
            } else {
                blocks.push({ type: 'para', content: tableLines.join('<br>') });
            }
            continue;
        }

        // 分割线
        if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        // 标题
        const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            const level = Math.min(headingMatch[1].length, 4);
            blocks.push({ type: 'heading', content: `<h${level + 1}>${headingMatch[2]}</h${level + 1}>` });
            i++;
            continue;
        }

        // 引用块 >
        if (line.trim().startsWith('>')) {
            let quoteLines = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quoteLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({ type: 'quote', content: `<blockquote>${quoteLines.join('<br>')}</blockquote>` });
            continue;
        }

        // 无序列表 - 连续的 - 开头
        if (/^- /.test(line.trim())) {
            let items = [];
            while (i < lines.length && /^- /.test(lines[i].trim())) {
                items.push(lines[i].replace(/^-\s+/, ''));
                i++;
            }
            const lis = items.map(item => `<li>${item}</li>`).join('');
            blocks.push({ type: 'list', content: `<ul>${lis}</ul>` });
            continue;
        }

        // 有序列表 1. 2. 3.
        if (/^\d+\.\s/.test(line.trim())) {
            let items = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                items.push(lines[i].replace(/^\d+\.\s+/, ''));
                i++;
            }
            const lis = items.map(item => `<li>${item}</li>`).join('');
            blocks.push({ type: 'list', content: `<ol>${lis}</ol>` });
            continue;
        }

        // 普通段落：收集连续非空非特殊行
        let paraLines = [];
        while (i < lines.length && lines[i].trim() &&
               !lines[i].trim().startsWith('|') &&
               !lines[i].trim().startsWith('>') &&
               !/^(#{1,4}\s|---+$|\*\*\*+$|- |\d+\.\s)/.test(lines[i].trim())) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            // 行内格式：粗体、斜体、行内代码
            let content = paraLines.join('<br>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`(.+?)`/g, '<code>$1</code>');
            blocks.push({ type: 'para', content });
        }
    }

    // 组装 HTML
    let html = '';
    for (const block of blocks) {
        switch (block.type) {
            case 'table':
                html += `<div class="table-wrap">${block.content}</div>`;
                break;
            case 'heading':
            case 'list':
            case 'hr':
            case 'quote':
                html += block.content;
                break;
            case 'para':
                html += `<p>${block.content}</p>`;
                break;
            case 'empty':
                break;
        }
    }
    return html;
}

// 创建流式消息气泡
function addStreamingMessage(initialStatus) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🎓';

    const content = document.createElement('div');
    content.className = 'msg-content streaming';

    // 状态指示区
    const statusEl = document.createElement('div');
    statusEl.className = 'stream-status';
    statusEl.innerHTML = `<span class="status-text">${initialStatus}</span>`;
    content.appendChild(statusEl);

    // 内容区（初始隐藏）
    const textEl = document.createElement('div');
    textEl.className = 'stream-text md-content';
    textEl.style.display = 'none';
    content.appendChild(textEl);

    // 光标
    const cursor = document.createElement('span');
    cursor.className = 'stream-cursor';
    cursor.textContent = '▊';
    cursor.style.display = 'none';
    content.appendChild(cursor);

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 存储引用
    msgDiv._statusEl = statusEl;
    msgDiv._textEl = textEl;
    msgDiv._cursorEl = cursor;
    return msgDiv;
}

// 更新工具调用状态
function updateStreamingStatus(msgEl, statusText) {
    if (!msgEl || !msgEl._statusEl) return;
    msgEl._statusEl.querySelector('.status-text').textContent = statusText;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 更新流式文本内容
function updateStreamingMessage(msgEl, partialContent) {
    if (!msgEl) return;
    const statusEl = msgEl._statusEl;
    const textEl = msgEl._textEl;
    const cursor = msgEl._cursorEl;

    // 隐藏状态，显示文本
    if (statusEl) statusEl.style.display = 'none';
    if (textEl) {
        textEl.style.display = 'block';
        textEl.innerHTML = renderMarkdown(partialContent);
    }
    if (cursor) cursor.style.display = 'inline';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 流结束，固定最终内容
function finalizeStreamingMessage(msgEl, finalContent) {
    if (!msgEl) return;
    const statusEl = msgEl._statusEl;
    const textEl = msgEl._textEl;
    const cursor = msgEl._cursorEl;
    const content = msgEl.querySelector('.msg-content');

    // 移除 streaming 类（停止动画）
    if (content) content.classList.remove('streaming');

    // 隐藏状态和光标
    if (statusEl) statusEl.remove();
    if (cursor) cursor.remove();

    // 渲染最终完整 Markdown
    if (textEl) {
        textEl.style.display = 'block';
        textEl.innerHTML = renderMarkdown(finalContent);
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 清空对话
function clearChat() {
    if (!confirm('确定清空对话记录？')) return;
    state.messages = [];
    state.usageCount = 0;
    updateUsageUI();
    persistState();
    // 重置聊天界面
    messagesContainer.innerHTML = `
        <div class="message bot">
            <div class="msg-avatar">🎓</div>
            <div class="msg-content">
                <p>你好！我是高报专家 🎓</p>
                <p>在开始之前，我想先了解一下：</p>
                <p><strong>你是考生本人，还是家长？</strong></p>
            </div>
        </div>
        <div class="quick-replies">
            <button class="quick-btn" onclick="sendQuickReply('我是考生')">我是考生</button>
            <button class="quick-btn" onclick="sendQuickReply('我是家长')">我是家长</button>
        </div>`;
}

// ─── 报告生成 ──────────────────────────────────────────────
let reportGenerating = false;

async function generateReport() {
    if (reportGenerating) {
        showPage('report');
        return;
    }

    // 至少要有对话记录
    if (state.messages.length < 2) {
        alert('请先和 AI 专家聊几句你的情况，再来生成报告');
        showPage('chat');
        return;
    }

    reportGenerating = true;
    showPage('report');

    // 切换到报告内容视图
    document.getElementById('report-empty').style.display = 'none';
    document.getElementById('report-content').style.display = 'block';

    // 填充封面
    const province = state.province || '未知';
    const category = state.category || '未知';
    const year = state.year || new Date().getFullYear();
    document.getElementById('cover-title').textContent =
        `${year}年${province}${category} 志愿分析报告`;
    document.getElementById('cover-province').textContent = province;
    document.getElementById('cover-category').textContent = `${year}年 ${category}`;
    document.getElementById('cover-date').textContent =
        new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    // 重置流式区域
    const statusEl = document.getElementById('report-status');
    const textEl = document.getElementById('report-text');
    statusEl.style.display = 'flex';
    statusEl.querySelector('.status-text').textContent = '正在分析对话记录并生成报告...';
    textEl.style.display = 'none';
    textEl.innerHTML = '';

    // 构建报告专用 prompt
    const reportPrompt = buildReportPrompt();

    try {
        await callLLMForReport(
            reportPrompt,
            // onChunk: 实时渲染报告文本
            (partialContent) => {
                statusEl.style.display = 'none';
                textEl.style.display = 'block';
                textEl.innerHTML = renderMarkdown(partialContent);
                document.getElementById('report-body').scrollTop = document.getElementById('report-body').scrollHeight;
            },
            // onStatus: 工具调用状态
            (statusText) => {
                statusEl.querySelector('.status-text').textContent = statusText;
            }
        );
        // 报告生成完毕
        statusEl.style.display = 'none';
    } catch (err) {
        console.error('报告生成失败:', err);
        statusEl.style.display = 'none';
        textEl.style.display = 'block';
        textEl.innerHTML = `<p>⚠️ 报告生成失败：${err.message}</p><p>请返回对话页继续聊天后再试</p>`;
    } finally {
        reportGenerating = false;
    }
}

function buildReportPrompt() {
    // 从对话历史中提取关键信息
    const chatHistory = state.messages
        .map(m => `${m.role === 'user' ? '用户' : '专家'}：${m.content}`)
        .join('\n\n');

    return `请根据以下对话记录，生成一份完整的高考志愿分析报告。

## 报告要求

请严格按以下结构生成 Markdown 格式报告：

### 1. 📋 考生画像
用表格汇总：省份、科类、高考分数、省排名、超线情况、成绩定位

### 2. 💡 核心判断
基于数据给出 2-3 条关键判断（如：能上什么层次、地域选择空间、专业重要性）

### 3. ⚠️ 重要预警
基于真实数据指出风险（如位次暴涨的院校、招生人数少的陷阱）

### 4. 🎯 志愿方案

**冲刺志愿（位次比你高1000-3000名）**
用表格：院校名 | 标签 | 城市 | 近三年位次 | 招生人数 | 推荐专业 | 风险提示
冲刺总结

**稳妥志愿（位次±1500名）**
用表格：院校名 | 标签 | 城市 | 近三年位次 | 招生人数 | 推荐专业 | 安全余量
按安全性排序

**保底志愿（位次比你低1500名以上）**
用表格同上

### 5. 📊 位次趋势分析
关键院校近三年位次变化（用表格），标注暴涨/暴跌

### 6. 🎯 专业建议
结合考生情况推荐 3-5 个专业方向，说明理由

### 7. 📝 操作建议
志愿填报的具体步骤提醒

## 对话记录

${chatHistory}

## 注意事项
- 所有数据必须基于对话中工具查询到的真实数据，不要编造
- 如果对话中缺少某些数据（如位次、分数），请标注"需补充"
- 稳妥志愿的安全余量必须≥1500名
- 位次波动大的院校要特别标注风险`;
}

// 独立的报告 SSE 调用（不污染对话历史）
async function callLLMForReport(reportPrompt, onChunk, onStatus) {
    const payload = {
        model: 'default',
        messages: [{ role: 'user', content: reportPrompt }],
        stream: true,
        max_tokens: 6000,
        temperature: 0.5  // 报告用更低温度，更稳定
    };
    if (state.province) payload.province = state.province;
    if (state.category) payload.category = state.category;
    if (state.year) payload.year = state.year;

    const response = await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.token}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'tool_status' && onStatus) {
                    onStatus(parsed.content);
                    continue;
                }
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                    fullContent += delta;
                    if (onChunk) onChunk(fullContent);
                }
            } catch (e) {
                // ignore
            }
        }
    }

    return fullContent || '';
}

// 分享报告（复制到剪贴板）
function shareReport() {
    const textEl = document.getElementById('report-text');
    if (!textEl || !textEl.textContent.trim()) {
        alert('还没有报告内容可分享');
        return;
    }
    const text = textEl.innerText;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('report-share-btn');
            btn.textContent = '已复制';
            setTimeout(() => { btn.textContent = '分享'; }, 2000);
        }).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        const btn = document.getElementById('report-share-btn');
        btn.textContent = '已复制';
        setTimeout(() => { btn.textContent = '分享'; }, 2000);
    } catch (e) {
        alert('复制失败，请长按选择文字复制');
    }
    document.body.removeChild(ta);
}

// ─── 连接检测 ────────────────────────────────────────────
async function checkConnection() {
    try {
        await fetch(`${API_CONFIG.baseURL}/v1/chat/completions`, {
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
    } catch (e) {
        console.warn('连接检测失败:', e.message);
    }
}

// ─── 输入框交互 ──────────────────────────────────────────
userInput?.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

userInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// ─── 持久化 ──────────────────────────────────────────────
function persistState() {
    localStorage.setItem('gaokao_messages',    JSON.stringify(state.messages));
    localStorage.setItem('gaokao_usage_count', state.usageCount);
    // 机构模式：保存当前档案的对话记录
    if (state.userRole === 'institution' && state.currentProfileId) {
        saveProfileMessages(state.currentProfileId);
    }
}

function restoreState() {
    try {
        const msgs = localStorage.getItem('gaokao_messages');
        if (msgs) state.messages = JSON.parse(msgs);
    } catch (_) {}
    state.usageCount = parseInt(localStorage.getItem('gaokao_usage_count') || '0', 10);
    // 恢复年份
    const savedYear = localStorage.getItem('gaokao_year');
    if (savedYear) {
        state.year = parseInt(savedYear, 10) || 0;
    }
    // 恢复角色
    const savedRole = localStorage.getItem('gaokao_role');
    if (savedRole) state.userRole = savedRole;
    // 恢复机构模式的考生档案
    if (state.userRole === 'institution') {
        try {
            const savedProfiles = localStorage.getItem('gaokao_profiles');
            if (savedProfiles) state.profiles = JSON.parse(savedProfiles);
        } catch (_) {}
        state.currentProfileId = localStorage.getItem('gaokao_current_profile') || null;
    }
}

// ─── 考生档案管理（机构模式） ───────────────────────────
function generateProfileId() {
    return 'pf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function saveProfilesToStorage() {
    localStorage.setItem('gaokao_profiles', JSON.stringify(state.profiles));
}

function saveProfileMessages(profileId) {
    if (!profileId) return;
    const key = `gaokao_profile_msgs_${profileId}`;
    localStorage.setItem(key, JSON.stringify(state.messages));
}

function loadProfileMessages(profileId) {
    if (!profileId) return;
    const key = `gaokao_profile_msgs_${profileId}`;
    try {
        const msgs = localStorage.getItem(key);
        if (msgs) {
            state.messages = JSON.parse(msgs);
            // 同步到全局消息存储
            localStorage.setItem('gaokao_messages', msgs);
        } else {
            state.messages = [];
            localStorage.setItem('gaokao_messages', '[]');
        }
    } catch (_) {
        state.messages = [];
    }
}

function showProfilesPage() {
    renderProfilesList();
    showPage('profiles');
}

function renderProfilesList() {
    const listEl = document.getElementById('profiles-list');
    const emptyEl = document.getElementById('profiles-empty');
    const formEl = document.getElementById('profile-form-panel');

    formEl.style.display = 'none';

    if (state.profiles.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }

    listEl.style.display = 'block';
    emptyEl.style.display = 'none';

    listEl.innerHTML = state.profiles.map(p => {
        const isActive = p.id === state.currentProfileId;
        const tags = [];
        if (p.year) tags.push(p.year + '年');
        if (p.province) tags.push(p.province);
        if (p.category) tags.push(p.category);
        if (p.score) tags.push(p.score + '分');
        if (p.rank) tags.push('第' + Number(p.rank).toLocaleString() + '名');

        return `
            <div class="profile-card-item ${isActive ? 'active' : ''}" onclick="switchProfile('${p.id}')">
                <div class="profile-card-header">
                    <span class="profile-card-name">${escapeHtml(p.name)}</span>
                    ${isActive ? '<span class="profile-card-active-badge">当前</span>' : ''}
                </div>
                ${tags.length ? `<div class="profile-card-info">${tags.map(t => `<span class="profile-card-tag">${t}</span>`).join('')}</div>` : ''}
                ${p.notes ? `<p style="font-size:13px;color:var(--text-light);margin-top:4px">${escapeHtml(p.notes)}</p>` : ''}
                <div class="profile-card-actions" onclick="event.stopPropagation()">
                    <button onclick="editProfile('${p.id}')">编辑</button>
                    <button class="delete-btn" onclick="deleteProfile('${p.id}')">删除</button>
                </div>
            </div>
        `;
    }).join('');

    // 更新会员页的档案数量
    const badge = document.getElementById('profile-count-badge');
    if (badge) badge.textContent = state.profiles.length;
}

let editingProfileId = null;

function showAddProfileForm(profileId) {
    editingProfileId = profileId || null;
    const formEl = document.getElementById('profile-form-panel');
    const titleEl = document.getElementById('profile-form-title');
    const listEl = document.getElementById('profiles-list');
    const emptyEl = document.getElementById('profiles-empty');

    listEl.style.display = 'none';
    emptyEl.style.display = 'none';
    formEl.style.display = 'block';

    if (profileId) {
        titleEl.textContent = '编辑考生档案';
        const p = state.profiles.find(x => x.id === profileId);
        if (p) {
            document.getElementById('pf-name').value = p.name || '';
            document.getElementById('pf-year').value = p.year || '';
            document.getElementById('pf-province').value = p.province || '';
            document.getElementById('pf-score').value = p.score || '';
            document.getElementById('pf-rank').value = p.rank || '';
            document.getElementById('pf-notes').value = p.notes || '';
            // 刷新科类后设置
            refreshProfileCategoryOptions();
            setTimeout(() => {
                document.getElementById('pf-category').value = p.category || '';
            }, 50);
        }
    } else {
        titleEl.textContent = '新建考生档案';
        document.getElementById('pf-name').value = '';
        document.getElementById('pf-year').value = '';
        document.getElementById('pf-province').value = '';
        document.getElementById('pf-category').value = '';
        document.getElementById('pf-score').value = '';
        document.getElementById('pf-rank').value = '';
        document.getElementById('pf-notes').value = '';
    }

    // 初始化表单里的年份和省份下拉
    initProfileFormSelects();
}

function initProfileFormSelects() {
    const yearSel = document.getElementById('pf-year');
    const provSel = document.getElementById('pf-province');
    if (!yearSel || !provSel) return;

    // 年份下拉（只填充一次）
    if (yearSel.options.length <= 1) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear + 1; y >= 2017; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y + '年';
            yearSel.appendChild(opt);
        }
    }

    // 省份下拉（只填充一次）
    if (provSel.options.length <= 1) {
        PROVINCES.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            provSel.appendChild(opt);
        });
    }
}

function refreshProfileCategoryOptions() {
    const catSel = document.getElementById('pf-category');
    if (!catSel) return;
    const year = parseInt(document.getElementById('pf-year')?.value, 10);
    const prov = document.getElementById('pf-province')?.value;
    catSel.innerHTML = '<option value="">科类</option>';
    if (!prov || !year) return;
    const cats = getCategoriesForYear(prov, year);
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        catSel.appendChild(opt);
    });
}

// 绑定表单联动事件
document.getElementById('pf-year')?.addEventListener('change', refreshProfileCategoryOptions);
document.getElementById('pf-province')?.addEventListener('change', refreshProfileCategoryOptions);

function cancelProfileForm() {
    editingProfileId = null;
    renderProfilesList();
}

function saveProfile() {
    const name = document.getElementById('pf-name').value.trim();
    if (!name) { alert('请输入考生姓名'); return; }

    const data = {
        id: editingProfileId || generateProfileId(),
        name,
        year: document.getElementById('pf-year').value || '',
        province: document.getElementById('pf-province').value || '',
        category: document.getElementById('pf-category').value || '',
        score: document.getElementById('pf-score').value || '',
        rank: document.getElementById('pf-rank').value || '',
        notes: document.getElementById('pf-notes').value.trim(),
        createdAt: editingProfileId
            ? (state.profiles.find(p => p.id === editingProfileId)?.createdAt || new Date().toISOString())
            : new Date().toISOString()
    };

    if (editingProfileId) {
        const idx = state.profiles.findIndex(p => p.id === editingProfileId);
        if (idx >= 0) state.profiles[idx] = data;
    } else {
        state.profiles.push(data);
    }

    saveProfilesToStorage();
    editingProfileId = null;

    // 如果没有当前档案，自动选中新创建的
    if (!state.currentProfileId) {
        switchProfile(data.id);
    }

    renderProfilesList();
}

function editProfile(profileId) {
    showAddProfileForm(profileId);
}

function deleteProfile(profileId) {
    const p = state.profiles.find(x => x.id === profileId);
    if (!p) return;
    if (!confirm(`确定删除考生「${p.name}」的档案？`)) return;

    // 清除该档案的对话记录
    localStorage.removeItem(`gaokao_profile_msgs_${profileId}`);

    state.profiles = state.profiles.filter(x => x.id !== profileId);
    saveProfilesToStorage();

    // 如果删除的是当前档案，切换到第一个或清空
    if (state.currentProfileId === profileId) {
        if (state.profiles.length > 0) {
            switchProfile(state.profiles[0].id);
        } else {
            state.currentProfileId = null;
            localStorage.removeItem('gaokao_current_profile');
            state.messages = [];
            state.usageCount = 0;
            localStorage.setItem('gaokao_messages', '[]');
            localStorage.setItem('gaokao_usage_count', '0');
            resetHomePanel();
        }
    }

    renderProfilesList();
}

function switchProfile(profileId) {
    if (state.userRole !== 'institution') return;

    // 保存当前档案的对话记录
    if (state.currentProfileId && state.currentProfileId !== profileId) {
        saveProfileMessages(state.currentProfileId);
    }

    state.currentProfileId = profileId;
    localStorage.setItem('gaokao_current_profile', profileId);

    // 加载新档案的对话记录
    loadProfileMessages(profileId);
    state.usageCount = 0;

    // 应用档案信息到首页面板
    const p = state.profiles.find(x => x.id === profileId);
    if (p) {
        if (p.year) {
            state.year = parseInt(p.year, 10);
            localStorage.setItem('gaokao_year', state.year);
            if (quickYearSelect) quickYearSelect.value = state.year;
        }
        if (p.province) {
            state.province = p.province;
            localStorage.setItem('gaokao_province', state.province);
            if (quickProvinceSelect) quickProvinceSelect.value = state.province;
        }
        if (p.category) {
            state.category = p.category;
            localStorage.setItem('gaokao_category', state.category);
        }
        refreshCategoryOptions();
        // 如果有缓存的科类，延迟设置
        if (p.category && quickCategorySelect) {
            setTimeout(() => { quickCategorySelect.value = p.category; }, 50);
        }

        // 填入分数和位次（不持久化，只在输入框中显示）
        const scoreInput = document.getElementById('quick-score');
        const rankInput = document.getElementById('quick-rank');
        if (scoreInput) scoreInput.value = p.score || '';
        if (rankInput) rankInput.value = p.rank || '';
    }

    updateProfileSwitcherUI();
    updateUsageUI();

    // 更新首页问候语
    const greetEl = document.getElementById('greeting-text');
    if (greetEl && p) greetEl.textContent = `Hi，${p.name}`;

    console.log('切换考生档案:', p?.name);
    // 如果在 profiles 页面，刷新列表
    const profilesPage = document.getElementById('profiles-page');
    if (profilesPage?.classList.contains('active')) {
        renderProfilesList();
    }
}

function updateProfileSwitcherUI() {
    const switcher = document.getElementById('profile-switcher');
    const select = document.getElementById('profile-select');
    if (!switcher || !select) return;

    if (state.userRole !== 'institution') {
        switcher.style.display = 'none';
        return;
    }

    switcher.style.display = 'block';
    select.innerHTML = state.profiles.map(p =>
        `<option value="${p.id}" ${p.id === state.currentProfileId ? 'selected' : ''}>${p.name}${p.province ? ' · ' + p.province : ''}${p.year ? ' · ' + p.year + '年' : ''}</option>`
    ).join('');
}

function resetHomePanel() {
    const greetEl = document.getElementById('greeting-text');
    if (greetEl) greetEl.textContent = 'Hi，机构用户';
    const statusEl = document.getElementById('user-status-text');
    if (statusEl) statusEl.textContent = '请选择或新建考生档案';
    updateProfileSwitcherUI();
    updateUsageUI();
}

function updateMemberRoleUI() {
    const roleEl = document.getElementById('member-role-text');
    const avatarEl = document.getElementById('member-avatar');
    const vipEl = document.getElementById('home-vip-badge');
    const instSection = document.getElementById('institution-section');

    if (!roleEl) return;

    if (state.userRole === 'institution') {
        roleEl.textContent = '志愿填报机构';
        if (avatarEl) avatarEl.textContent = '🏢';
        if (vipEl) vipEl.textContent = '机构版';
        if (instSection) instSection.style.display = 'block';
    } else {
        roleEl.textContent = '免费体验版';
        if (avatarEl) avatarEl.textContent = '👤';
        if (vipEl) vipEl.textContent = '免费体验';
        if (instSection) instSection.style.display = 'none';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── 初始化 ──────────────────────────────────────────────
function init() {
    restoreState();
    initYearSelect();
    initProvinceSelect();
    // 初始化后刷新科类选项（依赖年份和省份）
    refreshCategoryOptions();
    restoreMbti();

    // MBTI "测一测"按钮
    document.getElementById('mbti-test-btn')?.addEventListener('click', startMbtiTest);

    // MBTI 手动输入：用户填入4个字母后自动保存
    const mbtiInput = document.getElementById('quick-mbti');
    mbtiInput?.addEventListener('blur', () => {
        const val = mbtiInput.value.trim().toUpperCase();
        if (val && /^[EI][SN][TF][JP]$/.test(val) && MBTI_TYPES[val]) {
            const info = MBTI_TYPES[val];
            state.mbti = { type: val, name: info.name, tags: info.tags, majors: info.majors, desc: info.desc };
            localStorage.setItem('gaokao_mbti', JSON.stringify(state.mbti));
            updateMbtiQuickPanel();
            console.log('MBTI 手动设置:', val, info.name);
        } else if (val) {
            mbtiInput.value = '';
            mbtiInput.placeholder = '格式如 INTJ';
        }
    });

    // MBTI 结果行点击可重新测试
    document.getElementById('mbti-result-row')?.addEventListener('click', startMbtiTest);

    // 角色初始化：有角色才跳过角色选择页
    if (state.userRole && localStorage.getItem('gaokao_role')) {
        // 有角色，检查是否已登录
        const savedUser = localStorage.getItem('gaokao_user');
        if (savedUser) {
            try {
                state.user = JSON.parse(savedUser);
                state.isLoggedIn = true;
                updateUserUI();

                // 机构模式：恢复当前档案
                if (state.userRole === 'institution') {
                    updateProfileSwitcherUI();
                    if (state.currentProfileId) {
                        const p = state.profiles.find(x => x.id === state.currentProfileId);
                        if (p) {
                            loadProfileMessages(state.currentProfileId);
                            const greetEl = document.getElementById('greeting-text');
                            if (greetEl) greetEl.textContent = `Hi，${p.name}`;
                        }
                    } else if (state.profiles.length > 0) {
                        // 没有当前档案但有档案列表，自动选第一个
                        switchProfile(state.profiles[0].id);
                    }
                }

                showPage('home');
            } catch (_) {}
        } else {
            // 有角色但未登录，显示登录页
            showPage('login');
        }
        updateMemberRoleUI();
    }
    // 没有 gaokao_role，停留在 role-page（默认 active）

    updateUsageUI();
    console.log('高报专家 H5 初始化完成');
}

init();
