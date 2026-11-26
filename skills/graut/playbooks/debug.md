# Debugging playbook

For anything broken, in any language.

1. **Reproduce.** Get one command or set of steps that fails every time. No reproduction, no fix.
2. **Read.** The whole error and stack trace, from the first line that points into this project.
3. **Narrow.** What changed (`git log`, `git diff`)? Does it fail with smaller input, on an older commit, in a clean environment?
4. **Hypothesize.** One cause at a time, with a check that would prove it wrong. Print or inspect real values; do not guess them.
5. **Fix the cause** where every caller benefits, not the symptom where you noticed it.
6. **Prove.** The reproduction now passes, the other tests still pass, and a test covers this bug.

Common causes worth checking early: wrong environment or version, stale build or cache, path or working directory, async code not awaited, null or empty input, time zones, text encoding, race between two writers, configuration that differs between machines.

Stuck after two failed ideas: write down what you know for certain, question the first assumption, and ask for the one missing fact.
