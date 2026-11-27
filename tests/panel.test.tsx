import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'graut',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    isCollapsed: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the panel starts as one line headed only Graut', async $ => {
  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /graut/i }))?.text).toBe('Graut')
    expect(await ui.find({ type: 'Text', text: /pranjal|bhar/i })).toBeUndefined()
    for (const key of ['level', 'review', 'audit', 'doctor', 'details', 'hide']) expect(await ui.find({ key })).toBeDefined()
    expect(await ui.find({ key: 'level-ultra' })).toBeUndefined()
    await ui.unmount()
  }
})

test('Details shows the levels and columns, drawn as an image on desktop, and Compact closes them', async ($, on) => {
  mock.store(on)
  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    await ui.press({ key: 'details' })
    for (const key of ['level-off', 'level-lite', 'level-full', 'level-ultra', 'copy']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    expect((await ui.find({ type: 'Svg' })) !== undefined).toBe(surface === 'desktop')
    // the character divider is a terminal drawing: an image replaces it on desktop
    expect((await ui.find({ type: 'Text', text: /^agent time$/ })) !== undefined).toBe(surface !== 'desktop')
    await ui.press({ key: 'details' })
    expect(await ui.find({ key: 'level-ultra' })).toBeUndefined()
    await ui.unmount()
  }
})

test('choosing a level saves it and tells the model once', async ($, on) => {
  const files: [string, string][] = []
  const heard: (readonly string[])[] = []
  mock.env(on, { HOME: '/home/u' })
  mock.store(on)
  on('fs.write', (_, e) => {
    files.push([e.path, e.text])
    return { value: undefined }
  })
  on('fs.read', () => ({ value: '{"ultra":"Graut level: ultra."}' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    heard.push(e.context ?? [])
    return { text: e.text }
  })
  const say = () => $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await say()
  await ui.press({ key: 'level' })
  await ui.press({ key: 'level-ultra' })
  await say()
  await say()

  expect(files.length).toBe(1)
  // the host resolves the path in the style of its own system
  expect(files[0]?.[0]).toMatch(/home.u.\.graut.level$/)
  expect(files[0]?.[1]).toBe('ultra\n')
  expect((await ui.find({ key: 'level-ultra' }))?.props.variant).toBe('primary')
  expect(heard).toEqual([[], ['Graut level: ultra.'], []])
  await ui.unmount()
})

test("the cost of a turn is what it added, over the session's own totals", async ($, on) => {
  mock.env(on, { HOME: '/home/u' })
  mock.store(on)
  let cost = 4.11
  let turns = 6
  on('session.usage', () => ({
    value: { startedAt: 0, rateLimits: [], cost: { usd: cost }, context: { window: 200000, tokens: 150000, percent: 75 } },
  }))
  on('session.turns', () => ({ value: turns }))
  on('session.id', () => ({ value: 's1' }))
  on('fs.read', () => ({ value: '' }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  // a resumed session shows its total, and no "last turn" it never saw
  expect(await ui.find({ type: 'Text', text: /\$4\.11/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /last/ })).toBeUndefined()

  cost = 4.39
  turns = 7
  await $.turn.complete({
    reason: 'answer',
    answer: 'done',
    durationMs: 28000,
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as never)
  await ui.press({ key: 'details' })
  expect(await ui.find({ type: 'Text', text: /^last \$0\.28 · ⌀ \$0\.63$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^7 turns$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^⌀ 28s \/ turn$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^try \/compact$/ })).toBeDefined()
  await ui.unmount()
})

test('tests, code edits and specialists show up in the panel', async ($, on) => {
  mock.store(on)
  let reply = { text: 'ℹ tests 15\nℹ pass 15\nℹ fail 0\nls: no such file', isError: true }
  on('tool.call', (_, e) => ({ result: {}, ...(e.tool === 'Bash' ? reply : { text: '' }) }) as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'details' })
  const shows = async (text: RegExp) => (await ui.find({ type: 'Text', text })) !== undefined
  const edit = (file_path: string) => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' })

  await $.tool.call({ tool: 'Read', file_path: '/x/skills/graut/packs/impeccable/PACK.md' })
  // a later step of the same command failed; the tests did not
  await $.tool.call({ tool: 'Bash', command: 'npm test; ls missing' })
  expect(await shows(/^15 passed$/)).toBe(true)
  expect(await shows(/^impeccable$/)).toBe(true)

  await edit('/x/notes.md')
  expect(await shows(/^15 passed$/)).toBe(true)
  await edit('/x/a.js')
  expect(await shows(/^rerun$/)).toBe(true)

  reply = { text: '===== 2 failed, 5 passed in 1.2s =====', isError: true }
  await $.tool.call({ tool: 'Bash', command: 'python -m pytest' })
  expect(await shows(/^2 failed$/)).toBe(true)

  reply = { text: 'Error: Cannot find module', isError: true }
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await shows(/^failing$/)).toBe(true)
  await ui.unmount()
})

test('a removed function that is still called is reported', async ($, on) => {
  mock.store(on)
  on('session.id', () => ({ value: 's2' }))
  on('process.run', (_, e) => {
    const stdout = JSON.stringify(e).includes('-nw') ? 'src/b.js:4:  total = oldSum(list)' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', () => ({ result: {}, text: '' }))
  on('turn.complete', () => ({ text: '' }))
  await $.tool.call({ tool: 'Edit', file_path: '/x/src/a.js', old_string: 'export function oldSum(a) {}', new_string: '' })
  await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1000 } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /1 callers open/ })).toBeDefined()
  await ui.unmount()
})

test('two kinds of test run in one command are added up', async ($, on) => {
  mock.store(on)
  on('tool.call', () => ({ result: {}, text: 'ℹ pass 16\nℹ fail 0\n 6 pass\n 0 fail' }) as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Bash', command: 'npm test && claude plugin test .' })
  expect(await ui.find({ type: 'Text', text: /22 passed/ })).toBeDefined()
  await ui.unmount()
})

test("the average time is that of the turns the panel timed, not all its time over one turn", async ($, on) => {
  mock.store(on)
  on('turn.complete', () => ({ text: '' }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'details' })
  for (const durationMs of [10000, 30000]) await $.turn.complete({ reason: 'answer', answer: 'done', durationMs } as never)
  expect(await ui.find({ type: 'Text', text: /^40s$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^⌀ 20s \/ turn$/ })).toBeDefined()
  await ui.unmount()
})

test('Hide and /graut-panel hide the panel and bring it back', async ($, on) => {
  const saved: string[] = []
  const commands: string[] = []
  mock.env(on, { HOME: '/home/u' })
  mock.store(on)
  on('fs.write', (_, e) => {
    saved.push(e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: e.path.endsWith('panel') ? (saved[saved.length - 1] ?? '') : '' }))
  on('command.register', (_, e) => {
    commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const say = (args: string) =>
    $.command.run({ command: 'graut-panel', args, origin: { kind: 'composer' }, presentation: {} } as never)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(commands).toEqual(['graut-panel'])
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'hide' })
  expect(saved).toEqual(['off\n'])
  expect(await ui.find({ key: 'review' })).toBeUndefined()

  expect((await say('on')).text).toBe('Graut panel shown.')
  expect(await ui.find({ key: 'review' })).toBeDefined()
  expect((await say('')).text).toMatch(/hidden/)
  expect(await ui.find({ key: 'review' })).toBeUndefined()
  expect((await say('sideways')).text).toMatch(/on or/)
  await ui.unmount()
})
