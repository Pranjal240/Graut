# Security scan

NVIDIA SkillSpector 2.13.7, static analysis only (`--no-llm`), run on 2026-11-27 against the pinned commits. A skill "fails" when its risk score is above 50. A static scanner matches patterns: it over-reports normal behaviour and can miss real problems. This is not an audit.

## Passed (22)

`graut` (score 42, caution: `sudo` in install hints, unpinned `npx` commands, and one line of the web playbook), `skill-inspector`, the six `ponytail` skills, `gravitas-highstakes`, `gravitas-python`, `gravitas-typescript`, `banner-design`, `design-system`, `slides`, `ui-styling`, `brag`, `brag-slim`, `hyperframes-registry`, `camera-3d-captions`, `prod-by-claude`, `x-posting-license`, `huashu-nuwa`.

`graut` was scanned with its panel and playbooks, without its `packs` and `library` folders: the packs are listed here one by one, and the library is search data from the catalogs. Each pack was scanned under its original file name, `SKILL.md`.

## Rated high risk (13)

| Skill | Score | Main findings |
|---|---|---|
| `day-in-my-life` | 100 | npm lock file pins versions with published advisories (zod, i18next); partly analyzed files |
| `design` | 100 | scripts send API keys from the environment to image providers; reads `.env` |
| `hyperframes` | 100 | mentions of credential files in docs; HTML comments flagged as hidden instructions; unpinned `npx hyperframes` |
| `impeccable` | 100 | wording such as "never judge"; touches agent config folders; partly analyzed files |
| `media-use` | 100 | many `.env` references; calls outside services; unpinned `npx hyperframes` |
| `session-story` | 100 | npm advisory (zod); wording such as "no warnings"; partly analyzed files |
| `ui-ux-pro-max` | 100 | phrases inside its CSV design data; partly analyzed files |
| `hyperframes-cli` | 99 | mentions `~/.aws/credentials` and `--no-confirm`; unpinned `npx hyperframes` |
| `brand` | 90 | partly analyzed files; a `return prompt` line read as prompt extraction |
| `gravitas` | 71 | no declared tool scope; unpinned `npx tsc` |
| `vox-explainer` | 60 | partly analyzed files; unpinned `npx` commands |
| `duo` | 55 | partly analyzed files; unpinned `npx hyperframes` |
| `p5-paint-animation` | 55 | npm advisory (zod, i18next) |

## What was checked by hand

- A search of the bundled files for common secret formats (API keys, private keys) found none.
- A search for `curl | sh` style installs found only a line advising against them.
- `design/scripts/logo/generate.py`: each provider key has its own base URL. Besides Google, it supports the third-party gateways atlascloud.ai, muapi.ai and uberllm.dev, used when you choose them and set their key.
- One of the three "hidden instructions" files in `hyperframes` was opened: an ordinary template comment.

The remaining findings were **not** reviewed one by one.

## Do the skills run?

Checked on Windows on 2026-11-27, without FFmpeg and without API keys:

- All 242 Python, JavaScript and shell scripts parse.
- Key tools run: design system, logo, identity and slide search, token generator and validator, brand context, and the `gravitas` and HyperFrames launchers.
- Unit tests of the design skills: 340 pass, 3 skip. Five `ui-ux-pro-max` test files need the author's full repository and do not load.
- Node tests of `hyperframes`, `media-use` and `brag`: 291 pass, 118 skip, 57 fail. 55 fail the same way in the authors' own folder layout (some report missing FFmpeg). The other 2 are style rules that also look at neighbouring non-HyperFrames skills.

Not run: the `impeccable` engine and the HyperFrames command line (both are downloaded at first use), and anything that needs a paid service.

## Do it yourself

```bash
npx graut-bhar-de --scan     # scan, report, install
npx graut-bhar-de --strict   # install only what passes
```
