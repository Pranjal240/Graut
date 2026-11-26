# Credits and licenses

Graut (the master skill, installer and meme lines) is by [Pranjal240](https://github.com/Pranjal240). The specialist work is other people's open source projects, copied here from the commits pinned in [sources.json](skills/graut/sources.json). Their copyright stays theirs, and each folder carries the author's license (`UPSTREAM-LICENSE`, plus `UPSTREAM-NOTICE*` where one exists).

| Project | Author | License | Folders in `skills/` |
|---|---|---|---|
| [ponytail](https://github.com/DietrichGebert/ponytail) | DietrichGebert | MIT | `ponytail`, `ponytail-*` |
| [Gravitas](https://github.com/udaysharmadev/Gravitas) | udaysharmadev | MIT | `gravitas`, `gravitas-*` |
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | nextlevelbuilder | MIT | `ui-ux-pro-max`, `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling` |
| [impeccable](https://github.com/pbakaus/impeccable) | pbakaus | Apache-2.0 | `impeccable` |
| [brag](https://github.com/latent-spaces/brag) | latent-spaces | MIT | `brag`, `brag-slim` |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | HeyGen | Apache-2.0 | `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use` |
| [HyperFrames community skills](https://github.com/heygen-com/hyperframes-community-skills) | HeyGen and contributors | Apache-2.0 | `camera-3d-captions`, `day-in-my-life`, `duo`, `p5-paint-animation`, `prod-by-claude`, `session-story`, `vox-explainer`, `x-posting-license` |
| [nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | alchaincyf | MIT | `huashu-nuwa` |
| [SkillSpector](https://github.com/NVIDIA/SkillSpector) | NVIDIA | Apache-2.0 | `skill-inspector` |
| [agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | sickn33 and contributors | Code MIT, written content CC BY 4.0 (`UPSTREAM-LICENSE-CONTENT`) | `graut/library/agentic-awesome-skills` (search index) |
| [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | VoltAgent | MIT | `graut/library/awesome-agent-skills` |
| [claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) | shanraisshan | MIT | `graut/library/claude-code-best-practice` |

## Media and fonts

- Music in `brag`: "Happy Beats / Business Moves" Vol. 1, 9, 10, 11, 12 by Sascha Ende, [ende.app](https://ende.app/en), [CC BY 4.0](https://ende.app/en/standard-license). Credit it in videos that use it: "Music: Sascha Ende, ende.app (CC BY 4.0)".
- Sound effects in `brag`: [Kenney](https://kenney.nl/) and unicae_games, CC0.
- Fonts in `ui-styling` and `hyperframes`: SIL Open Font License, text beside each font.
- `session-story` includes code adapted from ClaudeAnimationBase by John Heibel, MIT (see its `assets/engine/NOTICE.md`).

## Changes made to the copies

- `ui-ux-pro-max/SKILL.md`: script paths rewritten to `<skill-dir>` so they work from any install location, with a note saying so.
- `huashu-nuwa`: only `SKILL.md`, `references/` and `scripts/` are copied; the example personas are not.
- Library folders keep only Markdown and JSON files.
- Coverage data and Python caches are left out. License files are added under the `UPSTREAM-` prefix.

Graut is not affiliated with or endorsed by any of these projects. If you are an author and want something changed or removed, open an issue.
