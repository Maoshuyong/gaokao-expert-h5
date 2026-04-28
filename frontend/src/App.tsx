import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from '@/store'
import StepInput from '@/components/StepInput'
import StepAnalysis from '@/components/StepAnalysis'
import StepRecommend from '@/components/StepRecommend'
import StepDetail from '@/components/StepDetail'
import StepChat from '@/components/StepChat'
import StepReport from '@/components/StepReport'
import ProgressBar from '@/components/ProgressBar'

export default function App() {
  const currentStep = useAppStore((s) => s.currentStep)

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* 顶部导航 */}
        <header className="gradient-bg text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <h1 className="text-lg font-bold tracking-wide">🎓 志愿填报专家</h1>
          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={() => window.history.back()}
              className="text-sm opacity-80 hover:opacity-100"
            >
              返回
            </button>
          )}
        </header>

        {/* 进度条 */}
        {currentStep >= 1 && currentStep <= 4 && <ProgressBar current={currentStep} total={4} />}

        {/* 页面内容 */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<StepInput />} />
            <Route path="/analysis" element={<StepAnalysis />} />
            <Route path="/recommend" element={<StepRecommend />} />
            <Route path="/college/:code" element={<StepDetail />} />
            <Route path="/chat" element={<StepChat />} />
            <Route path="/report" element={<StepReport />} />
          </Routes>
        </main>

        {/* AI 对话浮动按钮 */}
        {currentStep !== 5 && (
          <button
            onClick={() => window.location.href = '/chat'}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full gradient-bg text-white shadow-lg flex items-center justify-center text-xl hover:shadow-xl transition-all z-50 card-hover"
          >
            🤖
          </button>
        )}
      </div>
    </BrowserRouter>
  )
}
