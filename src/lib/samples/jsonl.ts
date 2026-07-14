/** A realistic JSONL (JSON Lines / NDJSON) sample — one log/event record per line. */
export const JSONL_SAMPLE = `{"ts":"2026-07-14T09:00:01Z","level":"info","event":"request","method":"GET","path":"/json","ms":12}
{"ts":"2026-07-14T09:00:02Z","level":"info","event":"request","method":"POST","path":"/api/validate","ms":34}
{"ts":"2026-07-14T09:00:03Z","level":"warn","event":"slow_query","table":"events","ms":812}
{"ts":"2026-07-14T09:00:05Z","level":"error","event":"exception","type":"TimeoutError","retry":true}
{"ts":"2026-07-14T09:00:06Z","level":"info","event":"request","method":"GET","path":"/xml","ms":9}
{"ts":"2026-07-14T09:00:08Z","level":"info","event":"user_signup","plan":"free","referrer":"blog"}`;
