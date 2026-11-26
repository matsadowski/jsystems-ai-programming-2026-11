# HSDC PoC T01b: verified facts for ADR 002 and ADR 004

Research date: 2026-11-26. Research only. No code or installs.

Source keys used below:
- **C7:ai-sdk** = Context7 `/websites/ai-sdk_dev` (topic in brackets)
- **C7:or-provider** = Context7 `/openrouterteam/ai-sdk-provider` (the provider's `_autodocs` and README)
- **C7:openrouter** = Context7 `/websites/openrouter_ai`
- **WF:decisions** = WebFetch https://openrouter.ai/docs/guides/features/decisions (2026-11-26)
- **WF:luna** = WebFetch https://openrouter.ai/openai/gpt-6-luna-decisions (2026-11-26)
- **NPM** = `npm view` run on 2026-11-26

## Package versions (NPM)

- `ai` latest: **7.0.183**. Peer deps: `zod ^3.25.76 || ^4.1.8`.
- `@ai-sdk/react` latest: **4.0.188**. Peer deps: `react ^18 || ~19.0.1 || ~19.1.2 || ^19.2.1`.
  The peer deps do not list `ai`. Check the version pairing at scaffold time.
- `@openrouter/ai-sdk-provider` latest: **3.1.0**. Peer deps: `ai ^7.0.0`, `zod ^3.25.76 || ^4.1.8`.
  The brief's package name is the npm name. The Context7 ID is `/openrouterteam/ai-sdk-provider`.

---

## Q1. `generateText` with `output: Output.object({ schema })`

**Imports (C7:ai-sdk, [generating-structured-data]):**
```ts
import { generateText, Output, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai';
import { z } from 'zod';
```

**Call and result:**
```ts
const result = await generateText({
  model,
  output: Output.object({ schema: z.object({ /* ... */ }) }),
  prompt,
});
console.log(result.output); // parsed, typed object
```
- The result field is `result.output`. It is a **getter**, so destructuring it also triggers the access (C7:ai-sdk, [generating-structured-data]).
- `result.reasoningText` exists for reasoning models (C7:ai-sdk, [generateText]).

**Errors:**
- Schema mismatch or unparseable response: `generateText` **rejects** with `AI_NoObjectGeneratedError` (class `NoObjectGeneratedError`).
  Detect with `NoObjectGeneratedError.isInstance(error)`. It keeps `text`, `response`, `usage`, `cause`, and `finishReason` on refusal (C7:ai-sdk, [generating-structured-data]; OpenAI provider page on refusals).
- A result with no output (last step did not finish with `stop`, e.g. `tool-calls`): accessing `result.output` throws `AI_NoOutputGeneratedError` (class `NoOutputGeneratedError`, `.isInstance`) (C7:ai-sdk, [generating-structured-data]).
- Refusal with structured output: `NoObjectGeneratedError`, `error.text` = refusal text, `error.finishReason === 'content-filter'` (C7:ai-sdk, OpenAI provider page). Provider-specific; not confirmed for OpenRouter.

**Options (C7:ai-sdk, [settings]):**
- `timeout`: `number` (ms) or object `{ totalMs, stepMs, firstChunkMs, chunkMs, toolMs, tools }`. `chunkMs` and `firstChunkMs` are for `streamText` only.
- `abortSignal`: `AbortSignal`, e.g. `AbortSignal.timeout(5000)`. `timeout` and `abortSignal` can be used together; the call aborts when either fires.
- `maxRetries`: default **2**; `0` disables retries.

**ADR notes:** ADR 002 §2 says `generateObject` is deprecated. Not verified in this research. **UNVERIFIED.** ADR 002 §3.3 uses an `AbortSignal.timeout` 20 s / 35 s budget and `maxRetries: 1` / `0`. These are valid option forms. Consistent.

---

## Q2. Multimodal image `file` part

**C7:ai-sdk, [foundations/prompts]:**
```ts
const result = await generateText({
  model,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Describe the image in detail.' },
      { type: 'file', mediaType: 'image', data: fs.readFileSync('./data/comic-cat.png') },
    ],
  }],
});
```
- Part shape: `{ type: 'file', mediaType, data }`. `data` is a `Buffer` (binary) or a base64 `string`.
- The docs examples use `mediaType: 'image'` (no subtype). ADR 002 §3.3 says `image/jpeg`.

**Conflict / UNVERIFIED:** The docs show `mediaType: 'image'`. ADR 002 §3.3 says `image/jpeg`. Both appear in docs (`image/jpeg` is the more specific MIME type and is what ADR 002 uses). Use the exact MIME (`image/jpeg`). Confirm the generic `'image'` is accepted in v7 at scaffold time. **UNVERIFIED** whether `image/jpeg` is accepted by the v7 file part; no explicit v7 example found in Context7.

---

## Q3. `streamText` with tools, `isStepCount`, `instructions`, `convertToModelMessages`

**C7:ai-sdk, [multi-step / cookbook]:**
```ts
import { streamText, tool, isStepCount, convertToModelMessages } from 'ai';
import { z } from 'zod';

const result = streamText({
  model,
  instructions: 'You are a helpful assistant.',   // system prompt
  messages: await convertToModelMessages(messages),
  stopWhen: isStepCount(5),
  tools: {
    getWeather: tool({
      description: '...',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ /* ... */ }),
    }),
  },
});
```
- `tool({ description, inputSchema, execute })`: confirmed. (`inputSchema`, not `parameters`.)
- `stopWhen: isStepCount(n)`: confirmed. The default is `isStepCount(1)`, which stops after the first step when there are tool results. ADR 002 §3.3 uses `isStepCount(3)`. Consistent.
- `instructions`: confirmed as the system-prompt option for `streamText` (cookbook examples). Note: `system` is not shown in these docs.
- `convertToModelMessages`: **async**. Docs show `await convertToModelMessages(messages)`. AI SDK 6 migration guide: "`convertToModelMessages()` is async in AI SDK 6" (C7:ai-sdk, [migration-guide-6-0]). v7 docs use `await`. Use `await`.

---

## Q4. UI message stream response for `useChat`

**Names confirmed (C7:ai-sdk, [streamText reference], [cookbooks]):**
```ts
return createUIMessageStreamResponse({
  stream: toUIMessageStream({
    stream: result.stream,
    originalMessages: messages,      // optional, for typed metadata
    messageMetadata: ({ part }) => { /* ... */ },
    onFinish: ({ messages }) => { /* persist */ },   // see conflict below
    onError: (error) => 'An error occurred.',        // returns string sent to client
    // consumeSseStream?, sendReasoning?, sendSources?, sendFinish?, sendStart?
  }),
});
```
- `toUIMessageStream({ stream })`, `createUIMessageStreamResponse({ stream })`: confirmed.
- `pipeUIMessageStreamToResponse({ response, stream })`: confirmed for Node/Express (C7:ai-sdk, [Angular guide]).
- `result.toUIMessageStreamResponse()`: **UNVERIFIED**. Not in the Context7 results. ADR 002 §2 names `toUIMessageStream` and `createUIMessageStreamResponse`, which is consistent with the docs.

**`onFinish` vs `onEnd` (CONFLICT, minor):**
- The `streamText` reference lists `onEnd` and says `onFinish` is a "deprecated alias for `onEnd`". Both receive `{ messages: UIMessage[], isContinuation, responseMessage, isAborted, isCancelled?, outcome, finishReason? }` (C7:ai-sdk, [streamText reference]).
- The cookbook still uses `onFinish: ({ messages }) => saveMessages(...)` inside `toUIMessageStream` (C7:ai-sdk, [chat message persistence]).
- Recommendation: use `onEnd` in new v7 code. Cover both names in tests if the scaffold keeps `onFinish`.
- `messages` = full updated UI message list (persistence). Matches ADR 002 §2.

**`messageMetadata` (C7:ai-sdk, [message-metadata], [streamText reference]):**
- Signature: `messageMetadata: ({ part }) => unknown`.
- Called on part types `start`, `finish`, `start-step`, `finish-step`. Return a value to attach it.
- `finish` part has `part.totalUsage.totalTokens`, `part.response.modelId`. `finish-step` has `part.usage`.
- The return value becomes `message.metadata` on the client.

**Error part after a tool call (C7:ai-sdk, [streamText reference]):**
- `onError?: (error: unknown) => string` handles stream errors and failed tool calls. Its return value is the error text put in the data stream. Default text is `"An error occurred."`.
- `redactToolErrors` (default `true` when `onError` is given) replaces tool error text with the `onError` result.
- Tool execution errors with `providerExecuted: true` skip `onError`.
- ADR 002 §7.4 expects that a committed tool-call change stays committed after a later stream error. The docs above do not cover DB commit semantics. That is an app concern. Consistent with ADR.

---

## Q5. `@ai-sdk/react` `useChat` v7

**Transport and body (C7:ai-sdk, [chatbot], [send-custom-body cookbook]):**
```tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status, regenerate } = useChat({
  id: caseId,
  transport: new DefaultChatTransport({
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: { caseId: id, message: messages[messages.length - 1] },
    }),
  }),
});
```
- `prepareSendMessagesRequest({ id, messages })` returns `{ body }`. Sending `{ caseId, message }` is supported. The `id` of the chat is the field passed in. Set `id: caseId` on `useChat` so `id` is the case ID.
- Note: the doc example sends `{ id, message }`. Rename to `caseId` in the body, as ADR 002 §2 wants.

**`status` values (C7:ai-sdk, [chatbot], [useChat reference]):** `'submitted' | 'streaming' | 'ready' | 'error'`. Confirmed.

**`regenerate` (C7:ai-sdk, [chatbot]):** `regenerate({ messageId?, headers?, body?, metadata? })`. With no `messageId`, it regenerates the last assistant message. Disable it unless `status` is `'ready'` or `'error'`.

**Message metadata (C7:ai-sdk, [chatbot]):** `message.metadata` (typed by the `UIMessage` generic). Confirmed.

**Tool part type naming (C7:ai-sdk, [chatbot-tool-usage]):** Tool parts are typed `tool-<toolName>`. Example: `tool-getLocation`, `tool-askForConfirmation`. So the part for `reviseDecision` is `tool-reviseDecision`. Matches ADR 002 §4.5 guess. Confirmed.

**Tool part states (C7:ai-sdk, [chatbot-tool-usage], [subagents]):**
- `input-streaming`, `input-available`, `approval-requested`, `approval-responded`, `output-available`, `output-error`, `output-denied`.
- Access output with `part.output`, error with `part.errorText`.

**`addToolOutput` (C7:ai-sdk, [useChat reference]):** `addToolOutput({ tool, toolCallId, output })`. `addToolResult` is deprecated.

---

## Q6. `ai/test` mocks

**Exports (C7:ai-sdk, [testing]):** `MockLanguageModelV4`, `MockEmbeddingModelV4`, `mockId`, `mockValues`. `simulateReadableStream` is imported from `ai` (not `ai/test`) (C7:ai-sdk, [simulate-readable-stream]). ADR 002 §6.2 matches this.

**`MockLanguageModelV4` constructor (C7:ai-sdk, [testing]):**
- `doGenerate`: a function returning a result, **or an array** of results (one per call; the mock tracks `model.doGenerateCalls`) (ToolLoopAgent example).
- `doStream`: an async function returning `{ stream }`, where `stream = simulateReadableStream({ chunks, initialDelayInMs?, chunkDelayInMs? })`.

**`doGenerate` result shape (C7:ai-sdk, [testing]):**
```ts
{
  content: [{ type: 'text', text: 'Hello, world!' }],        // or { type: 'tool-call', toolCallId, toolName, input: '<json string>' }
  finishReason: { unified: 'stop', raw: undefined },          // or 'tool-calls'
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 20, text: 20, reasoning: undefined },
  },
  warnings: [],
}
```

**`doStream` chunk shape (C7:ai-sdk, [testing]):**
- `{ type: 'text-start', id }`, `{ type: 'text-delta', id, delta }`, `{ type: 'text-end', id }`
- `{ type: 'finish', finishReason: { unified, raw }, logprobs: undefined, usage: { inputTokens: {...}, outputTokens: {...} } }`

**`mockValues` (C7:ai-sdk, [testing]):** "Iterates over an array of values with each call. Returns the last value when the array is exhausted." Use it for multi-call sequences (corrective retry, ADR 002 §6.2).

**Replay of a captured raw response:** The docs show hand-written mock results only. There is no documented helper that takes a raw captured provider response and turns it into `doGenerate` or `doStream` output. **UNVERIFIED.** The mapping has to be written by hand from the captured fields. ADR 002 §6.1/§6.2 assumes a replay is possible.

---

## Q7. OpenRouter provider

**Construction (C7:or-provider, [create-openrouter], [chat-language-model]):**
```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const model = openrouter.chat('anthropic/claude-3.7-sonnet:thinking');  // named factory
// callable form, also valid:
const model2 = openrouter('openai/gpt-4o');
```
- `createOpenRouter({ apiKey })`: confirmed. Default reads `OPENROUTER_API_KEY` from env. Other options: `baseURL`, `decisionsBaseURL`, `appName`, `appUrl`, `api_keys`.
- `openrouter.chat(modelId, settings?)` is a `strict` compatibility chat model. `openrouter(modelId)` is the same provider called directly. Both are valid. Use `.chat()` to be explicit (ADR 002 §2 uses `openrouter.chat(slug)`).

**Reasoning per call (C7:or-provider, [types], [configuration]):**
```ts
providerOptions: {
  openrouter: {
    reasoning: { effort: 'medium', exclude: true },   // or { max_tokens: N }
  },
}
```
- `effort`: `'max' | 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none'`. One of `effort` or `max_tokens` is required.
- `exclude`: default `false`. `true` removes reasoning from the response.
- `reasoning_effort` (a separate key) suppresses call-level reasoning resolution.
- Call-level `reasoning` replaces the model-level effort but keeps `enabled` and `exclude`.
- Matches ADR 002 §2 and §3.3 (`effort` `medium` for decisions, `low` for chat, `exclude: true`).

**Cost (C7:or-provider, [README usage accounting], [types], [completion/index.ts]):**
- Enable usage accounting on the model: `openrouter('openai/gpt-3.5-turbo', { usage: { include: true } })`. The README calls this "Enable usage accounting".
- Read cost: `result.providerMetadata?.openrouter?.usage?.cost`.
- `providerMetadata.openrouter.usage` also has `promptTokens`, `completionTokens`, `totalTokens`, `promptTokensDetails.cachedTokens`, `completionTokensDetails.reasoningTokens`, `costDetails.upstreamInferenceCost`, `isByok`.
- `cost` is only set when the API response includes it. The `usage.include: true` requirement is stated in the README. Source code sets cost only if present (`response.usage?.cost != null`).
- **ADR gap:** ADR 002 §6.3 relies on `usage.cost` for the eval budget. It does not say the model needs `usage: { include: true }`. Add it. The image model returns no cost (completion/index.ts note covers chat/completion only).

---

## Q8. OpenRouter Decisions API (`POST /api/alpha/decisions`)

**Endpoint and headers (WF:decisions, C7:openrouter):**
- `POST https://openrouter.ai/api/alpha/decisions`
- Headers used in every example: `Authorization: Bearer <OPENROUTER_API_KEY>`, `Content-Type: application/json`. The page's text does not list required headers separately.

**Request (WF:decisions; C7:openrouter [submit a decisions request]):**
```json
{
  "model": "typesafe/jev-1.14",
  "state": "<text, or array of text and media parts>",
  "questions": {
    "<key>": { "type": "noul", "instructions": "...", "criteria": { "true": "...", "false": "..." } },
    "<key>": { "type": "choice", "instructions": "...", "criteria": { "<option>": "<definition>" } },
    "<key>": { "type": "score", "instructions": "...", "criteria": ["lowest", "...", "highest"] },
    "<key>": { "type": "box", "instructions": "..." }
  },
  "assets": { "<key>": { /* base64 image, PNG/JPEG */ } },
  "provider": { "order": [], "only": [], "ignore": [], "options": {} },
  "session_id": "...",
  "user": "..."
}
```
- Required: `model`, `state`, `questions`. Optional: `assets`, `provider`, `session_id`, `user` (WF:decisions).
- `state` shape is **inconsistent across OpenRouter pages**: the guide says "string or array" (text parts and `image_url`, `input_audio`, `video_url`). The API reference says `state` is an object. See conflicts.
- Limits: nesting max 64 levels in `state`, each `instructions`, and each `criteria` value. Question keys: `A-Z a-z 0-9 _ -`, 1–64 chars for Gemini-backed models (WF:decisions, C7:openrouter). Max images per request: GPT-6 Luna = 128 (ADR 004 §2, not confirmed on the current model page; see below).
- Question types confirmed: `noul`, `choice`, `score`, `box`. `box` needs an image in `state` or `assets`, for `typesafe/jev-1.14` and `~typesafe/jev-latest` (WF:decisions).
- The provider package names the boolean question `boolean` in its `evaluate()` example (C7:or-provider [decisionModel]). This differs from the API's `noul`. Use `noul` for the raw API.

**Answer shapes (WF:decisions; C7:openrouter):**
- `noul`: `{ "type": "noul", "noul": <0–1>, "confidence": <float> }`
- `choice`: `{ "type": "choice", "choice": "<key>", "probabilities": { "<key>": <float> }, "confidence": <float> }` (probabilities sum to 1)
- `score`: `{ "type": "score", "score": <0..N-1 float>, "probabilities": { "0": …, "1": … }, "confidence": <float> }`. The API reference also adds `legend` (index to criteria text).
- `box`: `{ "type": "box", "box": { "top", "bottom", "left", "right" }, "confidence": <float> }`. Values are fractions of image size from top-left.
- Refusal: `{ "type": "refusal" }`, no numeric fields. Other questions in the same request still resolve (WF:decisions).
- Missing key in `answers`: docs say treat as "not answered". The docs do not say when it happens.
- Fail-closed rule (WF:decisions): check `type` before reading values. Refusal, missing key or unexpected type = route to a human. Not a safe verdict.

**Response (C7:openrouter [submit a decisions request]; WF:decisions):**
```json
{
  "id": "gen-dec-…",
  "model": "typesafe/jev-1.13-20260917",
  "provider": "TypeSafe",
  "answers": { "<key>": { /* answer shape above */ } },
  "usage": { "cost": 0.000019992, "input_tokens": 476, "output_tokens": 70, "input_tokens_details": { "cached_tokens": 0 } }
}
```
- `usage.cost`: documented as the exact credits charged ("always reports"), WF:decisions. So cost is available for Decisions requests without any extra flag.
- `is_byok` and `cost_details` appear only in a sample, not in the schema text (WF:decisions).

**Errors (C7:openrouter [submit a decisions request] API reference):**
Body shape: `{ "error": { "code": <int>, "message": "<text>" } }`.
| HTTP | message (sample) |
|---|---|
| 400 | Invalid request parameters |
| 401 | Missing Authentication header |
| 402 | Insufficient credits |
| 403 | Only management keys can perform this operation |
| 404 | Resource not found |
| 413 | Request payload too large |
| 429 | Rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Provider returned error |
| 503 | Service temporarily unavailable |
| 524 | Request timed out |
| 529 | Provider returned error |

- The guide (WF:decisions) says "Errors: Not stated". The error table comes from the API reference page only. Treat the error table as **single-source**.
- The API reference says a request an endpoint cannot serve (unsupported question type, media part or asset reference) fails with 400 before anything is sent upstream.

---

## ADR conflicts and gaps

1. **ADR 004 §7.3 rejects the AI SDK for Luna. The provider already has a Decisions path.** `@openrouter/ai-sdk-provider` 3.1.0 exposes `openrouter.decisionModel(modelId)` and `experimental_evaluate` from `ai` (C7:or-provider [decisionModel]). It also needs `decisionsBaseURL` when `baseURL` does not end in `/v1`. The ADR's rationale ("not OpenAI-chat compatible", "custom AI SDK provider: too much work") does not mention this. Review before finalizing §7.3. The provider marks the Decisions API as alpha.
2. **ADR 004 §2 says Luna has "p50 latency 0.22 s (OpenAI provider)" and "chat SDKs... do not work".** WF:luna did not find a latency figure or any SDK statement on the model page. The Decisions guide does not say it either. **UNVERIFIED.** §7.3 also cites the model page for the SDK statement; it is not on the page I fetched.
3. **ADR 004 §2 says the model page states "alpha".** WF:luna found no alpha or may-change wording. The alpha label comes from the endpoint path and the provider docs ("in alpha; request/response shapes may change"). Reword the ADR to cite the provider doc.
4. **ADR 004 §2 "max 128 images per request".** Not found in WF:luna or the Decisions guide. **UNVERIFIED.**
5. **ADR 004 §2 request shape `{ model, state, questions, session_id?, user? }`** is missing `assets` and `provider`. The `state` type also differs (see 6).
6. **`state` type conflict.** The Decisions guide (WF:decisions) says `state` is a string or array of text and media parts, and that media uses `image_url` with data URLs. The API reference (C7:openrouter) says `state` is an **object**, with `assets` as a separate PNG/JPEG reference. Check against a real capture before writing the request type. ADR 004 §2 says remote URLs are not fetched; this is not in the fetched pages. **UNVERIFIED** for remote URLs.
7. **ADR 002 §3.3 `mediaType: image/jpeg` vs docs `mediaType: 'image'`.** See Q2. **UNVERIFIED** which value the v7 file part needs.
8. **ADR 002 §6.3 `usage.cost`** is confirmed for chat through `providerMetadata.openrouter.usage.cost` (only with `usage: { include: true }` per the README) and for Decisions through `usage.cost` (always). Add the `include` flag to the chat model settings.
9. **`onFinish` vs `onEnd`.** See Q4. Use `onEnd`; `onFinish` is a deprecated alias in the v7 reference.
10. **`@ai-sdk/react` 4.0.188 vs `ai` 7.0.183.** The peer deps of `@ai-sdk/react` do not list `ai`. Confirm the pairing at scaffold time.
11. **Errors on the Decisions API** are not in the official guide. The error table is only from the API reference. ADR 004 §7.3 says retries are off because of the 5 s budget. That is consistent. Add error handling to `luna-client.ts` for 402, 429 and 5xx (fail closed to `escalate` in `gated`).

---

## UNVERIFIED items (summary)

- `result.toUIMessageStreamResponse()` method name in v7.
- `mediaType` exact value for JPEG in v7 file parts (`image/jpeg` vs `image`).
- Whether `generateObject` is deprecated in v7 (ADR 002 §2).
- Replay of a captured raw provider response into `MockLanguageModelV4` (no documented helper).
- Luna p50 latency 0.22 s; "chat SDKs do not work" claim; max 128 images per request.
- Remote URLs not fetched by Luna (ADR 004 §2).
- `state` exact type for the alpha Decisions API (guide vs API reference conflict).
- Decisions API error table: API reference only; the guide does not document errors.
- Whether the Decisions API has an `alpha` label on the model page (not found).
