import { FC, useEffect, useMemo, useRef, useState } from "react"
import { Image } from "antd";
import { select } from 'd3-selection'
import { zoom as d3Zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3-zoom'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { useSelector } from "react-redux";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import type { ViewRenderProps } from "@/core/component-registry/registry-types";
import './index.css'

const VIEW_RESOLVER_TOKEN_REGEXP = /@@VIEW_RESOLVER_(\d+)@@/g

const parsePrimitiveValue = (rawValue: string) => {
  const value = rawValue.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (value === 'undefined') return undefined
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

const parseViewResolverProps = (attrsText: string): Record<string, unknown> => {
  const props: Record<string, unknown> = {}
  const attrRegexp = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'=<>`]+))/g

  let match: RegExpExecArray | null
  while ((match = attrRegexp.exec(attrsText)) !== null) {
    const key = match[1]
    const raw = match[2] ?? match[3] ?? match[4] ?? match[5] ?? ''
    const unwrapped = raw.replace(/^['"]|['"]$/g, '')
    props[key] = parsePrimitiveValue(unwrapped)
  }

  return props
}

type SafeViewResolverProps = {
  view: string
} & Record<string, unknown>

const isValidViewResolverProps = (props: Record<string, unknown>): props is SafeViewResolverProps => {
  return typeof props.view === 'string' && props.view.length > 0
}

const replaceViewResolverTags = (text: string) => {
  const viewResolvers: Record<string, Record<string, unknown>> = {}
  let index = 0

  const markdownText = text.replace(
    /<ViewResolver\b([^>]*)\/?>(?:\s*<\/ViewResolver>)?/g,
    (_match, attrsText: string) => {
      const token = `@@VIEW_RESOLVER_${index}@@`
      viewResolvers[token] = parseViewResolverProps(attrsText || '')
      index += 1
      return token
    }
  )

  return { markdownText, viewResolvers }
}

const renderTextWithViewResolvers = (
  value: string,
  viewResolvers: Record<string, Record<string, unknown>>
) => {
  const segments: any[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  VIEW_RESOLVER_TOKEN_REGEXP.lastIndex = 0
  while ((match = VIEW_RESOLVER_TOKEN_REGEXP.exec(value)) !== null) {
    const token = match[0]
    if (match.index > lastIndex) {
      segments.push(value.slice(lastIndex, match.index))
    }

    const props = viewResolvers[token]
    if (props && isValidViewResolverProps(props)) {
      const viewRenderProps = props as ViewRenderProps
      segments.push(
        <ViewResolver
          key={`${token}-${match.index}`}
          {...viewRenderProps}
        />
      )
    } else {
      segments.push(token)
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < value.length) {
    segments.push(value.slice(lastIndex))
  }

  if (segments.length === 0) return value
  return segments
}

const isAbsoluteOrSpecialUrl = (url: string) => {
  return /^(https?:)?\/\//i.test(url) || /^(data:|blob:|#)/i.test(url)
}

const resolveImageSrc = (baseURL: string, src?: string) => {
  if (!src) return ''
  if (isAbsoluteOrSpecialUrl(src)) return src
  if (src.startsWith('/')) return `${baseURL}${src}`
  return `${baseURL}/${src}`
}

const MermaidBlock: FC<{ chart: string; isDarkTheme: boolean }> = ({ chart, isDarkTheme }) => {
  const graphRef = useRef<HTMLDivElement | null>(null)
  const zoomSvgRef = useRef<SVGSVGElement | null>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [errorText, setErrorText] = useState('')

  const resetZoom = () => {
    const svg = zoomSvgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svg || !zoomBehavior) return

    select(svg).call(zoomBehavior.transform, zoomIdentity)
  }

  const updateZoomByFactor = (factor: number) => {
    const svg = zoomSvgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svg || !zoomBehavior) return

    const current = zoomTransform(svg)
    const minScale = 0.5
    const maxScale = 8
    const nextScale = Math.max(minScale, Math.min(maxScale, current.k * factor))
    select(svg).call(zoomBehavior.scaleTo, nextScale)
  }

  const setupSvgPanZoom = (svgElement: SVGSVGElement) => {
    const svgSelection = select(svgElement)

    const zoomLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    zoomLayer.setAttribute('class', 'markdown-mermaid__zoom-layer')

    while (svgElement.firstChild) {
      zoomLayer.appendChild(svgElement.firstChild)
    }
    svgElement.appendChild(zoomLayer)

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        zoomLayer.setAttribute('transform', event.transform.toString())
      })

    svgSelection
      .style('cursor', 'grab')
      .style('touch-action', 'none')
      .call(zoomBehavior)
      .on('dblclick.zoom', null)

    zoomSvgRef.current = svgElement
    zoomBehaviorRef.current = zoomBehavior
  }

  useEffect(() => {
    let isCancelled = false

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          // useMaxWidth: false,
          theme: isDarkTheme ? 'dark' : 'default'
        })

        const renderId = `markdown-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const { svg } = await mermaid.render(renderId, chart)

        if (isCancelled || !graphRef.current) return
        graphRef.current.innerHTML = svg

        const svgElement = graphRef.current.querySelector('svg')
        if (svgElement) {
          setupSvgPanZoom(svgElement)
        }

        setErrorText('')
      } catch (_error) {
        if (!isCancelled) {
          setErrorText('Mermaid 图表渲染失败')
        }
      }
    }

    renderMermaid()

    return () => {
      isCancelled = true
      if (zoomSvgRef.current) {
        select(zoomSvgRef.current).on('.zoom', null)
      }
      zoomSvgRef.current = null
      zoomBehaviorRef.current = null
    }
  }, [chart, isDarkTheme])

  return (
    <div className="markdown-code-block markdown-mermaid-block">
      <div className="markdown-code-block__header">
        <span className="markdown-code-block__lang">mermaid</span>
        <div className="markdown-mermaid__toolbar">
          <button
            type="button"
            className="markdown-code-block__copy"
            onClick={() => updateZoomByFactor(1.2)}
            aria-label="放大"
          >
            放大
          </button>
          <button
            type="button"
            className="markdown-code-block__copy"
            onClick={resetZoom}
            aria-label="重置缩放"
          >
            1:1
          </button>
          <button
            type="button"
            className="markdown-code-block__copy"
            onClick={() => updateZoomByFactor(1 / 1.2)}
            aria-label="缩小"
          >
            缩小
          </button>
          <button
            type="button"
            className="markdown-code-block__copy"
            onClick={() => {
              if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(chart)
              }
            }}
          >
            复制
          </button>
        </div>
      </div>
      <div className="markdown-mermaid__container">
        {errorText ? (
          <div className="markdown-mermaid__error">
            <div>{errorText}</div>
            <pre className="markdown-code-block__pre">
              <code>{chart}</code>
            </pre>
          </div>
        ) : (
          <div ref={graphRef} className="markdown-mermaid__graph" />
        )}
      </div>
    </div>
  )
}

const Markdown: FC<any> = ({ data ,prefix=""}) => {

  const { baseURL, project, theme } = useSelector((state: any) => state.user)
  
  const parsedResult = useMemo(() => {
    if (!data || typeof data !== 'string') return data
    const reportReplaced = data.replace(/@report:([A-Za-z0-9-]+)/g, (_match, key) => {
      return `[点击查看](#/analysis-report?project=${project}&key=${key})`
    })
    return replaceViewResolverTags(reportReplaced)
  }, [data, project])

  const parsedData = typeof parsedResult === 'string' ? parsedResult : parsedResult?.markdownText
  const viewResolvers = typeof parsedResult === 'string' ? {} : (parsedResult?.viewResolvers || {})

  const isDarkTheme = theme === 'dark'
  const markdownThemeClass = isDarkTheme ? 'markdown-theme-dark' : 'markdown-theme-light'

  return <div className={`markdown-wrapper ${markdownThemeClass}`}>
    {/* {prefix} */}
    <ReactMarkdown
      children={parsedData}
      rehypePlugins={[rehypeKatex]}
      remarkPlugins={[remarkGfm, remarkMath]}
      components={{
        code: ({ node, className, children, ...props }: any) => {
          const codeText = String(children ?? '').replace(/\n$/, '')
          const languageMatch = /language-(\w+)/.exec(className || '')
          const language = languageMatch?.[1] || 'text'
          const normalizedLanguage = language.toLowerCase()
          const isBlockCode = Boolean(className?.includes('language-')) || codeText.includes('\n')

          if (!isBlockCode) {
            return <code className="markdown-inline-code" {...props}>{children}</code>
          }

          if (normalizedLanguage === 'mermaid') {
            return <MermaidBlock chart={codeText} isDarkTheme={isDarkTheme} />
          }

          return (
            <div className="markdown-code-block">
              <div className="markdown-code-block__header">
                <span className="markdown-code-block__lang">{language}</span>
                <button
                  type="button"
                  className="markdown-code-block__copy"
                  onClick={() => {
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(codeText)
                    }
                  }}
                >
                  复制
                </button>
              </div>
              <pre className="markdown-code-block__pre">
                <code className={className} {...props}>{codeText}</code>
              </pre>
            </div>
          )
        },
        a: ({ node, href, children, ...props }) => (
          <a href={resolveImageSrc(baseURL, `${prefix}${href}`)} {...props}>{children}</a>
        ),
        img: ({ node, src, ...props }) => (
          <div className="markdown-image">
            {/* {src} */}
            <Image
              src={resolveImageSrc(baseURL, `${prefix}${src}?timestamp=${Date.now()}`)}
              className="markdown-image__img"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              alt={props.alt || ''}
              preview={{ mask: '点击预览' }}
            />
            {props.alt ? <div className="markdown-image__caption">{props.alt}</div> : null}
          </div>
        ),
        table: ({ node, children, ...props }) => (
          <div className="markdown-table-wrap">
            <table className="markdown-table" {...props}>{children}</table>
          </div>
        ),
        blockquote: ({ node, children, ...props }) => (
          <blockquote className="markdown-blockquote" {...props}>{children}</blockquote>
        ),
        p: ({ node, children }) => {
          const normalizedChildren = Array.isArray(children) ? children : [children]
          return (
            <div>
              {normalizedChildren.map((child, index) => {
                if (typeof child !== 'string') return child
                return (
                  <span key={`md-p-${index}`}>
                    {renderTextWithViewResolvers(child, viewResolvers)}
                  </span>
                )
              })}
            </div>
          )
        }
      }}
      ></ReactMarkdown>

  </div>
}

export default Markdown