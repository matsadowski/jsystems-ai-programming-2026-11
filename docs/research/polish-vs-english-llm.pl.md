# Czy polski naprawdę jest „najlepszym językiem” dla modeli AI? Weryfikacja źródła i dane z lat 2024–2026

Data badania: 2026-11-24 · Metoda: 6 agentów badawczych + 5 agentów weryfikujących (Claude Haiku), koordynacja i kontrola jakości: Claude Opus · Wersja angielska: [polish-vs-english-llm.en.md](polish-vs-english-llm.en.md)

## W skrócie

1. **Źródło istnieje, ale ma wąski zakres.** Artykuł na cryps.pl (25.10.2025) opiera się na badaniu **OneRuler** (Kim, Russell, Karpińska, Iyyer; arXiv 2503.01996; COLM 2025). Polski uzyskał **88%**, angielski **83,9%** (6. miejsce na 26). To średnia z zadań typu „igła w stogu siana” (wyszukiwanie informacji w bardzo długim tekście) przy kontekście 64K i 128K tokenów, liczona dla 6–7 modeli z początku 2025 roku.
2. **Badanie mierzyło wyszukiwanie w długim kontekście, a nie promptowanie ani rozumowanie.** Autorzy nie przeprowadzili testu istotności statystycznej. Dla każdego języka „stogiem siana” była inna książka. Sami autorzy nazywają wynik polskiego „nieoczekiwanym” i nie umieją go wyjaśnić. Współautorka Marzena Karpińska oraz Microsoft publicznie zastrzegli, że badanie nie dowodzi, że polski jest najlepszy do promptowania (źródło wtórne: media).
3. **Nie znaleziono replikacji z 2026 roku.** Żaden inny wielojęzyczny benchmark długiego kontekstu otwarty w tym przeglądzie nie obejmuje polskiego. Zastrzeżenia: nie udało się pobrać listy cytowań OneRulera, nie sprawdzono też HELMET i BABILong. Istnieją benchmarki tylko dla rosyjskiego (LIBRA, CODi 2025).
4. **Na tych samych pytaniach (tłumaczonych lub dopasowanych) polski jest zwykle nieco słabszy od angielskiego, a różnica maleje wraz z rozmiarem modelu.** Na dopasowanych polskich egzaminach medycznych (Grzybowski i in., EMNLP Findings 2025) modele 3–8B tracą po polsku 4,7–18,1 pp. Llama-3.1-70B traci 1,4–1,7 pp. GPT-4o radzi sobie po polsku o około 1,3 pp *lepiej*. Bielik, polski model, też wypada lepiej po polsku.
5. **Wyszukiwanie: klasyczne wyszukiwanie po słowach działa po polsku wyraźnie gorzej.** BM25 na BEIR-PL (tłumaczeniu angielskiego BEIR) osiąga średnio 35,67 nDCG@10 wobec 42,41 po angielsku (−15,9%). Autorzy wskazują na fleksję polszczyzny. Nikt nie zmierzył wyszukiwarki wektorowej (dense retriever) w obu językach na tych samych danych.
6. **Język wpływa na rozumowanie.** Wymuszenie rozumowania po angielsku zwykle pomaga: w PolyMath QwQ-32B uzyskuje 47,9 przy rozumowaniu po angielsku i 43,4 w języku pytania. Agenci tracą skuteczność poza angielskim: w GAIA (MAPS) 47,4% po angielsku wobec średnio 35,8% w 11 innych językach. Efekt jest największy dla małych modeli i języków o małych zasobach. Polski należy do języków o dużych zasobach.
7. **Polski zużywa więcej tokenów.** Na jedno słowo potrzeba średnio **1,83 raza więcej tokenów** niż po angielsku (2,25 wobec 1,23, Tokenizer Tax 2026). W oknie kontekstu mieści się więc mniej słów, a wywołania API są droższe.

**Wniosek:** stwierdzenie „polski bije angielski” jest prawdziwe dla jednego typu zadań (znajdowanie faktów w bardzo długim kontekście), w jednym badaniu z 2025 roku, bez testu statystycznego. Szersze dane nie potwierdzają tezy, że „polski jest lepszy dla AI”. W najnowszych dużych modelach polski jest blisko angielskiego (ok. 98–100% wyniku po angielsku). W małych i otwartych modelach angielski wciąż ma wyraźną przewagę.

---

## 1. Ustalenie źródła

| Element | Ustalenie | Status |
|---|---|---|
| Artykuł | cryps.pl, Maciej Halikowski, 25.10.2025. Liczby zgadzają się z publikacją (88%, ~84%, chiński 62,1%) | Zweryfikowane |
| Publikacja | *One ruler to measure them all: Benchmarking multilingual long-context language models*. Y. Kim, J. Russell, M. Karpińska, M. Iyyer. arXiv [2503.01996](https://arxiv.org/abs/2503.01996) (v1 3.03.2025, v3 30.09.2025), COLM 2025. Kod: [github.com/mungg/OneRuler](https://github.com/mungg/OneRuler) | Zweryfikowane (źródło pierwotne) |
| Projekt badania | 26 języków; 7 zadań (5 wariantów „igły w stogu siana” i 2 zadania ze zliczaniem najczęstszych słów); kontekst 8K, 32K, 64K i 128K tokenów; modele: Gemini 1.5 Flash, o3-mini-high, Llama 3.3 70B, Llama 3.1 8B, Qwen 2.5 72B, Qwen 2.5 7B, DeepSeek-R1 (tylko po angielsku) | Zweryfikowane |
| Główny wynik | Polski 88% (1. miejsce), angielski 83,9% (6. miejsce), chiński 62,1% (4. od końca). Średnia z zadań wyszukiwania dla wszystkich modeli przy 64K i 128K (sekcja 3.1) | Potwierdzone niezależnie przez 3 agentów |
| Pojedynczy model | o3-mini-high przy 128K: polski 92%, ukraiński 89%, angielski 67% | Zweryfikowane |
| Luka zasobowa | Różnica między 5 najlepszymi a 5 najsłabszymi językami (według wielkości Wikipedii) rośnie z 11 pp przy 8K do 34 pp przy 128K | Zweryfikowane (tekst) |
| Język instrukcji | Według streszczenia publikacji wynik może się zmienić nawet o 20%. Przykład: angielski kontekst przy 64K spada z 91% do 71%, gdy instrukcje są po koreańsku | Zweryfikowane (wartości z przykładu); „20%” pochodzi ze streszczenia |
| Istotność | Brak testu statystycznego, przedziałów ufności i wariancji dla porównania polski–angielski. Różnica wynosi 4,1 pp | Zweryfikowane (brak testu) |
| Wyjaśnienie | Autorzy nazywają wynik nieoczekiwanym i piszą, że nie wiadomo, skąd się bierze. Wymieniają hipotezy (dane treningowe, alfabet, rodzina językowa, tokenizer), ale nie twierdzą, że któraś jest przyczyną | Zweryfikowane |
| Czynnik zakłócający | Dla każdego języka „stogiem siana” jest inna książka: dla polskiego *Noce i dnie*, dla angielskiego *Little Women*. Autorzy przyznają, że wiek i styl książek mogły wpłynąć na wyniki | Zweryfikowane (tab. 4, dod. A) |
| Pozostałe języki | Wyniki pozostałych 23 języków są tylko na wykresach, a repozytorium nie zawiera plików z wynikami. Liczby podawane w mediach (francuski 87, włoski 86, hiszpański 85, rosyjski 84) **nie występują** w tekście publikacji | Nie do zweryfikowania |

### Jak media zmieniły przekaz

| Teza medialna | Co mówi publikacja |
|---|---|
| „Polski to najlepszy język do promptowania AI” (nagłówek Euronews, Polskie Radio i inni) | Badanie nie dotyczyło promptowania, tylko wyszukiwania i agregacji informacji w długim kontekście |
| „Polski radzi sobie mimo mniejszej ilości danych” / „gramatyka zmniejsza niejednoznaczność” (cryps.pl) | Tego nie ma w publikacji. Autorzy podają tylko hipotezy |
| Lista modeli „Gemini, Llama, Qwen” | Pomija o3-mini-high i DeepSeek-R1 |
| „Rosyjski na 2. miejscu”, francuski 87, włoski 86… | Nie znaleziono w tekście publikacji |

Źródła wtórne (PAP / Nauka w Polsce): według Karpińskiej z badania na pewno nie wynika, że polski jest najlepszy do promptowania. Microsoft (12.11.2025) dodał, że badanie nie miało porównywać języków pod kątem promptowania.

---

## 2. Wyszukiwanie w długim kontekście po OneRulerze

- **MLNeedle** ([2408.10151](https://arxiv.org/abs/2408.10151); według wyszukiwarki NAACL 2025): angielski, niemiecki, hiszpański, chiński, wietnamski, hindi i arabski, bez języków słowiańskich. Model najczęściej odnajduje „igłę”, gdy jest ona po angielsku, niezależnie od języka „stogu siana”. Dla Llama3-8B kolumna z angielską igłą to 0,61–0,70, a z chińską 0,15–0,22.
- **MLRBench** ([2504.12845](https://arxiv.org/abs/2504.12845), EACL 2026): bez języków słowiańskich. W warunkach wielojęzycznych modele wykorzystują mniej niż 30% deklarowanego kontekstu.
- **LIBRA** ([2408.02439](https://arxiv.org/abs/2408.02439)): tylko rosyjski. GPT-4o uzyskuje 70,2 ogółem, 73,3 przy 4K i 54,8 przy 128K.
- **Nie znaleziono replikacji z 2026 roku** tezy „polski > angielski” na GPT-5.x, Claude, Gemini 3 i podobnych modelach. Listy cytowań OneRulera nie udało się pobrać (Semantic Scholar zwracał błędy 429/403).

**Nasza hipoteza, niezbadana w żadnej publikacji:** OneRuler mierzy długość kontekstu w *tokenach*. Polski tekst zużywa około 1,8 raza więcej tokenów na słowo, więc polski „stóg siana” o długości 128K tokenów zawiera znacznie mniej słów niż angielski. Czy to ułatwia wyszukiwanie, nikt nie sprawdził. Sami autorzy przyznają, że różnice w tokenizacji utrudniają uczciwe porównanie.

---

## 3. Wyszukiwanie informacji i RAG

| Dowód | Polski/słowiańskie wobec angielskiego | Porównywalne? |
|---|---|---|
| **BEIR-PL** (Wojtasik i in., [2305.19840](https://arxiv.org/abs/2305.19840), LREC-COLING 2024): BM25, 11 zbiorów danych | PL 35,67 wobec EN 42,41 średnio nDCG@10 (**−15,9%**). Największy spadek na NQ (−38%). Podana przyczyna: fleksja osłabia dopasowanie po słowach | Tak (maszynowe tłumaczenie BEIR) |
| **PIRB** (41 zadań) / **PL-MTEB** (11 zadań wyszukiwania) | Tylko polski. Najlepsze wyniki: PIRB mE5-large 57,29, PL-MTEB stella-pl-retrieval-8k 61,59, Qwen3-Embedding-8B 59,21 | Brak angielskiego odpowiednika |
| **CUS-QA** (czeski, słowacki, ukraiński; [2507.22752](https://arxiv.org/abs/2507.22752)), Llama-3.3-70B | Bez RAG angielski wypada nieco lepiej (język lokalny od −0,6 do −3,1). **Z RAG lepszy jest język lokalny** (od +3,5 do +7,5) | Tak (tłumaczone pytania) |
| **Linguistic Nepotism** ([2509.13930](https://arxiv.org/abs/2509.13930)) | Modele trafniej cytują źródła angielskie. Llama-3.3-70B: EN 85,9 wobec RU 74,5 | Częściowo |
| **DELTA** ([2601.02956](https://arxiv.org/abs/2601.02956), styczeń 2026) | Duża część „preferencji dla angielskiego” w RAG wynika z tego, gdzie leżą dowody. W 73% badanych przypadków poprawną odpowiedź potwierdza źródło angielskie | Tak (MKQA) |
| **Koszt międzyjęzykowy** ([2507.07543](https://arxiv.org/abs/2507.07543), EN–AR) | Gdy zapytanie i dokumenty są w różnych językach, wyszukiwanie słabnie. M-E5 Hit@20 spada z 88% do 46%, BGE-M3 z 89% do 73% | Tak, ale bez języka słowiańskiego |
| Polskie systemy RAG (LREC 2026, EACL SRW 2026) | Tylko polski. Bielik-11B wygrywa z PLLuM-12B (ocena sędziego 4,52 wobec 4,03). PLLuM-70B wypada najlepiej w RAG na polskiej Wikipedii | Brak angielskiego |

**Wniosek:** wyszukiwanie po słowach (BM25) jest po polsku wyraźnie słabsze. RAG w języku lokalnym pomaga językom słowiańskim. Różnicy polski–angielski dla wyszukiwarek wektorowych nikt nie zmierzył na równoległych danych.

---

## 4. Rozumowanie i wiedza na tych samych pytaniach

### 4.1 Polski i angielski na tych samych lub dopasowanych pytaniach

**Grzybowski i in., *Polish-English medical knowledge transfer*** (Findings of EMNLP 2025, [2412.00559](https://arxiv.org/abs/2412.00559)), dopasowany egzamin LEK:

| Model | PL | EN | EN−PL |
|---|---|---|---|
| Llama-3.2-3B | 39,22 | 52,08 | +12,86 |
| Llama-3.1-8B | 51,25 | 64,69 | +13,44 |
| Qwen2.5-7B | 51,92 | 67,73 | +15,81 |
| Bielik-11B-v2.2 | 62,36 | 56,98 | **−5,38** |
| Llama-3.1-70B | 80,94 | 82,60 | +1,66 |
| Qwen2.5-72B | 76,87 | 81,93 | +5,06 |
| Mistral-Large-2407 | 76,75 | 82,40 | +5,65 |
| gpt-4o-mini | 75,88 | 75,92 | +0,04 |
| gpt-4o | 89,96 | 88,69 | **−1,27** |

Zastrzeżenie: zestawy polskie i angielskie pochodzą częściowo z różnych edycji egzaminu (22 wobec 14 zestawów).

**EU20** ([2410.08928](https://arxiv.org/abs/2410.08928), tłumaczenia DeepL), Llama-3.1-70B-Instruct: średnio PL 0,70 wobec EN 0,79. GSM8K 0,69 wobec 0,87, MMLU 0,78 wobec 0,82, TruthfulQA 0,59 wobec 0,60.

**Belebele** (w pełni równoległy, modele z 2023 roku): polski wypada o 6–18 pp gorzej niż angielski (GPT-3.5-turbo: 74,7 wobec 87,7).

### 4.2 Najnowsze duże modele: prawie równo w językach o dużych zasobach

- **Anthropic, Global-MMLU, wynik jako % wyniku tego samego modelu po angielsku** ([dokumentacja](https://platform.claude.com/docs/en/build-with-claude/multilingual-support)): Claude Opus 5.5 osiąga 99,1–99,3% dla niemieckiego, francuskiego, hiszpańskiego i chińskiego, 98,3% dla suahili i 96,3% dla joruba. **Polskiego ani innych języków słowiańskich nie ma w tabeli.**
- **MMLU-ProX** (EMNLP 2025; bez polskiego; z językami słowiańskimi RU, UK, SR, CS). Różnica między angielskim a językami słowiańskimi: Qwen3-235B-Think 0,2–3,7 pp, Qwen3-32B 3,8–4,6 pp, Llama-3.1-8B 16–22 pp. *Pojedyncza ekstrakcja, niższa pewność.*

### 4.3 Czy liczy się język *rozumowania*?

- **Modele wewnętrznie „przechodzą przez angielski”.** Schut i in. ([2502.15603](https://arxiv.org/abs/2502.15603)) mierzą w modelach otwartych wskaźnik takiego przechodzenia na poziomie 0,50–0,70. Badania interpretowalności Anthropic pokazują pojęcia wspólne dla wielu języków, a w większych modelach takich wspólnych pojęć jest więcej.
- **Wymuszenie rozumowania po angielsku zwykle pomaga:**
  - PolyMath, QwQ-32B: 47,9 przy rozumowaniu po angielsku, 45,9 bez narzuconego języka, 43,4 w języku pytania.
  - *Language Matters* ([2505.17407](https://arxiv.org/abs/2505.17407)), MATH-500, średnia z 4 modeli rozumujących, rozumowanie po angielsku wobec rozumowania w języku pytania: hiszpański 88,0 wobec 72,5, rosyjski 86,7 wobec 81,6, suahili 57,4 wobec 25,9.
  - Barua i in., AIME: R1-Distill-Llama-70B uzyskuje 52,6 przy tokach rozumowania po angielsku i 24,2 w języku pytania.
- **Kontrargument:** Kang i in. ([2510.27269](https://arxiv.org/abs/2510.27269)) przypisują większość różnicy *rozumieniu* pytania, a nie samemu etapowi rozumowania.

**Odpowiedź:** tak, język wpływa na rozumowanie. Efekt jest duży w małych modelach, w językach o małych zasobach i przy trudnej matematyce. W najnowszych dużych modelach i językach o dużych zasobach, w tym polskim, jest mały (kilka pp lub mniej).

---

## 5. Agenci, narzędzia, wykonywanie instrukcji

- **MAPS** ([2505.15935](https://arxiv.org/abs/2505.15935), 2026): w GAIA agenci osiągają 47,4% po angielsku wobec średnio 35,8% w 11 innych językach. GPT-o1 osiąga 39,1 po rosyjsku. Skuteczność ataków poza angielskim rośnie nawet o 27 pp (ASB). Polskiego nie ma w zestawie.
- **MASSIVE-Agents** (Findings of EMNLP 2025, 52 wersje językowe, w tym pl-PL): w najmocniejszych modelach polski ≈ angielski. Claude 3.5 Sonnet v2 ma 89,47 w obu językach. Llama-3.1-405B ma 88,42 po polsku wobec 87,89 po angielsku. Mniejsze modele mocno tracą: Nova Micro 17,37 wobec 32,11, Command R 38,95 wobec 60,00. *Zastrzeżenie: etykiety metryk i średnie w publikacji są wewnętrznie niespójne.*
- **Multi-IF** (Meta): angielski nie zawsze wypada najlepiej. Dla o1-preview hiszpański ma 0,912, a angielski 0,856.
- **Bezpieczeństwo:** w raporcie PLLuM ([2511.03823](https://arxiv.org/abs/2511.03823)) ataki na Llama-3.1-8B są skuteczniejsze po polsku: 3,51% wobec 0,74% po angielsku (DoNotAnswer) i 24,27% wobec 0,32% na nowym zbiorze danych.

---

## 6. Tokenizacja: polski „podatek tokenowy”

*The Tokenizer Tax Across 24 European Languages* (Ovcharov, [2605.24718](https://arxiv.org/abs/2605.24718), maj 2026), tab. 4, SIB-200, średnia z 6 tokenizerów:

| Język | Tokeny/słowo | × angielski |
|---|---|---|
| angielski | 1,23 | 1,00 |
| hiszpański | 1,46 | 1,19 |
| francuski | 1,52 | 1,24 |
| włoski | 1,67 | 1,36 |
| niemiecki | 1,76 | 1,43 |
| **polski** | **2,25** | **1,83** |
| czeski | 2,28 | 1,85 |
| słoweński | 2,28 | 1,85 |
| chorwacki | 2,31 | 1,88 |
| bułgarski | 2,33 | 1,89 |
| słowacki | 2,45 | 1,99 |
| ukraiński | 2,66 | 2,16 |

Publikacja o Bieliku v3 ([2604.10799](https://arxiv.org/abs/2604.10799)) mierzy liczbę tokenów na słowo w preambule Konstytucji RP. Qwen3 potrzebuje 2,69 po polsku wobec 1,17 po angielsku, Gemma3 2,20 wobec 1,20. Tokenizer APT4, zoptymalizowany pod polski, potrzebuje 1,62 po polsku wobec 1,98 po angielsku.

---

## 7. Rekomendacje praktyczne

1. **Najnowsze duże modele (Claude, GPT, Gemini):** prompty po polsku sprawdzają się w zadaniach wiedzy i rozumowania; spodziewana strata to najwyżej kilka pp. Nie przechodź na polski dlatego, że „jest lepszy”, ale też nie unikaj go.
2. **Małe i otwarte modele (≤ 14B):** przy trudnym rozumowaniu rozważ prompt lub tok rozumowania po angielsku i odpowiedź po polsku. Do wiedzy specyficznej dla Polski warto rozważyć Bielika lub PLLuM.
3. **RAG po polsku:** nie opieraj się na samym BM25. Używaj wyszukiwania hybrydowego lub wektorowego z modelami embeddingowymi dostrojonymi do polskiego albo wielojęzycznymi (liderzy PL-MTEB i PIRB). Gdy to możliwe, trzymaj zapytania i dokumenty w tym samym języku.
4. **Budżet:** licz się z około 1,8 raza większą liczbą tokenów dla polskiego tekstu, czyli wyższym kosztem i mniejszym zapasem w oknie kontekstu.
5. **Bezpieczeństwo:** testy red-team przeprowadzaj także po polsku. Zabezpieczenia dostrojone po angielsku mogą być po polsku słabsze.
6. **Testuj na własnych danych:** publiczne wyniki rzadko obejmują polski i najnowsze modele z 2026 roku.

---

## 8. Luki i ograniczenia

- **Nie znaleziono pierwotnego benchmarku z 2026 roku, który porównywałby polski i angielski na tych samych pytaniach dla najnowszych dużych modeli.** Każdy agent wykonał co najmniej 5 udokumentowanych iteracji, w tym wyszukiwania po polsku, czesku, słowacku, ukraińsku, rosyjsku, serbsku, chorwacku, słoweńsku i bułgarsku.
- Subagenci czytali publikacje przez narzędzie pobierające strony, które streszcza treść. Bezpośrednie parsowanie PDF nie było dostępne. Kluczowe liczby sprawdziło niezależnie co najmniej dwóch agentów (OneRuler, Grzybowski, tab. 1 Bielika). Wartości z pojedynczej ekstrakcji oznaczono jako mniej pewne (MMLU-ProX, MASSIVE-Agents, EU20).
- Wartości dostępnych tylko na wykresach (większość języków w OneRulerze, wyniki Global-MMLU dla poszczególnych języków) nie były szacowane.
- Poza zakresem: HELMET i BABILong po polsku, wartości dla polskiego z wykresów Global-MMLU oraz bieżący stan Open PL LLM Leaderboard.

## Źródła (pierwotne)

Pełna lista z odnośnikami znajduje się w [wersji angielskiej](polish-vs-english-llm.en.md#sources-primary).

Źródła wtórne (tylko jako tropy): cryps.pl, Euronews, Polskie Radio, Notes from Poland, PAP / Nauka w Polsce, Spidersweb.
