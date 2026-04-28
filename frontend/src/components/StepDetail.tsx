import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { getCollegeDetail, getCollegeScores, calculateProbability, getScoreRank } from '@/api/client'
import { getRankWithFallback } from '@/utils/helpers'
import type { College, ScoreRecord } from '@/types'

export default function StepDetail() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { province, category, score, setStep, rankData, setRankData } = useAppStore()
  const [college, setCollege] = useState<College | null>(null)
  const [scores, setScores] = useState<ScoreRecord[]>([])
  const [prob, setProb] = useState<{ probability: number | null; level: string; explanation: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    setStep(4)
    setLoading(true)

    async function fetchData() {
      try {
        const [collegeData, scoresData] = await Promise.all([
          getCollegeDetail(code!),
          getCollegeScores(code!, { province: province!, category: category! }),
        ])
        setCollege(collegeData)
        setScores(scoresData)

        // 计算概率（排名优先复用 store 缓存）
        if (score && province && category) {
          let rank: number
          if (rankData) {
            rank = rankData.rank
          } else {
            const result = await getRankWithFallback(province!, category!, score!, getScoreRank)
            rank = result.rank
            setRankData({ rank, source: result.source })
          }
          const probRes = await calculateProbability({
            score: score!,
            rank,
            province: province!,
            category: category!,
            college_codes: [code!],
          })
          if (probRes.results[0]) {
            const r = probRes.results[0]
            setProb({ probability: r.probability, level: r.level, explanation: r.explanation })
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [code, province, category, score])

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="animate-spin text-3xl mb-3">⏳</div>
        <p>加载中...</p>
      </div>
    )
  }

  if (!college) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-3xl mb-3">😕</p>
        <p>院校信息未找到</p>
      </div>
    )
  }

  const probColor = prob
    ? { '冲刺': 'text-orange-500', '稳妥': 'text-green-600', '保底': 'text-blue-500', '不建议': 'text-gray-400', '数据不足': 'text-gray-400' }[prob.level]
    : 'text-gray-400'
  const probBg = prob
    ? { '冲刺': 'bg-orange-50 border-orange-200', '稳妥': 'bg-green-50 border-green-200', '保底': 'bg-blue-50 border-blue-200', '不建议': 'bg-gray-50 border-gray-200', '数据不足': 'bg-gray-50 border-gray-200' }[prob.level]
    : 'bg-gray-50 border-gray-200'

  return (
    <div className="px-4 py-4">
      {/* 院校头部 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {(college.name || '').charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold mb-1">{college.name}</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {college.is_985 && <span className="text-[10px] bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full font-medium">985</span>}
              {college.is_211 && <span className="text-[10px] bg-gold-100 text-gold-600 px-2 py-0.5 rounded-full font-medium">211</span>}
              {college.is_double_first && <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">双一流</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center bg-gray-50 rounded-lg py-2">
            <p className="text-xs text-gray-400">所在地</p>
            <p className="text-sm font-medium">{college.province}</p>
          </div>
          <div className="text-center bg-gray-50 rounded-lg py-2">
            <p className="text-xs text-gray-400">类型</p>
            <p className="text-sm font-medium">{college.type || '-'}</p>
          </div>
          <div className="text-center bg-gray-50 rounded-lg py-2">
            <p className="text-xs text-gray-400">层次</p>
            <p className="text-sm font-medium">{college.level || '-'}</p>
          </div>
        </div>
      </div>

      {/* 录取概率 */}
      {prob && (
        <div className={`rounded-2xl border p-5 mb-4 ${probBg}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">🎯 录取概率</h3>
            <span className={`text-lg font-bold ${probColor}`}>{prob.level}</span>
          </div>
          {prob.probability !== null && (
            <div className="mb-3">
              <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full gradient-bg transition-all duration-500"
                  style={{ width: `${Math.round(prob.probability * 100)}%` }}
                />
              </div>
              <p className="text-right text-sm mt-1 font-medium" style={{ color: probColor }}>
                {Math.round(prob.probability * 100)}%
              </p>
            </div>
          )}
          <p className="text-sm text-gray-500 leading-relaxed">{prob.explanation}</p>
        </div>
      )}

      {/* 历年分数线 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3">📊 {province}·{category} 历年分数线</h3>
        {scores.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-400 font-medium">年份</th>
                  <th className="text-left py-2 text-gray-400 font-medium">批次</th>
                  <th className="text-right py-2 text-gray-400 font-medium">最低分</th>
                  <th className="text-right py-2 text-gray-400 font-medium">最低位次</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2.5 font-medium">{s.year}</td>
                    <td className="py-2.5 text-gray-500">
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{s.batch}</span>
                    </td>
                    <td className={`py-2.5 text-right font-bold ${s.min_score <= (score || 0) ? 'text-green-600' : 'text-red-500'}`}>
                      {s.min_score || '-'}
                    </td>
                    <td className="py-2.5 text-right text-gray-500">
                      {s.min_rank ? s.min_rank.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-6 text-sm">暂无录取数据</p>
        )}
      </div>

      {/* 返回按钮 */}
      <button
        onClick={() => navigate('/recommend')}
        className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 mb-4"
      >
        ← 返回院校列表
      </button>
    </div>
  )
}
