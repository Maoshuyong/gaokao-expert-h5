import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store'
import { getScoreRank } from '@/api/client'
import { getRankWithFallback, buildReportContext, buildBasicPrompt } from '@/utils/helpers'

export default function StepChat() {
  const { province, category, score, reportData, rankData, setStep, setRankData } = useAppStore()

  // 同步步骤状态（必须在 useEffect 中调用，避免渲染死循环）
  useEffect(() => {
    setStep(5)
  }, [setStep])

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [rankReady, setRankReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // 如果 store 里还没有排名数据，调 API 获取
  useEffect(() => {
    if (!province || !category || !score) return

    if (rankData) {
      // 已有缓存，直接标记就绪
      setRankReady(true)
      return
    }

    async function fetchRank() {
      const result = await getRankWithFallback(province, category, score, getScoreRank)
      setRankData({ rank: result.rank, source: result.source })
      setRankReady(true)
    }
    fetchRank()
  }, [province, category, score])

  // 清理 timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // 构建排名文本
  const rankText = rankData
    ? `${rankData.rank.toLocaleString()}名${rankData.source === 'estimate' ? '（经验估算）' : ''}`
    : ''

  // 构建基础 prompt（有报告用报告数据，没有用基础数据）
  const getBasePrompt = useCallback((): string => {
    if (!province || !category || !score) return ''
    if (reportData) {
      return buildReportContext(reportData)
    }
    if (rankReady && rankText) {
      return buildBasicPrompt(province, category, score, rankText)
    }
    return ''
  }, [province, category, score, reportData, rankReady, rankText])

  const basePrompt = getBasePrompt()

  // 场景化高级 prompt
  const advancedPrompts = [
    {
      id: '985',
      label: '🔍 冲刺 985/211',
      desc: '重点分析能冲刺哪些985/211大学',
      suffix: '请重点帮我分析能冲刺哪些985和211大学，按录取概率从高到低排列。给出每所院校的优劣势分析。',
    },
    {
      id: 'city',
      label: '🏙️ 一线城市',
      desc: '筛选北上广深杭等一线/新一线城市院校',
      suffix: '我想去北京、上海、广州、深圳或杭州等一线/新一线城市，请帮我筛选这些城市的匹配院校。',
    },
    {
      id: 'intl',
      label: '🌐 中外合作办学',
      desc: '分析中外合办项目（西浦、宁诺等）的性价比',
      suffix: '请帮我分析中外合作办学项目（如西交利物浦、宁波诺丁汉等），包括学费、适合人群、出国深造前景、和普通专业的优劣对比。',
    },
    {
      id: 'gongkao',
      label: '💰 考公/考编',
      desc: '推荐考公友好的院校和专业',
      suffix: '我的目标是毕业后考公务员或事业编，请推荐录取概率高且考公友好的院校和专业，分析各校考公上岸率。',
    },
    {
      id: 'full',
      label: '📊 完整志愿方案',
      desc: '12所院校的冲稳保完整方案',
      suffix: '请按"冲刺-稳妥-保底"三档给我一个12所院校的完整志愿方案，包括每所院校的2022-2024三年位次趋势分析、录取概率、滑档风险评估。',
    },
  ]

  // 复制功能（带 toast 反馈）
  function copyToClipboard(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // 是否有报告数据
  const hasReport = !!reportData

  // 加载中状态
  if (!province || !category || !score) {
    return (
      <div className="px-4 py-12 text-center text-gray-400">
        <p className="text-3xl mb-3">🤖</p>
        <p>请先填写考生信息</p>
        <button
          onClick={() => (window.location.href = '/')}
          className="mt-4 text-sm text-primary-600 font-medium"
        >
          ← 返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      {/* 说明头部 */}
      <div className="gradient-bg rounded-2xl p-6 text-white text-center mb-6">
        <div className="text-4xl mb-3">{hasReport ? '🧠' : '🤖'}</div>
        <h2 className="text-xl font-bold mb-2">
          {hasReport ? 'AI 深度志愿分析' : 'AI 志愿填报顾问'}
        </h2>
        <p className="text-sm opacity-90 leading-relaxed">
          {hasReport
            ? '已注入完整分析报告数据，AI 能给出更精准的建议'
            : '深度对话分析，获取个性化的志愿填报方案'}
        </p>
        {hasReport && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs">
            <span>✅ 报告数据已就绪</span>
          </div>
        )}
      </div>

      {/* 用户信息摘要 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-gray-500 mb-2">你的信息</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-400">省份</p>
            <p className="font-bold text-primary-600">{province}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">科类</p>
            <p className="font-bold">{category}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">分数</p>
            <p className="font-bold text-primary-600">{score}</p>
          </div>
        </div>
        {rankReady && rankText && (
          <div className="mt-3 text-center pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-400">省排名</p>
            <p className="font-bold text-gray-700">{rankText}</p>
          </div>
        )}
      </div>

      {/* 使用引导 */}
      <div className="border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="font-bold text-gray-700 mb-3">💬 使用方式</h3>
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <div className="flex gap-3">
            <span className="text-primary-500 font-bold">1</span>
            <p>打开 WorkBuddy 对话界面</p>
          </div>
          <div className="flex gap-3">
            <span className="text-primary-500 font-bold">2</span>
            <p>
              {hasReport
                ? '点击下方"复制提示词"，粘贴到 WorkBuddy 对话中（已包含你的完整分析报告数据）'
                : '点击下方"复制提示词"，粘贴到 WorkBuddy 对话中'}
            </p>
          </div>
          <div className="flex gap-3">
            <span className="text-primary-500 font-bold">3</span>
            <p>继续对话深入交流，比如追问具体院校、调整方案、分析专业</p>
          </div>
        </div>
      </div>

      {/* 提示词卡片 */}
      {!rankReady ? (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-4 text-center">
          <div className="animate-spin text-3xl mb-3">⏳</div>
          <p className="text-sm text-primary-600">正在准备提示词数据...</p>
          <p className="text-xs text-primary-400 mt-1">获取省排名中</p>
        </div>
      ) : (
        <>
          {/* 基础提示词 */}
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-primary-500 font-medium">
                📋 {hasReport ? '智能提示词（含完整报告数据）' : '基础提示词'}
              </p>
              <button
                onClick={() => copyToClipboard('base', basePrompt)}
                className={`text-xs font-medium border rounded-lg px-3 py-1 transition-all ${
                  copiedId === 'base'
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'border-primary-200 text-primary-600 hover:bg-primary-100'
                }`}
              >
                {copiedId === 'base' ? '✓ 已复制' : '复制'}
              </button>
            </div>
            <p className="text-sm text-primary-700 leading-relaxed whitespace-pre-line line-clamp-6">
              {basePrompt}
            </p>
          </div>

          {/* 高级场景提示词 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full text-center text-sm text-gray-500 py-2 mb-3"
          >
            {showAdvanced ? '收起 ▲' : '展开更多场景提示词 ▼'}
          </button>

          {showAdvanced && (
            <div className="space-y-3 mb-4">
              {advancedPrompts.map((item) => {
                const fullPrompt = `${basePrompt}\n\n${item.suffix}`
                return (
                  <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-700">{item.label}</p>
                      <button
                        onClick={() => copyToClipboard(item.id, fullPrompt)}
                        className={`text-xs font-medium border rounded-lg px-3 py-1 transition-all ${
                          copiedId === item.id
                            ? 'bg-green-100 border-green-300 text-green-700'
                            : 'border-primary-200 text-primary-600 hover:bg-primary-50'
                        }`}
                      >
                        {copiedId === item.id ? '✓ 已复制' : '复制提示词'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{item.desc}</p>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{item.suffix}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* 快捷问题 */}
          <div className="border border-gray-200 rounded-xl p-5 mb-4">
            <h3 className="font-bold text-gray-700 mb-3">🎯 对话中可以这样追问</h3>
            <div className="space-y-2">
              {[
                '这所学校的优势专业有哪些？',
                '中外合作办学的学费和含金量怎么样？',
                '如果我想考研，哪所学校更有优势？',
                '帮我分析这两所学校哪个更适合我',
                '这个方案中哪些学校有滑档风险？',
                '本二批有哪些好的保底选择？',
              ].map((q) => (
                <div
                  key={q}
                  className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => copyToClipboard(q, q)}
                >
                  💬 {q}
                </div>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-3">
            <button
              onClick={() => copyToClipboard('main', basePrompt)}
              className={`w-full py-3.5 rounded-xl text-white font-bold gradient-bg shadow-lg active:scale-[0.98] transition-all ${
                copiedId === 'main' ? 'ring-2 ring-green-400 ring-offset-2' : ''
              }`}
            >
              {copiedId === 'main' ? '✅ 已复制，去 WorkBuddy 对话吧！' : '📋 复制提示词，去 WorkBuddy 对话'}
            </button>

            {copiedId === 'main' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center animate-fadeIn">
                <p className="text-sm text-green-700 font-medium">
                  ✅ 提示词已复制到剪贴板
                </p>
                <p className="text-xs text-green-500 mt-1">
                  现在打开 WorkBuddy 对话界面，粘贴即可开始深度分析
                </p>
              </div>
            )}

            {!hasReport && (
              <button
                onClick={() => (window.location.href = '/report')}
                className="w-full py-3 border border-primary-200 rounded-xl text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors"
              >
                📊 先生成完整报告（获取更精准的 AI 分析）
              </button>
            )}

            <button
              onClick={() => (window.location.href = '/')}
              className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
            >
              ← 重新开始填报
            </button>
          </div>
        </>
      )}
    </div>
  )
}
