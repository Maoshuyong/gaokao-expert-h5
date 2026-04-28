// 专业库数据 - 13个学科门类
const MAJOR_CATEGORIES = [
    {
        id: 'philosophy',
        name: '哲学',
        icon: '🧠',
        desc: '探索人生根本问题的学科',
        majors: [
            { name: '哲学', core: ['哲学概论', '中国哲学史', '西方哲学史'], career: ['高校教师', '科研机构', '党政机关'] },
            { name: '逻辑学', core: ['数理逻辑', '形式逻辑', '批判性思维'], career: ['数据分析', '人工智能', '法律推理'] },
            { name: '宗教学', core: ['宗教史', '宗教哲学', '比较宗教学'], career: ['文化研究', '博物馆', '社科研究'] }
        ]
    },
    {
        id: 'economics',
        name: '经济学',
        icon: '📊',
        desc: '研究资源配置与社会生产',
        majors: [
            { name: '经济学', core: ['微观经济学', '宏观经济学', '计量经济学'], career: ['金融机构', '政府经济部门', '咨询公司'] },
            { name: '金融学', core: ['货币银行学', '证券投资', '公司金融'], career: ['银行', '证券公司', '投资基金'] },
            { name: '国际经济与贸易', core: ['国际贸易', '国际金融', '跨境电商'], career: ['外贸企业', '跨国公司的', '政府机构'] }
        ]
    },
    {
        id: 'law',
        name: '法学',
        icon: '⚖️',
        desc: '研究法律现象及其规律的学科',
        majors: [
            { name: '法学', core: ['宪法', '民法', '刑法', '行政法'], career: ['律师', '法官', '检察官', '企业法务'] },
            { name: '社会学', core: ['社会学理论', '社会调查方法', '社会统计学'], career: ['社会工作', '市场研究', '公共管理'] }
        ]
    },
    {
        id: 'education',
        name: '教育学',
        icon: '📚',
        desc: '研究教育现象和教育问题',
        majors: [
            { name: '教育学', core: ['教育原理', '教育心理学', '课程与教学论'], career: ['中小学教师', '教育管理', '教育咨询'] },
            { name: '学前教育', core: ['儿童发展心理学', '幼儿园课程', '幼儿游戏理论'], career: ['幼儿园教师', '早教机构', '儿童出版'] }
        ]
    },
    {
        id: 'literature',
        name: '文学',
        icon: '✍️',
        desc: '研究语言文字与文学作品',
        majors: [
            { name: '汉语言文学', core: ['古代汉语', '现代汉语', '中国古代文学'], career: ['教师', '编辑', '文案策划', '公务员'] },
            { name: '新闻学', core: ['新闻理论', '新闻采访与写作', '新闻编辑'], career: ['记者', '编辑', '新媒体运营', '公关'] },
            { name: '英语', core: ['综合英语', '英语阅读', '英语写作'], career: ['翻译', '外贸', '英语教师', '跨国公司的'] }
        ]
    },
    {
        id: 'history',
        name: '历史学',
        icon: '🏛️',
        desc: '研究人类社会历史的学科',
        majors: [
            { name: '历史学', core: ['中国古代史', '世界近代史', '史学理论'], career: ['教师', '博物馆', '档案馆', '文化单位'] }
        ]
    },
    {
        id: 'science',
        name: '理学',
        icon: '🔬',
        desc: '研究自然物质形态与规律',
        majors: [
            { name: '数学与应用数学', core: ['数学分析', '高等代数', '概率论'], career: ['教师', '金融', '数据分析', 'IT'] },
            { name: '物理学', core: ['力学', '电磁学', '量子力学'], career: ['科研院所', '高校', '高新技术企业'] },
            { name: '化学', core: ['无机化学', '有机化学', '分析化学'], career: ['化工企业', '制药公司', '检验机构'] },
            { name: '生物科学', core: ['细胞生物学', '遗传学', '生态学'], career: ['生物医药', '农业科研', '环保'] }
        ]
    },
    {
        id: 'engineering',
        name: '工学',
        icon: '⚙️',
        desc: '应用科学原理解决实际问题',
        majors: [
            { name: '计算机科学与技术', core: ['数据结构', '操作系统', '计算机网络'], career: ['软件工程师', '系统架构师', 'AI研发'] },
            { name: '电子信息工程', core: ['电路分析', '信号与系统', '通信原理'], career: ['电子产品研发', '通信系统', '芯片设计'] },
            { name: '机械工程', core: ['机械制图', '材料力学', '机械设计'], career: ['机械设计', '制造工程师', '自动化'] },
            { name: '土木工程', core: ['结构力学', '土力学', '混凝土设计'], career: ['建筑工程师', '结构工程师', '工程管理'] }
        ]
    },
    {
        id: 'agriculture',
        name: '农学',
        icon: '🌾',
        desc: '研究农业生产与科学',
        majors: [
            { name: '农学', core: ['作物栽培学', '作物育种学', '植物保护'], career: ['农业技术推广', '种子公司', '农场管理'] }
        ]
    },
    {
        id: 'medical',
        name: '医学',
        icon: '🏥',
        desc: '研究生命现象与疾病防治',
        majors: [
            { name: '临床医学', core: ['人体解剖学', '病理学', '内科学', '外科学'], career: ['医生', '医学研究', '公共卫生'] },
            { name: '药学', core: ['药物化学', '药理学', '药剂学'], career: ['制药企业', '医院药剂科', '药品监管'] },
            { name: '护理学', core: ['基础护理学', '内科护理', '外科护理'], career: ['护士', '护理管理', '健康教育'] }
        ]
    },
    {
        id: 'military',
        name: '军事学',
        icon: '🎖️',
        desc: '研究战争规律与国防建设',
        majors: [
            { name: '军事思想及军事历史', core: ['军事思想', '军事历史', '战略学'], career: ['军队指挥', '军事科研', '国防工业'] }
        ]
    },
    {
        id: 'management',
        name: '管理学',
        icon: '📋',
        desc: '研究管理活动规律与方法',
        majors: [
            { name: '工商管理', core: ['管理学原理', '市场营销', '人力资源管理'], career: ['企业管理者', '管理咨询', '创业'] },
            { name: '会计学', core: ['财务会计', '管理会计', '审计学'], career: ['会计师', '审计师', '财务分析师'] },
            { name: '公共管理', core: ['公共管理学', '公共政策分析', '行政法学'], career: ['公务员', 'NGO管理', '政策研究'] }
        ]
    },
    {
        id: 'arts',
        name: '艺术学',
        icon: '🎨',
        desc: '研究艺术创作与审美规律',
        majors: [
            { name: '音乐表演', core: ['声乐', '器乐', '舞台表演'], career: ['音乐家', '音乐教师', '艺术团体'] },
            { name: '美术学', core: ['素描', '色彩', '艺术概论'], career: ['画家', '美术教师', '艺术设计'] },
            { name: '设计学', core: ['设计概论', '色彩学', '计算机辅助设计'], career: ['平面设计', 'UI设计', '产品设计'] }
        ]
    }
];

// 根据MBTI类型推荐专业
function recommendMajorsByMBTI(mbtiType) {
    if (!mbtiType) return [];
    
    const recommendations = {
        'INTJ': ['计算机科学与技术', '金融学', '数学与应用数学', '物理学'],
        'INTP': ['计算机科学与技术', '哲学', '物理学', '数学与应用数学'],
        'ENTJ': ['工商管理', '金融学', '经济学', '公共管理'],
        'ENTP': ['金融学', '工商管理', '新闻学', '设计学'],
        'INFJ': ['心理学', '教育学', '社会学', '哲学'],
        'INFP': ['文学', '心理学', '艺术设计', '社会学'],
        'ENFJ': ['教育学', '公共管理', '新闻学', '社会学'],
        'ENFP': ['新闻学', '艺术设计', '心理学', '社会学'],
        'ISTJ': ['会计学', '法学', '计算机科学与技术', '数学与应用数学'],
        'ISFJ': ['会计学', '护理学', '学前教育', '汉语言文学'],
        'ESTJ': ['工商管理', '会计学', '金融学', '公共管理'],
        'ESFJ': ['学前教育', '护理学', '公共管理', '汉语言文学'],
        'ISTP': ['电子信息工程', '机械工程', '计算机科学与技术', '物理学'],
        'ISFP': ['设计学', '美术学', '音乐表演', '护理学'],
        'ESTP': ['金融学', '工商管理', '电子信息工程', '机械工程'],
        'ESFP': ['新闻学', '音乐表演', '设计学', '体育教育']
    };
    
    return recommendations[mbtiType] || [];
}

// 搜索专业
function searchMajors(keyword) {
    const results = [];
    const kw = keyword.toLowerCase();
    
    MAJOR_CATEGORIES.forEach(category => {
        category.majors.forEach(major => {
            if (major.name.toLowerCase().includes(kw) ||
                category.name.toLowerCase().includes(kw)) {
                results.push({
                    category: category.name,
                    icon: category.icon,
                    ...major
                });
            }
        });
    });
    
    return results;
}

// ============ 渲染函数 ============

// 渲染学科门类列表
function renderMajorCategories() {
    const container = document.getElementById('major-categories');
    if (!container) return;
    
    container.innerHTML = MAJOR_CATEGORIES.map(cat => `
        <div class="major-category" onclick="showMajorCategory('${cat.id}')">
            <div class="major-category-icon">${cat.icon}</div>
            <div class="major-category-name">${cat.name}</div>
            <div class="major-category-desc">${cat.desc}</div>
            <div class="major-category-majors">
                ${cat.majors.slice(0, 3).map(m => `<span class="major-tag">${m.name}</span>`).join('')}
                ${cat.majors.length > 3 ? `<span class="major-tag">+${cat.majors.length - 3}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// 显示某个学科门类下的专业列表
function showMajorCategory(categoryId) {
    const category = MAJOR_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;
    
    const detailEl = document.getElementById('major-detail');
    const nameEl = document.getElementById('major-detail-name');
    const bodyEl = document.getElementById('major-detail-body');
    
    if (!detailEl || !nameEl || !bodyEl) return;
    
    nameEl.textContent = `${category.icon} ${category.name}`;
    bodyEl.innerHTML = category.majors.map(m => `
        <div class="major-detail-section">
            <h4>${m.name}</h4>
            <div style="margin:8px 0;color:var(--text-light);font-size:13px;">
                <strong>核心课程：</strong>${m.core.join('、')}
            </div>
            <div style="color:var(--text-light);font-size:13px;">
                <strong>就业方向：</strong>${m.career.join('、')}
            </div>
        </div>
    `).join('');
    
    detailEl.style.display = 'block';
}

// 隐藏专业详情，回到列表
function hideMajorDetail() {
    const detailEl = document.getElementById('major-detail');
    if (detailEl) detailEl.style.display = 'none';
}

// 切换搜索栏显示/隐藏
function toggleMajorSearch() {
    const searchEl = document.getElementById('major-search');
    if (!searchEl) return;
    
    if (searchEl.style.display === 'none') {
        searchEl.style.display = 'block';
        document.getElementById('major-search-input').focus();
    } else {
        searchEl.style.display = 'none';
        document.getElementById('major-search-input').value = '';
        renderMajorCategories(); // 恢复显示所有门类
    }
}

// 根据关键词过滤专业
function filterMajors(keyword) {
    if (!keyword || keyword.trim() === '') {
        renderMajorCategories();
        return;
    }
    
    const results = searchMajors(keyword);
    const container = document.getElementById('major-categories');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">未找到相关专业</div>';
        return;
    }
    
    container.innerHTML = results.map(item => `
        <div class="major-category" onclick="showMajorDetail('${item.name}')">
            <div class="major-category-icon">${item.icon}</div>
            <div class="major-category-name">${item.name}</div>
            <div class="major-category-desc">${item.category}</div>
            <div class="major-detail-section" style="margin-top:8px;">
                <div style="font-size:13px;color:var(--text-light);">
                    <strong>核心课程：</strong>${item.core.join('、')}
                </div>
                <div style="font-size:13px;color:var(--text-light);margin-top:4px;">
                    <strong>就业方向：</strong>${item.career.join('、')}
                </div>
            </div>
        </div>
    `).join('');
}

// 显示专业详情（从搜索结果点击）
function showMajorDetail(majorName) {
    let found = null;
    let foundCategory = null;
    
    MAJOR_CATEGORIES.forEach(cat => {
        cat.majors.forEach(m => {
            if (m.name === majorName) {
                found = m;
                foundCategory = cat;
            }
        });
    });
    
    if (!found) return;
    
    const detailEl = document.getElementById('major-detail');
    const nameEl = document.getElementById('major-detail-name');
    const bodyEl = document.getElementById('major-detail-body');
    
    if (!detailEl || !nameEl || !bodyEl) return;
    
    nameEl.textContent = `${foundCategory.icon} ${found.name}`;
    bodyEl.innerHTML = `
        <div class="major-detail-section">
            <h4>核心课程</h4>
            <ul>${found.core.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
        <div class="major-detail-section">
            <h4>就业方向</h4>
            <ul>${found.career.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
        <div class="major-detail-section">
            <h4>所属门类</h4>
            <p>${foundCategory.name} ${foundCategory.icon}</p>
        </div>
    `;
    
    detailEl.style.display = 'block';
}

// 页面初始化时渲染学科门类列表
document.addEventListener('DOMContentLoaded', () => {
    renderMajorCategories();
});
