/**
 * 经验公式降级：当 API 无排名数据时使用
 * 仅用于无官方一分一段表的省份/科类
 */
export function fallbackRank(score: number): number {
  return Math.max(1, Math.round(300000 * Math.pow((750 - score) / 650, 2.5)))
}

/**
 * 获取排名（优先从 store 读缓存，否则调 API，最后降级经验公式）
 */
export async function getRankWithFallback(
  province: string,
  category: string,
  score: number,
  getScoreRank: (params: { province: string; category: string; score: number }) => Promise<{ rank: number | null; method?: string }>,
): Promise<{ rank: number; source: 'api' | 'estimate' }> {
  try {
    const res = await getScoreRank({ province, category, score })
    if (res.rank) {
      return { rank: res.rank, source: res.method === 'exact' ? 'api' : 'estimate' }
    }
  } catch {
    // API 失败，降级
  }
  return { rank: fallbackRank(score), source: 'estimate' }
}

/**
 * 从报告数据中构建结构化的 prompt 上下文
 */
export function buildReportContext(report: {
  profile: { province: string; category: string; score: number; rank: number; position: { label: string; desc: string; emoji: string } }
  control_scores: { yiben: number | null; erben: number | null; yiben_diff: number | null; erben_diff: number | null }
  statistics: { total_matched: number; chong_count: number; wen_count: number; bao_count: number }
  recommendations: {
    chong: Array<{ code: string; name: string; province: string; type?: string; is_985: boolean; is_211: boolean; is_double_first?: boolean; latest_rank: number; margin: number; history: Array<{ year: number; min_rank?: number }> }>
    wen: Array<{ code: string; name: string; province: string; type?: string; is_985: boolean; is_211: boolean; is_double_first?: boolean; latest_rank: number; margin: number; history: Array<{ year: number; min_rank?: number }> }>
    bao: Array<{ code: string; name: string; province: string; type?: string; is_985: boolean; is_211: boolean; is_double_first?: boolean; latest_rank: number; margin: number; history: Array<{ year: number; min_rank?: number }> }>
  }
  erben_fallback: Array<{ code: string; name: string; province: string; type?: string; latest_rank: number; margin: number }>
  tips: string[]
}): string {
  const { profile, control_scores: cs, statistics: stats, recommendations: rec, erben_fallback, tips } = report
  const lines: string[] = []

  // 基础信息
  lines.push(
    `我是${profile.province}${profile.category}考生，高考${profile.score}分（省排名${profile.rank.toLocaleString()}名），${profile.position.emoji} ${profile.position.label}。`,
    '',
  )

  // 省控线
  if (cs.yiben) {
    lines.push(`【省控线】本科一批 ${cs.yiben}分（${cs.yiben_diff! >= 0 ? '+' : ''}${cs.yiben_diff}分）`)
  }
  if (cs.erben) {
    lines.push(`【省控线】本科二批 ${cs.erben}分（${cs.erben_diff! >= 0 ? '+' : ''}${cs.erben_diff}分）`)
  }

  // 匹配统计
  lines.push(
    '',
    `【匹配院校】共${stats.total_matched}所（冲刺${stats.chong_count}/稳妥${stats.wen_count}/保底${stats.bao_count}）`,
  )

  // 院校列表（每个档次最多 10 所，避免 prompt 过长）
  function formatColleges(label: string, colleges: typeof rec.chong): string {
    if (colleges.length === 0) return ''
    const items: string[] = []
    const list = colleges.slice(0, 10)
    for (const c of list) {
      const tags: string[] = []
      if (c.is_985) tags.push('985')
      if (c.is_211) tags.push('211')
      if (c.is_double_first) tags.push('双一流')
      const tagStr = tags.length > 0 ? `（${tags.join('/')}）` : ''
      const marginStr = c.margin > 0
        ? `落后${c.margin.toLocaleString()}名`
        : `领先${Math.abs(c.margin).toLocaleString()}名`
      // 位次趋势
      const history = c.history || []
      let trendStr = ''
      if (history.length >= 2) {
        const latest = history[0].min_rank || 0
        const oldest = history[history.length - 1].min_rank || 0
        const diff = latest - oldest
        if (diff > 500) trendStr = ' 位次走高↓'
        else if (diff < -500) trendStr = ' 位次走低↑'
        else trendStr = ' 位次稳定→'
      }
      items.push(`${c.name}${tagStr} - ${c.province} - 2024位次${c.latest_rank.toLocaleString()}（${marginStr}${trendStr}）`)
    }
    const header = `【${label}】${colleges.length > 10 ? `（前10/${colleges.length}所）` : ''}`
    return `${header}\n${items.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
  }

  lines.push(formatColleges('冲刺院校', rec.chong))
  lines.push(formatColleges('稳妥院校', rec.wen))
  lines.push(formatColleges('保底院校', rec.bao))

  // 本二批兜底
  if (erben_fallback.length > 0) {
    const items = erben_fallback.slice(0, 5).map((c, i) =>
      `${i + 1}. ${c.name} - ${c.province} - 2024位次${c.latest_rank.toLocaleString()}`,
    ).join('\n')
    lines.push(`\n【本科二批兜底】${erben_fallback.length > 5 ? `（前5/${erben_fallback.length}所）` : ''}\n${items}`)
  }

  // 填报建议
  if (tips.length > 0) {
    lines.push('', '【填报建议】', ...tips.map((t) => `• ${t}`))
  }

  lines.push('', '请基于以上真实投档线数据，帮我分析志愿方案。')
  return lines.join('\n')
}

/**
 * 基础 prompt（无报告数据时的 fallback）
 */
export function buildBasicPrompt(
  province: string,
  category: string,
  score: number,
  rankText: string,
): string {
  return `我是${province}${category}考生，高考${score}分（省排名约${rankText}），请帮我分析能上哪些大学，推荐合适的志愿方案。`
}
