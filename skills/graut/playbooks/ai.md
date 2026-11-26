# AI development playbook

For apps built on language models: chatbots, RAG, agents, tool calling, prompts.

## Before writing

1. Write 5 to 20 real examples with the answer you expect. They are the test set; build them first.
2. Check current model names, parameters and prices in the provider's docs or SDK. Do not trust memory.
3. Ask what code can do without a model. Parsing, math, lookups and rules belong in code.

## Build checks

- **Prompts:** say the role, the goal, the output shape and what to do when unsure. Show one example of anything fussy.
- **Output:** request structured output and validate it. Handle a refusal, a cut-off reply and invalid JSON.
- **Cost and speed:** log tokens per request, cap output, cache the fixed prefix, use the smallest model that passes the examples.
- **Failure:** timeouts, rate limits with backoff, and a clear message when the model is unavailable.
- **RAG:** test retrieval alone first (is the right passage in the top results?). Keep source ids and cite them. Say "not found" instead of guessing.
- **Agents:** few, well-described tools; a step limit and a spend limit; a person approves anything destructive or public.
- **Safety:** treat user text, documents, web pages and tool results as data, never as instructions. A model's output never gets more permission than its input deserves. Keys stay on the server.

## Done when

The examples run from one command and you report the pass count, cost and latency, before and after your change. Include at least one hostile input (an instruction hidden in a document) and one empty or off-topic input.
