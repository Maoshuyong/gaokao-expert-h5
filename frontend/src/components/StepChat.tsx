import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { getScoreRank } from '@/api/client'

/** 经验公式降级 */
function fallbackRank(score: number): number {
  return Math.max(1, Math.round(300000 * Math.pow((750 - score) / 650, 2.5)))
}

export default function StepChat() {
  const { province, category, score, setStep } = useAppStore()
  setStep(5)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [rankText, setRankText] = useState('加载中...')

  useEffect(() => {
    if (!province || !category || !score) return
    getScoreRank({ province, category, score })
      .then((res) => {
        if (res.rank) {
          setRankText(`${res.rank.toLocaleString()}名`)
        } else {
          setRankText(`约${fallbackRank(score).toLocaleString()}名（经验估算）`)
        }
      })
      .catch(() => {
        setRankText(`约${fallbackRank(score).toLocaleString()}名（经验估算）`)
      })
  }, [province, category, score])

  const basePrompt = `我是${province}${category}考生，高考${score}分（省排名约${rankText}），请帮我分析能上哪些大学，推荐合适的志愿方案。`

  const advancedPrompts = [
    { label: '🔍 冲刺 985/211', prompt: `${basePrompt}\n\n请重点帮我分析能冲刺哪些985和211大学，按录取概率从高到低排列。` },
    { label: '🏙️ 一线城市', prompt: `${basePrompt}\n\n我想去北京、上海、广州、深圳或杭州等一线/新一线城市，请帮我筛选这些城市的匹配院校。` },
    { label: '🌐 中外合办', prompt: `${basePrompt}\n\n请帮我分析中外合作办学项目（如西交利物浦、宁波诺丁汉等），包括学费、适合人群和出国深造前景。` },
    { label: '💰 考公/考编', prompt: `${basePrompt}\n\n我的目标是毕业后考公务员或事业编，请推荐录取概率高且考公友好的院校和专业。` },
    { label: '📊 详细方案', prompt: `${basePrompt}\n\n请按"冲刺-稳妥-保底"三档给我一个12所院校的完整志愿方案，包括每所院校的2022-2024三年位次趋势分析和录取概率。` },
  ]

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text)
    const btn = document.activeElement as HTMLElement
    if (btn) {
      const orig = btn.textContent
      btn.textContent = '✓ 已复制'
      setTimeout(() => { btn.textContent = orig }, 1500)
    }
  }

  return (
    <div className="px-4 py-6">
      {/* 说明 */}
      <div className="gradient-bg rounded-2xl p-6 text-white text-center mb-6">
        <div className="text-4xl mb-3">🤖</div>
        <h2 className="text-xl font-bold mb-2">AI 志愿填报顾问</h2>
        <p className="text-sm opacity-90 leading-relaxed">
          深度对话分析，获取个性化的志愿填报方案
        </p>
      </div>

      {/* 用户信息摘要 */}
      {province && (
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
        </div>
      )}

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
            <p>输入下方提示词（或点击复制），AI 会基于真实投档线数据为你分析</p>
          </div>
          <div className="flex gap-3">
            <span className="text-primary-500 font-bold">3</span>
            <p>继续对话深入交流，比如追问具体院校、调整方案、分析专业</p>
          </div>
        </div>
      </div>

      {/* 基础提示词 */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
        <p className="text-xs text-primary-500 font-medium mb-2">📋 基础提示词</p>
        <p className="text-sm text-primary-700 leading-relaxed">{basePrompt}</p>
        <button
          onClick={() => copyPrompt(basePrompt)}
          className="mt-3 text-xs text-primary-600 font-medium border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-100 transition-colors"
        >
          复制
        </button>
      </div>

      {/* 高级提示词 */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-center text-sm text-gray-500 py-2 mb-3"
      >
        {showAdvanced ? '收起 ▲' : '展开更多场景提示词 ▼'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 mb-4">
          {advancedPrompts.map((item) => (
            <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-700 mb-1">{item.label}</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{item.prompt}</p>
              <button
                onClick={() => copyPrompt(item.prompt)}
                className="text-xs text-primary-600 font-medium border border-primary-200 rounded-lg px-3 py-1 hover:bg-primary-50 transition-colors"
              >
                复制提示词
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 快捷问题 */}
      <div className="border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="font-bold text-gray-700 mb-3">🎯 可以这样追问 AI</h3>
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
              onClick={() => copyPrompt(q)}
            >
              💬 {q}
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="space-y-3">
        <button
          onClick={() => copyPrompt(basePrompt)}
          className="w-full py-3.5 rounded-xl text-white font-bold gradient-bg shadow-lg active:scale-[0.98] transition-all"
        >
          📋 复制提示词，去 WorkBuddy 对话
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
        >
          ← 重新开始填报
        </button>
      </div>
    </div>
  )
}
