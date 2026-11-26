# Graut

> **Tention mat le, teri problem me graut bhar denge.**

One master skill and 34 specialists for Claude Code, Codex, Antigravity and other coding agents. Give Graut a problem: it picks and chains the right skills, splits the work across subagents when that helps, remembers your project, and calls it solved only after a check passes.

Everything is in this repository. No hunting for ten other installs.

## Install

Pick one.

**One command** (copies all skills into every agent on your machine and turns Graut on)

```bash
npx github:Pranjal240/Graut
```

**Claude Code plugin**

```
/plugin marketplace add Pranjal240/Graut
/plugin install graut@graut
```

**The `skills` CLI**

```bash
npx skills add Pranjal240/Graut --skill '*' -g
```

**Copy a link into your agent**

```
Install every skill from https://github.com/Pranjal240/Graut : copy each folder inside skills/ into your skills folder.
```

**Clone**

```bash
git clone https://github.com/Pranjal240/Graut.git
node Graut/skills/graut/scripts/graut.js
```

Then restart your agent. The `npx` and clone routes need Node.js 18.3+, and git for the `npx` and clone download.

Only the first and last routes install missing tools and add the always-on block. After the other routes, say "set up graut" to do that.

## Use

Just describe the problem. Or call a skill by name: `/graut`, `/ui-ux-pro-max`, `/brag`, `/brag-slim`, `/impeccable`, `/ponytail` (plugin installs prefix them with `graut:`).

| When | Graut says |
|---|---|
| Starting a task | Tention mat le, teri problem me graut bhar denge |
| You ask "kya karu?" | Isme Graut bhar denge, and then the answer |
| It needs something from you | teri problem me graut to bhar diya, par isse kam nhi chalega (do this: ...) |
| Solved and checked | le bhai isme graut bhardiya |

## What is inside

| For | Skills |
|---|---|
| Routing, chaining, splitting work, memory, making new skills and agents | `graut` |
| Writing less code | `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` |
| Correct engineering | `gravitas`, `gravitas-highstakes`, `gravitas-python`, `gravitas-typescript` |
| Design | `ui-ux-pro-max`, `impeccable`, `design`, `brand`, `design-system`, `ui-styling`, `banner-design`, `slides` |
| Video | `brag`, `brag-slim`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `camera-3d-captions`, `day-in-my-life`, `duo`, `p5-paint-animation`, `prod-by-claude`, `session-story`, `vox-explainer`, `x-posting-license` |
| Turning a person's thinking into a skill | `huashu-nuwa` |
| Safety | `skill-inspector`, with NVIDIA SkillSpector |
| Everything else | `graut find` searches skills already on your machine and thousands in the bundled catalogs; `graut add` installs one |

The big catalogs are searched, not installed: loading thousands of skills would fill your agent's context before you typed a word.

## Commands

Prefix each with `npx github:Pranjal240/Graut`.

| Command | Does |
|---|---|
| `install` (default) | set up or update |
| `doctor` | show what is installed and missing |
| `find <words>` | search local skills and catalogs |
| `add <id>` | scan and install one catalog skill |
| `uninstall` | remove what Graut installed |

| Option | Does |
|---|---|
| `--agents claude,codex` | only these agents |
| `--no-activate` | leave instruction files alone |
| `--no-system-deps` | do not install tools or SkillSpector |
| `--scan` | scan the skills before installing (several minutes) |
| `--strict` | scan, and install only the skills that pass |
| `--allow-risky` | with `add`, install despite a failed or missing scan |

## What install does

1. Installs missing git, uv, Python and FFmpeg through winget or Homebrew, if you run it in a terminal. Elsewhere it prints the command.
2. Installs SkillSpector with uv.
3. Copies the skills into each agent's skills folder. A skill you already have under the same name is left alone.
4. Adds a short marked block to `CLAUDE.md`, `AGENTS.md` and `GEMINI.md` (the old file is saved as `.graut.bak`).

Supported: Claude Code, Codex, Antigravity, Gemini CLI, Cursor, OpenCode, GitHub Copilot CLI, Windsurf, Kiro. The always-on block is added for Claude Code, Codex, Antigravity and Gemini CLI; the others load Graut when the task matches.

## Safety, read this

- Skills are instructions and scripts that your agent runs with your permissions. Installing Graut means trusting the projects in [CREDITS.md](CREDITS.md).
- A static scan rates some bundled skills high risk. [SCAN.md](SCAN.md) lists them and why. Use `--strict` to leave them out.
- Some skills use the network or your API keys when you run them: `impeccable` downloads its engine on first run, HyperFrames sends a usage note unless you say no, and `design` calls the image provider you give it a key for.
- `session-story` and `day-in-my-life` read your local agent transcripts to make their films.
- Graut installs skill folders only. It does not install other projects' hooks.

## Maintaining

```bash
npm test
```

To update a bundled skill, change its `sha` in [sources.json](skills/graut/sources.json), run `npm run sync`, read the diff, then commit.

## License

Graut's own files are MIT. Every bundled skill keeps its author's license, shipped in its folder. See [CREDITS.md](CREDITS.md).
