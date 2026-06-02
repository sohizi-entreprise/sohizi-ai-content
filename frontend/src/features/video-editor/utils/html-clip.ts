import type { CompositionVariable } from '@hyperframes/core'
import { isColorVariable, isNumberVariable } from '@hyperframes/core'

/** Pinned GSAP build injected into every Hyperframe iframe srcdoc. */
const GSAP_SCRIPT_TAG = `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>`

function htmlIncludesGsapScript(html: string): boolean {
  return /(?:src|href)=["'][^"']*gsap/i.test(html)
}

function injectBeforeHeadClose(html: string, injection: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`)
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', `${injection}</body>`)
  }
  return `${injection}${html}`
}

export function injectGsap(html: string): string {
  if (htmlIncludesGsapScript(html)) return html
  return injectBeforeHeadClose(html, GSAP_SCRIPT_TAG)
}

export function buildVariableOverride(
    variables: CompositionVariable[],
    values: Record<string, string | number | boolean>
  ): string {
    const cssLines: string[] = []
    const jsConfig: Record<string, unknown> = {}
  
    for (const v of variables) {
      const val = values[v.id] ?? v.default
  
      jsConfig[v.id] = val
  
      if (isColorVariable(v) || isNumberVariable(v)) {
        cssLines.push(`  --hf-${v.id}: ${val};`)
      }
    }
  
    const style = cssLines.length
      ? `<style>:root {\n${cssLines.join('\n')}\n}</style>`
      : ''
  
    const script = `<script>window.__hfConfig = ${JSON.stringify(jsConfig)};</script>`
  
    return `${style}\n${script}`
}

export function injectVariables(
  html: string,
  variables: CompositionVariable[],
  values: Record<string, string | number | boolean>
): string {
  const override = buildVariableOverride(variables, values)
  return injectBeforeHeadClose(html, override)
}

/** GSAP + variable overrides, ready for iframe srcdoc. */
export function prepareHtmlDocument(
  html: string,
  variables: CompositionVariable[],
  values: Record<string, string | number | boolean>
): string {
  return injectVariables(injectGsap(html), variables, values)
}

export function extractVariableSchema(html: string): CompositionVariable[] {
    const match =
      html.match(/data-composition-variables='([^']+)'/) ??
      html.match(/data-composition-variables="([^"]+)"/)
    if (!match) return []
    try {
      return JSON.parse(match[1]) as CompositionVariable[]
    } catch {
      return []
    }
}

export function buildDefaultValues(
    variables: CompositionVariable[]
  ): Record<string, string | number | boolean> {
    return Object.fromEntries(variables.map(v => [v.id, v.default]))
}