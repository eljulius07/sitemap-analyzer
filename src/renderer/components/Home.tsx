import { useStore } from '../stores/analysisStore'
import { useSpiderStore } from '../stores/spiderStore'
import { ModeSelector } from './ModeSelector'
import { SitemapInput } from './SitemapInput'
import { SpiderConfig } from './SpiderConfig'
import { SpiderProgress } from './SpiderProgress'

export function Home(): JSX.Element {
  const inputMode = useStore((s) => s.inputMode)
  const spiderRunning = useSpiderStore((s) => s.running)

  return (
    <div className="flex-1 overflow-auto flex flex-col items-center p-8">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Site Analyzer</h1>
        </div>

        {spiderRunning ? (
          <SpiderProgress />
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="w-full max-w-2xl">
              <ModeSelector />
            </div>
            {inputMode === 'sitemap' ? <SitemapInput /> : <SpiderConfig />}
          </div>
        )}
      </div>
    </div>
  )
}
