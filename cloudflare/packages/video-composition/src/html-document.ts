import {
  isBooleanVariable,
  isColorVariable,
  isEnumVariable,
  isNumberVariable,
  isStringVariable,
} from './variables'
import type { CompositionVariable } from './variables'

/** Pinned GSAP build injected into every Hyperframe iframe srcdoc. */
const GSAP_SCRIPT_TAG = `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>`

/**
 * Live update bridge — host calls window.__hfApplyConfig(values, { cssIds, textIds, boolIds })
 * so variable edits don't require reloading the player iframe.
 */
const LIVE_CONFIG_BRIDGE_SCRIPT = `<script>
(function () {
  window.__hfConfig = window.__hfConfig || {};
  function snakeToCamel(id) {
    return String(id).replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }
  function setText(el, val) {
    if (!el || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = String(val);
      return;
    }
    el.textContent = String(val);
  }
  window.__hfApplyConfig = function (next, opts) {
    if (!next || typeof next !== 'object') return;
    opts = opts || {};
    window.__hfConfig = Object.assign({}, window.__hfConfig, next);
    var root = document.documentElement;
    var cssIds = opts.cssIds || [];
    for (var i = 0; i < cssIds.length; i++) {
      var cssId = cssIds[i];
      if (next[cssId] == null) continue;
      root.style.setProperty('--hf-' + cssId, String(next[cssId]));
    }
    var textIds = opts.textIds || [];
    for (var t = 0; t < textIds.length; t++) {
      var textId = textIds[t];
      if (next[textId] == null) continue;
      var candidates = [textId, snakeToCamel(textId)];
      for (var c = 0; c < candidates.length; c++) {
        var el = document.getElementById(candidates[c]);
        if (el) setText(el, next[textId]);
      }
      document.querySelectorAll('[data-hf-var="' + textId + '"]').forEach(function (node) {
        setText(node, next[textId]);
      });
    }
    var boolIds = opts.boolIds || [];
    for (var b = 0; b < boolIds.length; b++) {
      var boolId = boolIds[b];
      if (typeof next[boolId] !== 'boolean') continue;
      root.toggleAttribute('data-hf-' + boolId, next[boolId]);
      var boolEl = document.getElementById(boolId) || document.getElementById(snakeToCamel(boolId));
      if (boolEl) boolEl.hidden = !next[boolId];
    }
    window.dispatchEvent(new CustomEvent('hf-config-change', { detail: window.__hfConfig }));
  };
})();
</script>`

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

    return `${style}\n${script}\n${LIVE_CONFIG_BRIDGE_SCRIPT}`
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

export type LiveConfigApplyOptions = {
  cssIds: string[]
  textIds: string[]
  boolIds: string[]
}

export function getLiveConfigApplyOptions(
  variables: CompositionVariable[],
): LiveConfigApplyOptions {
  const cssIds: string[] = []
  const textIds: string[] = []
  const boolIds: string[] = []
  for (const variable of variables) {
    if (isColorVariable(variable) || isNumberVariable(variable)) {
      cssIds.push(variable.id)
    } else if (isStringVariable(variable) || isEnumVariable(variable)) {
      textIds.push(variable.id)
    } else if (isBooleanVariable(variable)) {
      boolIds.push(variable.id)
    }
  }
  return { cssIds, textIds, boolIds }
}

/** Push variable updates into a loaded composition without reloading the iframe. */
export function applyLiveHtmlConfig(
  doc: Document | null | undefined,
  variables: CompositionVariable[],
  values: Record<string, string | number | boolean>,
): boolean {
  if (!doc?.defaultView) return false
  const win = doc.defaultView as Window & {
    __hfApplyConfig?: (
      next: Record<string, string | number | boolean>,
      opts?: LiveConfigApplyOptions,
    ) => void
  }
  if (typeof win.__hfApplyConfig !== 'function') return false
  win.__hfApplyConfig(values, getLiveConfigApplyOptions(variables))
  return true
}

/**
 * Pull the JSON array from `data-composition-variables` by bracket-matching.
 * Quote-based regexes break on apostrophes inside defaults (e.g. Newton's).
 */
export function extractVariableSchema(html: string): CompositionVariable[] {
  const marker = html.search(/data-composition-variables\s*=/)
  if (marker === -1) return []

  const eq = html.indexOf('=', marker)
  if (eq === -1) return []

  const after = html.slice(eq + 1).trimStart()
  const jsonStart = after.search(/[[{]/)
  if (jsonStart === -1) return []

  const open = after[jsonStart]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inString = false
  let escape = false

  for (let i = jsonStart; i < after.length; i++) {
    const ch = after[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        try {
          const parsed = JSON.parse(after.slice(jsonStart, i + 1))
          return Array.isArray(parsed) ? (parsed as CompositionVariable[]) : []
        } catch {
          return []
        }
      }
    }
  }

  return []
}

export function buildDefaultValues(
    variables: CompositionVariable[]
  ): Record<string, string | number | boolean> {
    return Object.fromEntries(variables.map(v => [v.id, v.default]))
}
