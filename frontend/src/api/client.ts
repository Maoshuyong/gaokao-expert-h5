import type {
  College,
  ScoreRecord,
  ProbabilityResult,
  RecommendResponse,
} from '@/types'

interface ScoreLookupResponse {
  college: {
    code: string; name: string; short_name?: string; province: string;
    city?: string; is_985: boolean; is_211: boolean
  } | null
  province: string
  category: string
  history: ScoreRecord[]
}

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// 搜索院校
export async function searchColleges(params: {
  q?: string
  province?: string
  is_985?: boolean
  is_211?: boolean
  page?: number
  page_size?: number
}): Promise<College[]> {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) searchParams.set(k, String(v))
  })
  return request<College[]>(`/api/v1/colleges/?${searchParams}`)
}

// 院校详情
export async function getCollegeDetail(code: string): Promise<College> {
  return request<College>(`/api/v1/colleges/${code}`)
}

// 院校分数线
export async function getCollegeScores(code: string, params?: {
  year?: number
  province?: string
  category?: string
}): Promise<ScoreRecord[]> {
  const searchParams = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) searchParams.set(k, String(v))
  })
  return request<ScoreRecord[]>(`/api/v1/colleges/${code}/scores?${searchParams}`)
}

// 院校推荐
export async function recommendColleges(params: {
  province: string
  category: string
  score: number
  rank: number
  level?: string
  target_provinces?: string
  is_985?: boolean
  is_211?: boolean
  page?: number
  page_size?: number
}): Promise<RecommendResponse> {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) searchParams.set(k, String(v))
  })
  return request<RecommendResponse>(`/api/v1/colleges/recommend?${searchParams}`)
}

// 计算录取概率
export async function calculateProbability(params: {
  score: number
  rank: number
  province: string
  category: string
  college_codes: string[]
  year?: number
}): Promise<{ user_score: number; user_rank: number; results: ProbabilityResult[] }> {
  return request('/api/v1/probability', {
    method: 'POST',
    body: JSON.stringify({ ...params, year: params.year || 2024 }),
  })
}

// 查询分数线（POST）
export async function lookupScores(params: {
  college_code: string
  province: string
  category: string
}): Promise<ScoreLookupResponse> {
  return request('/api/v1/scores/lookup', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

interface ControlScore {
  category: string
  batch: string
  control_score: number | null
}

interface ControlScoreResponse {
  province: string
  year: number
  control_scores: ControlScore[]
}

// 控制分数线
export async function getControlScores(province: string, year: number): Promise<ControlScoreResponse> {
  return request(`/api/v1/control-scores?province=${encodeURIComponent(province)}&year=${year}`)
}

// ========== 一分一段表 ==========

interface ScoreRankResponse {
  province: string
  category: string
  score: number
  rank: number | null
  matched_score?: number
  count_this_score?: number
  total: number | null
  year: number
  method: 'exact' | 'nearest_lower' | 'none'
  message?: string
}

/**
 * 根据分数查询省排名（基于官方一分一段表）
 * 如果无数据返回 null，允许调用方降级到经验公式
 */
export async function getScoreRank(params: {
  province: string
  category: string
  score: number
  year?: number
}): Promise<ScoreRankResponse> {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) searchParams.set(k, String(v))
  })
  return request<ScoreRankResponse>(`/api/v1/score-to-rank?${searchParams}`)
}

// ========== 报告接口 ==========

interface ReportCollege {
  code: string
  name: string
  province: string
  city?: string
  type?: string
  is_985: boolean
  is_211: boolean
  is_double_first?: boolean
  latest_rank: number
  probability: number
  level: string
  display_level?: string
  margin: number
  batch?: string
  history: Array<{ year: number; min_score: number; min_rank?: number; enrollment?: number }>
}

interface ReportResponse {
  profile: {
    province: string
    category: string
    score: number
    rank: number
    position: { label: string; desc: string; emoji: string }
  }
  control_scores: {
    yiben: number | null
    erben: number | null
    yiben_diff: number | null
    erben_diff: number | null
  }
  statistics: {
    total_matched: number
    chong_count: number
    wen_count: number
    bao_count: number
  }
  recommendations: {
    chong: ReportCollege[]
    wen: ReportCollege[]
    bao: ReportCollege[]
  }
  erben_fallback: ReportCollege[]
  tips: string[]
}

export type { ReportResponse, ReportCollege }

// 生成综合分析报告
export async function generateReport(params: {
  province: string
  category: string
  score: number
  rank: number
}): Promise<ReportResponse> {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    searchParams.set(k, String(v))
  })
  return request<ReportResponse>(`/api/v1/report/generate?${searchParams}`)
}
