interface Props {
  current: number
  total: number
}

const STEPS = ['输入信息', '分数分析', '院校推荐', '院校详情']

export default function ProgressBar({ current, total }: Props) {
  return (
    <div className="px-4 py-3 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        {STEPS.map((label, i) => {
          const step = i + 1
          const isActive = step === current
          const isDone = step < current
          return (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-primary-500 text-white'
                      : isActive
                      ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? '✓' : step}
                </div>
                <span
                  className={`text-[10px] mt-1 ${
                    isActive ? 'text-primary-600 font-medium' : isDone ? 'text-gray-500' : 'text-gray-300'
                  }`}
                >
                  {label}
                </span>
              </div>
              {step < total && (
                <div
                  className={`flex-1 h-0.5 mx-1.5 mt-[-14px] ${
                    step < current ? 'bg-primary-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
