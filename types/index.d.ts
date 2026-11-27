export type Level = 'off' | 'lite' | 'full' | 'ultra'

export type Tests = { state: 'none' | 'pass' | 'fail' | 'stale'; passed: number | null; failed: number | null }

export type Stats = {
  /** The session's own turn count and cost, so they include what ran before the panel loaded. */
  turns: number
  costUsd: number | null
  turnCosts: number[]
  /** Time and tokens of the turns the panel saw, with the last turns' own durations. */
  agentMs: number
  turnMs: number[]
  tokens: number
  /** How full the context window is. */
  context: { percent: number; tokens: number; window: number } | null
  tests: Tests
  /** Specialists read this session, in the order first used. */
  packs: string[]
  /** Functions reused and created by edits, removed ones still called, and where. */
  reused: string[]
  created: string[]
  removed: string[]
  openCallers: string[]
}

declare module 'claude-code' {
  interface PluginState {
    graut: { level: Level; stats: Stats; details: boolean; hidden: boolean }
  }
}
