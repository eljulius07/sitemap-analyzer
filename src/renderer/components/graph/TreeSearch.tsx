import { useTreeStore } from '../../stores/treeStore'

export function TreeSearch(): JSX.Element {
  const searchQuery = useTreeStore((s) => s.searchQuery)
  const searchResults = useTreeStore((s) => s.searchResults)
  const search = useTreeStore((s) => s.search)
  const zoomToNode = useTreeStore((s) => s.zoomToNode)

  return (
    <div className="relative">
      <input
        value={searchQuery}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && searchResults.length > 0) zoomToNode(searchResults[0])
        }}
        placeholder="Search node 🔍"
        className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-900 w-48"
      />
      {searchQuery && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
          {searchResults.length}
        </span>
      )}
    </div>
  )
}
