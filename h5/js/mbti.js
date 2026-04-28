// MBTI 测试模块 - 28题精简版（每维度7题）
// 四维度：E/I（外向/内向）、S/N（感觉/直觉）、T/F（思考/情感）、J/P（判断/感知）

const MBTI_QUESTIONS = [
    // ─── E/I 维度（7题）───
    { q: '参加一个有很多陌生人的聚会，你会？', a: '主动和陌生人聊天，结交新朋友', b: '找认识的人待在一起，或者安静观察', dim: 'EI' },
    { q: '周末你更倾向于？', a: '和朋友出去玩，参加活动', b: '一个人在家看书、打游戏或追剧', dim: 'EI' },
    { q: '做决定时你更喜欢？', a: '和别人讨论后再决定', b: '自己想清楚再决定', dim: 'EI' },
    { q: '在团队中你通常是？', a: '活跃发言者，喜欢主导讨论', b: '安静倾听者，思考后再发言', dim: 'EI' },
    { q: '长时间独处后你会？', a: '感到无聊，想找人说说话', b: '享受独处的时光，觉得很充实', dim: 'EI' },
    { q: '学习新东西时你更喜欢？', a: '小组讨论、头脑风暴', b: '自己查资料研究', dim: 'EI' },
    { q: '你的朋友圈通常是？', a: '朋友很多，各种圈子都有', b: '几个知心好友就够了', dim: 'EI' },

    // ─── S/N 维度（7题）───
    { q: '你更关注？', a: '具体的事实和细节', b: '整体的规律和可能性', dim: 'SN' },
    { q: '看一本书时你更在意？', a: '故事的具体情节和描写', b: '故事背后的深层含义和主题', dim: 'SN' },
    { q: '你更喜欢哪类问题？', a: '有明确答案、有标准解法的问题', b: '开放性问题，可以多角度思考', dim: 'SN' },
    { q: '描述一件事时你倾向于？', a: '按照时间顺序，详细说过程', b: '先说结论和重点，跳过细节', dim: 'SN' },
    { q: '你认为更重要的是？', a: '实践经验和已验证的方法', b: '创新想法和理论可能性', dim: 'SN' },
    { q: '对于未来你更倾向于？', a: '关注当前能确定的事情', b: '畅想各种可能的未来', dim: 'SN' },
    { q: '你更喜欢哪类工作？', a: '按部就班、有明确流程的', b: '灵活多变、充满新挑战的', dim: 'SN' },

    // ─── T/F 维度（7题）───
    { q: '做重要决定时你更依赖？', a: '逻辑分析和客观事实', b: '内心感受和价值观', dim: 'TF' },
    { q: '朋友之间发生矛盾你会？', a: '帮理不帮亲，客观分析谁对谁错', b: '先安慰双方情绪，再看怎么调和', dim: 'TF' },
    { q: '你认为好的决定应该？', a: '理性、高效、符合逻辑', b: '照顾到所有相关者的感受', dim: 'TF' },
    { q: '面对批评时你更在意？', a: '批评的内容是否合理客观', b: '对方的态度和语气', dim: 'TF' },
    { q: '选择专业时你更看重？', a: '就业前景和薪资水平', b: '是否真正感兴趣和有热情', dim: 'TF' },
    { q: '你更容易被什么打动？', a: '精妙的论证和严密的推理', b: '真挚的情感和动人的故事', dim: 'TF' },
    { q: '工作中你更在意？', a: '效率和成果', b: '团队氛围和人际关系', dim: 'TF' },

    // ─── J/P 维度（7题）───
    { q: '你的书桌/房间通常？', a: '整齐有序，东西各有各的位置', b: '有点乱但我知道东西在哪', dim: 'JP' },
    { q: '面对截止日期你通常？', a: '提前完成，留出缓冲时间', b: '最后时刻冲刺完成', dim: 'JP' },
    { q: '出去旅行你更倾向于？', a: '提前做好详细攻略和计划', b: '到了再说，随机应变更有趣', dim: 'JP' },
    { q: '你更喜欢？', a: '确定感和可预见性', b: '灵活性和变化的可能性', dim: 'JP' },
    { q: '面对突发变化你通常？', a: '感到不适，希望回到计划轨道', b: '适应很快，觉得变化也挺好', dim: 'JP' },
    { q: '你觉得规则应该？', a: '严格遵守，规则就是规则', b: '灵活对待，特殊情况可以变通', dim: 'JP' },
    { q: '你的生活方式更接近？', a: '规律作息，每天有固定节奏', b: '随心所欲，不同天可以很不一样', dim: 'JP' },
];

// 16种MBTI类型描述
const MBTI_TYPES = {
    'INTJ': { name: '建筑师', tags: ['战略思维', '独立', '追求卓越'], majors: '计算机科学、人工智能、数学、物理学、法学、金融工程', desc: '天生的战略家，善于制定长远计划。喜欢深入思考复杂问题，追求效率和最优解。独立自主，对自己和他人都有很高标准。' },
    'INTP': { name: '逻辑学家', tags: ['分析能力', '好奇', '创新'], majors: '计算机科学、哲学、数学、心理学、数据科学', desc: '热衷于探索理论和抽象概念，喜欢追问"为什么"。思维灵活，能发现别人忽略的逻辑漏洞。对感兴趣的事可以极度专注。' },
    'ENTJ': { name: '指挥官', tags: ['领导力', '高效', '目标导向'], majors: '管理学、经济学、法学、金融、工商管理', desc: '天生的领导者，善于整合资源和推动项目前进。果断高效，对目标有清晰规划。喜欢挑战，不怕承担责任。' },
    'ENTP': { name: '辩论家', tags: ['创新', '机智', '多面手'], majors: '新闻传播、市场营销、创业管理、产品设计', desc: '思维活跃的点子大王，善于从不同角度看问题。喜欢辩论和挑战传统观念。适应力极强，兴趣广泛但不持久。' },
    'INFJ': { name: '提倡者', tags: ['理想主义', '洞察力', '利他'], majors: '心理学、教育学、社会工作、临床医学、文学', desc: '最有洞察力的类型，能敏锐感知他人情感。有强烈的理想主义和使命感，希望让世界变得更好。内心世界丰富而深刻。' },
    'INFP': { name: '调停者', tags: ['理想主义', '创造力', '共情'], majors: '文学、艺术设计、心理学、社会工作、哲学', desc: '安静的理想主义者，内心有着丰富的想象力和强烈的价值观。追求真实和意义，对艺术和创造有天生的热情。' },
    'ENFJ': { name: '主人公', tags: ['感染力', '关怀', '领导力'], majors: '教育学、人力资源管理、公共关系、临床心理学', desc: '天生的激励者，善于激发他人的潜力。对他人的情感有着极高的敏感度，善于创造和谐的氛围。有强烈的责任感和使命感。' },
    'ENFP': { name: '竞选者', tags: ['热情', '创造力', '社交'], majors: '新闻传播、广告学、公共关系、旅游管理', desc: '充满热情和创造力的社交达人，善于发现生活中的可能性。对新鲜事物充满好奇，能感染周围的人。需要自由和变化。' },
    'ISTJ': { name: '物流师', tags: ['可靠', '务实', '有条理'], majors: '会计学、土木工程、计算机、药学、机械工程', desc: '最可靠的责任承担者，做事一丝不苟。重视传统和规则，有极强的责任心和执行力。是团队中不可或缺的稳定力量。' },
    'ISFJ': { name: '守卫者', tags: ['温暖', '勤勉', '忠诚'], majors: '护理学、教育学、会计学、人力资源管理、药学', desc: '温暖而默默奉献的守护者，对承诺的事情会全力以赴。注重细节，善于照顾他人感受。是最可靠的朋友和伙伴。' },
    'ESTJ': { name: '总经理', tags: ['组织力', '果断', '务实'], majors: '工商管理、会计学、法学、土木工程、项目管理', desc: '天生的组织者和管理者，善于建立秩序和推动执行。重视效率和结果，对工作和家庭都有强烈的责任感。直率果断。' },
    'ESFJ': { name: '执政官', tags: ['社交', '关怀', '合作'], majors: '护理学、教育学、酒店管理、社会工作、人力资源管理', desc: '最有社交天赋的类型，善于营造和谐氛围。关心他人需求，乐于助人。在团队中是凝聚力的来源。重视传统和社会规范。' },
    'ISTP': { name: '鉴赏家', tags: ['动手能力', '冷静', '灵活'], majors: '机械工程、电子工程、计算机、汽车工程、航空', desc: '冷静务实的行动派，善于用双手解决问题。对机械和技术有天生的直觉。独立自主，喜欢自由，不喜被约束。' },
    'ISFP': { name: '探险家', tags: ['艺术感', '温和', '自由'], majors: '视觉传达设计、环境设计、音乐、摄影、手工艺', desc: '安静而有艺术气质的自由灵魂。活在当下，善于发现生活中的美。温和友善但不喜争辩，追求内心的和谐与真实。' },
    'ESTP': { name: '企业家', tags: ['行动力', '冒险', '应变'], majors: '市场营销、体育管理、金融、销售管理', desc: '充满行动力的冒险家，善于在压力下做出快速决策。喜欢挑战和刺激，对现实有着敏锐的洞察力。社交能力强，适应力极强。' },
    'ESFP': { name: '表演者', tags: ['活力', '乐观', '表现力'], majors: '表演艺术、旅游管理、酒店管理、活动策划、运动训练', desc: '天生的表演者和氛围制造者。乐观热情，善于享受生活。是聚会的灵魂人物，能让周围的人都感到快乐。活在当下。' },
};

// 测试状态
let mbtiState = {
    currentQ: 0,
    scores: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
};

// 开始/重新开始测试
function startMbtiTest() {
    mbtiState = { currentQ: 0, scores: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 } };
    document.getElementById('mbti-question-area').style.display = '';
    document.getElementById('mbti-result-area').style.display = 'none';
    showPage('mbti');
    renderMbtiQuestion();
}

// 渲染当前题目
function renderMbtiQuestion() {
    const q = MBTI_QUESTIONS[mbtiState.currentQ];
    const total = MBTI_QUESTIONS.length;
    const progress = ((mbtiState.currentQ + 1) / total * 100).toFixed(1);

    document.getElementById('mbti-step-text').textContent = `${mbtiState.currentQ + 1}/${total}`;
    document.getElementById('mbti-progress-fill').style.width = progress + '%';
    document.getElementById('mbti-question').textContent = q.q;
    document.getElementById('mbti-opt-a').textContent = q.a;
    document.getElementById('mbti-opt-b').textContent = q.b;
}

// 选择答案
function answerMbti(isA) {
    const q = MBTI_QUESTIONS[mbtiState.currentQ];
    const dim = q.dim;

    if (isA) {
        mbtiState.scores[dim[0]]++;
    } else {
        mbtiState.scores[dim[1]]++;
    }

    mbtiState.currentQ++;

    if (mbtiState.currentQ >= MBTI_QUESTIONS.length) {
        showMbtiResult();
    } else {
        // 添加过渡动画
        const area = document.getElementById('mbti-question-area');
        area.style.opacity = '0';
        area.style.transform = 'translateX(30px)';
        setTimeout(() => {
            renderMbtiQuestion();
            area.style.transition = 'all 0.3s ease';
            area.style.opacity = '1';
            area.style.transform = 'translateX(0)';
        }, 150);
    }
}

// 计算并展示结果
function showMbtiResult() {
    const s = mbtiState.scores;
    const type = `${s.E >= s.I ? 'E' : 'I'}${s.S >= s.N ? 'S' : 'N'}${s.T >= s.F ? 'T' : 'F'}${s.J >= s.P ? 'J' : 'P'}`;
    const info = MBTI_TYPES[type];

    // 保存结果
    localStorage.setItem('gaokao_mbti', JSON.stringify({ type, name: info.name, tags: info.tags, majors: info.majors, desc: info.desc }));
    state.mbti = { type, name: info.name, tags: info.tags, majors: info.majors, desc: info.desc };

    // 隐藏题目，显示结果
    document.getElementById('mbti-question-area').style.display = 'none';
    document.getElementById('mbti-result-area').style.display = '';
    document.getElementById('mbti-progress-fill').style.width = '100%';

    // 填充结果
    document.getElementById('mbti-result-type').textContent = type;
    document.getElementById('mbti-result-nickname').textContent = `"${info.name}"`;
    document.getElementById('mbti-result-tags').innerHTML = info.tags.map(t => `<span class="mbti-tag">${t}</span>`).join('');
    document.getElementById('mbti-result-detail').textContent = info.desc;
    document.getElementById('mbti-result-majors-text').textContent = info.majors;

    // 更新首页 MBTI 显示
    updateMbtiQuickPanel();
}

// 重新测试
function restartMbti() {
    startMbtiTest();
}

// 确认结果并进入对话
function confirmMbtiResult() {
    showPage('chat');
    const info = state.mbti;
    if (info) {
        const msg = `我的MBTI测试结果是 ${info.type}（${info.name}），性格特点：${info.tags.join('、')}`;
        setTimeout(() => dispatchMessage(msg), 300);
    }
}

// 更新首页 MBTI 快速面板显示
function updateMbtiQuickPanel() {
    const resultRow = document.getElementById('mbti-result-row');
    const inputRow = document.getElementById('mbti-input-row');
    const badge = document.getElementById('mbti-badge-display');
    const desc = document.getElementById('mbti-desc-display');

    if (state.mbti) {
        resultRow.style.display = '';
        inputRow.style.display = 'none';
        badge.textContent = state.mbti.type;
        desc.textContent = `${state.mbti.name} · ${state.mbti.tags.slice(0, 2).join('/')}`;
    } else {
        resultRow.style.display = 'none';
        inputRow.style.display = '';
    }
}

// 恢复保存的 MBTI 结果
function restoreMbti() {
    try {
        const saved = localStorage.getItem('gaokao_mbti');
        if (saved) {
            state.mbti = JSON.parse(saved);
            updateMbtiQuickPanel();
        }
    } catch (_) {}
}
