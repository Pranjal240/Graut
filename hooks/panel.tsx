// The Graut panel: a band above the prompt with the level, quick actions and what the session has used.
// It watches and reports; it adds nothing to what the model reads unless the level changes.
// Caller and reuse tracking follow ponytail 5.3.3's band (MIT, see metrics.ts).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Level, Stats, Tests } from '../types'
import { GREP_DEFS, TEST_COMMAND, bars, changes, clock, count, defsIn, hits, inProject, isCode, knownNames, metricsSvg, money, percent, readTests, testsText } from './metrics'
import type { Col } from './metrics'

const LEVELS: readonly Level[] = ['off', 'lite', 'full', 'ultra']
const EMPTY: Stats = {
  turns: 0,
  costUsd: null,
  turnCosts: [],
  agentMs: 0,
  turnMs: [],
  tokens: 0,
  context: null,
  tests: { state: 'none', passed: null, failed: null },
  packs: [],
  lookups: 0,
  reused: [],
  created: [],
  removed: [],
  openCallers: [],
}
const level = atom({ plugin: 'graut', key: 'level' } as const, 'full')
const stats = atom({ plugin: 'graut', key: 'stats' } as const, EMPTY)
const details = atom({ plugin: 'graut', key: 'details' } as const, false)
const hidden = atom({ plugin: 'graut', key: 'hidden' } as const, false)

// State kept by an older version of the panel lacks newer fields.
const load = async ($: EngineInterface): Promise<Stats> => ({ ...EMPTY, ...(await read($, stats)) })
const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])]

// The settings the panel shares with the `graut` command line.
const settingFile = async ($: EngineInterface, name: 'level' | 'panel') =>
  `${(await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))}/.graut/${name}`

const savedLevel = async ($: EngineInterface): Promise<Level> => {
  const text = await $.fs.read(await settingFile($, 'level')).catch(() => '')
  return LEVELS.find(l => l === text.trim()) ?? 'full'
}

const savedHidden = async ($: EngineInterface) =>
  (await $.fs.read(await settingFile($, 'panel')).catch(() => '')).trim() === 'off'

const setHidden = async ($: EngineInterface, next: boolean) => {
  await $.fs.write(await settingFile($, 'panel'), next ? 'off\n' : 'on\n')
  await update($, hidden, () => next)
}
const HIDDEN_NOTE = 'Graut panel hidden. Type /graut-panel to bring it back.'

/** What the model is told when the level changes in the middle of a session. */
const rules = async ($: EngineInterface, next: Level) => {
  if (next === 'off') return 'The user switched Graut off. Do not use the graut skill or its lines unless asked.'
  const text = await $.fs.read(`${$.plugin.root}/skills/graut/levels.json`)
  return (JSON.parse(text) as Record<string, string>)[next]
}

/** The session's own figures, which also cover what happened before the panel loaded. */
const measure = async ($: EngineInterface) => {
  const usage = await $.session.usage().catch(() => undefined)
  const turns = await $.session.turns().catch(() => undefined)
  const c = usage?.context
  return {
    cost: usage?.cost?.usd,
    turns,
    context: c?.percent === undefined ? null : { percent: c.percent, tokens: c.tokens ?? 0, window: c.window },
  }
}

// What only the panel counts is kept per session, so a resumed session goes on from where it was.
type Kept = Pick<Stats, 'agentMs' | 'turnMs' | 'tokens' | 'turnCosts' | 'tests' | 'packs' | 'lookups' | 'reused' | 'created'>
const sessions = async ($: EngineInterface) =>
  ((await $.store.get('sessions').catch(() => undefined)) ?? []) as [string, Kept][]

const keep = async ($: EngineInterface, s: Stats) => {
  const id = await $.session.id()
  const { agentMs, turnMs, tokens, turnCosts, tests, packs, lookups, reused, created } = s
  const others = (await sessions($)).filter(([key]) => key !== id)
  const mine: Kept = { agentMs, turnMs, tokens, turnCosts, tests, packs, lookups, reused, created }
  await $.store.set('sessions', [...others, [id, mine]].slice(-20))
}

/** Sets the panel up for the current session and returns the names its code already defines. */
const begin = async ($: EngineInterface, carry: Partial<Stats>) => {
  const id = await $.session.id().catch(() => '')
  const kept = (await sessions($)).find(([key]) => key === id)?.[1]
  const m = await measure($)
  await update($, stats, () => ({
    ...EMPTY,
    ...carry,
    ...kept,
    // The cost so far is the baseline for the next turn's own cost.
    costUsd: m.cost ?? null,
    turns: m.turns ?? 0,
    context: m.context,
  }))
  const grep = await $.process.run(['git', 'grep', '--untracked', '-nE', GREP_DEFS]).catch(() => undefined)
  return knownNames(grep?.exitCode === 0 ? grep.stdout : '')
}

/** Removed definitions that are not defined again but still called somewhere. */
const stillCalled = async ($: EngineInterface, removed: readonly string[]) => {
  const names: string[] = []
  const callers: string[] = []
  for (const name of removed) {
    // shortcut: a name match with git grep, so a same-named call in another module counts too.
    const grep = await $.process.run(['git', 'grep', '--untracked', '-nw', '-e', name]).catch(() => undefined)
    const rows = hits(grep?.stdout ?? '')
    if (rows.some(r => defsIn(r.file, r.text.trimStart()).includes(name))) continue
    const call = new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}\\s*\\(`)
    const found = rows.filter(r => call.test(r.text)).map(r => `${r.file}:${r.line}`)
    if (found.length) {
      names.push(name)
      callers.push(...found)
    }
  }
  return { names, callers }
}

export const register: Register = on => {
  // Every hook that passes an event on has a fallback: a fault here never blocks the session. It is safe
  // to call next again, which replays what the first call returned.
  // The level the model last heard about; the session-start hook tells it the saved one.
  let announced: Level | undefined
  // Definitions that existed when the session started: what new code can reuse.
  let known: ReadonlySet<string> = new Set()

  on('session.start', async ($, e, next) => {
    announced = await savedLevel($)
    const saved = announced
    await update($, level, () => saved)
    const open = (await $.store.get('details').catch(() => undefined)) === true
    await update($, details, () => open)
    const off = await savedHidden($)
    await update($, hidden, () => off)
    await $.command
      .register({ name: 'graut-panel', description: 'Show or hide the Graut panel', argumentHint: '[on|off]', immediate: true })
      .catch(() => undefined)
    known = await begin($, await load($)).catch(() => known)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /clear, /resume and /branch go on under another session id with no session.start.
  on('command.run', { command: ['clear', 'resume', 'branch'] }, async ($, e, next) => {
    const before = await $.session.id()
    const result = await next(e)
    if ((await $.session.id()) !== before) known = await begin($, {}).catch(() => known)
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'graut-panel' }, async ($, e) => {
    const word = e.args.trim().toLowerCase()
    if (word && word !== 'on' && word !== 'off') return { text: 'Use /graut-panel on or /graut-panel off.' }
    const next = word ? word === 'off' : !(await read($, hidden))
    await setHidden($, next)
    return { text: next ? HIDDEN_NOTE : 'Graut panel shown.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // `graut panel off` from a terminal reaches an open session at its next message.
    const off = await savedHidden($)
    await update($, hidden, () => off)
    const current = await read($, level)
    if (current === (announced ?? current)) return next(e)
    const note = await rules($, current)
    if (!note) return next(e)
    announced = current
    return next({ ...e, context: [...(e.context ?? []), note] })
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const call = e as { tool: string; command?: string; file_path?: string; old_string?: string; new_string?: string; content?: string }
    const isEdit = call.tool === 'Edit' || call.tool === 'Write'
    const file = call.file_path ?? ''
    // A file outside the project (a scratch script) is neither reused nor covered by its tests.
    const root = isEdit ? ((await $.session.repo().catch(() => null))?.root ?? (await $.session.cwd().catch(() => ''))) : ''
    const watched = isEdit && (root === '' || inProject(file, root))
    // Read before the edit runs, or the old text of a rewritten file is gone.
    const before = !watched ? '' : call.tool === 'Write' ? await $.fs.read(file).catch(() => '') : (call.old_string ?? '')

    const ran = await next(e)
    if (ran.deny !== undefined) return ran

    const pack = call.tool === 'Read' ? /[\\/]packs[\\/]([a-z0-9-]+)[\\/]/.exec(file)?.[1] : undefined
    if (pack) {
      await update($, stats, s => ({ ...EMPTY, ...s, packs: union(s.packs ?? [], [pack]) }))
    }
    // Graut's context command or CodeGraph's own tool, when it found something.
    const asked =
      /codegraph_explore$/.test(call.tool) ||
      ((call.tool === 'Bash' || call.tool === 'PowerShell') && /graut\.js["']? +context +(?!o(n|ff)\b)/.test(call.command ?? ''))
    if (asked && ran.isError !== true && !/^No code context/m.test(ran.text ?? '')) {
      await update($, stats, s => ({ ...EMPTY, ...s, lookups: (s.lookups ?? 0) + 1 }))
    }
    if (watched && ran.isError !== true) {
      const after = (call.tool === 'Write' ? call.content : call.new_string) ?? ''
      const found = changes(file, before, after, known)
      await update($, stats, old => {
        const s = { ...EMPTY, ...old }
        const stale: Tests = { state: 'stale', passed: null, failed: null }
        return {
          ...s,
          reused: union(s.reused, found.reused),
          created: union(s.created, found.created),
          removed: union(s.removed, found.removed),
          tests: isCode(file) && s.tests.state !== 'none' ? stale : s.tests,
        }
      })
    }
    if ((call.tool === 'Bash' || call.tool === 'PowerShell') && TEST_COMMAND.test(call.command ?? '')) {
      const output = ran.text ?? JSON.stringify(ran.result ?? '')
      await update($, stats, s => ({ ...EMPTY, ...s, tests: readTests(output, ran.isError === true) }))
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const usage = e.usage
    const tokens = usage
      ? usage.input_tokens +
        usage.output_tokens +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0)
      : 0
    if (e.agentId !== undefined) {
      // A subagent's tokens count; its cost is already in the session cost the main turn reads.
      await update($, stats, s => ({ ...EMPTY, ...s, tokens: (s.tokens ?? 0) + tokens }))
      return next(e)
    }

    const m = await measure($)
    const open = await stillCalled($, (await load($)).removed)
    await update($, stats, old => {
      const s = { ...EMPTY, ...old }
      // Without an earlier reading the turn's own cost is unknown. A lower total means the ledger started over.
      const spent = m.cost === undefined || s.costUsd === null ? null : m.cost >= s.costUsd ? m.cost - s.costUsd : m.cost
      return {
        ...s,
        turns: m.turns ?? s.turns + 1,
        costUsd: m.cost ?? s.costUsd,
        turnCosts: spent === null ? s.turnCosts : [...s.turnCosts, spent].slice(-20),
        agentMs: s.agentMs + e.durationMs,
        turnMs: [...s.turnMs, e.durationMs].slice(-20),
        tokens: s.tokens + tokens,
        context: m.context ?? s.context,
        removed: open.names,
        openCallers: open.callers,
      }
    })
    await keep($, await load($)).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, hidden))) return next(e)
    // Other panels share this place: theirs is drawn under Graut's, not replaced by it.
    // next(e) rejects only when nothing answers beneath, as in the test harness.
    const below = await next(e).catch(() => undefined)

    const current = await read($, level)
    const s = await load($)
    const isOpen = await read($, details)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const failed = (what: string) => () => $.ui.toast(`Graut: ${what} did not work`)

    const choose = async (chosen: Level) => {
      await $.fs.write(await settingFile($, 'level'), `${chosen}\n`)
      await update($, level, () => chosen)
    }
    const toggle = async () => {
      await update($, details, () => !isOpen)
      await $.store.set('details', !isOpen)
    }
    const ask = (args: string) => $.command.run({ command: 'graut:graut', args }).catch(failed('that command'))
    const doctor = async () => {
      const r = await $.process.run(['node', `${$.plugin.root}/skills/graut/scripts/graut.js`, 'doctor'])
      $.ui.toast(r.stdout || 'Graut doctor printed nothing')
    }
    const copy = async () => {
      const done = await $.ui.copy({
        text: [
          '| Graut session | |',
          '|---|---|',
          `| level | ${current} |`,
          `| cost | ${money(s.costUsd)} |`,
          `| turns | ${s.turns} |`,
          `| tokens | ${count(s.tokens)} |`,
          `| context | ${s.context ? `${s.context.percent}%` : 'n/a'} |`,
          `| agent time | ${clock(s.agentMs)} |`,
          `| tests | ${testsText(s.tests)} |`,
          `| specialists | ${s.packs.join(', ') || 'none'} |`,
        ].join('\n'),
        surface: e.surface,
      })
      $.ui.toast(done.isCopied ? 'Graut: usage copied' : 'Graut: could not copy')
    }

    const last = s.turnCosts[s.turnCosts.length - 1]
    const typical = s.turnMs.length ? s.turnMs.reduce((sum, ms) => sum + ms, 0) / s.turnMs.length : null
    const average = s.costUsd !== null && s.turns > 0 ? s.costUsd / s.turns : null
    const reuse = percent(s.reused.length, s.created.length)
    const isFull = (s.context?.percent ?? 0) >= 70
    const testsColor = s.tests.state === 'pass' ? 'success' : s.tests.state === 'fail' ? 'error' : undefined

    const title = (
      <Text bold color="warning">
        Graut
      </Text>
    )
    const actions = [
      <Button key="review" plain label="Review" onPress={() => ask('review the current changes for bugs and bloat; report only')} />,
      <Button key="audit" plain label="Audit" onPress={() => ask('audit this project for bugs, security, accessibility and bloat; report only')} />,
      <Button key="doctor" plain label="Doctor" onPress={() => doctor().catch(failed('doctor (is Node.js installed?)'))} />,
      <Button key="details" plain label={isOpen ? 'Compact' : 'Details'} onPress={toggle} />,
      <Button key="hide" plain label="Hide" onPress={() => setHidden($, true).then(() => $.ui.toast(HIDDEN_NOTE)).catch(failed('hiding the panel'))} />,
    ]
    const stack = (mine: NonNullable<typeof below>) =>
      below ? (
        <Box flexDirection="column">
          {mine}
          {below}
        </Box>
      ) : (
        mine
      )
    // bodyColumns counts terminal cells; elsewhere buttons are wider than cells, so no width is set.
    const width = e.surface === 'terminal' ? e.props.bodyColumns : undefined

    if (!isOpen) {
      return stack(
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} width={width}>
          {title}
          <Button key="level" plain onPress={toggle}>
            <Text color={current === 'off' ? 'inactive' : 'suggestion'}>●</Text> {current}
          </Button>
          <Text>{money(s.costUsd)}</Text>
          {last === undefined ? null : <Text dimColor>last {money(last)}</Text>}
          {s.context ? <Text color={isFull ? 'warning' : undefined}>context {s.context.percent}%</Text> : null}
          {s.lookups ? <Text color="success">code index {s.lookups}×</Text> : null}
          {reuse === undefined ? null : <Text>{reuse}% reuse</Text>}
          {s.openCallers.length ? <Text color="warning">⚠ {s.openCallers.length} callers open</Text> : null}
          {s.tests.state === 'none' ? null : <Text color={testsColor}>tests {testsText(s.tests)}</Text>}
          <Box flexGrow={1} />
          {actions}
        </Box>,
      )
    }

    // Only columns that say something; the rest appear once there is something to report.
    const cols: Col[] = [
      {
        key: 'cost',
        label: 'cost',
        value: money(s.costUsd),
        sub: [last === undefined ? '' : `last ${money(last)}`, average === null ? '' : `⌀ ${money(average)}`].filter(Boolean).join(' · '),
      },
      { key: 'tokens', label: 'tokens', value: count(s.tokens), sub: `${s.turns} ${s.turns === 1 ? 'turn' : 'turns'}` },
      { key: 'time', label: 'agent time', value: clock(s.agentMs), sub: typical === null ? '' : `⌀ ${clock(typical)} / turn` },
    ]
    if (s.context) {
      cols.push({
        key: 'context',
        label: 'context',
        value: `${s.context.percent}%`,
        sub: isFull ? 'try /compact' : `${count(s.context.tokens)} of ${count(s.context.window)}`,
        ...(isFull ? { tone: 'warning' as const } : {}),
      })
    }
    if (s.lookups) cols.push({ key: 'index', label: 'code index', value: `${s.lookups}×`, sub: 'asked, not searched', tone: 'success' })
    if (reuse !== undefined) cols.push({ key: 'reuse', label: 'reuse', value: `${reuse}%`, sub: `${s.reused.length} reused` })
    if (s.openCallers.length) {
      cols.push({ key: 'callers', label: 'callers', value: `${s.openCallers.length} open`, sub: s.openCallers.slice(0, 2).join(', '), tone: 'warning' })
    }
    if (s.tests.state !== 'none') {
      cols.push({
        key: 'tests',
        label: 'tests',
        value: testsText(s.tests),
        sub: s.tests.state === 'pass' ? 'after last change' : s.tests.state === 'fail' ? 'last run' : 'code changed since',
        ...(testsColor ? { tone: testsColor } : {}),
      })
    }
    if (s.packs.length) cols.push({ key: 'skills', label: 'skills', value: `${s.packs.length}`, sub: s.packs.join(', ') })

    let metrics = (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-end">
          {'─'.repeat(e.props.bodyColumns)}
        </Text>
        <Box flexDirection="row" columnGap={2}>
          {cols.map(c => (
            // Off the terminal the columns share the row; a width in cells would cut the text.
            <Box key={c.key} flexDirection="column" {...(width === undefined ? { flexGrow: 1 } : { width: Math.max(10, Math.floor(width / cols.length) - 2) })}>
              <Text dimColor>{c.label}</Text>
              <Text bold color={c.tone}>
                {c.value}
              </Text>
              <Text dimColor wrap="truncate-end">
                {c.sub || (c.key === 'cost' ? bars(s.turnCosts) : '')}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
    // Characters make broken lines in the desktop's proportional font; an image draws real ones.
    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      // A wider drawing for many columns keeps their second lines readable.
      const wide = Math.max(720, cols.length * 140)
      metrics = <Svg source={metricsSvg(cols, s.turnCosts, wide)} alt={cols.map(c => `${c.label} ${c.value} ${c.sub}`).join(', ')} />
    }

    return stack(
      // The image draws its own line at the top, which would touch the buttons without the gap.
      <Box flexDirection="column" width={width} gap={e.surface === 'desktop' ? 1 : 0}>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
          {title}
          {LEVELS.map(l => (
            <Button
              key={`level-${l}`}
              label={l}
              {...(l === current ? { variant: 'primary' as const } : { plain: true as const, dimColor: true })}
              onPress={() => choose(l).catch(failed('saving the level'))}
            />
          ))}
          <Box flexGrow={1} />
          <Button key="copy" plain label="Copy" onPress={() => copy().catch(failed('copy'))} />
          {actions}
        </Box>
        {metrics}
      </Box>,
    )
  }).catch(($, e, next) => next(e))
}
