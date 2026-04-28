import { create } from 'zustand'
import type { ReportResponse } from '@/api/client'

interface RankData {
  rank: number
  source: 'api' | 'estimate'
}

interface AppState {
  // 用户输入
  province: string
  category: string
  score: number
  rank: number | null

  // 结果数据
  controlScores: Array<{ category: string; batch: string; control_score: number | null }>
  colleges: Array<{
    code: string
    name: string
    province: string
    city?: string
    level?: string
    type?: string
    is_985: boolean
    is_211: boolean
    ranking?: number
  }>
  totalColleges: number
  probabilityMap: Record<string, { probability: number | null; level: string }>

  // 排名数据（全局共享，避免重复 API 调用）
  rankData: RankData | null

  // 报告数据（StepReport 生成后存入，StepChat 直接读取）
  reportData: ReportResponse | null

  // 状态
  loading: boolean
  currentStep: number // 1-6

  // 操作
  setProfile: (province: string, category: string, score: number, rank: number | null) => void
  setControlScores: (scores: Array<{ category: string; batch: string; control_score: number | null }>) => void
  setColleges: (colleges: AppState['colleges'], total: number) => void
  setProbability: (code: string, probability: number | null, level: string) => void
  setRankData: (data: RankData | null) => void
  setReportData: (data: ReportResponse | null) => void
  setLoading: (loading: boolean) => void
  setStep: (step: number) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  province: '',
  category: '',
  score: 0,
  rank: null,
  controlScores: [],
  colleges: [],
  totalColleges: 0,
  probabilityMap: {},
  rankData: null,
  reportData: null,
  loading: false,
  currentStep: 1,

  setProfile: (province, category, score, rank) =>
    set({ province, category, score, rank }),

  setControlScores: (controlScores) =>
    set({ controlScores }),

  setColleges: (colleges, totalColleges) =>
    set({ colleges, totalColleges }),

  setProbability: (code, probability, level) =>
    set((state) => ({
      probabilityMap: { ...state.probabilityMap, [code]: { probability, level } },
    })),

  setRankData: (rankData) => set({ rankData }),

  setReportData: (reportData) => set({ reportData }),

  setLoading: (loading) => set({ loading }),
  setStep: (currentStep) => set({ currentStep }),

  reset: () =>
    set({
      province: '',
      category: '',
      score: 0,
      rank: null,
      controlScores: [],
      colleges: [],
      totalColleges: 0,
      probabilityMap: {},
      rankData: null,
      reportData: null,
      loading: false,
      currentStep: 1,
    }),
}))
