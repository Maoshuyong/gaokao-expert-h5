import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { recommendColleges, calculateProbability, getScoreRank } from '@/api/client'
import { getRankWithFallback } from '@/utils/helpers'
import type { College } from '@/types'

const TABS = ['全部', '冲刺', '稳妥', '保底'] as const
type Tab = (typeof TABS)[number]

const LEVEL_TAB_MAP: Record<string, Tab> = {
  '冲刺': '冲刺',
  '稳妥': '稳妥',
  '保底': '保底',
  '不建议': '冲刺',  // 不建议的院校仍可查看，归入冲刺（但标签会标红）
}

// 热门城市筛选
const CITY_FILTERS = ['全部', '北京', '上海', '江苏', '浙江', '广东', '天津', '重庆', '陕西']

export default function StepRecommend() {
  const navigate = useNavigate()
  const { province, category, score, setColleges, colleges, totalColleges, probabilityMap, setProbability, setStep, loading, setLoading, rankData, setRankData } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('全部')
  const [page, setPage] = useState(1)
  const [filter985, setFilter985] = useState(false)
  const [filter211, setFilter211] = useState(false)
  const [cityFilter, setCityFilter] = useState('全部')
  const [showCityPicker, setShowCityPicker] = useState(false)

  const fetchColleges = useCallback(async () => {
    setLoading(true)
    try {
      setStep(3)
      // 获取排名（优先复用 store 缓存）
      let rank: number
      if (rankData) {
        rank = rankData.rank
      } else {
        const result = await getRankWithFallback(province, category, score, getScoreRank)
        rank = result.rank
        setRankData({ rank, source: result.source })
      }
      const res = await recommendColleges({
        province,
        category,
        score,
        rank,
        page,
        page_size: 20,
        is_985: filter985 || undefined,
        is_211: filter211 || undefined,
        target_provinces: cityFilter !== '全部' ? cityFilter : undefined,
      })
      setColleges(res.colleges, res.total)

      const codes = res.colleges.map((c) => c.code)
      if (codes.length > 0) {
        const probRes = await calculateProbability({
          score,
          rank,
          province,
          category,
          college_codes: codes,
        })
        probRes.results.forEach((r) => {
          setProbability(r.college_code, r.probability, r.level)
        })
      }
    } catch (err) {
      console.error(err)
      alert('获取推荐院校失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [province, category, score, page, filter985, filter211, cityFilter])

  useEffect(() => {
    fetchColleges()
  }, [fetchColleges])

  const filteredColleges = activeTab === '全部'
    ? colleges
    : colleges.filter((c) => {
        const p = probabilityMap[c.code]
        if (!p) return false
        return LEVEL_TAB_MAP[p.level] === activeTab
      })

  const countMap: Record<string, number> = { 全部: colleges.length, 冲刺: 0, 稳妥: 0, 保底: 0 }
  colleges.forEach((c) => {
    const p = probabilityMap[c.code]
    if (p) {
      const tab = LEVEL_TAB_MAP[p.level]
      if (tab) countMap[tab]++
    }
  })

  function CollegeCard({ college }: { college: College }) {
    const prob = probabilityMap[college.code]
    const levelColor = prob
      ? {
          '冲刺': 'border-orange-300 bg-orange-50',
          '稳妥': 'border-green-300 bg-green-50',
          '保底': 'border-blue-300 bg-blue-50',
          '不建议': 'border-red-200 bg-red-50',
          '数据不足': 'border-gray-200 bg-gray-50',
        }[prob.level] || 'border-gray-100 bg-white'
      : 'border-gray-100 bg-white'

    const levelBadge = prob
      ? {
          '冲刺': 'bg-orange-100 text-orange-600',
          '稳妥': 'bg-green-100 text-green-700',
          '保底': 'bg-blue-100 text-blue-600',
          '不建议': 'bg-red-100 text-red-600',
          '数据不足': 'bg-gray-100 text-gray-400',
        }[prob.level] || 'bg-gray-100 text-gray-400'
      : 'bg-gray-100 text-gray-400'

    return (
      <div
        onClick={() => navigate(`/college/${college.code}`)}
        className={`p-4 rounded-xl border ${levelColor} card-hover cursor-pointer`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <h3 className="font-bold text-base truncate">{college.name}</h3>
              {college.is_985 && <span className="text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">985</span>}
              {college.is_211 && <span className="text-[10px] bg-gold-100 text-gold-600 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">211</span>}
            </div>
            <p className="text-xs text-gray-500">
              {college.province}
              {college.type ? ` · ${college.type}` : ''}
              {college.level ? ` · ${college.level}` : ''}
            </p>
          </div>
          {prob && (
            <div className="text-right flex-shrink-0 ml-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelBadge}`}>
                {prob.level}
              </span>
              {prob.probability !== null && (
                <p className="text-lg font-bold text-primary-600 mt-1">
                  {Math.round(prob.probability * 100)}%
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      {/* 摘要 */}
      <div className="bg-gray-50 rounded-xl p-3 mb-4 text-center">
        <p className="text-sm text-gray-600">
          共找到 <span className="font-bold text-primary-600">{totalColleges}</span> 所院校
          <span className="ml-2 text-gray-400">
            （冲刺 {countMap['冲刺']} / 稳妥 {countMap['稳妥']} / 保底 {countMap['保底']}）
          </span>
        </p>
      </div>

      {/* 筛选栏 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {/* 城市 */}
        <button
          onClick={() => setShowCityPicker(!showCityPicker)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
            cityFilter !== '全部' ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-white border-gray-200 text-gray-500'
          }`}
        >
          📍 {cityFilter === '全部' ? '城市' : cityFilter}
        </button>
        <button
          onClick={() => setFilter985(!filter985)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
            filter985 ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-white border-gray-200 text-gray-500'
          }`}
        >
          985
        </button>
        <button
          onClick={() => setFilter211(!filter211)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
            filter211 ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-white border-gray-200 text-gray-500'
          }`}
        >
          211
        </button>
      </div>

      {/* 城市选择器 */}
      {showCityPicker && (
        <div className="flex gap-2 mb-4 flex-wrap animate-fadeIn">
          {CITY_FILTERS.map((city) => (
            <button
              key={city}
              onClick={() => {
                setCityFilter(city)
                setShowCityPicker(false)
                setPage(1)
              }}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                cityFilter === city
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white border-gray-200 text-gray-500'
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {tab}
            <span className="ml-1 text-xs text-gray-400">{countMap[tab]}</span>
          </button>
        ))}
      </div>

      {/* 院校列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="animate-spin text-3xl mb-3">⏳</div>
          <p>正在为你筛选院校...</p>
        </div>
      ) : filteredColleges.length > 0 ? (
        <div className="space-y-3">
          {filteredColleges.map((college) => (
            <CollegeCard key={college.code} college={college} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-3">📭</p>
          <p>暂无匹配的院校</p>
          <p className="text-sm mt-1">试试切换其他筛选条件</p>
        </div>
      )}

      {/* 加载更多 */}
      {!loading && colleges.length < totalColleges && (
        <button
          onClick={() => setPage(page + 1)}
          className="w-full mt-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
        >
          加载更多（已加载 {colleges.length}/{totalColleges}）
        </button>
      )}

      {/* 生成报告按钮 */}
      {!loading && colleges.length > 0 && (
        <div className="mt-5 space-y-3">
          <button
            onClick={() => navigate('/report')}
            className="w-full py-3.5 rounded-xl text-white font-bold gradient-bg shadow-lg active:scale-[0.98] transition-all"
          >
            📊 生成完整志愿报告
          </button>
        </div>
      )}
    </div>
  )
}
