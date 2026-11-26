# Brief hsdc-poc-T01b — AI facts research

**Goal.** Produce a notes file of verified facts about the AI SDK v7, the OpenRouter provider and
the OpenRouter Decisions API used by ADR 002 and ADR 004. Research only: no code, no installs.

**Editable files:** `docs/.agent-briefs/hsdc-poc-T01b-notes.md` (create). Nothing else.
**Forbidden:** `course-materials/`, the nested `jsystems-ai-programming-2026-11/` folder, any `.env`.
**Concurrent task:** T01a writes `docs/.agent-briefs/hsdc-poc-T01a-notes.md` (do not touch).

**Read first:** `docs/ADR/002-ai-pipeline.md` §2–§4, §6, §7 and `docs/ADR/004-confidence-gated-decisions.md`
§2, §3.3, §3.4, §7.3 (only these sections).

**Lookup order.** Context7 MCP (one concept per query) → official web pages last. IDs: AI SDK
`/websites/ai-sdk_dev`, cookbook `/websites/ai-sdk_dev_cookbook`, OpenRouter provider
`/openrouterteam/ai-sdk-provider`, OpenRouter `/websites/openrouter_ai`, Zod `/colinhacks/zod`.
Record `npm view ai version`, `npm view @ai-sdk/react version`, `npm view @openrouter/ai-sdk-provider version peerDependencies`.

**Questions (each with a source):**
1. `generateText` with `output: Output.object({ schema })`: exact import names, how to read the
   parsed result (`result.output`?), the error thrown on schema mismatch (class name, how to detect
   it: `NoObjectGeneratedError.isInstance`?), `timeout`/`abortSignal`/`maxRetries` options.
2. Multimodal message: image `file` part shape (`type`, `mediaType`, `data`) in v7.
3. `streamText` with `tools`, `tool({ description, inputSchema, execute })`, `stopWhen: isStepCount(n)`,
   `instructions` for the system prompt, `convertToModelMessages` (sync or async in v7?).
4. Producing the UI stream response for `useChat`: `toUIMessageStream` / `createUIMessageStreamResponse`
   / `result.toUIMessageStreamResponse` — exact v7 names and the `onFinish` and `messageMetadata`
   callbacks (what each receives). How a server streams an error part after a tool call.
5. `@ai-sdk/react` `useChat` v7: `DefaultChatTransport` with `prepareSendMessagesRequest` to send only
   `{ caseId, message }`; `status` values; `regenerate`; message `metadata`; tool part type naming
   (`tool-reviseDecision`?) and its states (`output-available` etc.).
6. `ai/test`: `MockLanguageModelV4` constructor options (`doGenerate`, `doStream`), the shape of a
   `doGenerate` result (content parts, finishReason, usage) and of stream chunks for `doStream`,
   `simulateReadableStream`, `mockValues`. How to replay a captured raw response.
7. OpenRouter provider: `createOpenRouter({ apiKey })`, `openrouter.chat(slug)` vs `openrouter(slug)`,
   `providerOptions.openrouter.reasoning` `{ effort }`, how `usage.cost` is exposed (provider
   metadata `openrouter.usage.cost`? needs `usage: { include: true }`?).
8. OpenRouter Decisions API (`POST /api/alpha/decisions`): full request and response JSON schema,
   headers, answer shapes for `noul`/`choice`/`score`/refusal, error responses, any cost/usage field.
   Prefer https://openrouter.ai/docs/guides/features/decisions and Context7 `/websites/openrouter_ai`.

**Report format.** The notes file: one section per question with code snippets as documented and the
source for each fact, flagged conflicts with the ADRs, "UNVERIFIED" where nothing confirmed it.
Final reply: a 10-line summary with key facts, ADR conflicts and unverified items.
