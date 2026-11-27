// Pure helpers for the panel: nothing here touches the engine.
// The metrics drawing and the definition, caller and reuse matching are adapted from ponytail 5.3.3
// (hooks/band/metrics.ts), MIT License, Copyright (c) 2026 DietrichGebert.
// The license text is in ../skills/graut/packs/ponytail/UPSTREAM-LICENSE.
import type { Tests } from '../types'

export const money = (usd: number | null) => (usd === null ? 'n/a' : `$${usd.toFixed(2)}`)
export const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`)
export const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const minutes = Math.floor(s / 60)
  return minutes < 60 ? `${minutes}m ${s % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
/** The last turns' costs as small bars, for surfaces that cannot draw an image. */
export const bars = (costs: readonly number[]) => {
  const top = Math.max(...costs, 0)
  return costs.map(c => '▁▂▃▄▅▆▇█'[top > 0 ? Math.round((Math.max(c, 0) / top) * 7) : 0]).join('')
}

// A runner counts only where a command starts, so reading about tests (`grep pytest`, `npm install jest`) is not a run.
// Before it may come settings and wrappers: `CI=1 timeout 60 python -m pytest`.
const BEFORE = String.raw`(?:^|[;&|(\n])\s*(?:(?:[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)|sudo|time|npx|bunx|uv\s+run|timeout\s+\S+|(?:"[^"]*|\S*)python3?(?:\.exe)?"?\s+-m)\s+)*(?:\S*[\\/])?`
const RUNNERS = String.raw`(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test(?![\w.-])|node\s+(?:--?\S+\s+)*(?:--test(?![\w-])|\S*test\S*\.[cm]?js)|(?:pytest|jest|vitest|mocha|phpunit|rspec)(?![\w.=-])|(?:go|cargo|dotnet|mvn|gradlew?|deno|make)\s+test(?![\w.-])|claude\s+plugin\s+test(?![\w-]))`
export const TEST_COMMAND = new RegExp(BEFORE + RUNNERS)

/** Reads a test run's summary. Any reported failure counts; a command that errors after a clear zero passed. */
export const readTests = (output: string, failedExit: boolean): Tests => {
  const all = (pattern: RegExp) => [...output.matchAll(pattern)].map(m => Number(m[1] ?? m[2]))
  // Runners word their totals differently, so a command that ran two kinds has two totals to add.
  const totals = [/(?:^|\n)[#ℹ] pass (\d+)/g, /(\d+) pass\b/g, /(\d+) (?:passed|passing)\b/g].flatMap(kind => all(kind).slice(-1))
  const passed = totals.length ? totals.reduce((sum, n) => sum + n, 0) : null
  const failures = all(/(\d+) (?:failed|failing|failures?|fail)\b|(?:^|\n)[#ℹ] fail (\d+)/g)
  const failed = failures.length ? Math.max(...failures) : null
  // The exit code also covers whatever ran after the tests in the same command.
  const passedAnyway = failed === 0 && (passed ?? 0) > 0
  return { state: (failed ?? 0) > 0 || (failedExit && !passedAnyway) ? 'fail' : 'pass', passed, failed }
}

export const testsText = ({ state, passed, failed }: Tests) =>
  state === 'none'
    ? 'not run'
    : state === 'stale'
      ? 'rerun'
      : state === 'fail'
        ? failed
          ? `${failed} failed`
          : 'failing'
        : passed === null
          ? 'passed'
          : `${passed} passed`

const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|vendor|venv|\.venv|__pycache__|coverage|\.next|target|migrations|fixtures|tests?|__tests__|spec)(\/|$)/
const SKIP_FILE = /(^|\/)(test_[^/]*|[^/]*(_test|\.test|\.spec|\.gen|\.min|\.d)\.[a-z]+)$/
// shortcut: regex, not a parser; nested and dynamic definitions are missed.
const DEFS: [RegExp, RegExp[]][] = [
  [/\.py$/, [/^(?:async\s+)?def\s+([A-Za-z]\w*)/gm, /^class\s+([A-Za-z]\w*)/gm]],
  [
    /\.[cm]?[jt]sx?$/,
    [
      /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
      /^(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/gm,
    ],
  ],
  [/\.go$/, [/^func\s+(?:\([^)]*\)\s*)?([A-Za-z]\w*)/gm]],
  [/\.rs$/, [/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gm]],
  [/\.rb$/, [/^\s*def\s+(?:self\.)?([A-Za-z]\w*[?!]?)/gm]],
]
/** Lines worth a closer look; the per-language patterns decide. */
export const GREP_DEFS = '^[[:space:]]*(export|async|def|class|function|func|pub|fn)[[:space:]]'
// Names too common to say anything about reuse.
const GENERIC = new Set(['main', 'init', 'run', 'get', 'set', 'test', 'setup', 'open', 'close', 'read', 'write', 'start', 'stop', 'load', 'save', 'update', 'create', 'delete', 'handle', 'render', 'index', 'new', 'call', 'apply'])

/** Files whose change makes an earlier test run out of date. */
export const isCode = (file: string) => /\.(py|[cm]?[jt]sx?|go|rs|rb|java|kt|php|swift|cs|c|cc|cpp|h|vue|svelte)$/.test(file)
const isSource = (file: string) => {
  const f = file.replace(/\\/g, '/')
  return !SKIP_DIR.test(f) && !SKIP_FILE.test(f)
}

export function defsIn(file: string, text: string): string[] {
  const rules = DEFS.find(([extension]) => extension.test(file))?.[1] ?? []
  return [...new Set(rules.flatMap(pattern => [...text.matchAll(pattern)].map(m => m[1] ?? '')))].filter(Boolean)
}

export type Hit = { file: string; line: string; text: string }
/** `git grep -n` output, one "file:line:text" row each. */
export const hits = (stdout: string): Hit[] =>
  stdout.split('\n').flatMap(row => {
    const m = /^(.+?):(\d+):(.*)$/.exec(row)
    return m ? [{ file: m[1] ?? '', line: m[2] ?? '', text: m[3] ?? '' }] : []
  })

/** The names already defined in source files. */
export const knownNames = (stdout: string) =>
  new Set(hits(stdout).flatMap(h => (isSource(h.file) ? defsIn(h.file, h.text.trimStart()) : [])))

/** What an edit created, removed and reused. */
export function changes(file: string, before: string, after: string, known: ReadonlySet<string>) {
  const had = defsIn(file, before)
  const has = defsIn(file, after)
  const old = new Set(before.split('\n'))
  const added = after.split('\n').filter(line => !old.has(line)).join('\n')
  const called = [...added.matchAll(/(?<![\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1] ?? '')
  const source = isSource(file)
  return {
    created: source ? has.filter(n => !had.includes(n)) : [],
    removed: had.filter(n => !has.includes(n)),
    reused: source ? [...new Set(called.filter(n => known.has(n) && !has.includes(n) && !GENERIC.has(n.toLowerCase())))] : [],
  }
}

/** Whether a file lies under the project root; Windows paths may use either slash. */
export function inProject(file: string, root: string): boolean {
  const f = file.replace(/\\/g, '/')
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '')
  return f === r || f.startsWith(`${r}/`)
}

// shortcut: no share below 3 functions, where one new helper would read as "0% reuse".
export const percent = (reused: number, created: number) => (reused + created < 3 ? undefined : Math.round((reused / (reused + created)) * 100))

export type Col = { key: string; label: string; value: string; sub: string; tone?: 'warning' | 'success' | 'error' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fit = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s)
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
// The image cannot read the app's theme, so it follows the system's.
const STYLE = `.l,.s{fill:#87867f;font:12px ${FONT}}.v{fill:#1f1e1d;font:600 16px ${FONT}}.d{stroke:#1f1e1d;stroke-opacity:.12}.b{fill:#87867f}.warning{fill:#a86400}.success{fill:#2e7d32}.error{fill:#c62828}@media (prefers-color-scheme:dark){.v{fill:#ecebe6}.d{stroke:#fff;stroke-opacity:.14}.warning{fill:#e3a03d}.success{fill:#6abf69}.error{fill:#ef6a5a}}`

/** The numbers as one image: equal columns with 1px dividers. */
export function metricsSvg(cols: readonly Col[], turnCosts: readonly number[], width = 720): string {
  const height = 64
  const colW = width / Math.max(1, cols.length)
  const top = Math.max(...turnCosts, 0)
  let body = `<line class="d" x1="0" y1="0.5" x2="${width}" y2="0.5"/>`
  cols.forEach((c, i) => {
    const x = i * colW + (i === 0 ? 0 : 12)
    const tone = c.tone ? ` ${c.tone}` : ''
    if (i > 0) body += `<line class="d" x1="${i * colW}" y1="14" x2="${i * colW}" y2="${height - 2}"/>`
    body += `<text class="l" x="${x}" y="24">${esc(c.label)}</text>`
    body += `<text class="v${tone}" x="${x}" y="44">${esc(fit(c.value, Math.floor((colW - 16) / 9)))}</text>`
    if (c.sub) body += `<text class="s${c.tone === 'warning' ? tone : ''}" x="${x}" y="61">${esc(fit(c.sub, Math.floor((colW - 16) / 6.2)))}</text>`
    if (c.key === 'cost' && turnCosts.length > 1 && top > 0) {
      const shown = turnCosts.slice(-10)
      const x0 = (i + 1) * colW - 16 - shown.length * 5
      shown.forEach((v, j) => {
        const h = Math.max(1, Math.round((Math.max(v, 0) / top) * 16))
        body += `<rect class="b" x="${x0 + j * 5}" y="${44 - h}" width="3" height="${h}" rx="1"/>`
      })
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>${STYLE}</style>${body}</svg>`
}
