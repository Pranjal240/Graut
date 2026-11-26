<div align="center">

<img src="https://raw.githubusercontent.com/Pranjal240/Graut/main/assets/graut-logo.jpg" alt="Graut logo: the 'graut bhar denge' meme" width="340">

# Graut

### Tention mat le, teri problem me graut bhar denge.

**Web development, AI development, machine learning ya kuch bhi: sabme Graut bhar denge, ye skill use karke.**<br>
Koi bhi software problem ho, usme graut bhar denge aur solve kar denge.

by **Pranjal**

```bash
npx graut-bhar-de
```

</div>

---

## What is Graut?

One skill for Claude Code, Codex, Antigravity and other coding agents. Say your problem in a few words. Graut works out what it really needs, loads the right expertise, builds it, **checks it before calling it solved**, and remembers your project.

- **Any software problem.** Websites, APIs, bugs, AI apps, ML models, design, launch videos.
- **One skill, not thirty.** Your agent sees only `graut`. Everything else is read when a task needs it, so sessions stay light.
- **Any model.** A seven-step short version keeps small models on track; bigger ones get the full playbook.
- **A live panel** in Claude Code, with your level and what the session has used.

## Install

| How | Command |
|---|---|
| **Recommended** | `npx graut-bhar-de` |
| Install globally | `npm install -g graut-bhar-de` then `graut` |
| Claude Code plugin (with the panel) | `/plugin marketplace add Pranjal240/Graut` then `/plugin install graut@graut` |
| `skills` CLI | `npx skills add Pranjal240/Graut -g` |
| From GitHub | `npx --allow-git=all github:Pranjal240/Graut` |
| Clone | `git clone https://github.com/Pranjal240/Graut.git` then `node Graut/skills/graut/scripts/graut.js` |
| Paste into an agent | `Install the skill from https://github.com/Pranjal240/Graut : copy the whole skills/graut folder into your skills folder.` |

Restart your agent afterwards. You need Node.js 18.3 or newer.

`npm install graut-bhar-de` only downloads the package: run `npx graut-bhar-de` to set it up (npm does not run setup scripts for you). `npx graut-bhar-de` and the clone route also install missing tools and switch Graut on for every agent found; after the other routes, say "set up graut".

## The panel

With the Claude Code plugin, Graut sits above the prompt:

```text
GRAUT by Pranjal   Tention mat le, teri problem me graut bhar denge
[off] [lite] [* full] [ultra] | [Review] [Audit] [Doctor] [Copy] [Compact]
cost $0.42 last $0.11   tokens 1.2M   time 4m 10s 3 turns   tests 11 passed   skills ui-ux-pro-max
```

| Level | What Graut does |
|---|---|
| `off` | Stays out of the way |
| `lite` | The short version; specialists only when needed |
| `full` | Everything (default) |
| `ultra` | Loads every matching specialist, plans in writing, verifies, reviews its own work |

Other agents: `npx graut-bhar-de level ultra`.

**Review** and **Audit** ask Graut for a report on your changes or project. **Doctor** shows what is missing. **Copy** puts the session figures on your clipboard. **Compact** shrinks the conversation. Cost is Claude Code's own estimate.

## Use

```text
/graut tests fail, fix it
/graut build a landing page for my chai shop
/graut my RAG bot gives wrong answers
/graut my model has 99% accuracy but fails in production
kya karu? my app is slow
```

With the plugin the command is `/graut:graut`.

| When | Graut says |
|---|---|
| Starting a task | Tention mat le, teri problem me graut bhar denge |
| You ask "kya karu?" | Isme Graut bhar denge, and then the answer |
| It needs something from you | teri problem me graut to bhar diya, par isse kam nhi chalega (do this: ...) |
| Solved and checked | le bhai isme graut bhardiya |

## From four words to a website

A one-line page and the prompt "make this website good" gave this (the menu items are samples, and the page says so):

<div align="center">
<img src="https://raw.githubusercontent.com/Pranjal240/Graut/main/assets/example-website.jpg" alt="A chai cart ordering page built by Graut" width="720">
</div>

## How it works

1. **Understand** a short request and fill in sensible defaults.
2. **Plan** to the size of the job.
3. **Load** the playbook or specialist that fits, one at a time.
4. **Build** the smallest complete change.
5. **Prove** it by running something, never by rereading its own work.
6. **Remember** what matters in `.graut/memory.md`.

## What is inside

| For | Inside Graut |
|---|---|
| Web, AI apps, machine learning, debugging | Graut playbooks |
| Routing, chaining, subagents, memory, new skills and agents | `graut` |
| Writing less code | `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` |
| Correct engineering | `gravitas`, `gravitas-highstakes`, `gravitas-python`, `gravitas-typescript` |
| Design | `ui-ux-pro-max`, `impeccable`, `design`, `brand`, `design-system`, `ui-styling`, `banner-design`, `slides` |
| Video | `brag`, `brag-slim`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `camera-3d-captions`, `day-in-my-life`, `duo`, `p5-paint-animation`, `prod-by-claude`, `session-story`, `vox-explainer`, `x-posting-license` |
| Turning a person's thinking into a skill | `huashu-nuwa` |
| Safety | `skill-inspector`, with NVIDIA SkillSpector |
| Everything else | `find` searches skills on your machine and thousands in the bundled catalogs; `add` gives one to Graut |

## Commands

Prefix each with `npx graut-bhar-de`.

| Command | Does |
|---|---|
| `install` (default) | set up or update |
| `doctor` | show what is installed and missing |
| `level [name]` | show or change the level |
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
3. Copies the `graut` folder into each agent's skills folder. A `graut` folder of your own is left alone.
4. Adds a short marked block to `CLAUDE.md`, `AGENTS.md` and `GEMINI.md` (the old file is saved as `.graut.bak`).

Supported: Claude Code, Codex, Antigravity, Gemini CLI, Cursor, OpenCode, GitHub Copilot CLI, Windsurf, Kiro. The always-on block is added for Claude Code, Codex, Antigravity and Gemini CLI; the others load Graut when the task matches.

## Safety, read this

- Skills are instructions and scripts that your agent runs with your permissions. Installing Graut means trusting the projects in [CREDITS.md](CREDITS.md).
- A static scan rates some specialists high risk. [SCAN.md](SCAN.md) lists them and why. Use `--strict` to leave them out.
- Some specialists use the network or your API keys when you run them: `impeccable` downloads its engine on first run, the HyperFrames tools are fetched with `npx`, and `design` calls the image provider you give it a key for. Graut asks before any of them sends usage data.
- `session-story` and `day-in-my-life` read your local agent transcripts to make their films.

## Maintaining

```bash
npm test
claude plugin test .
```

To update a specialist, change its `sha` in [sources.json](skills/graut/sources.json), run `npm run sync`, read the diff, then commit.

## License and credits

Graut, its playbooks, panel and installer are by Pranjal, under the MIT license. The bundled specialists are open source work by their own authors, each shipped with its license: see [CREDITS.md](CREDITS.md).
