import type { GraphData } from '@shared/types'

export function graphToJson(graph: GraphData): string {
  return JSON.stringify(graph, null, 2)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function graphToGexf(graph: GraphData): string {
  const nodeAttrs = `    <attributes class="node">
      <attribute id="depth" title="depth" type="integer"/>
      <attribute id="status" title="status" type="integer"/>
      <attribute id="health" title="healthScore" type="integer"/>
      <attribute id="title" title="pageTitle" type="string"/>
      <attribute id="group" title="group" type="string"/>
    </attributes>`
  const edgeAttrs = `    <attributes class="edge">
      <attribute id="type" title="type" type="string"/>
    </attributes>`
  const nodes = graph.nodes
    .map(
      (n) =>
        `      <node id="${esc(n.id)}" label="${esc(n.pageTitle || n.url)}">
        <attvalues>
          <attvalue for="depth" value="${n.depth}"/>
          <attvalue for="status" value="${n.status ?? 0}"/>
          <attvalue for="health" value="${n.healthScore}"/>
          <attvalue for="title" value="${esc(n.pageTitle)}"/>
          <attvalue for="group" value="${esc(n.group)}"/>
        </attvalues>
      </node>`
    )
    .join('\n')
  const edges = graph.edges
    .map(
      (e, i) =>
        `      <edge id="${i}" source="${esc(e.source)}" target="${esc(e.target)}">
        <attvalues><attvalue for="type" value="${e.type}"/></attvalues>
      </edge>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.3" version="1.3">
  <meta lastmodifieddate="${graph.metadata.crawlDate.slice(0, 10)}">
    <creator>Site Analyzer</creator>
    <description>Site graph for ${esc(graph.metadata.rootUrl)}</description>
  </meta>
  <graph mode="static" defaultedgetype="directed">
${nodeAttrs}
${edgeAttrs}
    <nodes>
${nodes}
    </nodes>
    <edges>
${edges}
    </edges>
  </graph>
</gexf>
`
}

export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
}

/** Render the SVG to a high-res PNG. Resolves to PNG bytes. */
export function svgToPng(svg: SVGSVGElement, scale = 2): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const rect = svg.viewBox.baseVal
    const width = rect && rect.width ? rect.width : svg.clientWidth || 1200
    const height = rect && rect.height ? rect.height : svg.clientHeight || 800
    const xml = serializeSvg(svg)
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas 2d context unavailable'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('toBlob failed'))
          return
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('failed to rasterize SVG'))
    }
    img.src = url
  })
}
