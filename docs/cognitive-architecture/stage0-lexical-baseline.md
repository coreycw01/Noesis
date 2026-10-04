# Stage 0 Synthetic Lexical Baseline

Date: October 4, 2026  
Fixture: `tests/fixtures/cognitive-benchmark.ts`  
Strategy: deterministic token-overlap retrieval, no generation, no account data

## Results

| Metric | Result |
|---|---:|
| Cases | 60 |
| Average required-evidence recall | 91.67% |
| “Show everything” completeness recall | 100% |
| Excluded-evidence violations | 0 |
| Evidence-budget violations | 0 |
| Average selected evidence count | 5.97 |
| Maximum measured local retrieval latency | 8.04 ms |
| Model/provider cost | 0 |

These numbers are a synthetic engineering baseline, not a product-quality claim. The corpus is intentionally small, terms overlap with the queries, and execution is local. The review-account run must report separate metrics.

## Missed cases

The lexical baseline did not retrieve all required evidence for:

- `temporal-08` — missed the source background associated with a revision;
- `temporal-10` — missed both unresolved items when asked what remains unresolved;
- `relationship-01` — found the attention work but missed the practice evidence;
- `tension-01` — missed the superseded historical identity statement;
- `gap-03` — found the technology position but missed Postman's source claim;
- `analytics-03` — could not derive historical-state membership from a natural-language query;
- `analytics-04` — could not identify practices with explicit outcomes.

## Interpretation

The misses support the staged plan:

- deterministic analytics should query structured fields rather than use semantic retrieval;
- temporal questions need explicit current/superseded filtering and event joins;
- relationship questions need confirmed-link expansion;
- source-background and practice-outcome questions are plausible candidates for semantic retrieval or field-aware lexical indexing;
- no result yet justifies claim extraction or global graph processing.

## Safety behavior verified

- rejected, stale, deleted, and invalidated evidence is ineligible;
- local-only evidence can be found by local search but is excluded from external evidence bundles;
- evidence counts and latency stay within each case budget;
- must-exclude evidence produced no violations.

## Next comparison

After the user signs in to the dedicated review account and read-only identity/inventory checks pass:

1. reproduce this exact baseline against an isolated evaluation run;
2. add field-aware lexical retrieval;
3. add semantic retrieval for externally allowed evidence only;
4. compare hybrid retrieval;
5. add reranking only if hybrid errors remain;
6. introduce claims or graph expansion only for query classes with measured unmet needs.
