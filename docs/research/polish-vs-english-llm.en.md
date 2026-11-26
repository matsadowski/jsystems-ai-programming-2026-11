# Is Polish really the "best language" for LLMs? Source check and 2024–2026 evidence

Research date: 2026-11-24 · Method: 6 research agents + 5 verification agents (Claude Haiku), coordinated and reviewed by Claude Opus · Polish version: [polish-vs-english-llm.pl.md](polish-vs-english-llm.pl.md)

## TL;DR

1. **The original source is real, but narrow.** The article on cryps.pl (25 Oct 2025) is based on **OneRuler** (Kim, Russell, Karpińska, Iyyer; arXiv 2503.01996; COLM 2025). Polish scored **88%** and English **83.9%** (6th of 26). That is an average over *needle-in-a-haystack* retrieval tasks at 64K and 128K tokens, across 6–7 models from early 2025.
2. **It measured long-context retrieval, not prompting or reasoning.** The paper has no significance test, it uses a different book as the haystack for each language, and the authors call the Polish result "unexpected" without explaining it. Co-author Marzena Karpińska and Microsoft both said publicly that it is not evidence that Polish is the best language for prompting (reported by Polish media, so a secondary source).
3. **No 2026 replication was found.** None of the other multilingual long-context benchmarks opened in this review includes Polish. Two caveats on the search: OneRuler's citation list could not be retrieved, and HELMET and BABILong were not checked. Russian-only benchmarks (LIBRA, CODi 2025) exist.
4. **On identical (translated or matched) items, Polish is usually slightly below English, and the gap shrinks as models grow.** In matched Polish medical exams (Grzybowski et al., EMNLP Findings 2025), 3–8B models lose 4.7–18.1 pp in Polish. Llama-3.1-70B loses 1.4–1.7 pp. GPT-4o is about 1.3 pp *better* in Polish. Bielik (a Polish model) is better in Polish.
5. **Retrieval: classic lexical search is clearly worse in Polish.** BM25 on BEIR-PL, a translation of the English BEIR, averages 35.67 vs 42.41 nDCG@10 in English (−15.9%). Polish morphology is the stated cause. No dense retriever has been measured in both languages on the same items.
6. **Language does affect reasoning.** Forcing English reasoning traces usually helps: PolyMath, QwQ-32B 47.9 with English reasoning vs 43.4 in the query language. Agents lose accuracy outside English: GAIA in MAPS, 47.4% in English vs a 35.8% mean for 11 other languages. The effect is largest for small models and low-resource languages. Polish counts as high-resource.
7. **Polish costs more tokens.** Polish needs about **1.83× as many tokens per word** as English (2.25 vs 1.23 tokens/word, Tokenizer Tax 2026). That means fewer words fit in a context window and API calls cost more.

**Bottom line:** "Polish beats English" holds for one task type (finding facts in very long contexts), in one 2025 study, with no statistical test. The broader evidence does not support "Polish is better for AI". With frontier models Polish is close to English (roughly 98–100% of English performance). With small and open models English still has a clear edge.

---

## 1. Tracing the source

| Item | Finding | Status |
|---|---|---|
| Article | cryps.pl, Maciej Halikowski, 25 Oct 2025. Its numbers match the paper (88%, ~84%, Chinese 62.1%) | Verified |
| Paper | *One ruler to measure them all: Benchmarking multilingual long-context language models*. Y. Kim, J. Russell, M. Karpińska, M. Iyyer. arXiv [2503.01996](https://arxiv.org/abs/2503.01996) (v1 3 Mar 2025, v3 30 Sep 2025), COLM 2025. Code: [github.com/mungg/OneRuler](https://github.com/mungg/OneRuler) | Verified (primary) |
| Design | 26 languages; 7 tasks (5 NIAH variants plus 2 common-word-extraction tasks); contexts of 8K, 32K, 64K and 128K tokens; models: Gemini 1.5 Flash, o3-mini-high, Llama 3.3 70B, Llama 3.1 8B, Qwen 2.5 72B, Qwen 2.5 7B, DeepSeek-R1 (English only) | Verified |
| Headline | Polish 88% (rank 1), English 83.9% (rank 6), Chinese 62.1% (4th from bottom). NIAH average across models at 64K+128K (Sec. 3.1) | Verified by 3 agents independently |
| Single model | o3-mini-high at 128K: Polish 92%, Ukrainian 89%, English 67% | Verified |
| Resource gap | The gap between the top-5 and bottom-5 languages (ranked by Wikipedia size) grows from 11 pp at 8K to 34 pp at 128K | Verified (text) |
| Instruction language | The abstract says accuracy can shift by up to 20%. Example: English context at 64K goes from 91% to 71% when the instructions are in Korean | Verified (example values); the "20%" appears in the abstract |
| Significance | No statistical test, confidence interval or variance for Polish vs English. The gap is 4.1 pp | Verified (absence) |
| Explanation | The authors call the result unexpected and say it is unclear why. They list hypotheses (pretraining data, script, language family, tokenizer) but make no causal claim | Verified |
| Confound | One different book per language serves as the haystack. Polish uses *Noce i dnie*, English uses *Little Women*. The authors note that the books' age and style may have influenced results | Verified (Table 4, App. A) |
| Other languages | The remaining 23 per-language values appear only in figures. The repo has no result files. Media figures (French 87, Italian 86, Spanish 85, Russian 84) are **not** in the paper text | Not verifiable |

### How the media changed the claim

| Media claim | What the paper says |
|---|---|
| "Polish is the best language for prompting AI" (Euronews headline, Polskie Radio and others) | No prompting experiment. Only long-context retrieval and aggregation |
| "Polish works well despite fewer training resources" / "grammar reduces ambiguity" (cryps.pl) | Not in the paper. The authors offer only hypotheses |
| Model list "Gemini, Llama, Qwen" | Omits o3-mini-high and DeepSeek-R1 |
| "Russian second", French 87 / Italian 86 … | Not found in the primary text |

Secondary sources, quoted by PAP / Nauka w Polsce: Karpińska said the study "certainly" does not show Polish is the best language for prompting, and Microsoft (12 Nov 2025) said the study was not meant to compare languages for prompting.

---

## 2. Long-context retrieval after OneRuler

- **MLNeedle** ([2408.10151](https://arxiv.org/abs/2408.10151); NAACL 2025 per search) uses English, German, Spanish, Chinese, Vietnamese, Hindi and Arabic, with no Slavic languages. Accuracy is highest when the needle is in English for every haystack language. For Llama3-8B, the English-needle column is 0.61–0.70 and the Chinese-needle column is 0.15–0.22.
- **MLRBench** ([2504.12845](https://arxiv.org/abs/2504.12845), EACL 2026) has no Slavic languages. Models use less than 30% of their claimed context in multilingual settings.
- **LIBRA** ([2408.02439](https://arxiv.org/abs/2408.02439)) is Russian-only. GPT-4o scores 70.2 overall, 73.3 at 4K and 54.8 at 128K.
- **No 2026 replication** of "Polish > English" with GPT-5.x, Claude, Gemini 3 or similar models was found. The OneRuler citation list could not be retrieved (Semantic Scholar returned 429/403).

**Our hypothesis, not tested in any paper:** OneRuler measures context length in *tokens*. Polish needs about 1.8× more tokens per word, so a 128K-token Polish haystack holds far fewer words than an English one. Whether this helps retrieval is untested. The authors themselves say tokenizer differences make a fair comparison difficult.

---

## 3. Retrieval and RAG

| Evidence | Polish/Slavic vs English | Comparable? |
|---|---|---|
| **BEIR-PL** (Wojtasik et al., [2305.19840](https://arxiv.org/abs/2305.19840), LREC-COLING 2024): BM25, 11 datasets | PL 35.67 vs EN 42.41 avg nDCG@10 (**−15.9%**). Largest drop on NQ (−38%). Cause given: Polish inflection weakens lexical matching | Yes (machine-translated BEIR) |
| **PIRB** (41 tasks) / **PL-MTEB** (11 retrieval tasks) | Polish only. Best results: PIRB mE5-large 57.29, PL-MTEB stella-pl-retrieval-8k 61.59, Qwen3-Embedding-8B 59.21 | No English twin |
| **CUS-QA** (Czech, Slovak, Ukrainian; [2507.22752](https://arxiv.org/abs/2507.22752)), Llama-3.3-70B | Without RAG, English is slightly higher (−0.6 to −3.1 for local). **With RAG, the local language is higher** (+3.5 to +7.5) | Yes (translated questions) |
| **Linguistic Nepotism** ([2509.13930](https://arxiv.org/abs/2509.13930)) | Models cite English sources more accurately. Llama-3.3-70B: EN 85.9 vs RU 74.5 | Partial |
| **DELTA** ([2601.02956](https://arxiv.org/abs/2601.02956), Jan 2026) | Much of the "English preference" in RAG reflects where the evidence is. In 73% of the cases studied, the correct answer is backed by an English source | Yes (MKQA) |
| **Cross-lingual cost** ([2507.07543](https://arxiv.org/abs/2507.07543), EN–AR) | When the query and documents are in different languages, retrieval drops. M-E5 Hit@20 falls from 88% to 46%, BGE-M3 from 89% to 73% | Yes, but no Slavic language |
| Polish RAG systems (LREC 2026, EACL SRW 2026) | Polish only. Bielik-11B beats PLLuM-12B (judge score 4.52 vs 4.03). PLLuM-70B ranks top on Polish Wikipedia RAG | No English |

**Takeaway:** lexical search (BM25) is clearly weaker for Polish. RAG in the local language helps Slavic languages. The Polish-vs-English gap for *dense* retrievers has not been measured on parallel data.

---

## 4. Reasoning and knowledge on identical items

### 4.1 Polish vs English, same or matched items

**Grzybowski et al., *Polish-English medical knowledge transfer*** (Findings of EMNLP 2025, [2412.00559](https://arxiv.org/abs/2412.00559)), matched LEK exam:

| Model | PL | EN | EN−PL |
|---|---|---|---|
| Llama-3.2-3B | 39.22 | 52.08 | +12.86 |
| Llama-3.1-8B | 51.25 | 64.69 | +13.44 |
| Qwen2.5-7B | 51.92 | 67.73 | +15.81 |
| Bielik-11B-v2.2 | 62.36 | 56.98 | **−5.38** |
| Llama-3.1-70B | 80.94 | 82.60 | +1.66 |
| Qwen2.5-72B | 76.87 | 81.93 | +5.06 |
| Mistral-Large-2407 | 76.75 | 82.40 | +5.65 |
| gpt-4o-mini | 75.88 | 75.92 | +0.04 |
| gpt-4o | 89.96 | 88.69 | **−1.27** |

Caveat: the Polish and English sets come partly from different exam editions (22 vs 14 sets).

**EU20** ([2410.08928](https://arxiv.org/abs/2410.08928), DeepL translations), Llama-3.1-70B-Instruct: average PL 0.70 vs EN 0.79. GSM8K 0.69 vs 0.87, MMLU 0.78 vs 0.82, TruthfulQA 0.59 vs 0.60.

**Belebele** (fully parallel, 2023 models): Polish is 6–18 pp below English (GPT-3.5-turbo 74.7 vs 87.7).

### 4.2 Frontier models: close to parity on high-resource languages

- **Anthropic, Global-MMLU, % of the same model's English score** ([docs](https://platform.claude.com/docs/en/build-with-claude/multilingual-support)): Claude Opus 5.5 scores 99.1–99.3% for German, French, Spanish and Chinese, 98.3% for Swahili and 96.3% for Yoruba. **Polish and other Slavic languages are not listed.**
- **MMLU-ProX** (EMNLP 2025; no Polish; Slavic languages present: RU, UK, SR, CS). EN−Slavic gap: Qwen3-235B-Think 0.2–3.7 pp, Qwen3-32B 3.8–4.6 pp, Llama-3.1-8B 16–22 pp. *Single extraction, lower confidence.*

### 4.3 Does the language of *reasoning* matter?

- **Models route through English internally.** Schut et al. ([2502.15603](https://arxiv.org/abs/2502.15603)) measure an English-routing rate of 0.50–0.70 in open models. Anthropic's interpretability work shows concepts shared across languages, a larger share in bigger models.
- **Forcing English reasoning usually helps:**
  - PolyMath, QwQ-32B: 47.9 with English reasoning, 45.9 with no control, 43.4 in the query language.
  - *Language Matters* ([2505.17407](https://arxiv.org/abs/2505.17407)), MATH-500, average of 4 reasoning models, English reasoning vs target-language reasoning: Spanish 88.0 vs 72.5, Russian 86.7 vs 81.6, Swahili 57.4 vs 25.9.
  - Barua et al., AIME: R1-Distill-Llama-70B scores 52.6 with English chain-of-thought vs 24.2 in the target language.
- **Counterpoint:** Kang et al. ([2510.27269](https://arxiv.org/abs/2510.27269)) attribute most of the gap to *understanding* the question, not to the reasoning step itself.

**Answer:** yes, language affects reasoning. The effect is large for small models, for low-resource languages and on hard math. It is small (a few pp or less) for frontier models in high-resource languages, which includes Polish.

---

## 5. Agents, tools, instruction following

- **MAPS** ([2505.15935](https://arxiv.org/abs/2505.15935), 2026): on GAIA, agents score 47.4% in English vs a 35.8% mean for 11 other languages. GPT-o1 scores 39.1 in Russian. Attack success in non-English rises by up to 27 pp (ASB). Polish is not included.
- **MASSIVE-Agents** (Findings of EMNLP 2025, 52 locales including pl-PL): for the strongest models, Polish ≈ English. Claude 3.5 Sonnet v2 scores 89.47 in both. Llama-3.1-405B scores 88.42 PL vs 87.89 EN. Smaller models drop sharply: Nova Micro 17.37 vs 32.11, Command R 38.95 vs 60.00. *Caveat: the paper's metric labels and averages are internally inconsistent.*
- **Multi-IF** (Meta): English is not always best. For o1-preview, Spanish scores 0.912 vs English 0.856.
- **Safety:** PLLuM report ([2511.03823](https://arxiv.org/abs/2511.03823)) shows Llama-3.1-8B attack success at 3.51% in Polish vs 0.74% in English (DoNotAnswer), and 24.27% vs 0.32% on a new dataset.

---

## 6. Tokenization: the Polish "token tax"

*The Tokenizer Tax Across 24 European Languages* (Ovcharov, [2605.24718](https://arxiv.org/abs/2605.24718), May 2026), Table 4, SIB-200, mean of 6 tokenizers:

| Language | Tokens/word | × English |
|---|---|---|
| English | 1.23 | 1.00 |
| Spanish | 1.46 | 1.19 |
| French | 1.52 | 1.24 |
| Italian | 1.67 | 1.36 |
| German | 1.76 | 1.43 |
| **Polish** | **2.25** | **1.83** |
| Czech | 2.28 | 1.85 |
| Slovenian | 2.28 | 1.85 |
| Croatian | 2.31 | 1.88 |
| Bulgarian | 2.33 | 1.89 |
| Slovak | 2.45 | 1.99 |
| Ukrainian | 2.66 | 2.16 |

The Bielik v3 paper ([2604.10799](https://arxiv.org/abs/2604.10799)) measures tokens per word on the Polish Constitution preamble. Qwen3 needs 2.69 PL vs 1.17 EN, Gemma3 2.20 vs 1.20. The Polish-optimized APT4 tokenizer needs 1.62 PL vs 1.98 EN.

---

## 7. Practical recommendations

1. **Frontier models (Claude, GPT, Gemini):** Polish prompts are fine for knowledge and reasoning tasks; the expected loss is a few pp at most. Do not switch to Polish "because it's better", and do not avoid it either.
2. **Small and open models (≤ 14B):** for hard reasoning, consider English prompts or English chain-of-thought, then answer in Polish. Bielik or PLLuM are an alternative for Polish-specific knowledge.
3. **RAG in Polish:** do not rely on plain BM25. Use hybrid or dense retrieval with Polish-tuned or multilingual embeddings (PL-MTEB and PIRB leaders). Keep queries and documents in the same language where possible.
4. **Budget:** expect about 1.8× more tokens for Polish text, which means more cost and less room in the context window.
5. **Safety:** run red-team tests in Polish too. Guardrails tuned in English can be weaker in Polish.
6. **Evaluate on your own data:** public results rarely cover Polish with 2026 frontier models.

---

## 8. Gaps and limitations

- **No primary 2026 same-item Polish-vs-English benchmark for frontier models was found** after 5+ documented iterations per agent, including searches in Polish, Czech, Slovak, Ukrainian, Russian, Serbian, Croatian, Slovenian and Bulgarian.
- Subagents read papers through a summarizing web fetch. Raw PDF parsing was not available. Key numbers were cross-checked by at least two independent agents (OneRuler, Grzybowski, Bielik Table 1). Single-extraction values are marked lower confidence (MMLU-ProX, MASSIVE-Agents, EU20).
- Values printed only in figures (most OneRuler languages, Global-MMLU per-language results) were not estimated.
- Not covered: HELMET and BABILong in Polish, Global-MMLU Polish figure values, and the live Open PL LLM Leaderboard snapshot.

## Sources (primary)

OneRuler [2503.01996](https://arxiv.org/abs/2503.01996) · MLNeedle [2408.10151](https://arxiv.org/abs/2408.10151) · MLRBench [2504.12845](https://arxiv.org/abs/2504.12845) · LIBRA [2408.02439](https://arxiv.org/abs/2408.02439) · BEIR-PL [2305.19840](https://arxiv.org/abs/2305.19840) / [LREC-COLING 2024](https://aclanthology.org/2024.lrec-main.194/) · PIRB [2402.13350](https://arxiv.org/abs/2402.13350) · PL-MTEB [2405.10138](https://arxiv.org/abs/2405.10138) · CUS-QA [2507.22752](https://arxiv.org/abs/2507.22752) · Linguistic Nepotism [2509.13930](https://arxiv.org/abs/2509.13930) · DELTA [2601.02956](https://arxiv.org/abs/2601.02956) · Cross-Lingual Cost [2507.07543](https://arxiv.org/abs/2507.07543) · Bartanowicz & Jassem [LREC 2026](https://aclanthology.org/2026.lrec-1.211/) · Smits & Walkowiak [EACL SRW 2026](https://aclanthology.org/2026.eacl-srw.55/) · Grzybowski et al. [Findings EMNLP 2025](https://aclanthology.org/2025.findings-emnlp.480/) · EU20 [2410.08928](https://arxiv.org/abs/2410.08928) · Belebele [2308.16884](https://arxiv.org/abs/2308.16884) · MMLU-ProX [EMNLP 2025](https://aclanthology.org/2025.emnlp-main.79/) · Global-MMLU [2412.03304](https://arxiv.org/abs/2412.03304) · Anthropic [multilingual support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support) · Schut et al. [2502.15603](https://arxiv.org/abs/2502.15603) · PolyMath [2504.18428](https://arxiv.org/abs/2504.18428) · Language Matters [2505.17407](https://arxiv.org/abs/2505.17407) · Kang et al. [2510.27269](https://arxiv.org/abs/2510.27269) · Barua et al. [2508.14828](https://arxiv.org/abs/2508.14828) · MAPS [2505.15935](https://arxiv.org/abs/2505.15935) · MASSIVE-Agents [Findings EMNLP 2025](https://aclanthology.org/2025.findings-emnlp.1099/) · MASSIVE [2204.08582](https://arxiv.org/abs/2204.08582) · Multi-IF [2410.15553](https://arxiv.org/abs/2410.15553) · PLLuM [2511.03823](https://arxiv.org/abs/2511.03823) · Tokenizer Tax [2605.24718](https://arxiv.org/abs/2605.24718) · Bielik v3 tokenizer [2604.10799](https://arxiv.org/abs/2604.10799) · PLCC [2503.00995](https://arxiv.org/abs/2503.00995) · LLMzSzŁ [2501.02266](https://arxiv.org/abs/2501.02266)

Secondary (leads only): cryps.pl, Euronews, Polskie Radio, Notes from Poland, PAP / Nauka w Polsce, Spidersweb.
