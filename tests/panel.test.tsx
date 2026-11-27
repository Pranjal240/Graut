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

test('the panel shows its owner, levels, actions and stats on each surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /by Pranjal/ }))?.text).toBe('by Pranjal')
    expect(await ui.find({ type: 'Text', text: /Isme Graut bhar denge/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^not run$/ })).toBeDefined()
    for (const key of ['level-off', 'level-lite', 'level-full', 'level-ultra', 'review', 'audit', 'doctor', 'copy', 'compact']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    await ui.unmount()
  }
})

test('choosing a level saves it and tells the model once', async ($, on) => {
  const files: [string, string][] = []
  const heard: (readonly string[])[] = []
  mock.env(on, { HOME: '/home/u' })
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

test('a test run, an edit and a specialist show up in the panel', async ($, on) => {
  on('tool.call', (_, e) => ({
    result: {},
    text: e.tool === 'Bash' ? 'ℹ tests 11\nℹ pass 11\nℹ fail 0' : '',
  }))

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.tool.call({ tool: 'Read', file_path: '/x/skills/graut/packs/impeccable/PACK.md' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(await ui.find({ type: 'Text', text: /^11 passed$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^impeccable$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /le bhai isme graut bhardiya/ })).toBeDefined()

  await $.tool.call({ tool: 'Edit', file_path: '/x/a.js', old_string: 'a', new_string: 'b' })
  expect(await ui.find({ type: 'Text', text: /rerun/ })).toBeDefined()
  await ui.unmount()
})

test('failing runs are reported as failing', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: '===== 2 failed, 5 passed in 1.2s =====' }))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Bash', command: 'python -m pytest' })
  expect(await ui.find({ type: 'Text', text: /^failing$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /isse kam nhi chalega/ })).toBeDefined()
  await ui.unmount()
})

test('Compact hides the numbers and Details brings them back', async $ => {
  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^agent time$/ })).toBeDefined()
    await ui.press({ key: 'compact' })
    expect(await ui.find({ type: 'Text', text: /^agent time$/ })).toBeUndefined()
    await ui.press({ key: 'compact' })
    expect(await ui.find({ type: 'Text', text: /^agent time$/ })).toBeDefined()
    await ui.unmount()
  }
})
