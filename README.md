# Graut

> **Tention mat le, teri problem me graut bhar denge.**

One skill for Claude Code, Codex, Antigravity and other coding agents. Say what you want in a few words. Graut works out what the job needs, loads the right specialist out of 34 bundled ones, builds it, checks it, and remembers your project.

Your agent sees **one** skill. The specialists are read only when a task needs them, so in Claude Code every session pays about 100 tokens for the skill list plus a short reminder, instead of about 3,500 for 35 separate skills.

## Install

Pick one.

**One command** (adds Graut to every agent on your machine and turns it on)

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
npx skills add Pranjal240/Graut -g
```

**Copy a link into your agent**

```
Install the skill from https://github.com/Pranjal240/Graut : copy the whole skills/graut folder into your skills folder.
```

**Clone**

```bash
git clone https://github.com/Pranjal240/Graut.git
node Graut/skills/graut/scripts/graut.js
```

Then restart your agent. The `npx` and clone routes need Node.js 18.3+ and git. The plugin's start-of-session reminder needs Node.js too.

The first and last routes also install missing tools and add the always-on note for your agents. After the other routes, say "set up graut".

## Use

```
/graut tests fail, fix it
/graut build a landing page for my chai shop
/graut brag
/graut impeccable audit the dashboard
kya karu? my app is slow
```

With the plugin, the command is `/graut:graut`.

| When | Graut says |
|---|---|
| Starting a task | Tention mat le, teri problem me graut bhar denge |
| You ask "kya karu?" | Isme Graut bhar denge, and then the answer |
| It needs something from you | teri problem me graut to bhar diya, par isse kam nhi chalega (do this: ...) |
| Solved and checked | le bhai isme graut bhardiya |

## How it works

1. **Understand** a short request and fill in sensible defaults.
2. **Plan** to the size of the job.
3. **Build** the smallest complete change.
4. **Prove** it by running something, never by rereading its own work.
5. **Load** a specialist only when it adds depth, one at a time.
6. **Remember** what matters in `.graut/memory.md`.

Websites and UI work get the design chain automatically: `ui-ux-pro-max` for the design system, `impeccable` for audit and polish.

## What is inside

| For | Specialists |
|---|---|
| Writing less code | `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` |
| Correct engineering | `gravitas`, `gravitas-highstakes`, `gravitas-python`, `gravitas-typescript` |
| Design | `ui-ux-pro-max`, `impeccable`, `design`, `brand`, `design-system`, `ui-styling`, `banner-design`, `slides` |
| Video | `brag`, `brag-slim`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `camera-3d-captions`, `day-in-my-life`, `duo`, `p5-paint-animation`, `prod-by-claude`, `session-story`, `vox-explainer`, `x-posting-license` |
| Turning a person's thinking into a skill | `huashu-nuwa` |
| Safety | `skill-inspector`, with NVIDIA SkillSpector |
| Everything else | `find` searches skills on your machine and thousands in the bundled catalogs; `add` gives one to Graut |

## Commands

Prefix each with `npx github:Pranjal240/Graut`.

| Command | Does |
|---|---|
| `install` (default) | set up or update |
| `doctor` | show what is installed and missing |
| `find <words>` | search local skills and catalogs |
| `add <id>` | scan one catalog skill and give it to Graut |
| `uninstall` | remove what Graut installed |

| Option | Does |
|---|---|
| `--agents claude,codex` | only these agents |
| `--no-activate` | leave instruction files alone |
| `--no-system-deps` | do not install tools or SkillSpector |
| `--scan` | scan the specialists before installing (several minutes) |
| `--strict` | scan, and install only the ones that pass |
| `--allow-risky` | with `add`, add it despite a failed or missing scan |

## What install does

1. Installs missing git, uv, Python and FFmpeg through winget or Homebrew, if you run it in a terminal. Elsewhere it prints the command.
2. Installs SkillSpector with uv.
3. Copies the `graut` folder into each agent's skills folder. A `graut` folder of your own is left alone. Separate copies made by Graut 1.0 are removed.
4. Adds a short marked block to `CLAUDE.md`, `AGENTS.md` and `GEMINI.md` (the old file is saved as `.graut.bak`).

Supported: Claude Code, Codex, Antigravity, Gemini CLI, Cursor, OpenCode, GitHub Copilot CLI, Windsurf, Kiro. The always-on block is added for Claude Code, Codex, Antigravity and Gemini CLI; the others load Graut when the task matches.

## Safety, read this

- Skills are instructions and scripts that your agent runs with your permissions. Installing Graut means trusting the projects in [CREDITS.md](CREDITS.md).
- A static scan rates some specialists high risk. [SCAN.md](SCAN.md) lists them and why. Use `--strict` to leave them out.
- Some specialists use the network or your API keys when you run them: `impeccable` downloads its engine on first run, the HyperFrames tools are fetched with `npx`, and `design` calls the image provider you give it a key for. Graut asks before any of them sends usage data.
- `session-story` and `day-in-my-life` read your local agent transcripts to make their films.
- Graut does not install other projects' hooks.

## Maintaining

```bash
npm test
```

To update a specialist, change its `sha` in [sources.json](skills/graut/sources.json), run `npm run sync`, read the diff, then commit.

## License

Graut's own files are MIT. Every bundled specialist keeps its author's license, shipped in its folder. See [CREDITS.md](CREDITS.md).
