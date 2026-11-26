# Retrospektywa: wieloagentowy research z weryfikacją źródeł

Sesja z 24.11.2026 · Temat: „Czy polski jest najlepszym językiem dla LLM?” · Skill utworzony na podstawie sesji: `.agents/skills/source-verified-research/`

## 1. Podsumowanie

Zadanie polegało na znalezieniu źródła artykułu z cryps.pl i zebraniu nowszych danych (2024–2026) o skuteczności polskiego i innych języków słowiańskich wobec angielskiego: w wyszukiwaniu informacji, RAG, rozumowaniu i pracy agentów. Rolą koordynatora (Claude Opus) było zarządzanie procesem, kontrola jakości i synteza. Wyszukiwaniem zajmowali się subagenci na Claude Haiku.

**Efekt:**
- źródło zidentyfikowane: OneRuler, arXiv 2503.01996, COLM 2025;
- teza medialna zweryfikowana; najważniejsza liczba (88% wobec 83,9%) potwierdzona przez 3 agentów niezależnie;
- raporty w Markdown i HTML, po polsku i po angielsku;
- dwa interaktywne artefakty (PL i EN);
- commit na gałęzi `feat/polish-vs-english-research` i push na forka.

**Metryki:**

| Etap | Agenci | Tokeny (subagenci) | Najdłuższy agent |
|---|---|---|---|
| Research | 6 (A1–A6), w tym jedna druga runda (A2) | 788 419 | 324 s |
| Weryfikacja | 5 (V1–V5) | 547 022 | 385 s |
| **Razem** | **11** | **1 335 441** | — |

Główna ścieżka czasowa to około 15 minut na research, potem około 7 minut na weryfikację. Resztę czasu zajęły synteza, artefakty i obsługa gita.

---

## 2. Workflow, krok po kroku

Poniżej jest workflow zapisany w skillu. Przeczytaj go i potwierdź albo popraw, a dostosuję skill.

### Faza 0: przygotowanie (przed uruchomieniem agentów)

1. Koordynator streszcza zlecenie w 5–8 punktach: teza lub pytanie, zakres, języki, liczba agentów, formaty i języki wyników, miejsce zapisu i commita. Prosi o jedno potwierdzenie albo przechodzi przez tryb planowania.
2. Sprawdzenie gita: bieżąca gałąź, czy repozytorium to fork, tożsamość autora, `gh auth status`. Gdy sesja jest na `main`, planuje gałąź `feat/<temat>`.
3. Narzędzia dla agentów: jeśli `curl` i `pdftotext` są zablokowane, koordynator prosi o zgodę albo sam pobiera kluczowe PDF-y.

### Faza 1: research (co najmniej 5 agentów Haiku, równolegle, w tle)

- Jeden agent zajmuje się wyłącznie **źródłem pierwotnym i łańcuchem medialnym**. Pozostali dostają po jednym obszarze dowodów.
- Każdy brief zawiera: kontekst całego projektu, zakres, przykładowe źródła i frazy, **wyszukiwanie w językach narodowych i co najmniej 5 iteracji od początku**, zasady weryfikacji, format raportu i ścieżkę pliku w scratchpadzie.
- Konkretów, których koordynator nie sprawdził (autorzy, liczby), nie podaje się jako faktów, tylko jako „hipotezę do weryfikacji”.

### Faza 2: przegląd każdego raportu

Koordynator sprawdza, czy każda liczba ma wartość, metrykę, miejsce w źródle, URL i status, czy jest dziennik co najmniej 5 iteracji oraz czy dane są wiarygodne. Szuka też sprzeczności między agentami. Braki odsyła z konkretnym feedbackiem (`SendMessage`).

### Faza 3: celowana weryfikacja

Każda wątpliwość trafia do osobnego weryfikatora z wąską listą kontrolną: „potwierdź lub popraw wartości X, Y z tabeli N” oraz „uzupełnij lukę G”. Weryfikatorzy szukają też nowych tropów, np. zbiorów danych, które są tłumaczeniami angielskich benchmarków. Proste obliczenia koordynator sprawdza sam, jedną linią Pythona.

### Faza 4: synteza i wyniki

Koordynator sam pisze raport, w dwóch językach, w Markdown i HTML (oraz PDF na życzenie). Do tego dwa interaktywne artefakty z jednego szablonu z przełącznikiem `LANG`. Pewność danych jest oznaczona uczciwie, a wartości dostępnych tylko na wykresach się nie szacuje.

### Faza 5: kontrola jakości i git

Kontrola HTML: zamknięte znaczniki, brak przewijania w poziomie na telefonie, brak błędów w konsoli. Commit tylko wskazanych plików na `feat/<temat>`. Push i PR tylko na prośbę.

### Faza 6: podsumowanie po polsku

Najpierw bezpośrednia odpowiedź, potem dowody, luki, pliki i linki, przebieg procesu i wskazówki na przyszłość.

---

## 3. Co zadziałało

- **Agent od źródła i mediów** znalazł publiczne sprostowania autorki i Microsoftu oraz liczby, które pojawiły się tylko w prasie.
- **Weryfikatorzy szukali też luk, nie tylko potwierdzeń.** Dzięki temu znalazły się BEIR-PL (jedyne porównanie PL i EN w wyszukiwaniu na tych samych danych) i MASSIVE-Agents (dane o agentach po polsku).
- **Tabele gotowe do wykresów** w każdym raporcie sprawiły, że budowa artefaktu była mechaniczna.
- **Statusy pewności** (VERIFIED / UNVERIFIED / CONTRADICTED) i kolumna „Porównywalne?” pilnowały uczciwości syntezy.
- **Kontrola krzyżowa** rozstrzygnęła sprzeczność co do liczb 88/83,9 i wyjaśniła podejrzaną wartość 3,22 tokena na słowo dla tokenizera Bielika.

---

## 4. Błędy i co można zrobić lepiej

### 4.1 Po stronie koordynatora (moje)

| # | Błąd | Skutek | Poprawka w skillu |
|---|---|---|---|
| 1 | Agentów uruchomiłem przed potwierdzeniem pełnego zlecenia | Pierwsze wywołanie zostało odrzucone; wymagania dosyłałem dodatkiem, a A2 skończył bez nich i potrzebował drugiej rundy | Faza 0: streszczenie zlecenia i jedno potwierdzenie |
| 2 | Wymogu „języki narodowe i ≥5 iteracji” nie było w pierwotnym briefie | Dodatkowa runda dla A2 | Wymóg na stałe w szablonie briefu |
| 3 | W briefie V5 podałem zgadniętą listę autorów BEIR-PL | Ryzyko, że agent przyjmie błędny fakt (wyłapał to weryfikator) | Konkrety podaję tylko jako „hipotezę do weryfikacji” |
| 4 | Nie sprawdziłem na początku, jakie narzędzia mają agenci | Brak `curl` i `pdftotext`; tabele z PDF czytane przez streszczenia, niższa pewność; pełnej tabeli 26 języków nie udało się odzyskać | Faza 0: zgoda na `curl`/`pdftotext` albo samodzielne pobranie PDF-ów |
| 5 | W briefie nie napisałem wprost, że zapis pliku jest dozwolony | V4 odmówił zapisu raportu do pliku | Szablon briefu: „zapis do scratchpadu jest dozwolony i oczekiwany” |
| 6 | Weryfikację planowałem na bieżąco, nie z góry | Weryfikatorzy startowali po kolei, a nie równolegle | Faza 3 zaplanowana od razu: weryfikator liczb głównych i po jednym na obszar |
| 7 | Artefakt nie był od początku dopasowany do telefonu | Jedna poprawka i ponowne budowanie | Reguła `minmax(0,1fr)` w szablonie i jedna kontrola `scrollWidth` |
| 8 | Konwerter Markdown pisany od zera, z błędem przy `***` | Dodatkowa runda debugowania | Gotowy, poprawiony `scripts/md2html.py` w skillu |
| 9 | Nazwałem gałąź `docs/…`, a Ty chciałeś `feat/…` | Zmiana nazwy gałęzi | Konwencja `feat/<temat>` w skillu |
| 10 | Gita nie sprawdziłem na początku (tożsamość, uprawnienia tokena) | Commit nie przeszedł bez tożsamości, push dostał 403 | Faza 0: preflight gita |
| 11 | HTML i PDF nie były w planie od początku | Dodatkowe tury rozmowy | Domyślnie MD + HTML + artefakty; o PDF pytam w Fazie 0 |

### 4.2 Po stronie procesu i środowiska

- **Uprawnienia:** Bash dla subagentów był zablokowany, a zapis do `.claude/` przez Bash odrzucany. Pliki skilla musiały powstać przez narzędzie Write, a przykładowy szablon artefaktu zostaje w `docs/research/artifact/`.
- **Limity zewnętrznych API:** Semantic Scholar zwracał 429/403, więc nie powstała lista cytowań OneRulera. Rozwiązanie: klucz API albo sprawdzenie cytowań przez arXiv lub Google Scholar.
- **Ograniczenie źródła:** wyniki 23 języków w OneRulerze istnieją tylko na wykresach. Bez danych od autorów nie da się ich uczciwie pokazać.

### 4.3 Wskazówki dla Ciebie (sposób zlecania)

- **Daj całe zlecenie od razu** albo zacznij od `/plan`. Przerwania i dosyłane wymagania kosztowały dodatkowe rundy agentów.
- **Uruchamiaj skill wprost:** napisz `/source-verified-research <URL lub pytanie>`. Brief, zasady weryfikacji i format wyników są już w skillu, więc nie trzeba ich wklejać.
- **Przed sesją zezwól na `curl` i `pdftotext`** (np. przez `/fewer-permission-prompts`) i ustaw tożsamość gita oraz token z uprawnieniem *Contents: write*.
- **Przy dużych zadaniach** możesz dodać słowo `ultracode` albo poprosić o „workflow”. Wtedy research i weryfikację można zapisać jako deterministyczny potok, w którym weryfikacja startuje automatycznie po każdym raporcie.

---

## 5. Co zawiera skill

```
.agents/skills/source-verified-research/
├── SKILL.md                         workflow (fazy 0–6), uzasadnienia, wyzwalacze
├── references/briefs.md             szablony briefów: research, weryfikator, feedback
├── references/report-and-artifact.md struktura raportu, HTML/PDF, artefakt dwujęzyczny
├── references/lessons-learned.md    13 lekcji z tej sesji + co zachować
└── scripts/
    ├── md2html.py                   Markdown → HTML (motywy, style do druku)
    └── md2pdf.sh                    Markdown → HTML → PDF (headless Chrome)
```

Przykładowy artefakt: `docs/research/artifact/template.html`.

Zgodnie z `.gitignore` repozytorium skill jest wersjonowany w `.agents/skills/`, a `.claude/skills/` służy tylko do linków dla Claude Code.

**Uwaga:** skill nie przeszedł jeszcze formalnych testów (porównania przebiegów ze skillem i bez niego). Jeden przebieg tego workflow kosztuje około 1,3 mln tokenów subagentów, więc testy warto uruchomić świadomie, na jednym lub dwóch realnych tematach.

---

## 6. Przykładowe wywołanie

```
/source-verified-research https://example.org/artykul-o-badaniu
Znajdź źródło, sprawdź nowsze dane z 2026 r. dla PL i języków słowiańskich
(retrieval, RAG, rozumowanie, agenci). 6 agentów Haiku, wyniki PL+EN, MD+HTML+PDF,
artefakty z wykresami, commit na feat/<temat>, bez pusha.
```
