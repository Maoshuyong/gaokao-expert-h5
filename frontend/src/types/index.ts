export interface College {
  code: string
  name: string
  short_name?: string
  province: string
  city?: string
  level?: string
  type?: string
  is_985: boolean
  is_211: boolean
  is_double_first?: boolean
  ranking?: number
  avg_tuition?: number
  description?: string
}

export interface ScoreRecord {
  year: number
  province: string
  batch: string
  category: string
  min_score: number
  min_rank?: number
  avg_score?: number
  control_score?: number
  enrollment?: number
}

export interface ControlScore {
  category: string
  batch: string
  control_score: number | null
}

export interface ProbabilityResult {
  college_code: string
  college_name?: string
  province?: string
  city?: string
  is_985?: boolean
  is_211?: boolean
  type?: string
  ranking?: number
  probability: number | null
  level: string
  explanation: string
  historical_data?: {
    years: number[]
    avg_rank?: number
  }
}

export interface UserProfile {
  province: string
  category: string
  score: number
  rank?: number
}

export interface RecommendResponse {
  query: UserProfile
  total: number
  page: number
  page_size: number
  colleges: College[]
}

// 省份与科类映射
export const PROVINCE_CURRICULUM: Record<string, string[]> = {
  '陕西': ['文科', '理科'],
  '河南': ['文科', '理科'],
  '山西': ['文科', '理科'],
  '四川': ['文科', '理科'],
  '云南': ['文科', '理科'],
  '贵州': ['文科', '理科'],
  '广西': ['文科', '理科'],
  '甘肃': ['文科', '理科'],
  '青海': ['文科', '理科'],
  '宁夏': ['文科', '理科'],
  '新疆': ['文科', '理科'],
  '西藏': ['文科', '理科'],
  '内蒙古': ['文科', '理科'],
  '黑龙江': ['文科', '理科'],
  '吉林': ['文科', '理科'],
  '广东': ['物理类', '历史类'],
  '湖南': ['物理类', '历史类'],
  '湖北': ['物理类', '历史类'],
  '河北': ['物理类', '历史类'],
  '辽宁': ['物理类', '历史类'],
  '江苏': ['物理类', '历史类'],
  '福建': ['物理类', '历史类'],
  '重庆': ['物理类', '历史类'],
  '安徽': ['物理类', '历史类'],
  '江西': ['物理类', '历史类'],
  '山东': ['综合'],
  '浙江': ['综合'],
  '海南': ['综合'],
  '北京': ['综合'],
  '天津': ['综合'],
  '上海': ['综合'],
}

export const ALL_PROVINCES = Object.keys(PROVINCE_CURRICULUM)

// 概率档位颜色
export const LEVEL_COLORS: Record<string, string> = {
  '冲刺': 'text-orange-500 bg-orange-50 border-orange-200',
  '稳妥': 'text-green-600 bg-green-50 border-green-200',
  '保底': 'text-blue-500 bg-blue-50 border-blue-200',
  '不建议': 'text-gray-400 bg-gray-50 border-gray-200',
  '数据不足': 'text-gray-400 bg-gray-50 border-gray-200',
}
