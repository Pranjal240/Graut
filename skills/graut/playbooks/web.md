# Web development playbook

For frontends, backends, APIs and databases. The design chain in `SKILL.md` covers how it looks; this covers whether it works.

## Before writing

1. Find the framework, package manager, test and run commands. Use the project's own.
2. Follow one request through the code end to end: route, validation, logic, data, response, UI state.

## Build checks

- **Input:** validate on the server, even when the form already does. Reject what you do not expect.
- **Auth:** every protected route checks who the user is and whether this record is theirs. Test with another user's id.
- **Secrets:** only on the server, from the environment. Nothing secret in client bundles, logs or git.
- **Injection:** parameterized queries, escaped output, no string-built shell commands or HTML from user text.
- **Data:** a migration has a way back. Index what you filter and join on. No query inside a loop.
- **Errors:** the user sees what happened and what to do; the log has the detail. No empty `catch`.
- **States:** loading, empty, error and success all exist. Buttons cannot be double submitted.
- **Network:** set timeouts. Retry only requests that are safe to repeat.
- **Cookies and CORS:** `HttpOnly`, `Secure`, `SameSite`; never allow every origin together with credentials.

## Done when

Run it and use the feature as a user would: the happy path, one bad input, one logged-out or wrong-user request. Check the browser console and the server log are clean. Tests and build pass.
