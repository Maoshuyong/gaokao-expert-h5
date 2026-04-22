// Pages Function: /v1/chat/completions
// 反向代理到硅基流动，注入系统提示词 + Tool Calling 循环 + SSE 流式输出
// 当 LLM 返回 tool_calls 时，自动调用 Render 后端 API 并回传结果
// 流式模式：tool calling 阶段发状态事件，最终回复透传上游 SSE

const RENDER_BASE = 'https://gaokao-agent.onrender.com';

// ─── 系统提示词（张雪峰风格 v2.2） ─────────────────────────────
const SYSTEM_PROMPT = `你是高考志愿填报专家，张雪峰风格的资深高考志愿规划师。你的核心使命是**帮普通家庭的孩子用每一分换到最大确定性**。

## 核心方法

1. **专业优先，学校其次**：理工科专业>学校，文科学校>专业
2. **位次比分数准**：看近3年专业录取位次，不只看学校最低分
3. **冲稳保拉开梯度**：比例 2:5:3 或 3:4:3
4. **服从调剂**：不服从调剂可能被退档
5. **普通家庭选就业**：穷人选就业，富人选情怀

## 工具使用规则

你可以调用以下工具查询真实的录取数据。**必须使用工具获取数据，不要凭记忆编造院校录取信息。**

### 标准工具调用流程

当用户提供了省份、科类和分数/位次后，按以下步骤操作：

1. **第一步：确认/查询位次**
   - 如果用户只提供了分数，用 \`score_to_rank\` 查询对应位次
   - 如果用户提供了位次，直接进入下一步

2. **第二步：搜索候选院校**
   - 用 \`search_colleges\` 获取有该省录取数据的院校列表
   - 注意：返回结果按录取位次排序，第一页可能是位次很高的学校
   - 你需要多页查看，或关注位次接近用户排名的院校
   - **重要**：从返回的院校中筛选位次在用户排名附近（±3000名）的院校代码

3. **第三步：计算录取概率**
   - 从 search_colleges 结果中提取合适的院校代码
   - 用 \`calculate_probability\` 批量计算这些院校的录取概率
   - 返回结果包含每所院校的 probability（概率值）和 level（冲刺/稳妥/保底）

4. **第四步：查询详细数据**
   - 对用户感兴趣的关键院校，用 \`lookup_scores\` 查看历年分数线
   - 用 \`get_college_detail\` 查看院校详情
   - 用 \`get_major_scores\` 查看各专业录取分数线（当用户想了解具体专业录取分数时）

## 对话流程

### 第一步：确认身份
先确认对方是考生本人还是家长。

### 第二步：确认省份和科类
- 传统高考省：确认文科还是理科
- 新高考省（3+1+2）：确认物理类还是历史类

### 第三步：获取位次信息（最重要！）
1. 精确位次优先：直接问省排名
2. 如果不知道位次：问分数，用 score_to_rank 工具查询
3. 如果还没高考：问模考分数/位次

### 第四步：调用工具获取真实数据
1. 用 score_to_rank 确认位次（如果只有分数）
2. 用 search_colleges 获取候选院校
3. 用 calculate_probability 批量计算录取概率
4. 用 lookup_scores 查看关键院校历年数据

### 第五步：给出基于数据的分析
基于工具返回的真实数据给出建议，包括：
- 分数段定位（与省控线对比）
- 冲稳保院校推荐（附带概率和历史数据）
- 专业方向建议（可查询各专业录取分数）
- 注意事项和风险提示

## 输出风格
- 直白犀利，说人话，用"说白了"等口语化表达
- 有态度，敢于说"不建议"
- 有温度，对普通家庭有共情
- 推荐院校时用表格格式，包含：院校、概率、推荐专业、注意事项
- 标注数据来源："（数据来源：2022-2024年投档线）"

## 禁止事项
- 不要捏造不在数据库中的院校信息
- 不要凭记忆编造录取分数线
- 不要说"一定能录取"
- 不要在不了解家庭情况时推荐金融、工商管理等需要资源的专业
- 不要忽略宏观经济环境（经济下行期985/211溢价暴涨）

## MBTI 性格与专业匹配
如果考生提供了 MBTI 测试结果，根据性格类型给出专业方向建议：
- INTJ/INTP（分析型）：计算机、数学、物理、哲学、数据科学
- ENTJ/ENTP（开拓型）：管理学、经济学、创业、市场营销
- INFJ/INFP（理想型）：心理学、教育学、文学、社会工作、艺术设计
- ENFJ/ENFP（社交型）：新闻传播、公共关系、旅游管理、人力资源
- ISTJ/ISFJ（务实型）：会计、土木工程、药学、护理学
- ESTJ/ESFJ（管理型）：工商管理、法学、酒店管理
- ISTP/ISFP（自由型）：机械工程、电子工程、视觉设计、音乐
- ESTP/ESFP（活力型）：体育管理、金融、表演艺术`;

// ─── Tool Definitions（OpenAI function calling 格式） ─────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_colleges',
      description: '根据考生条件筛选有录取数据的候选院校。返回结果按历史录取位次升序排列（位次低的排前面）。注意：第一页可能是录取位次远低于考生排名的学校，你需要从返回的院校中筛选录取位次接近考生排名（考生排名±3000名）的院校，然后提取它们的代码传给 calculate_probability 计算概率。建议 page_size 设为 50 以获取更多候选。',
      parameters: {
        type: 'object',
        properties: {
          province: { type: 'string', description: '考生省份，如"陕西""四川"' },
          category: { type: 'string', description: '科类：文科/理科/物理类/历史类' },
          score: { type: 'integer', description: '高考成绩' },
          rank: { type: 'integer', description: '省排名' },
          level: { type: 'string', description: '院校层次筛选（可选）' },
          college_type: { type: 'string', description: '院校类型筛选（可选）' },
          target_provinces: { type: 'string', description: '目标省份，逗号分隔（可选）' },
          is_985: { type: 'boolean', description: '是否只看985（可选）' },
          is_211: { type: 'boolean', description: '是否只看211（可选）' },
          page: { type: 'integer', description: '页码，默认1' },
          page_size: { type: 'integer', description: '每页数量，建议50以获取更多候选' }
        },
        required: ['province', 'category', 'score', 'rank']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_probability',
      description: '批量计算录取概率。传入院校代码列表，返回每所院校的录取概率、档位（冲刺/稳妥/保底/不建议）和说明。',
      parameters: {
        type: 'object',
        properties: {
          score: { type: 'integer', description: '高考成绩' },
          rank: { type: 'integer', description: '省排名' },
          province: { type: 'string', description: '考生省份' },
          category: { type: 'string', description: '科类：文科/理科/物理类/历史类' },
          college_codes: {
            type: 'array',
            items: { type: 'string' },
            description: '院校代码列表，如["10001","10002"]'
          },
          year: { type: 'integer', description: '参考年份，默认使用用户选择的高考年份' }
        },
        required: ['score', 'rank', 'province', 'category', 'college_codes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lookup_scores',
      description: '查询某所院校在某省某科类的历年录取分数线（最近5年），包含最低分、最低排名、平均分等。',
      parameters: {
        type: 'object',
        properties: {
          college_code: { type: 'string', description: '院校代码' },
          province: { type: 'string', description: '考生省份' },
          category: { type: 'string', description: '科类：文科/理科/物理类/历史类' }
        },
        required: ['college_code', 'province', 'category']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_college_by_keyword',
      description: '模糊搜索院校。按院校名称或代码搜索，支持筛选条件。',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '搜索关键词（院校名称或代码）' },
          province: { type: 'string', description: '省份筛选（可选）' },
          is_985: { type: 'boolean', description: '是否只看985（可选）' },
          is_211: { type: 'boolean', description: '是否只看211（可选）' },
          page_size: { type: 'integer', description: '每页数量，默认20' }
        },
        required: ['q']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_college_detail',
      description: '获取院校详细信息，包括办学层次、类型、是否985/211、排名等。',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '院校代码' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_control_scores',
      description: '查询某省某年的控制分数线（一本线/二本线）。',
      parameters: {
        type: 'object',
        properties: {
          province: { type: 'string', description: '省份' },
          year: { type: 'integer', description: '年份' }
        },
        required: ['province', 'year']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'score_to_rank',
      description: '将高考分数转换为省排名（基于官方一分一段表）。当用户只有分数不知道位次时使用此工具。',
      parameters: {
        type: 'object',
        properties: {
          province: { type: 'string', description: '省份' },
          category: { type: 'string', description: '科类：文科/理科/物理类/历史类' },
          score: { type: 'integer', description: '高考分数（0-750）' },
          year: { type: 'integer', description: '年份，默认使用用户选择的高考年份' }
        },
        required: ['province', 'category', 'score']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_major_scores',
      description: '查询某所院校在某省某科类某年的各专业录取分数线。当用户想了解具体专业的录取分数（如"北大的计算机多少分"、"西安交大各专业录取分数"）时使用。返回每个专业的最低分、位次和录取人数。',
      parameters: {
        type: 'object',
        properties: {
          college_name: { type: 'string', description: '院校名称，如"北京大学""西安交通大学"' },
          province: { type: 'string', description: '招生省份' },
          category: { type: 'string', description: '科类：文科/理科/物理类/历史类' },
          year: { type: 'integer', description: '年份，默认使用用户选择的高考年份' }
        },
        required: ['college_name', 'province', 'category']
      }
    }
  }
];

// ─── Tool 执行器：根据 function name 调用 Render API ─────────
async function executeToolCall(name, args) {
  const url = new URL(RENDER_BASE);
  let method = 'GET';
  let body = null;

  switch (name) {
    case 'search_colleges': {
      url.pathname = '/api/v1/colleges/recommend';
      Object.entries(args).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
      break;
    }
    case 'calculate_probability': {
      url.pathname = '/api/v1/probability';
      method = 'POST';
      body = JSON.stringify(args);
      break;
    }
    case 'lookup_scores': {
      url.pathname = '/api/v1/scores/lookup';
      method = 'POST';
      body = JSON.stringify(args);
      break;
    }
    case 'search_college_by_keyword': {
      url.pathname = '/api/v1/colleges/';
      Object.entries(args).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
      break;
    }
    case 'get_college_detail': {
      url.pathname = `/api/v1/colleges/${args.code}`;
      break;
    }
    case 'get_control_scores': {
      url.pathname = '/api/v1/control-scores';
      url.searchParams.set('province', args.province);
      url.searchParams.set('year', String(args.year));
      break;
    }
    case 'score_to_rank': {
      url.pathname = '/api/v1/score-to-rank';
      url.searchParams.set('province', args.province);
      url.searchParams.set('category', args.category);
      url.searchParams.set('score', String(args.score));
      if (args.year) url.searchParams.set('year', String(args.year));
      break;
    }
    case 'get_major_scores': {
      url.pathname = '/api/v1/major-scores';
      url.searchParams.set('college_name', args.college_name);
      url.searchParams.set('province', args.province);
      url.searchParams.set('category', args.category);
      if (args.year) url.searchParams.set('year', String(args.year));
      break;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }

  console.log(`[Tool Call] ${method} ${url.toString()}`);

  try {
    const fetchOpts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) fetchOpts.body = body;

    const res = await fetch(url.toString(), fetchOpts);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Tool Error] ${res.status}: ${text.substring(0, 200)}`);
      if (res.status >= 500) {
        return { error: `数据服务正在启动中，请10秒后重试。状态码：${res.status}` };
      }
      return { error: `API 请求失败 (${res.status}): ${text.substring(0, 100)}` };
    }

    const data = await res.json();
    console.log(`[Tool Result] ${name}: ${JSON.stringify(data).substring(0, 200)}...`);
    return data;
  } catch (err) {
    console.error(`[Tool Error] ${name}: ${err.message}`);
    return { error: `网络错误: ${err.message}` };
  }
}

// ─── SSE 辅助函数 ──────────────────────────────────────────
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Province',
};

function sseEvent(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Tool 执行阶段的状态提示文案
function getToolStatusText(name) {
  const map = {
    'score_to_rank': '🔍 正在查询一分一段表...',
    'search_colleges': '🏫 正在搜索匹配院校...',
    'calculate_probability': '📊 正在计算录取概率...',
    'lookup_scores': '📋 正在查询历年分数线...',
    'search_college_by_keyword': '🔍 正在搜索院校...',
    'get_college_detail': '📖 正在获取院校详情...',
    'get_control_scores': '📏 正在查询省控线...',
    'get_major_scores': '🎓 正在查询专业分数线...',
  };
  return map[name] || `🔧 正在调用工具: ${name}`;
}

// ─── 主处理逻辑 ──────────────────────────────────────────────

const UPSTREAM_BASE = 'https://api.siliconflow.cn';
const MODEL = 'deepseek-ai/DeepSeek-V3';
const API_KEY = 'sk-cjmosfitgvdiqkpubfwanmjdyeyhjyuiesnquzoysjkhkxzy';

export const config = { runtime: 'edge' };

export async function onRequestPost(context) {
  try {
    const reqBody = await context.request.json();
    let messages = reqBody.messages || [];

    // 获取省份、科类和年份信息
    const province = reqBody.province || '';
    const category = reqBody.category || '';
    const year = reqBody.year || new Date().getFullYear();
    const isStream = reqBody.stream !== false; // 默认流式

    // 构建系统提示词
    let systemPrompt = SYSTEM_PROMPT;
    if (province) {
      systemPrompt += `\n\n## 当前用户信息\n- 考生所在省份：${province}`;
      if (category) {
        systemPrompt += `\n- 考生科类：${category}`;
      }
      systemPrompt += `\n- 高考年份：${year}年`;
      systemPrompt += `\n- 在查询数据时，请使用${year}年的数据（如果${year}年数据不存在，则使用最接近的历史年份）`;
      const newGkProvinces312 = ['广东','湖北','河北','江苏','湖南','福建','辽宁','重庆'];
      const newGkProvinces312Late = { '安徽': 2024, '江西': 2024 };
      const newGkProvinces33 = ['山东', '浙江', '海南', '北京', '天津', '上海'];

      if (newGkProvinces312.includes(province) || (newGkProvinces312Late[province] && year >= newGkProvinces312Late[province])) {
        systemPrompt += `\n- 考试类型：新高考（3+1+2模式），请按「物理类」和「历史类」分析`;
      } else if (newGkProvinces33.includes(province)) {
        systemPrompt += `\n- 考试类型：新高考（3+3模式，不分文理）`;
      } else {
        systemPrompt += `\n- 考试类型：传统高考（分文科/理科）`;
      }
      systemPrompt += `\n- 在分析录取概率、推荐院校时，请优先使用${province}省的历年录取数据`;
    }

    // 注入系统提示词
    if (!messages.length || messages[0].role !== 'system') {
      messages.unshift({ role: 'system', content: systemPrompt });
    } else {
      messages[0].content = systemPrompt;
    }

    // ═══ 非流式模式（兼容旧前端） ═══
    if (!isStream) {
      const reply = await runToolLoop(messages, 5, year);
      return new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: MODEL,
        tool_calls_used: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ═══ 流式模式（SSE） ═══
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const id = `chatcmpl-${Date.now()}`;

        // 发送 tool_status 事件：开始分析
        controller.enqueue(encoder.encode(sseEvent({
          type: 'tool_status',
          content: '🤔 正在分析你的问题...',
        })));

        // ─── Phase 1: Tool Calling 循环（非流式） ───
        let finalMessages = [...messages];
        let toolCallsUsed = false;
        const MAX_ROUNDS = 5;

        for (let round = 0; round < MAX_ROUNDS; round++) {
          console.log(`[Stream Tool Loop] Round ${round + 1}`);

          // 发送当前轮次状态
          controller.enqueue(encoder.encode(sseEvent({
            type: 'tool_status',
            content: round === 0 ? '🤔 正在分析你的问题...' : `🔄 继续分析中...（第${round + 1}轮）`,
          })));

          const response = await fetch(`${UPSTREAM_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
              model: MODEL,
              messages: finalMessages,
              tools: TOOLS,
              tool_choice: 'auto',
              max_tokens: 4000,
              temperature: 0.7,
              stream: false,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`[LLM Error] ${response.status}: ${errText.substring(0, 200)}`);
            controller.enqueue(encoder.encode(sseEvent({
              id, object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: `⚠️ AI 服务暂时不可用 (${response.status})，请稍后重试。` }, finish_reason: 'stop' }]
            })));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          const data = await response.json();
          const choice = data.choices?.[0];
          if (!choice) {
            controller.enqueue(encoder.encode(sseEvent({
              id, object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: '⚠️ AI 服务返回了空响应。' }, finish_reason: 'stop' }]
            })));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          const msg = choice.message;

          // 没有 tool_calls → 这是最终回复
          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            // 有了最终回复内容，进入流式输出阶段
            controller.enqueue(encoder.encode(sseEvent({
              type: 'tool_status',
              content: '✍️ 正在生成回复...',
            })));

            // 如果 LLM 已经返回了 content，直接输出
            if (msg.content) {
              // 分块输出已有内容（模拟流式，因为已经拿到了）
              const content = msg.content;
              const chunkSize = 6;
              for (let i = 0; i < content.length; i += chunkSize) {
                const chunk = content.substring(i, i + chunkSize);
                controller.enqueue(encoder.encode(sseEvent({
                  id, object: 'chat.completion.chunk',
                  choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }]
                })));
                await new Promise(r => setTimeout(r, 10));
              }
            }

            // 结束标记
            controller.enqueue(encoder.encode(sseEvent({
              id, object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
            })));
            controller.enqueue(encoder.encode(sseEvent({ type: 'done', tool_calls_used: toolCallsUsed })));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }

          // 有 tool_calls → 执行工具
          toolCallsUsed = true;
          finalMessages.push(msg);

          for (const tc of msg.tool_calls) {
            const fnName = tc.function.name;
            let fnArgs;
            try { fnArgs = JSON.parse(tc.function.arguments); }
            catch { fnArgs = {}; }

            // 发送工具调用状态
            controller.enqueue(encoder.encode(sseEvent({
              type: 'tool_status',
              content: getToolStatusText(fnName),
            })));

            console.log(`[Stream Tool Call] ${fnName}(${JSON.stringify(fnArgs)})`);
            // 自动注入年份：如果工具支持 year 参数但 LLM 未传，自动补上用户选择的年份
            if (year && !fnArgs.year) {
              const yearAwareTools = ['calculate_probability', 'score_to_rank', 'get_major_scores', 'get_control_scores'];
              if (yearAwareTools.includes(fnName)) fnArgs.year = year;
            }
            const result = await executeToolCall(fnName, fnArgs);

            finalMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
        }

        // 超过最大循环次数
        controller.enqueue(encoder.encode(sseEvent({
          id, object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { content: '⚠️ 分析过程超出最大步骤限制，请尝试更具体的问题。' }, finish_reason: 'stop' }]
        })));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(stream, { status: 200, headers: SSE_HEADERS });
  } catch (err) {
    console.error('[Completions Error]', err);
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Tool Calling 循环（非流式兼容） ─────────────────────────
async function runToolLoop(messages, maxRounds = 5, defaultYear) {
  for (let round = 0; round < maxRounds; round++) {
    console.log(`[Tool Loop] Round ${round + 1}`);

    const response = await fetch(`${UPSTREAM_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 4000,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[LLM Error] ${response.status}: ${errText.substring(0, 200)}`);
      return `⚠️ AI 服务暂时不可用 (${response.status})，请稍后重试。`;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return '⚠️ AI 服务返回了空响应。';

    const msg = choice.message;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || '（无回复）';
    }

    messages.push(msg);

    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      let fnArgs;
      try { fnArgs = JSON.parse(tc.function.arguments); }
      catch { fnArgs = {}; console.error(`[Tool Error] Failed to parse args: ${tc.function.arguments}`); }

      console.log(`[Tool Call] ${fnName}(${JSON.stringify(fnArgs)})`);
      // 自动注入年份
      if (defaultYear && !fnArgs.year) {
        const yearAwareTools = ['calculate_probability', 'score_to_rank', 'get_major_scores', 'get_control_scores'];
        if (yearAwareTools.includes(fnName)) fnArgs.year = defaultYear;
      }
      const result = await executeToolCall(fnName, fnArgs);

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return '⚠️ 分析过程超出最大步骤限制，请尝试更具体的问题。';
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: SSE_HEADERS,
  });
}
