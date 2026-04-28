import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { recommendColleges, calculateProbability, getScoreRank } from '@/api/client'
import { getRankWithFallback } from '@/utils/helpers'

export default function StepAnalysis() {
  const navigate = useNavigate()
  const { province, category, score, controlScores, setLoading, loading, setRankData, rankData } = useAppStore()
  const [stats, setStats] = useState<{ total: number; chong: number; wen: number; bao: number } | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [rankSource, setRankSource] = useState<'api' | 'estimate'>('estimate')

  useEffect(() => {
    if (!province || !category || !score) return

    async function fetchAll() {
      try {
        // 先获取排名（优先复用 store 缓存）
        let estimatedRank: number
        let source: 'api' | 'estimate' = 'estimate'
        if (rankData) {
          estimatedRank = rankData.rank
          source = rankData.source
          setRank(estimatedRank)
          setRankSource(source)
        } else {
          const result = await getRankWithFallback(province, category, score, getScoreRank)
          estimatedRank = result.rank
          source = result.source
          setRankData({ rank: estimatedRank, source })
          setRank(estimatedRank)
          setRankSource(source)
        }

        const res = await recommendColleges({
          province,
          category,
          score,
          rank: estimatedRank,
          page: 1,
          page_size: 2000,
        })
        // 批量计算概率
        const codes = res.colleges.slice(0, 100).map((c) => c.code)
        let countMap = { chong: 0, wen: 0, bao: 0, bujianyi: 0 }
        if (codes.length > 0) {
          const probRes = await calculateProbability({
            score,
            rank: estimatedRank,
            province,
            category,
            college_codes: codes,
          })
          probRes.results.forEach((r) => {
            if (r.level === '冲刺') countMap.chong++
            else if (r.level === '稳妥') countMap.wen++
            else if (r.level === '保底') countMap.bao++
            else countMap.bujianyi++
          })
        }
        setStats({ total: res.total, chong: countMap.chong, wen: countMap.wen, bao: countMap.bao })
      } catch (err) {
        console.error(err)
      }
    }
    fetchAll()
  }, [province, category, score])

  // 过滤出当前科类的省控线
  const myControlScores = controlScores.filter((s) => s.category === category)

  const yiben = myControlScores.find((s) => s.batch === '本科一批')
  const erben = myControlScores.find((s) => s.batch === '本科二批')
  const yibenPass = yiben && yiben.control_score ? score >= yiben.control_score : null
  const erbenPass = erben && erben.control_score ? score >= erben.control_score : null
  const yibenDiff = yiben && yiben.control_score ? score - yiben.control_score : null
  const erbenDiff = erben && erben.control_score ? score - erben.control_score : null

  // 分数段定位
  function getScorePosition() {
    if (!yiben || !yiben.control_score) return null
    if (!erben || !erben.control_score) return null
    if (yibenDiff === null) return null
    if (yibenDiff >= 80) return { label: '高分段', desc: '你的分数远超一本线，可以考虑中流985/强势211', emoji: '🏆' }
    if (yibenDiff >= 50) return { label: '中高分段', desc: '你的分数超一本线较多，有较多样性选择空间', emoji: '🌟' }
    if (yibenDiff >= 20) return { label: '中等偏上', desc: '超一本线不多，建议在专业和城市之间做好取舍', emoji: '📊' }
    if (yibenDiff >= 0) return { label: '压线段', desc: '刚过一本线，需要特别注意滑档风险，做好二批保底', emoji: '⚡' }
    if (erbenDiff !== null && erbenDiff >= 0) return { label: '二本高分段', desc: '未达一本线但超二本线较多，二批有好学校可选', emoji: '📈' }
    return { label: '二本段', desc: '建议关注二批次中的优势院校和特色专业', emoji: '📋' }
  }

  const position = getScorePosition()

  return (
    <div className="px-4 py-6">
      {/* 分数展示 */}
      <div className="text-center mb-6">
        <div className="inline-block gradient-bg rounded-2xl px-8 py-5 text-white">
          <p className="text-sm opacity-80 mb-1">{province} · {category}</p>
          <p className="text-5xl font-bold">{score}</p>
          <p className="text-sm opacity-80 mt-1">高考成绩</p>
        </div>
      </div>

      {/* 分数段定位卡片 */}
      {position && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{position.emoji}</span>
            <div>
              <h3 className="font-bold text-gray-700">分数定位：{position.label}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{position.desc}</p>
            </div>
          </div>

          {/* 位次估算 */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">
              {rankSource === 'api' ? '省排名（官方一分一段表）' : '预估省排名'}
            </p>
            <p className="text-2xl font-bold text-primary-600">
              ~{rank?.toLocaleString() ?? '...'}
            </p>
            {rankSource === 'estimate' && (
              <p className="text-xs text-gray-400 mt-1">（经验估算，以官方一分一段表为准）</p>
            )}
          </div>
        </div>
      )}

      {/* 冲稳保概览 */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-3">🎯 匹配院校分布</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center bg-orange-50 rounded-xl py-3 border border-orange-100">
              <p className="text-2xl font-bold text-orange-500">{stats.chong}</p>
              <p className="text-xs text-orange-600 mt-0.5">冲刺</p>
            </div>
            <div className="text-center bg-green-50 rounded-xl py-3 border border-green-100">
              <p className="text-2xl font-bold text-green-600">{stats.wen}</p>
              <p className="text-xs text-green-600 mt-0.5">稳妥</p>
            </div>
            <div className="text-center bg-blue-50 rounded-xl py-3 border border-blue-100">
              <p className="text-2xl font-bold text-blue-500">{stats.bao}</p>
              <p className="text-xs text-blue-600 mt-0.5">保底</p>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400">
            共 {stats.total.toLocaleString()} 所匹配院校（基于 2022-2024 三年数据）
          </p>
        </div>
      )}

      {/* 省控线对比 */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">📊 2024 省控线对比</h3>

        {yiben && (
          <div className={`p-4 rounded-xl border ${
            yibenPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">本科一批</p>
                <p className="text-lg font-bold">{yiben.control_score} 分</p>
              </div>
              <div className="text-right">
                {yibenDiff !== null && (
                  <p className={`text-lg font-bold ${yibenDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {yibenDiff >= 0 ? '+' : ''}{yibenDiff}
                  </p>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  yibenPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {yibenPass ? '✓ 已过线' : '✗ 未达线'}
                </span>
              </div>
            </div>
          </div>
        )}

        {erben && (
          <div className={`p-4 rounded-xl border ${
            erbenPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">本科二批</p>
                <p className="text-lg font-bold">{erben.control_score} 分</p>
              </div>
              <div className="text-right">
                {erbenDiff !== null && (
                  <p className={`text-lg font-bold ${erbenDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {erbenDiff >= 0 ? '+' : ''}{erbenDiff}
                  </p>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  erbenPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {erbenPass ? '✓ 已过线' : '✗ 未达线'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 其他批次 */}
        {myControlScores
          .filter((s) => s.batch !== '本科一批' && s.batch !== '本科二批')
          .slice(0, 4)
          .map((s) => {
            const diff = s.control_score ? score - s.control_score : null
            const pass = diff !== null && diff >= 0
            return (
              <div key={s.batch} className={`p-3 rounded-xl border ${
                pass ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{s.batch}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.control_score || '-'} 分</span>
                    {diff !== null && (
                      <span className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-400'}`}>
                        {diff >= 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* 策略提示 */}
      {position && (
        <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mb-6">
          <h4 className="font-bold text-gold-700 text-sm mb-2">💡 填报策略提示</h4>
          <div className="space-y-1.5 text-sm text-gold-600 leading-relaxed">
            {yibenDiff !== null && yibenDiff >= 0 && yibenDiff < 40 && (
              <p>• 你超一本线 <b>{yibenDiff} 分</b>，211 机会有限，建议关注强势双非和中外合办院校</p>
            )}
            {yibenDiff !== null && yibenDiff >= 40 && (
              <p>• 你超一本线 <b>{yibenDiff} 分</b>，有一定选择空间，可以冲刺中流 211</p>
            )}
            <p>• 记得同时填报本科二批作为保底</p>
            <p>• 稳妥志愿安全余量建议 ≥1500 名，宁可浪费位次不要卡线</p>
          </div>
        </div>
      )}

      {/* 下一页按钮 */}
      <button
        onClick={() => navigate('/recommend')}
        className="w-full py-3.5 rounded-xl text-white font-bold gradient-bg shadow-lg active:scale-[0.98] transition-all"
      >
        查看院校推荐（{stats ? stats.total.toLocaleString() : '...'} 所）→
      </button>

      {/* 快捷入口：直接生成报告 */}
      {stats && stats.total > 0 && (
        <button
          onClick={() => navigate('/report')}
          className="w-full mt-3 py-3 border border-primary-200 rounded-xl text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors"
        >
          📊 直接生成完整志愿报告
        </button>
      )}
    </div>
  )
}
