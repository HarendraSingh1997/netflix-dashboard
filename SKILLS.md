# SKILLS.md — installed agent skills

Source of truth for skill content is the files under `.agents/skills/`. Pinned sources are recorded in `skills-lock.json`.

| Skill | Source | Path | When to use |
| --- | --- | --- | --- |
| `improve` | `shadcn/improve` (github) | `.agents/skills/improve/SKILL.md` | Auditing the codebase, prioritizing tech-debt / bugs / security / perf / coverage, producing handoff plans for another agent. Read-only advisor; see `references/audit-playbook.md`, `references/plan-template.md`. |
| `typesafe-ai` | `typesafe-ai/skills` (github) | `.agents/skills/typesafe-ai/SKILL.md` | Designing TypeSafe Jev judgments (Discovery title matching, Ask RAG/agent/KG). Start from `https://docs.typesafe.ai/llms.txt`, then the primitive/cookbook pages. Code retrieves, Jev judges. |

## Notes

- `typesafe-ai` uses System One models (Jev `jev-latest`): typed judgments + probabilities, not free-text generation. Keep credentials server-side in web apps; here the key is BYO in the browser and only title/question strings are sent (see `README.md` AI section and `vite.config.ts` proxy).
- Adding a skill: place it under `.agents/skills/<name>/SKILL.md` and record the source + hash in `skills-lock.json`. Reference it in the table above.
