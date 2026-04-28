const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// ─── 图标工具 ─────────────────────────────────────────
function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// ─── 调色板：Teal Trust ──────────────────────────────
const C = {
  primary:   "028090",  // teal
  secondary: "00A896",  // seafoam
  accent:    "02C39A",  // mint
  dark:      "0A1628",  // 深蓝黑
  mid:       "1B3A4B",  // 深青
  light:     "F0F7F4",  // 薄荷白
  white:     "FFFFFF",
  gray:      "64748B",
  lightGray: "E2E8F0",
  orange:    "F97316",
  red:       "EF4444",
  yellow:    "EAB308",
};

const makeShadow = () => ({
  type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.12
});

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "小鹅";
  pres.title = "高考志愿填报专家 H5 — 项目介绍";

  // 预加载图标
  const { FaGraduationCap, FaRobot, FaCloud, FaMobileAlt, FaChartLine, FaDatabase, FaCogs, FaRocket, FaUsers, FaLock, FaGlobe, FaBullseye } = require("react-icons/fa");
  const { MdSchool } = require("react-icons/md");

  const icons = {};
  const iconList = [
    ["graduation", FaGraduationCap, C.primary],
    ["robot", FaRobot, C.accent],
    ["cloud", FaCloud, C.secondary],
    ["mobile", FaMobileAlt, C.primary],
    ["chart", FaChartLine, C.orange],
    ["database", FaDatabase, C.primary],
    ["cogs", FaCogs, C.secondary],
    ["rocket", FaRocket, C.orange],
    ["users", FaUsers, C.primary],
    ["lock", FaLock, C.red],
    ["globe", FaGlobe, C.accent],
    ["bullseye", FaBullseye, C.orange],
    ["school", MdSchool, C.white],
  ];
  for (const [name, comp, color] of iconList) {
    icons[name] = await iconToBase64Png(comp, `#${color}`, 256);
  }

  // ═══════════════════════════════════════════════════
  // Slide 1: 封面
  // ═══════════════════════════════════════════════════
  const s1 = pres.addSlide();
  s1.background = { color: C.dark };
  // 装饰条
  s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.accent } });
  s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.accent } });

  // 图标
  s1.addImage({ data: icons.school, x: 4.4, y: 0.6, w: 1.2, h: 1.2 });

  s1.addText("高考志愿填报专家 H5", {
    x: 0.5, y: 1.9, w: 9, h: 0.8,
    fontSize: 38, fontFace: "Arial Black", color: C.white, align: "center", margin: 0,
  });
  s1.addText("AI-Powered College Application Advisor", {
    x: 0.5, y: 2.7, w: 9, h: 0.5,
    fontSize: 16, fontFace: "Arial", color: C.accent, align: "center", margin: 0,
    charSpacing: 2,
  });
  // 分隔线
  s1.addShape(pres.shapes.LINE, { x: 3.5, y: 3.4, w: 3, h: 0, line: { color: C.secondary, width: 1.5 } });
  s1.addText("项目介绍 & 优化方案", {
    x: 0.5, y: 3.6, w: 9, h: 0.5,
    fontSize: 18, fontFace: "Arial", color: C.lightGray, align: "center", margin: 0,
  });
  s1.addText("2026 年 4 月  |  船歌 & 小鹅", {
    x: 0.5, y: 4.6, w: 9, h: 0.4,
    fontSize: 12, fontFace: "Arial", color: C.gray, align: "center", margin: 0,
  });

  // ═══════════════════════════════════════════════════
  // Slide 2: 项目概览
  // ═══════════════════════════════════════════════════
  const s2 = pres.addSlide();
  s2.background = { color: C.white };

  // 标题栏
  s2.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.dark } });
  s2.addImage({ data: icons.graduation, x: 0.5, y: 0.2, w: 0.6, h: 0.6 });
  s2.addText("项目概览", {
    x: 1.3, y: 0.15, w: 8, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "left", margin: 0, valign: "middle",
  });

  // 四个特性卡片
  const cards = [
    { icon: icons.robot, title: "AI 智能对话", desc: "基于大语言模型的苏格拉底式追问，个性化志愿填报指导", color: C.primary },
    { icon: icons.mobile, title: "移动端 H5", desc: "响应式设计，手机/平板即开即用，零安装门槛", color: C.secondary },
    { icon: icons.cloud, title: "云端部署", desc: "Cloudflare Pages 全球 CDN，无需本地服务器", color: C.accent },
    { icon: icons.database, title: "海量数据", desc: "陕西省 10584 条录取数据，覆盖 2022-2024 三年", color: C.primary },
  ];

  cards.forEach((card, i) => {
    const cx = 0.5 + i * 2.35;
    // 卡片背景
    s2.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: 1.4, w: 2.1, h: 3.5,
      fill: { color: C.light }, shadow: makeShadow(),
    });
    // 顶部色条
    s2.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: 1.4, w: 2.1, h: 0.06, fill: { color: card.color },
    });
    // 图标
    s2.addImage({ data: card.icon, x: cx + 0.7, y: 1.7, w: 0.7, h: 0.7 });
    // 标题
    s2.addText(card.title, {
      x: cx + 0.1, y: 2.6, w: 1.9, h: 0.5,
      fontSize: 15, fontFace: "Arial Black", color: C.dark, align: "center", margin: 0,
    });
    // 描述
    s2.addText(card.desc, {
      x: cx + 0.15, y: 3.2, w: 1.8, h: 1.2,
      fontSize: 11, fontFace: "Arial", color: C.gray, align: "center", valign: "top", margin: 0,
    });
  });

  // ═══════════════════════════════════════════════════
  // Slide 3: 技术架构
  // ═══════════════════════════════════════════════════
  const s3 = pres.addSlide();
  s3.background = { color: C.light };

  s3.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.dark } });
  s3.addImage({ data: icons.cogs, x: 0.5, y: 0.2, w: 0.6, h: 0.6 });
  s3.addText("技术架构", {
    x: 1.3, y: 0.15, w: 8, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "left", margin: 0, valign: "middle",
  });

  // 架构流程 - 三层
  const layers = [
    { label: "前端层", sub: "HTML5 + CSS3 + Vanilla JS", color: C.primary, items: ["响应式 UI", "对话持久化 (localStorage)", "登录/会员模块"] },
    { label: "服务层", sub: "Cloudflare Pages Functions", color: C.secondary, items: ["/v1/chat/completions 代理", "系统提示词注入", "流式响应 (SSE)"] },
    { label: "AI 层", sub: "硅基流动 API + DeepSeek-V3", color: C.accent, items: ["大语言模型推理", "6660 字专家提示词", "OpenAI 兼容接口"] },
  ];

  layers.forEach((layer, i) => {
    const ly = 1.3 + i * 1.4;
    // 卡片
    s3.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: ly, w: 9, h: 1.2,
      fill: { color: C.white }, shadow: makeShadow(),
    });
    // 左侧色块
    s3.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: ly, w: 0.1, h: 1.2, fill: { color: layer.color },
    });
    // 标签
    s3.addText(layer.label, {
      x: 0.8, y: ly + 0.1, w: 1.5, h: 0.4,
      fontSize: 16, fontFace: "Arial Black", color: layer.color, align: "left", margin: 0,
    });
    s3.addText(layer.sub, {
      x: 0.8, y: ly + 0.5, w: 2.2, h: 0.4,
      fontSize: 9, fontFace: "Arial", color: C.gray, align: "left", margin: 0,
    });
    // 右侧特性
    layer.items.forEach((item, j) => {
      const ix = 3.5 + j * 2.1;
      s3.addShape(pres.shapes.OVAL, {
        x: ix, y: ly + 0.35, w: 0.15, h: 0.15, fill: { color: layer.color },
      });
      s3.addText(item, {
        x: ix + 0.25, y: ly + 0.28, w: 1.8, h: 0.3,
        fontSize: 11, fontFace: "Arial", color: C.dark, align: "left", margin: 0, valign: "middle",
      });
    });
  });

  // 连接箭头
  [2.5, 3.9].forEach(ay => {
    s3.addShape(pres.shapes.LINE, {
      x: 5, y: ay, w: 0, h: 0.2, line: { color: C.secondary, width: 2, endArrowType: "triangle" },
    });
  });

  // ═══════════════════════════════════════════════════
  // Slide 4: 核心功能
  // ═══════════════════════════════════════════════════
  const s4 = pres.addSlide();
  s4.background = { color: C.white };

  s4.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.dark } });
  s4.addImage({ data: icons.chart, x: 0.5, y: 0.2, w: 0.6, h: 0.6 });
  s4.addText("核心功能", {
    x: 1.3, y: 0.15, w: 8, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "left", margin: 0, valign: "middle",
  });

  const features = [
    { icon: icons.users, title: "苏格拉底式追问", desc: "通过多轮对话深入了解学生成绩、兴趣、性格、家庭背景，而非简单问卷", color: C.primary },
    { icon: icons.bullseye, title: "智能志愿推荐", desc: "基于分数排名、历年数据、家庭情况，生成冲刺/稳妥/保底三档方案", color: C.secondary },
    { icon: icons.globe, title: "专业职业规划", desc: "结合就业倒推法、摆渡人哲学，帮助学生发现真正适合的方向", color: C.accent },
    { icon: icons.database, title: "数据驱动决策", desc: "陕西省 2022-2024 三年录取数据，支持多维度对比分析", color: C.primary },
    { icon: icons.lock, title: "隐私保护", desc: "对话历史仅存本地 localStorage，不上传服务器，保护学生隐私", color: C.secondary },
    { icon: icons.mobile, title: "零门槛使用", desc: "手机浏览器直接访问，无需下载安装，家长学生随时可用", color: C.accent },
  ];

  features.forEach((f, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const fx = 0.5 + col * 4.8;
    const fy = 1.3 + row * 1.35;

    // 卡片
    s4.addShape(pres.shapes.RECTANGLE, {
      x: fx, y: fy, w: 4.5, h: 1.15,
      fill: { color: C.light }, shadow: makeShadow(),
    });
    // 左色块
    s4.addShape(pres.shapes.RECTANGLE, {
      x: fx, y: fy, w: 0.08, h: 1.15, fill: { color: f.color },
    });
    // 图标
    s4.addImage({ data: f.icon, x: fx + 0.25, y: fy + 0.25, w: 0.55, h: 0.55 });
    // 文字
    s4.addText(f.title, {
      x: fx + 1.0, y: fy + 0.1, w: 3.3, h: 0.35,
      fontSize: 13, fontFace: "Arial Black", color: C.dark, align: "left", margin: 0,
    });
    s4.addText(f.desc, {
      x: fx + 1.0, y: fy + 0.5, w: 3.3, h: 0.55,
      fontSize: 10, fontFace: "Arial", color: C.gray, align: "left", valign: "top", margin: 0,
    });
  });

  // ═══════════════════════════════════════════════════
  // Slide 5: 部署架构
  // ═══════════════════════════════════════════════════
  const s5 = pres.addSlide();
  s5.background = { color: C.light };

  s5.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.dark } });
  s5.addImage({ data: icons.globe, x: 0.5, y: 0.2, w: 0.6, h: 0.6 });
  s5.addText("部署架构", {
    x: 1.3, y: 0.15, w: 8, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "left", margin: 0, valign: "middle",
  });

  // 部署对比表
  const tableData = [
    [
      { text: "组件", options: { fill: { color: C.dark }, color: C.white, bold: true, fontFace: "Arial Black", fontSize: 11, align: "center" } },
      { text: "之前（QClaw）", options: { fill: { color: C.dark }, color: C.white, bold: true, fontFace: "Arial Black", fontSize: 11, align: "center" } },
      { text: "现在（Cloudflare）", options: { fill: { color: C.dark }, color: C.white, bold: true, fontFace: "Arial Black", fontSize: 11, align: "center" } },
    ],
    [
      { text: "前端托管", options: { bold: true, fontSize: 10 } },
      { text: "本地 Node.js (8080)", options: { fontSize: 10, color: C.red } },
      { text: "Cloudflare Pages CDN", options: { fontSize: 10, color: C.primary } },
    ],
    [
      { text: "API 代理", options: { bold: true, fontSize: 10 } },
      { text: "本地 server.js → QClaw (28789)", options: { fontSize: 10, color: C.red } },
      { text: "Pages Functions → 硅基流动", options: { fontSize: 10, color: C.primary } },
    ],
    [
      { text: "公网访问", options: { bold: true, fontSize: 10 } },
      { text: "SSH 隧道 (localhost.run)", options: { fontSize: 10, color: C.red } },
      { text: "固定域名 pages.dev", options: { fontSize: 10, color: C.primary } },
    ],
    [
      { text: "可用性", options: { bold: true, fontSize: 10 } },
      { text: "依赖本机开机 + 隧道", options: { fontSize: 10, color: C.red } },
      { text: "99.9% SLA 全球可用", options: { fontSize: 10, color: C.primary } },
    ],
    [
      { text: "成本", options: { bold: true, fontSize: 10 } },
      { text: "QClaw 订阅 + 服务器", options: { fontSize: 10, color: C.gray } },
      { text: "免费（Pages + Functions）", options: { fontSize: 10, color: C.primary } },
    ],
    [
      { text: "LLM 后端", options: { bold: true, fontSize: 10 } },
      { text: "QClaw 内置网关", options: { fontSize: 10, color: C.gray } },
      { text: "硅基流动 DeepSeek-V3", options: { fontSize: 10, color: C.primary } },
    ],
  ];

  s5.addTable(tableData, {
    x: 0.5, y: 1.3, w: 9, colW: [1.5, 3.75, 3.75],
    border: { pt: 0.5, color: C.lightGray },
    rowH: [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45],
    autoPage: false,
  });

  // 优势标签
  s5.addText("✓ 零服务器  ✓ 全球 CDN  ✓ 免费额度  ✓ 固定域名  ✓ API Key 安全", {
    x: 0.5, y: 4.8, w: 9, h: 0.4,
    fontSize: 11, fontFace: "Arial", color: C.primary, align: "center", margin: 0,
    bold: true,
  });

  // ═══════════════════════════════════════════════════
  // Slide 6: 下一步优化方案
  // ═══════════════════════════════════════════════════
  const s6 = pres.addSlide();
  s6.background = { color: C.white };

  s6.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.dark } });
  s6.addImage({ data: icons.rocket, x: 0.5, y: 0.2, w: 0.6, h: 0.6 });
  s6.addText("下一步优化方案", {
    x: 1.3, y: 0.15, w: 8, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "left", margin: 0, valign: "middle",
  });

  const phases = [
    {
      label: "Phase 1", title: "多省份数据扩展", priority: "P0",
      color: C.red,
      items: ["接入更多省份一分一段表和投档线数据", "支持省份切换（下拉选择）", "预计覆盖全国 31 个省份"],
    },
    {
      label: "Phase 2", title: "AI 深度分析报告", priority: "P0",
      color: C.orange,
      items: ["对接 gaokao-agent 后端数据 API", "一键生成完整分析报告（PDF/长图）", "冲稳保院校列表 + 位次趋势图表"],
    },
    {
      label: "Phase 3", title: "用户体验升级", priority: "P1",
      color: C.primary,
      items: ["对话导出（微信分享卡片）", "历史对话管理（多学生档案）", "深色模式 + 字号调节"],
    },
    {
      label: "Phase 4", title: "商业化准备", priority: "P2",
      color: C.secondary,
      items: ["会员付费体系（按次/包月）", "顾问端管理后台", "微信小程序版本"],
    },
  ];

  phases.forEach((phase, i) => {
    const px = 0.4 + i * 2.4;
    // 卡片
    s6.addShape(pres.shapes.RECTANGLE, {
      x: px, y: 1.3, w: 2.2, h: 3.8,
      fill: { color: C.light }, shadow: makeShadow(),
    });
    // 顶部色块
    s6.addShape(pres.shapes.RECTANGLE, {
      x: px, y: 1.3, w: 2.2, h: 0.06, fill: { color: phase.color },
    });
    // 优先级标签
    s6.addShape(pres.shapes.RECTANGLE, {
      x: px + 0.1, y: 1.5, w: 0.5, h: 0.28,
      fill: { color: phase.color },
    });
    s6.addText(phase.priority, {
      x: px + 0.1, y: 1.5, w: 0.5, h: 0.28,
      fontSize: 8, fontFace: "Arial Black", color: C.white, align: "center", valign: "middle", margin: 0,
    });
    // Phase 标签
    s6.addText(phase.label, {
      x: px + 0.7, y: 1.5, w: 1.4, h: 0.28,
      fontSize: 8, fontFace: "Arial", color: C.gray, align: "left", valign: "middle", margin: 0,
    });
    // 标题
    s6.addText(phase.title, {
      x: px + 0.1, y: 1.95, w: 2.0, h: 0.5,
      fontSize: 13, fontFace: "Arial Black", color: C.dark, align: "left", margin: 0,
    });
    // 内容
    const bulletTexts = phase.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < phase.items.length - 1, indentLevel: 0 },
    }));
    s6.addText(bulletTexts, {
      x: px + 0.15, y: 2.55, w: 1.9, h: 2.2,
      fontSize: 10, fontFace: "Arial", color: C.gray, align: "left", valign: "top", margin: 0,
      paraSpaceAfter: 6,
    });
  });

  // ═══════════════════════════════════════════════════
  // Slide 7: 关键技术决策 & 风险
  // ═══════════════════════════════════════════════════
  const s7 = pres.addSlide();
  s7.background = { color: C.light };

  s7.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.0, fill: { color: C.dark } });
  s7.addImage({ data: icons.lock, x: 0.5, y: 0.2, w: 0.6, h: 0.6 });
  s7.addText("风险与应对", {
    x: 1.3, y: 0.15, w: 8, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "left", margin: 0, valign: "middle",
  });

  const risks = [
    { risk: "API Key 安全", desc: "Key 硬编码在 Functions 中", fix: "迁移到 Cloudflare Secrets / 环境变量", level: "高", levelColor: C.red },
    { risk: "提示词同步", desc: "SOUL.md 和 Functions 代码各一份", fix: "CI/CD 自动同步，统一为单一源", level: "中", levelColor: C.orange },
    { risk: "并发限制", desc: "硅基流动免费版限流", fix: "升级付费版，或接入多供应商路由", level: "中", levelColor: C.orange },
    { risk: "数据准确性", desc: "录取数据可能滞后", fix: "建立数据更新机制（爬虫 + 人工校验）", level: "高", levelColor: C.red },
  ];

  risks.forEach((r, i) => {
    const ry = 1.25 + i * 1.0;
    // 卡片
    s7.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: ry, w: 9, h: 0.85,
      fill: { color: C.white }, shadow: makeShadow(),
    });
    // 风险等级
    s7.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: ry, w: 0.08, h: 0.85, fill: { color: r.levelColor },
    });
    s7.addText(r.level, {
      x: 0.7, y: ry + 0.1, w: 0.8, h: 0.3,
      fontSize: 10, fontFace: "Arial Black", color: r.levelColor, align: "center", margin: 0,
    });
    // 风险标题
    s7.addText(r.risk, {
      x: 1.6, y: ry + 0.05, w: 2.5, h: 0.35,
      fontSize: 13, fontFace: "Arial Black", color: C.dark, align: "left", margin: 0,
    });
    // 风险描述
    s7.addText(r.desc, {
      x: 1.6, y: ry + 0.4, w: 2.5, h: 0.35,
      fontSize: 10, fontFace: "Arial", color: C.gray, align: "left", margin: 0,
    });
    // 分隔线
    s7.addShape(pres.shapes.LINE, {
      x: 4.3, y: ry + 0.1, w: 0, h: 0.65, line: { color: C.lightGray, width: 1 },
    });
    // 应对方案标签
    s7.addText("应对方案", {
      x: 4.5, y: ry + 0.05, w: 1.2, h: 0.25,
      fontSize: 9, fontFace: "Arial Black", color: C.primary, align: "left", margin: 0,
    });
    // 应对方案
    s7.addText(r.fix, {
      x: 4.5, y: ry + 0.3, w: 4.8, h: 0.5,
      fontSize: 10, fontFace: "Arial", color: C.dark, align: "left", margin: 0,
    });
  });

  // ═══════════════════════════════════════════════════
  // Slide 8: 总结
  // ═══════════════════════════════════════════════════
  const s8 = pres.addSlide();
  s8.background = { color: C.dark };
  s8.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.accent } });
  s8.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.accent } });

  s8.addImage({ data: icons.school, x: 4.4, y: 0.5, w: 1.0, h: 1.0 });

  s8.addText("让每个学生都能找到适合自己的路", {
    x: 0.5, y: 1.6, w: 9, h: 0.7,
    fontSize: 26, fontFace: "Arial Black", color: C.white, align: "center", margin: 0,
  });
  s8.addShape(pres.shapes.LINE, { x: 3.5, y: 2.4, w: 3, h: 0, line: { color: C.secondary, width: 1.5 } });

  // 三个关键数据
  const stats = [
    { value: "6660", unit: "字", label: "专家系统提示词" },
    { value: "10584", unit: "条", label: "录取数据记录" },
    { value: "99.9%", unit: "", label: "服务可用性" },
  ];
  stats.forEach((stat, i) => {
    const sx = 1.5 + i * 3;
    s8.addText([
      { text: stat.value, options: { fontSize: 36, fontFace: "Arial Black", color: C.accent, breakLine: true } },
      { text: stat.unit + " " + stat.label, options: { fontSize: 12, fontFace: "Arial", color: C.lightGray } },
    ], {
      x: sx, y: 2.7, w: 2.5, h: 1.5,
      align: "center", valign: "middle", margin: 0,
    });
  });

  // 联系方式
  s8.addText("gaokao-expert-h5.pages.dev", {
    x: 0.5, y: 4.5, w: 9, h: 0.4,
    fontSize: 14, fontFace: "Arial", color: C.accent, align: "center", margin: 0,
  });
  s8.addText("船歌 & 小鹅  |  2026.04", {
    x: 0.5, y: 4.95, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Arial", color: C.gray, align: "center", margin: 0,
  });

  // ─── 导出 ──────────────────────────────────────────
  const outPath = "/Users/fengweitao/WorkBuddy/20260414000511/gaokao-agent/h5/高报专家H5项目介绍.pptx";
  await pres.writeFile({ fileName: outPath });
  console.log("PPT 生成完成:", outPath);
}

main().catch(console.error);
