import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { ALL_PROVINCES, PROVINCE_CURRICULUM } from '@/types'
import { getControlScores } from '@/api/client'

export default function StepInput() {
  const navigate = useNavigate()
  const { setProfile, setControlScores, setStep, setLoading, loading } = useAppStore()

  const [province, setProvince] = useState('')
  const [category, setCategory] = useState('')
  const [score, setScore] = useState('')

  const categories = province ? PROVINCE_CURRICULUM[province] || [] : []

  async function handleSubmit() {
    if (!province || !category || !score) return
    const scoreNum = parseInt(score)
    if (isNaN(scoreNum) || scoreNum < 100 || scoreNum > 750) return

    setLoading(true)
    try {
      setProfile(province, category, scoreNum, null)
      setStep(2)

      // 获取省控线
      const data = await getControlScores(province, 2024)
      setControlScores(data.control_scores)

      navigate('/analysis')
    } catch (err) {
      alert('查询失败，请稍后重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6">
      {/* 顶部 Banner */}
      <div className="gradient-bg rounded-2xl p-5 mb-6 text-white">
        <h2 className="text-xl font-bold mb-2">🎓 高考志愿填报专家</h2>
        <p className="text-sm opacity-90 leading-relaxed">
          输入你的高考信息，AI 帮你智能推荐院校，精准计算录取概率
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs opacity-80">
          <span className="bg-white/20 rounded-full px-2 py-0.5">数据覆盖 1597 所院校</span>
          <span className="bg-white/20 rounded-full px-2 py-0.5">2022-2024 真实投档线</span>
        </div>
      </div>

      {/* 输入表单 */}
      <div className="space-y-5">
        {/* 省份 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📍 所在省份
          </label>
          <select
            value={province}
            onChange={(e) => {
              setProvince(e.target.value)
              setCategory('') // 切换省份时重置科类
            }}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base appearance-none"
          >
            <option value="">请选择省份</option>
            {ALL_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* 科类 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📋 考试科类
          </label>
          <div className="grid grid-cols-2 gap-3">
            {categories.length > 0 ? (
              categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`py-3 rounded-xl text-base font-medium transition-all ${
                    category === c
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {c}
                </button>
              ))
            ) : (
              <div className="col-span-2 py-3 text-center text-sm text-gray-400">
                请先选择省份
              </div>
            )}
          </div>
        </div>

        {/* 分数 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📊 高考分数
          </label>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="请输入高考总分"
            min={100}
            max={750}
            inputMode="numeric"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base"
          />
        </div>

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={!province || !category || !score || loading}
          className={`w-full py-3.5 rounded-xl text-white font-bold text-base transition-all ${
            province && category && score && !loading
              ? 'gradient-bg shadow-lg active:scale-[0.98]'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="animate-pulse-slow">查询中...</span>
          ) : (
            '开始分析 →'
          )}
        </button>
      </div>

      {/* 底部提示 */}
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>数据来源：百度高考 API | 仅供参考，以官方为准</p>
      </div>
    </div>
  )
}
