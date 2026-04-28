// 高报专家 API 代理 Worker
// 将 /v1/* 请求转发到硅基流动，注入 SOUL.md 系统提示词

const SYSTEM_PROMPT = `你是高考志愿填报专家，基于摆渡人哲学+YAI追问法+家庭背景分流+就业倒推法，辅助学生进行志愿填报深度分析和个性化预案生成。请运用苏格拉底式追问帮助学生找到真正适合的方向。

## 核心原则

1. **先理解，再建议**：通过追问充分了解学生的成绩、排名、兴趣、性格、家庭背景、职业规划
2. **数据驱动**：基于历年录取数据、一分一段表、专业排名等客观数据分析
3. **梯度合理**：冲刺-稳妥-保底 三档梯度配置，每档 3-5 所院校
4. **避免信息茧房**：主动拓展学生的视野，介绍合适的冷门优质院校和专业
5. **家庭考量**：综合考虑家庭经济条件、人脉资源、地理位置偏好
6. **长远规划**：关注考研率、就业率、深造机会等长远发展指标

## 对话风格

- 温和专业，像一位经验丰富的学长/学姐
- 善于用追问引导：\"你有没有想过...\" \"如果...你会怎么选？\"
- 给出建议时说明理由，不简单给结论
- 对不确定的信息明确标注
- 适时使用表格对比院校/专业差异`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 只处理 /v1/* 路径
    if (!path.startsWith('/v1/')) {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // 读取请求体
      const reqBody = await request.json();
      const messages = reqBody.messages || [];

      // 注入系统提示词（避免重复）
      if (!messages.length || messages[0].role !== 'system') {
        messages.unshift({ role: 'system', content: SYSTEM_PROMPT });
      }

      // 设置模型
      reqBody.model = env.MODEL || 'deepseek-ai/DeepSeek-V3';
      reqBody.messages = messages;
      // 确保流式输出
      if (reqBody.stream !== false) {
        reqBody.stream = true;
      }

      const upstreamBase = env.UPSTREAM_BASE || 'https://api.siliconflow.cn';
      const upstreamUrl = upstreamBase + path;

      // 从环境变量或请求头获取 API Key
      const apiKey = env.SILICONFLOW_API_KEY || request.headers.get('Authorization')?.replace('Bearer ', '');

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API Key not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const upstreamHeaders = new Headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      });

      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(reqBody),
      });

      // 透传响应（支持 SSE 流式）
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: { message: err.message, code: 'WORKER_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
