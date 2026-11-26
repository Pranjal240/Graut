export type Level = 'off' | 'lite' | 'full' | 'ultra'

export type Tests = { state: 'none' | 'pass' | 'fail' | 'stale'; passed: number | null }

export type Stats = {
  turns: number
  agentMs: number
  tokens: number
  costUsd: number | null
  lastCostUsd: number | null
  tests: Tests
  /** Specialists read this session, in the order first used. */
  packs: string[]
}

declare module 'claude-code' {
  interface PluginState {
    graut: { level: Level; stats: Stats }
  }
}
