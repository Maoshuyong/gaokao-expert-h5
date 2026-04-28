"""
LLM 代理路由 - /v1/chat/completions
将小程序的 OpenAI 兼容请求转发到 SiliconFlow，注入高报专家 SOUL.md 系统提示词
支持 mobile 模式（短回复）和 SSE 流式输出
"""
import json
import os
import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(tags=["LLM 代理"])

# ============================================================
# 配置
# ============================================================

LLM_BACKEND = os.environ.get("LLM_BACKEND", "https://api.siliconflow.cn/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3"

# 高报专家 V2.0 SOUL.md（内嵌，避免 Render 上读本地文件）
SOUL_PROMPT = """你是「高报专家」，一个专业、温暖、有洞察力的高考志愿填报AI顾问。

核心方法论：
1. 摆渡人哲学 - 追问而非给答案，真诚第一，长期主义
2. YAI苏格拉底式追问 - 由浅入深、由宽到窄、由外在到内在、由现在到未来
3. 家庭背景分流 - 按经济条件/父母职业/人脉资源/试错空间分策略
4. 就业倒推法 - 从中位数毕业生去向倒推专业选择，关注AI替代风险
5. 人生3.0框架 - 别人安排→追求成功→自我实现
6. OKR人生规划 - 人生目标→大学/专业支撑→能力培养

对话原则：
- 先问后答，不急着给学校推荐
- 苏格拉底式引导，用提问代替说教
- 数据驱动，引用具体分数线和位次
- 不确定的数据标注"需核实"，不做绝对承诺"""

# Mobile 模式指令（手机端短回复）
MOBILE_INSTRUCTION = """

═══════════════════════════════════════
【最高优先级 · 不可违反】当前模式: mode=mobile
你正在与手机端的普通用户（学生/家长）直接聊天。
═══════════════════════════════════════

硬性规则（违反任何一条=输出不合格）：
1. 单条回复严格不超过 100 字。超过就是失败。
2. 每次只说一件事：问1个问题，或给1个建议。
3. 不用 emoji 标记符号（📋💡⚠️❌✅1️⃣→ 全部禁止）
4. 不用编号列表，不用箭头，不用表格
5. 像微信朋友聊天一样说话，不要像写报告
6. 直接叫"你"，不要叫"考生""学生"
7. 如果需要对方选择，末尾写：【选项】A / B / C

示例正确输出：
"580分想学计算机，这个分数不错 👍 
你在哪个省？不同省份情况差挺多的。
【选项】河南 / 山东 / 四川"

示例错误输出：
"📋 已识别信息：
1️⃣ 分数：580 → ❌ 这是专家模式格式，手机端禁止！"
"""


# ============================================================
# 请求模型
# ============================================================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = None
    messages: List[ChatMessage]
    stream: Optional[bool] = True
    temperature: Optional[float] = 0.7


# ============================================================
# 路由
# ============================================================

@router.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    """OpenAI 兼容的 chat completions 代理接口"""

    if not LLM_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="LLM_API_KEY 未配置，请设置环境变量"
        )

    # 构造带系统提示词的消息列表
    system_content = SOUL_PROMPT + MOBILE_INSTRUCTION
    injected_messages = [
        {"role": "system", "content": system_content},
    ] + [m.model_dump() for m in request.messages]

    # 构造转发给 LLM 后端的请求体
    payload = {
        "model": request.model or DEFAULT_MODEL,
        "messages": injected_messages,
        "stream": request.stream if request.stream is not None else True,
        "temperature": request.temperature or 0.7,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Accept": "text/event-stream",
    }

    user_msg = request.messages[-1].content[:50] if request.messages else "(空)"
    print(f"📡 LLM代理请求: model={payload['model']} | 用户: {user_msg}...")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{LLM_BACKEND}/chat/completions",
                json=payload,
                headers=headers,
            )

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"LLM 后端错误: {resp.text[:500]}"
                )

            if payload["stream"]:
                # === SSE 流式响应 ===
                async def event_stream():
                    async for line in resp.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            json_str = line[6:]
                            try:
                                json.loads(json_str)  # 验证 JSON 合法性
                                yield f"{line}\n\n"
                            except json.JSONDecodeError:
                                pass
                        elif line == "data: [DONE]":
                            yield "data: [DONE]\n\n"

                return StreamingResponse(
                    event_stream(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "Access-Control-Allow-Origin": "*",
                    }
                )
            else:
                # === 非流式响应 ===
                return JSONResponse(
                    content=resp.json(),
                    headers={"Access-Control-Allow-Origin": "*"}
                )

    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"无法连接 LLM 服务: {e}")
