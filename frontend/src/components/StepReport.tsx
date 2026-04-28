import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { generateReport, type ReportResponse, type ReportCollege } from '@/api/client'
import { getRankWithFallback } from '@/utils/helpers'

export default function StepReport() {
  const navigate = useNavigate()
  const { province, category, score, setStep, setRankData, setReportData } = useAppStore()
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!province || !category || !score) return
    setStep(6)
    setLoading(true)

    async function fetchReport() {
      try {
        // 先获取排名（复用公共函数）
        const { rank, source } = await getRankWithFallback(province, category, score, async (params) => {
          const { getScoreRank } = await import('@/api/client')
          return getScoreRank(params)
        })
        // 写入 store，后续组件可共享
        setRankData({ rank, source })

        const data = await generateReport({ province, category, score, rank })
        setReport(data)
        // 写入 store，StepChat 可直接读取
        setReportData(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [province, category, score])

  if (loading) {
    return (
      <div className="px-4 py-12 text-center text-gray-400">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-base">正在生成分析报告...</p>
        <p className="text-xs mt-2">综合分析 2022-2024 三年投档线</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="px-4 py-12 text-center text-gray-400">
        <p className="text-3xl mb-3">😕</p>
        <p>报告生成失败，请返回重试</p>
      </div>
    )
  }

  const { profile, control_scores: cs, statistics: stats, recommendations: rec, erben_fallback, tips } = report

  return (
    <div className="px-4 py-5 pb-8">
      {/* 报告头部 */}
      <div className="gradient-bg rounded-2xl p-5 text-white mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">志愿分析报告</h2>
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">基于 2022-2024 数据</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs opacity-80">{profile.province}</p>
            <p className="font-bold text-sm">{profile.category}</p>
          </div>
          <div>
            <p className="text-xs opacity-80">分数</p>
            <p className="font-bold text-xl">{profile.score}</p>
          </div>
          <div>
            <p className="text-xs opacity-80">预估位次</p>
            <p className="font-bold text-sm">{profile.rank.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs opacity-80">定位</p>
            <p className="font-bold text-sm">{profile.position.emoji} {profile.position.label}</p>
          </div>
        </div>
        <p className="text-xs opacity-80 mt-2 leading-relaxed">{profile.position.desc}</p>
      </div>

      {/* 省控线 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">本科一批</p>
          <div className="flex items-end justify-between">
            <span className="text-xl font-bold">{cs.yiben || '-'}</span>
            {cs.yiben_diff !== null && (
              <span className={`text-sm font-bold ${cs.yiben_diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {cs.yiben_diff >= 0 ? '+' : ''}{cs.yiben_diff}
              </span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">本科二批</p>
          <div className="flex items-end justify-between">
            <span className="text-xl font-bold">{cs.erben || '-'}</span>
            {cs.erben_diff !== null && (
              <span className={`text-sm font-bold ${cs.erben_diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {cs.erben_diff >= 0 ? '+' : ''}{cs.erben_diff}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 匹配统计 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 shadow-sm">
        <h3 className="font-bold text-gray-700 text-sm mb-3">匹配院校分布</h3>
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="text-center bg-orange-50 rounded-lg py-2.5 border border-orange-100">
            <p className="text-xl font-bold text-orange-500">{stats.chong_count}</p>
            <p className="text-xs text-orange-600">冲刺</p>
          </div>
          <div className="text-center bg-green-50 rounded-lg py-2.5 border border-green-100">
            <p className="text-xl font-bold text-green-600">{stats.wen_count}</p>
            <p className="text-xs text-green-600">稳妥</p>
          </div>
          <div className="text-center bg-blue-50 rounded-lg py-2.5 border border-blue-100">
            <p className="text-xl font-bold text-blue-500">{stats.bao_count}</p>
            <p className="text-xs text-blue-600">保底</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center">
          共 {stats.total_matched} 所匹配院校（本科一批）
        </p>
      </div>

      {/* 冲刺 */}
      <CollegeSection
        title="冲刺院校"
        emoji="🔴"
        desc="位次略低于院校要求，录取概率较低但有冲击可能"
        colleges={rec.chong}
        color="orange"
        onCollegeClick={(code) => navigate(`/college/${code}`)}
      />

      {/* 稳妥 */}
      <CollegeSection
        title="稳妥院校"
        emoji="🟢"
        desc="位次与院校匹配度高，录取概率较大"
        colleges={rec.wen}
        color="green"
        onCollegeClick={(code) => navigate(`/college/${code}`)}
      />

      {/* 保底 */}
      <CollegeSection
        title="保底院校"
        emoji="🔵"
        desc="位次明显优于院校要求，基本可以稳录"
        colleges={rec.bao}
        color="blue"
        onCollegeClick={(code) => navigate(`/college/${code}`)}
      />

      {/* 本二批保底 */}
      {erben_fallback.length > 0 && (
        <div className="mt-5">
          <CollegeSection
            title="本科二批兜底"
            emoji="🛡️"
            desc="即使本一批滑档，二批这些学校你也能稳上"
            colleges={erben_fallback}
            color="purple"
            onCollegeClick={(code) => navigate(`/college/${code}`)}
            isErben
          />
        </div>
      )}

      {/* 填报建议 */}
      <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mt-5">
        <h3 className="font-bold text-gold-700 text-sm mb-2">💡 填报建议</h3>
        <ul className="space-y-1.5 text-sm text-gold-700 leading-relaxed">
          {tips.map((tip, i) => (
            <li key={i}>• {tip}</li>
          ))}
        </ul>
      </div>

      {/* 免责声明 */}
      <p className="text-xs text-gray-300 text-center mt-6 leading-relaxed">
        数据来源：百度高考 API | 基于 2022-2024 投档线分析<br />
        仅供参考，不构成志愿填报建议，请以官方公布为准
      </p>

      {/* 操作按钮 */}
      <div className="mt-5 space-y-3">
        <button
          onClick={() => navigate('/recommend')}
          className="w-full py-3 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50"
        >
          ← 返回院校列表
        </button>
        <button
          onClick={() => navigate('/chat')}
          className="w-full py-3.5 rounded-xl text-white font-bold gradient-bg shadow-lg active:scale-[0.98] transition-all"
        >
          AI 深度分析 →
        </button>
      </div>
    </div>
  )
}

// ========== 子组件 ==========

interface CollegeSectionProps {
  title: string
  emoji: string
  desc: string
  colleges: ReportCollege[]
  color: 'orange' | 'green' | 'blue' | 'purple'
  onCollegeClick: (code: string) => void
  isErben?: boolean
}

function CollegeSection({ title, emoji, desc, colleges, color, onCollegeClick, isErben }: CollegeSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const displayColleges = expanded ? colleges : colleges.slice(0, 4)

  const colors = {
    orange: { border: 'border-orange-100', bg: 'bg-orange-50/50', tag: 'bg-orange-100 text-orange-600', dot: 'bg-orange-400' },
    green: { border: 'border-green-100', bg: 'bg-green-50/50', tag: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    blue: { border: 'border-blue-100', bg: 'bg-blue-50/50', tag: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' },
    purple: { border: 'border-purple-100', bg: 'bg-purple-50/50', tag: 'bg-purple-100 text-purple-600', dot: 'bg-purple-400' },
  }

  const c = colors[color]

  if (colleges.length === 0) return null

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-gray-700 text-sm">
          {emoji} {title}
          {!isErben && <span className="ml-2 text-xs font-normal text-gray-400">本科一批</span>}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${c.tag}`}>
          {colleges.length} 所
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{desc}</p>

      <div className="space-y-2">
        {displayColleges.map((college, idx) => (
          <CollegeCard key={college.code} college={college} idx={idx} color={color} onClick={() => onCollegeClick(college.code)} isErben={isErben} />
        ))}
      </div>

      {colleges.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-xs text-gray-400 mt-3 py-1.5 hover:text-gray-600"
        >
          {expanded ? '收起 ▲' : `展开全部 ${colleges.length} 所 ▼`}
        </button>
      )}
    </div>
  )
}

function CollegeCard({ college, idx, color, onClick, isErben }: {
  college: ReportCollege
  idx: number
  color: 'orange' | 'green' | 'blue' | 'purple'
  onClick: () => void
  isErben?: boolean
}) {
  const margin = college.margin
  // margin > 0: 你位次更大(更差) = 落后; margin < 0: 你位次更小(更好) = 领先
  const marginStr = margin > 0 ? `落后 ${margin.toLocaleString()} 名` : `领先 ${Math.abs(margin).toLocaleString()} 名`
  const marginColor = margin > 0 ? 'text-red-500' : 'text-green-600'

  // 三年趋势
  const history = college.history || []
  const trend = history.length >= 2
    ? (() => {
        // 位次数字越大=排名越靠后=越差。所以位次增大=趋势变差
        const latest = history[0].min_rank || 0
        const oldest = history[history.length - 1].min_rank || 0
        const diff = latest - oldest
        if (diff > 500) return { text: '位次走高↓', color: 'text-red-500' }
        if (diff < -500) return { text: '位次走低↑', color: 'text-green-500' }
        return { text: '位次稳定→', color: 'text-gray-500' }
      })()
    : null

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:shadow-sm transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-xs font-bold text-gray-300 mt-0.5 w-5 text-center flex-shrink-0">
            {isErben ? `C${idx + 1}` : idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h4 className="font-bold text-sm truncate">{college.name}</h4>
              {college.is_985 && <span className="text-[9px] bg-primary-100 text-primary-600 px-1 py-0.5 rounded font-medium">985</span>}
              {college.is_211 && <span className="text-[9px] bg-gold-100 text-gold-600 px-1 py-0.5 rounded font-medium">211</span>}
              {college.is_double_first && <span className="text-[9px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded font-medium">双一流</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{college.province}</span>
              {college.type && <span>· {college.type}</span>}
              {college.history?.[0]?.enrollment && <span>· 招{college.history[0].enrollment}人</span>}
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-xs text-gray-400">2024位次</p>
          <p className="font-bold text-sm">{college.latest_rank?.toLocaleString()}</p>
          <p className={`text-xs font-medium ${marginColor}`}>{marginStr}</p>
        </div>
      </div>

      {/* 三年历史 */}
      {history.length > 0 && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 ml-7">
          <span className="flex items-center gap-1">
            历史:
            {history.map((h, i) => (
              <span key={i}>
                {h.year}({h.min_rank?.toLocaleString()})
                {i < history.length - 1 && ' → '}
              </span>
            ))}
          </span>
          {trend && (
            <span className={`font-medium ${trend.color}`}>{trend.text}</span>
          )}
        </div>
      )}
    </div>
  )
}
