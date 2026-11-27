// The Graut panel: a band above the prompt with the level, quick actions and what the session has used.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Level, Stats, Tests } from '../types'

const LEVELS: readonly Level[] = ['off', 'lite', 'full', 'ultra']
const EMPTY: Stats = {
  turns: 0,
  agentMs: 0,
  tokens: 0,
  costUsd: null,
  lastCostUsd: null,
  turnCosts: [],
  tests: { state: 'none', passed: null },
  packs: [],
}
const level = atom({ plugin: 'graut', key: 'level' } as const, 'full')
const stats = atom({ plugin: 'graut', key: 'stats' } as const, EMPTY)

const compact = atom({ plugin: 'graut', key: 'compact' } as const, false)

const TEST_COMMAND =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\bnode\s+(--test\b|\S*test\S*\.[cm]?js\b)|\b(pytest|jest|vitest|mocha|phpunit|rspec)\b|\b(go|cargo|dotnet|mvn|gradle|deno)\s+test\b/

/** Reads a test run's summary. The last count wins: runners print their totals at the end. */
export const readTests = (output: string, failedExit: boolean): Tests => {
  const last = (patterns: RegExp) => {
    const found = [...output.matchAll(patterns)].pop()
    return found ? Number(found[1] ?? found[2]) : null
  }
  const passed = last(/(\d+) passed|(?:^|\n)[#ℹ] pass (\d+)/g)
  const failed = last(/(\d+) fail(?:ed|ing|ures?)\b|(?:^|\n)[#ℹ] fail (\d+)/g)
  return { state: failedExit || (failed ?? 0) > 0 ? 'fail' : 'pass', passed }
}

const money = (usd: number | null) => (usd === null ? 'n/a' : `$${usd.toFixed(2)}`)
const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`)
const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}
/** The last turns' costs as small bars, tallest for the dearest turn. */
export const bars = (costs: readonly number[]) => {
  const top = Math.max(...costs, 0)
  return costs.map(c => '▁▂▃▄▅▆▇█'[top > 0 ? Math.round((Math.max(c, 0) / top) * 7) : 0]).join('')
}
const testsText = ({ state, passed }: Tests) =>
  state === 'none'
    ? 'not run'
    : state === 'stale'
      ? 'rerun (files changed)'
      : state === 'fail'
        ? 'failing'
        : passed === null
          ? 'passed'
          : `${passed} passed`

const mood = (isWorking: boolean, current: Level, tests: Tests) => {
  if (current === 'off') return 'Graut is off'
  if (isWorking) return 'Tention mat le, teri problem me graut bhar denge'
  if (tests.state === 'fail') return 'teri problem me graut to bhar diya, par isse kam nhi chalega'
  if (tests.state === 'pass') return 'le bhai isme graut bhardiya'
  return 'Isme Graut bhar denge'
}

const levelFile = async ($: EngineInterface) =>
  `${(await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))}/.graut/level`

const savedLevel = async ($: EngineInterface): Promise<Level> => {
  const text = await $.fs.read(await levelFile($)).catch(() => '')
  return LEVELS.find(l => l === text.trim()) ?? 'full'
}

/** What the model is told when the level changes in the middle of a session. */
const rules = async ($: EngineInterface, next: Level) => {
  if (next === 'off') return 'The user switched Graut off. Do not use the graut skill or its lines unless asked.'
  const text = await $.fs.read(`${$.plugin.root}/skills/graut/levels.json`)
  return (JSON.parse(text) as Record<string, string>)[next]
}

export const register: Register = on => {
  // The level the model last heard about; the session-start hook tells it the saved one.
  let announced: Level | undefined

  on('session.start', async ($, e, next) => {
    announced = await savedLevel($)
    const saved = announced
    await update($, level, () => saved)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const current = await read($, level)
    if (current === (announced ?? current)) return next(e)
    const note = await rules($, current)
    if (!note) return next(e)
    announced = current
    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran

    const call = e as { tool: string; command?: string; file_path?: string }
    const pack = call.tool === 'Read' ? /[\\/]packs[\\/]([a-z0-9-]+)[\\/]/.exec(call.file_path ?? '')?.[1] : undefined
    if (pack) {
      await update($, stats, s => (s.packs.includes(pack) ? s : { ...s, packs: [...s.packs, pack] }))
    }
    if ((call.tool === 'Edit' || call.tool === 'Write') && ran.isError !== true) {
      const stale: Tests = { state: 'stale', passed: null }
      await update($, stats, s => (s.tests.state === 'none' ? s : { ...s, tests: stale }))
    }
    if ((call.tool === 'Bash' || call.tool === 'PowerShell') && TEST_COMMAND.test(call.command ?? '')) {
      const output = ran.text ?? JSON.stringify(ran.result ?? '')
      await update($, stats, s => ({ ...s, tests: readTests(output, ran.isError === true) }))
    }
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const usage = e.usage
    const tokens = usage
      ? usage.input_tokens +
        usage.output_tokens +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0)
      : 0
    const cost = (await $.session.usage()).cost?.usd ?? null
    const isMain = e.agentId === undefined
    const spent = (await read($, stats)).costUsd ?? 0
    await update($, stats, s => ({
      ...s,
      turnCosts: isMain && cost !== null ? [...(s.turnCosts ?? []), cost - spent].slice(-8) : (s.turnCosts ?? []),
      turns: s.turns + (isMain ? 1 : 0),
      agentMs: s.agentMs + (isMain ? e.durationMs : 0),
      tokens: s.tokens + tokens,
      costUsd: cost,
      lastCostUsd: isMain && cost !== null ? cost - (s.costUsd ?? 0) : s.lastCostUsd,
    }))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Other panels share this place: theirs is drawn under Graut's, not replaced by it.
    // next(e) rejects only when nothing answers beneath, as in the test harness.
    const below = await next(e).catch(() => undefined)

    const current = await read($, level)
    const s = await read($, stats)
    const isCompact = await read($, compact)
    const { Box, Text, Button } = $.ui.resolve(e)
    const failed = (what: string) => () => $.ui.toast(`Graut: ${what} did not work`)

    const choose = async (chosen: Level) => {
      await $.fs.write(await levelFile($), `${chosen}\n`)
      await update($, level, () => chosen)
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
          `| tokens | ${count(s.tokens)} |`,
          `| agent time | ${clock(s.agentMs)} over ${s.turns} turns |`,
          `| tests | ${testsText(s.tests)} |`,
          `| specialists | ${s.packs.join(', ') || 'none'} |`,
        ].join('\n'),
        surface: e.surface,
      })
      $.ui.toast(done.isCopied ? 'Graut: usage copied' : 'Graut: could not copy')
    }

    const turns = s.turnCosts ?? []
    const testsColor = s.tests.state === 'pass' ? 'success' : s.tests.state === 'fail' ? 'error' : 'text'
    const columns = [
      {
        label: 'cost',
        value: money(s.costUsd),
        sub: `last ${money(s.lastCostUsd)}${s.turns && s.costUsd !== null ? ` · avg ${money(s.costUsd / s.turns)}` : ''} ${bars(turns)}`,
      },
      { label: 'tokens', value: count(s.tokens), sub: `${s.turns} ${s.turns === 1 ? 'turn' : 'turns'}` },
      { label: 'agent time', value: clock(s.agentMs), sub: s.turns ? `avg ${clock(s.agentMs / s.turns)} / turn` : '' },
      {
        label: 'tests',
        value: testsText(s.tests),
        sub: s.tests.state === 'pass' ? 'after last change' : s.tests.state === 'fail' ? 'last run' : '',
        tone: testsColor,
      },
      { label: 'skills', value: `${s.packs.length}`, sub: s.packs.join(', ') || 'none yet' },
    ] as const

    // A terminal needs widths in cells; elsewhere the columns share the row.
    const wide = e.surface === 'terminal' ? { width: Math.max(12, Math.floor(e.props.bodyColumns / columns.length) - 2) } : { flexGrow: 1 }
    const levels = LEVELS.map(l => (
      <Button
        key={`level-${l}`}
        label={l}
        {...(l === current ? { variant: 'primary' as const } : { plain: true as const, dimColor: true })}
        onPress={() => choose(l).catch(failed('saving the level'))}
      />
    ))

    const mine = (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text bold color="warning">
            GRAUT
          </Text>
          <Text dimColor>by Pranjal</Text>
          <Text>{mood(e.props.isWorking, current, s.tests)}</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
          {levels}
          <Box flexGrow={1} />
          <Button key="copy" plain label="Copy" onPress={() => copy().catch(failed('copy'))} />
          <Button key="review" plain label="Review" onPress={() => ask('review the current changes for bugs and bloat; report only')} />
          <Button key="audit" plain label="Audit" onPress={() => ask('audit this project for bugs, security, accessibility and bloat; report only')} />
          <Button key="doctor" plain label="Doctor" onPress={() => doctor().catch(failed('doctor (is Node.js installed?)'))} />
          <Button key="compact" plain label={isCompact ? 'Details' : 'Compact'} onPress={() => update($, compact, v => !v)} />
        </Box>
        {isCompact ? null : (
          <Box flexDirection="column">
            <Text dimColor wrap="truncate-end">
              {'─'.repeat(e.props.bodyColumns)}
            </Text>
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              {columns.map(c => (
                <Box key={c.label} flexDirection="column" {...wide}>
                  <Text dimColor>{c.label}</Text>
                  <Text bold color={'tone' in c ? c.tone : 'text'}>
                    {c.value}
                  </Text>
                  <Text dimColor wrap="truncate-end">
                    {c.sub}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    )
    return below ? (
      <Box flexDirection="column">
        {mine}
        {below}
      </Box>
    ) : (
      mine
    )
  })
}
