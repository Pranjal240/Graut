<div align="center">

<img src="https://raw.githubusercontent.com/Pranjal240/Graut/main/assets/graut-logo.jpg" alt="Graut logo: the 'graut bhar denge' meme" width="340">

# Graut

### Tention mat le, teri problem me graut bhar denge.

**Web development, AI development, machine learning ya kuch bhi: sabme Graut bhar denge, ye skill use karke.**<br>
Koi bhi software problem ho, usme graut bhar denge aur solve kar denge.

by **Pranjal**

[![install-check](https://github.com/Pranjal240/Graut/actions/workflows/install-check.yml/badge.svg)](https://github.com/Pranjal240/Graut/actions/workflows/install-check.yml)

```bash
npx graut-bhar-de
```

</div>

---

## Quick start

**1. Install.** Type this in a terminal (PowerShell on Windows, Terminal on macOS and Linux), not in the chat. It needs [Node.js](https://nodejs.org) and git.

```bash
npx graut-bhar-de
```

**2. Close and reopen your agent, then type your problem.** In Claude Code:

```text
/graut:graut make my website look good
```

In Codex, Antigravity, Gemini CLI, Cursor and others:

```text
/graut make my website look good
```

**3. Panel in your way? Turn it off.** Claude Code shows a small Graut bar above the chat box.

| You want | Do this | To bring it back |
|---|---|---|
| Hide the bar, keep the skills | click **Hide** on the bar, or type `/graut-panel off` in Claude Code | `/graut-panel on` |
| The same, from a terminal | `npx graut-bhar-de@latest panel off` | `npx graut-bhar-de@latest panel on` |
| Turn the whole plugin off | `claude plugin disable graut@graut`, then restart Claude Code | `claude plugin enable graut@graut` |

**4. Uninstall** (removes the plugin, the panel and the skill from every agent; your own files stay):

```bash
npx graut-bhar-de@latest uninstall
```

## What Graut can do

**Bring it any problem.** Say it in a few words, in English or Hinglish. Graut works out what it needs, loads the right expertise, builds it, **checks it before calling it solved**, remembers your project, and tells you plainly when something is still needed from you. It is one skill with 36 specialists inside, and for a job none of them covers, in any field, it searches the skills on your machine and thousands in its catalogs.

| Your problem | Specialists inside Graut | Try in Claude Code |
|---|---|---|
| Bugs, features, planning, hard debugging | Graut playbooks, `gravitas`, `gravitas-python`, `gravitas-typescript` | `/graut:graut tests fail, fix it` |
| Risky changes: login, payments, data | `gravitas-highstakes` | `/graut:gravitas-highstakes migrate my users table` |
| Websites and app design | `ui-ux-pro-max`, `impeccable`, `ui-styling`, `web-design-guidelines` | `/graut:impeccable audit my landing page` |
| Brand, logos, banners, slides | `design`, `brand`, `design-system`, `banner-design`, `slides` | `/graut:slides pitch deck for a chai shop` |
| AI apps and machine learning | Graut playbooks for AI and ML | `/graut:graut my model is 99% accurate but fails live` |
| Code review and too much code | `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` | `/graut:ponytail-review` |
| Launch videos and explainers | `brag`, `brag-slim`, `vox-explainer`, `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use` | `/graut:brag-slim` |
| Fun and social videos | `camera-3d-captions`, `day-in-my-life`, `duo`, `p5-paint-animation`, `prod-by-claude`, `session-story`, `x-posting-license` | `/graut:duo compare two screens` |
| Turning a person's thinking into a skill | `huashu-nuwa` | `/graut:huashu-nuwa think like a great teacher` |
| Finding and safety-checking skills | `search-skill`, `skill-inspector` (with NVIDIA SkillSpector) | `/graut:skill-inspector check this skill` |
| Anything else | `find` searches, `add` brings a skill in | `npx graut-bhar-de find "kubernetes deploy"` |

Some jobs need extra tools or your own account: video skills need FFmpeg, image generation needs a `GEMINI_API_KEY`, and HeyGen voices need a HeyGen login. `npx graut-bhar-de doctor` shows what is missing.

The full guide follows: [install](#install), [upgrade](#upgrade-to-a-newer-version), [use](#use), [panel](#the-panel), [commands](#commands).

## Install

Four steps. Type the commands in a terminal (**PowerShell** on Windows, **Terminal** on macOS and Linux), not in the chat box.

### Step 1: get the basic tools

Skip anything you already have. Graut needs Node.js 18.3 or newer (22 or newer for video skills) and git; the rest is used by the design and video skills.

<details open>
<summary><b>Windows</b></summary>

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
winget install --id Python.Python.3.13 -e
winget install --id Gyan.FFmpeg.Essentials -e
winget install --id astral-sh.uv -e
```

Close PowerShell and open a new one.
</details>

<details>
<summary><b>macOS</b> (needs <a href="https://brew.sh">Homebrew</a>)</summary>

```bash
brew install node git python ffmpeg uv
python3 -m pip install --user --break-system-packages numpy scipy pillow google-genai
```
</details>

<details>
<summary><b>Linux</b> (Ubuntu or Debian)</summary>

```bash
sudo apt-get update && sudo apt-get install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git python3 python3-pip python3-numpy python3-scipy python3-pil ffmpeg
curl -LsSf https://astral.sh/uv/install.sh | sh
python3 -m pip install --user --break-system-packages google-genai
```

Open a new terminal. On other distributions, install the same tools with your package manager.
</details>

### Step 2: install Graut (same on every system)

```bash
npx graut-bhar-de
```

On Windows, if PowerShell says *running scripts is disabled*, use `npx.cmd graut-bhar-de`.

### Step 3: restart and check

Close and reopen Claude Code (or your agent), then:

```bash
npx graut-bhar-de doctor
```

If a line says `MISSING`, run the command Graut prints after `do this:` and install again.

### Step 4: use it

Open your project in your agent and type your problem. In Claude Code:

```text
/graut:graut tests fail, fix it
```

In other agents:

```text
/graut tests fail, fix it
```

## Upgrade to a newer version

1. Close your agent.
2. Run this (same on Windows, macOS and Linux):

```bash
npx graut-bhar-de@latest upgrade
```

3. Open your agent again, then check with `npx graut-bhar-de@latest doctor`.

`upgrade` gets the newest version from npm, refreshes the global install if you have one, and installs it for every agent found. Your level, your added skills and your own files stay. It takes the same options as `install`, such as `--agents claude`. If npm says the command is not found or you still get the old version, wait a few minutes: a fresh release takes a while to appear.

| How you installed | How to upgrade |
|---|---|
| `npx` or global install | `npx graut-bhar-de@latest upgrade` |
| git clone | in the `Graut` folder: `git pull`, then `node skills/graut/scripts/graut.js` |
| Only the Claude Code plugin from GitHub | in Claude Code: `/plugin marketplace update graut`, then `/plugin update graut@graut`, then restart |

## Uninstall

```bash
npx graut-bhar-de@latest uninstall
```

If you installed it globally, also run `npm uninstall -g graut-bhar-de`.

### Other ways to install

**Install once, then use `npx graut`** (on Linux put `sudo` before the first command):

```bash
npm install -g graut-bhar-de
npx graut
```

npm only downloads the package; `npx graut` sets it up. npm does not allow a package named exactly `graut`, so the install name is `graut-bhar-de`.

**git clone**

```bash
git clone -c core.longpaths=true https://github.com/Pranjal240/Graut.git
cd Graut
node skills/graut/scripts/graut.js
```

**Straight from GitHub** (the newest code, before it reaches npm)

```bash
npx --yes github:Pranjal240/Graut
```

**Only inside Claude Code** (type these in Claude Code)

```
/plugin marketplace add Pranjal240/Graut
/plugin install graut@graut
```

In the desktop app: click **+** beside the prompt box, **Plugins**, **Add marketplace** `Pranjal240/Graut`, then **Add plugin**. This gives you the panel and every skill. Say **set up graut** afterwards to install the tools the skills need.

## Use

In Claude Code, with the plugin:

```text
/graut:graut tests fail, fix it
/graut:graut my model has 99% accuracy but fails in production
/graut:impeccable audit my landing page
/graut:ui-ux-pro-max design system for a chai shop
/graut:brag-slim
kya karu? my app is slow
```

Every skill below has its own `/graut:<name>` command. In other agents, or when Graut is installed as a plain skill, write `/graut impeccable audit my landing page`.

Graut stays quiet until it is needed. Questions, renames, small edits and ordinary fixes are done directly. The skill is used when you call it, or when the job needs a specialist, and only then does it speak:

| While the skill is working | Graut says |
|---|---|
| Starting a task | Tention mat le, teri problem me graut bhar denge |
| You ask "kya karu?" | Isme Graut bhar denge, and then the answer |
| It needs something from you | teri problem me graut to bhar diya, par isse kam nhi chalega (do this: ...) |
| Solved and checked | le bhai isme graut bhardiya |

## The panel

In Claude Code, Graut sits above the prompt as one line:

```text
Graut  ● full  $0.42  last $0.11  context 42%  tests 11 passed      Review  Audit  Doctor  Details  Hide
```

**Hide** removes the bar (`/graut-panel on` brings it back). **Details** opens the full view (Graut remembers your choice):

```text
Graut  off  lite  [full]  ultra              Copy  Review  Audit  Doctor  Compact  Hide
──────────────────────────────────────────────────────────────────────────────────────────
cost                  tokens       agent time       context            tests
$0.42                 1.2M         4m 10s           42%                11 passed
last $0.11 · ⌀ $0.14  3 turns      ⌀ 1m 23s / turn  84.0k of 200.0k    after last change
```

| Column | Meaning |
|---|---|
| cost | the session's total, the last turn's cost and the average per turn |
| tokens, agent time | what the panel has counted, kept when you resume the session |
| context | how full the model's memory is; from 70% it suggests `/compact` |
| reuse, callers | shown once code changes: existing functions reused, and removed ones still called |
| tests | the last test run; `rerun` after you edit code |
| skills | the Graut specialists used in this session |

The panel only watches: it adds nothing to what the model reads, except one note when you change the level. It appears after you install and restart Claude Code. If you also run the ponytail plugin you will see two panels; Graut already includes ponytail, so `claude plugin disable ponytail@ponytail` leaves only Graut's. Other agents have no panel; use `level` there.

| Level | What Graut does |
|---|---|
| `off` | Tells the agent to leave Graut alone |
| `lite` | Asks the agent to spend few tokens; the skill runs only when you call it |
| `full` | Default: spend few tokens, reuse existing code, call the skill when a specialist is needed. In Claude Code the session also starts with a short map of your code |
| `ultra` | Uses the skill for anything bigger than a quick edit: plan, specialists, verify, review |

Other agents: `npx graut-bhar-de level ultra`.

## What install sets up

| Set up | For |
|---|---|
| The Claude Code plugin | the panel and `/graut:<name>` commands |
| The `graut` skill in Codex, Antigravity, Gemini CLI, Cursor, OpenCode, Copilot CLI, Windsurf and Kiro | whichever you have |
| git, uv, Python, FFmpeg (through winget or Homebrew) | design and video skills |
| `python3` on Windows | skills that call it |
| Python packages: numpy, scipy, pillow, google-genai | `design`, `day-in-my-life` |
| Node packages | `day-in-my-life`, `session-story`, `p5-paint-animation` |
| The design engine and the video tool | `impeccable`, HyperFrames skills |
| A short note in `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` (old file saved as `.graut.bak`) | a quiet note: keep context small, call Graut only when needed. In Claude Code the plugin does this at session start, so `CLAUDE.md` is left alone |

Two features need your own account: image generation in `design` needs a `GEMINI_API_KEY`, and HeyGen voices and avatars in `media-use` need a HeyGen login.

## Fewer tokens in every agent

- **One skill to list.** Claude Code, Codex, Antigravity and the rest see `graut`, not 37 skills. Specialists are read only when a task needs them. In Claude Code the 36 direct commands add nothing to a session (measured).
- **Lean working rules.** Graut limits command output, reads only what the task needs and keeps replies short, without skipping checks.
- **Nothing lost.** A loaded specialist is followed in full, exactly as its author wrote it, with Graut's planning, checking and memory around it.

## Tested

Every change runs the install steps on fresh Windows, macOS and Linux machines: the one-command install, the global install, git clone, the Claude Code plugin, the `skills` CLI, a design audit and a video render. The badge at the top shows the latest result.

## Something not working?

| You see | Do this |
|---|---|
| Anything unclear | `npx graut-bhar-de doctor` names what is missing and the command that fixes it |
| No panel, no `/graut:` commands | Close Claude Code fully and reopen it; check `claude plugin list` shows `graut@graut` |
| `Python was not found` | Run the install again, or use `python` instead of `python3` |
| `ffmpeg` not found after installing it | Open a new terminal |
| Video render fails on first use | Run `npx --yes hyperframes@latest doctor` |

## From four words to a website

A one-line page and the prompt "make this website good" gave this (the menu items are samples, and the page says so):

<div align="center">
<img src="https://raw.githubusercontent.com/Pranjal240/Graut/main/assets/example-website.jpg" alt="A chai cart ordering page built by Graut" width="720">
</div>

## Commands

Prefix each with `npx graut-bhar-de` (or `npx graut` after the global install).

| Command | Does |
|---|---|
| `install` (default) | set up or update |
| `upgrade` | get the newest version and install it |
| `doctor` | show what is installed and missing |
| `level [name]` | show or change the level |
| `panel [on\|off]` | show or hide the Claude Code panel |
| `find <words>` | search local skills and catalogs |
| `add <id>` | scan one catalog skill and give it to Graut |
| `uninstall` | remove what Graut installed |

| Option | Does |
|---|---|
| `--agents claude,codex` | only these agents |
| `--no-activate` | leave instruction files alone |
| `--no-plugin` | Claude Code: the skill only, without the plugin and panel |
| `--no-system-deps` | do not install tools or packages |
| `--allow-risky` | with `add`, add a catalog skill despite a failed or missing scan |

## Good to know

- Skills are instructions and scripts that your agent runs with your permissions.
- Some skills use the network or your API keys when you run them: `impeccable` and the HyperFrames tools download their programs, and `design` calls the image provider you give it a key for. Graut asks before any of them sends usage data.
- `session-story` and `day-in-my-life` read your local agent transcripts to make their films.

## Maintaining

```bash
npm test
claude plugin test .
```

To update a specialist, change its `sha` in [sources.json](skills/graut/sources.json), run `npm run sync`, read the diff, then commit.

## Contributing

Ask first: see [CONTRIBUTING.md](CONTRIBUTING.md). Nothing is merged without the owner's approval.

## License and credits

Graut, its playbooks, panel and installer are by Pranjal, under the MIT license. The bundled specialists are open source work by their own authors, each shipped with its license: see [CREDITS.md](CREDITS.md).
