# Credits and licenses

Graut (the master skill, playbooks, panel, installer and meme lines) is by Pranjal ([Pranjal240](https://github.com/Pranjal240)). The specialist work is other people's open source projects, copied here from the commits pinned in [sources.json](skills/graut/sources.json). Their copyright stays theirs, and each folder carries the author's license (`UPSTREAM-LICENSE`, plus `UPSTREAM-NOTICE*` where one exists).

| Project | Author | License | Folders in `skills/graut/packs/` |
|---|---|---|---|
| [ponytail](https://github.com/DietrichGebert/ponytail) | DietrichGebert | MIT | `ponytail`, `ponytail-*`; the code map, panel numbers and metrics drawing are adapted from its plugin |
| [Gravitas](https://github.com/udaysharmadev/Gravitas) | udaysharmadev | MIT | `gravitas`, `gravitas-*` |
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | nextlevelbuilder | MIT | `ui-ux-pro-max`, `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling` |
| [impeccable](https://github.com/pbakaus/impeccable) | pbakaus | Apache-2.0 | `impeccable` |
| [brag](https://github.com/latent-spaces/brag) | latent-spaces | MIT | `brag`, `brag-slim` |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | HeyGen | Apache-2.0 | `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use` |
| [HyperFrames community skills](https://github.com/heygen-com/hyperframes-community-skills) | HeyGen and contributors | Apache-2.0 | `camera-3d-captions`, `day-in-my-life`, `duo`, `p5-paint-animation`, `prod-by-claude`, `session-story`, `vox-explainer`, `x-posting-license` |
| [nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | alchaincyf | MIT | `huashu-nuwa` |
| [SkillSpector](https://github.com/NVIDIA/SkillSpector) | NVIDIA | Apache-2.0 | `skill-inspector` |
| [agent-skills](https://github.com/vercel-labs/agent-skills) | Vercel | MIT (stated in its README; the folder carries the license of Vercel's [web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines), whose rules it bundles) | `web-design-guidelines` |
| [skill-from-masters](https://github.com/GBSOSS/skill-from-masters) | GBSOSS | MIT | `search-skill` |
| [agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | sickn33 and contributors | Code MIT, written content CC BY 4.0 (`UPSTREAM-LICENSE-CONTENT`) | `../library/agentic-awesome-skills` (search index) |
| [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | VoltAgent | MIT | `../library/awesome-agent-skills` |
| [claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) | shanraisshan | MIT | `../library/claude-code-best-practice` |

## Media and fonts

- `assets/graut-logo.jpg` and `assets/icon.jpg`: a frame from a widely shared internet meme. It shows a real person, and the rights belong to them and to whoever recorded it. It is not covered by this repository's license and will be removed on request.
- `assets/example-website.jpg`: a screenshot of a page Graut built.

- Music in `brag`: "Happy Beats / Business Moves" Vol. 1, 9, 10, 11, 12 by Sascha Ende, [ende.app](https://ende.app/en), [CC BY 4.0](https://ende.app/en/standard-license). Credit it in videos that use it: "Music: Sascha Ende, ende.app (CC BY 4.0)".
- Sound effects in `brag`: [Kenney](https://kenney.nl/) and unicae_games, CC0.
- Fonts in `ui-styling` and `hyperframes`: SIL Open Font License, text beside each font.
- `session-story` includes code adapted from ClaudeAnimationBase by John Heibel, MIT (see its `assets/engine/NOTICE.md`).

## Changes made to the copies

- Every `SKILL.md` is renamed `PACK.md`, so agents list Graut as one skill, and links to it are updated.
- `ui-ux-pro-max/PACK.md`: script paths rewritten to `<skill-dir>` so they work from any install location, with a note saying so.
- `gravitas/scripts/doctor.py`: looks for `PACK.md`.
- Three links to files outside a skill (in `gravitas` and `huashu-nuwa`) point to the author's repository instead.
- `huashu-nuwa`: only its skill file, `references/` and `scripts/` are copied; the example personas are not.
- Library folders keep only Markdown and JSON files.
- Coverage data, Python caches and `.gitignore` files are left out. License files are added under the `UPSTREAM-` prefix.

Graut is not affiliated with or endorsed by any of these projects. If you are an author and want something changed or removed, open an issue.
