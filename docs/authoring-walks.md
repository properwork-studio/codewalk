# Authoring walks

English | [繁體中文](./authoring-walks.zh-TW.md)

CodeWalk is a player — it never generates walks for you. This page gives you a
prompt to hand to an AI so you don't have to write `.codewalk.json` by hand.

Nothing here is Claude-specific. Any assistant that can read your repository and
write a file will do.

> **Prefer writing it yourself?** The format is small and fully specified in
> [`shared/schema.ts`](../shared/schema.ts). This page is a shortcut, not the
> contract.

## Pick a scope

The prompt below covers three scopes. Edit the `SCOPE:` line, leave the rest
alone.

| Scope | Use it when | Typical size |
| --- | --- | --- |
| `whole-codebase` | A new person's first day — one guided path through the project | 15–25 steps |
| `git-diff` | Getting a reviewer through a large change before they review it | 5–12 steps |
| `area: <what>` | One module, feature, or flow you name | 8–15 steps |

## The prompt

Copy everything in the block, edit the `SCOPE` line, and give it to your AI
assistant with the repository open.

````text
Generate a CodeWalk walkthrough for this repository and write it to
`.codewalk/<YYYY-MM-DD>-<short-topic>.codewalk.json`.

SCOPE: whole-codebase
  Replace the line above with exactly one of:
    whole-codebase          — a first-day path through the project
    git-diff                — the current diff (uncommitted, or `git diff main...HEAD`)
    area: <what to cover>   — e.g. "area: the authentication flow"

Before writing anything, run `git rev-parse HEAD` and use that full SHA as `ref`.

## Tools you may have

Check what is available before you start. None of these are required — this
prompt works without them — but they remove the two failure modes that break
walks most often: wrong line numbers and retyped anchors.

- **CodeGraph MCP** (`codegraph_explore`) — use it for every step you write.
  Query the symbol, then take the **line-numbered source** it returns for
  `startLine`/`endLine` and the **verbatim source** for `anchor`. Never count
  lines yourself. Its call paths tell you which code reaches which; treat that
  as input to your ordering, not as the order itself — execution order and
  teaching order are different things. For `git-diff` scope, its blast-radius
  summary shows what else the change touches.
- **DeepWiki MCP** — if this repository is indexed, read it first for the
  architectural picture, then decide which thread through it is worth walking.
- **Neither available** — read the files directly, copy anchors rather than
  retyping them, and verify everything against the checklist at the end.

## What a walk is

A sequence of steps. Each step points at a real line range in a real file and
explains it. The reader presses the arrow keys; the editor jumps and highlights
as they go. It ends with a quiz that checks they actually understood.

Write for someone competent who has never seen this code. Explain **why**, not
what — the code is on screen next to your words. "This function validates the
token" is worthless. "Validation happens here rather than in the middleware
because the middleware runs before the tenant is resolved" is the point.

## Scope-specific guidance

- **whole-codebase** — this is a **first-day path, not complete documentation**.
  Order the steps so understanding compounds: entry point first, then the main
  flow end to end, then the pieces that only make sense once the flow is clear.
  Do not walk files alphabetically or by directory. Skip anything a reader can
  infer (config boilerplate, barrel files). Completeness is not the goal, and
  chasing it makes the walk worse — a reader who wants to *look something up*
  has other tools. What they cannot get elsewhere is a considered order.

- **git-diff** — the subject is the change, not the codebase. Lead with the
  problem it solves, then walk the change in the order that makes it make sense.
  Include enough unchanged surrounding code that the change has context. Use
  `diff` items for the actual modifications.

- **area: <what>** — stay inside what was named. When something outside it
  matters, explain the contract at the boundary rather than walking into it.

## Required format

```json
{
  "title": "Short, specific — what the reader will understand afterwards",
  "ref": "<full SHA from git rev-parse HEAD>",
  "steps": [
    {
      "title": "Short title for this step",
      "file": "src/server.ts",
      "startLine": 12,
      "endLine": 20,
      "narration": "Why this code is the way it is.",
      "anchor": "<the exact text of lines 12-20, verbatim>",
      "terms": [{ "term": "middleware", "explanation": "..." }],
      "items": []
    }
  ],
  "quiz": [
    {
      "question": "...",
      "options": ["...", "..."],
      "correctIndex": 0,
      "optionExplanations": ["Why this is right", "Why this is wrong"]
    }
  ],
  "regenerateHint": "<a plain-language instruction for regenerating this walk>"
}
```

Rules that matter, in the order they tend to get broken:

1. **`anchor` must be the verbatim source text** of lines `startLine` through
   `endLine` — every character, including indentation and comments. Copy it;
   never retype or reformat it. This is what lets CodeWalk tell "the code moved"
   from "the code changed". A walk without anchors still plays, but loses all
   staleness detection.
2. **Line numbers are 1-based and inclusive**, and must match the anchor exactly.
   Off-by-one here silently mis-highlights every step.
3. **`file` is relative to the repository root**, forward slashes, no leading
   `/` and no `..` segment. Absolute paths and traversal are rejected by the
   player.
4. **At least one step and at least one quiz question** are required.
5. `optionExplanations`, when present, must have exactly one entry per option.

## Optional per-step items

Each step may carry an `items` array. Use them sparingly — they are seasoning,
not the meal.

| `kind` | Shape | Use for |
| --- | --- | --- |
| `tip` | `{ kind, text }` | Something worth knowing but not needed to follow the step |
| `pitfall` | `{ kind, misconception, reality }` | A wrong belief readers actually hold about this code |
| `todo` | `{ kind, text }` | Known unfinished work in the code being walked |
| `reference` | `{ kind, label, url }` | External docs. http/https only — other schemes fail validation |
| `snippet` | `{ kind, label, file, startLine, endLine, anchor }` | Quote code elsewhere that this step depends on |
| `diff` | `{ kind, label, file, startLine, endLine, oldStartLine, diffText }` | A before/after change |

For `diff`, `diffText` is the hunk body only — no `diff --git`, `---`/`+++`, or
`@@` headers. Prefix each line with `+`, `-`, or a space, and include at least
one `+` or `-` line. `oldStartLine` is where the hunk starts in the pre-change
file; `startLine` is where it starts after.

**Link out rather than restate.** When a reader would need the full structure of
a module, a `reference` item pointing at an external source — a generated wiki,
the project's own docs — serves them better than a narration trying to summarise
it. The walk's job is the path and the reasoning, not complete coverage.

## Terms

`terms` become collapsible cards next to the step. Annotate a term only if
someone competent in the language but new to this project would not know it —
domain jargon, project-specific names, non-obvious library concepts. Do not
annotate general programming vocabulary.

Explain each term **once**, at the step where it first appears. Two or three
plain sentences, plus why it matters here.

## The quiz

The quiz is not decoration — it is how the reader finds out whether they
actually understood, and it is the main thing that makes a walk better than a
document.

- Aim for 5 questions for a full walk, 3 for a short one.
- Each must be answerable **only** by someone who understood the walk. If it
  can be guessed from general knowledge, it is a wasted question.
- No trick questions, no "which of these is NOT", no near-identical options.
- Ask about *why* and *what would break*, not *what line is this on*.
- Give every option an entry in `optionExplanations` — including the correct
  one. The reason a wrong answer is wrong is where most of the learning is.
- `passThreshold` defaults to a simple majority; set it only if you want stricter.

## Markdown in text fields

A closed subset. Anything else renders as literal text rather than breaking.

- **Long fields** (`narration`, `term.explanation`, `tip`/`todo.text`,
  `pitfall.misconception`/`reality`, `optionExplanations`) support: inline
  `` `code` ``, `**bold**`, `[links](https://...)`, `- bullet lists`,
  `1. numbered lists`, and `## level-2 headings`.
- **Short fields** (`title`, `term.term`, `question`, `options`, any `label`)
  support only inline code, bold, and links.

Write the walk in whatever language suits its readers. The player's own
interface follows the editor's display language independently.

## Before you finish

Check each of these against the file you produced:

- [ ] Every `anchor` is byte-identical to the lines it claims
- [ ] Every `startLine`/`endLine` matches its anchor's real position
- [ ] Every `file` exists, is repo-relative, and has no `..`
- [ ] `ref` is the full SHA of the current HEAD
- [ ] Steps are ordered so understanding compounds
- [ ] No narration merely restates what the code plainly says
- [ ] Every quiz question requires having read the walk
- [ ] Every option has an explanation
````

## Once it's generated

Open the CodeWalk panel and pick the walk. If the file doesn't match the schema,
the panel shows exactly what's wrong, keyed by JSON path (for example
`steps[2].narration must be a non-empty string`) — paste that back to your AI
and ask it to fix it.

If steps are flagged as stale immediately after generating, the anchors don't
match the file. That is almost always retyped rather than copied anchor text, or
line numbers off by one.

## Keeping a walk alive

A walk describes the code at one moment. As the project moves, it drifts.

CodeWalk follows code that merely **moved** — same text, new position — with no
warning and no action from you. When the text itself **changes**, the step is
flagged as stale and the panel offers to copy the walk's `regenerateHint` so you
can hand it straight back to an AI.

Treat walks as disposable. Regenerating is cheaper and more honest than patching
line numbers by hand, which is why `regenerateHint` is worth filling in.
