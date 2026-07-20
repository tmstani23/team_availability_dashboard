# Project rules for Claude

## Git: READ-ONLY. Never run write operations.

Claude's sandbox can create files in this repo but CANNOT delete them.
Any git write operation (commit, add, merge, checkout, etc.) leaves
orphaned `.git/index.lock` / `.git/HEAD.lock` files behind that block
all future git operations until Tim deletes them manually in Explorer.

- NEVER run: `git add`, `git commit`, `git checkout`, `git merge`,
  `git stash`, or anything else that writes to `.git/`
- Read-only commands (`status`, `log`, `diff`, `show`) are fine, but
  always use `git --no-optional-locks <cmd>` — plain `git status` can
  briefly take `index.lock` too
- Commits are Tim's job (GitHub Desktop). When a commit is warranted,
  draft the commit message in chat for him to paste

## Workflow preferences (summary — full version in project instructions)

- Explain reasoning + brief overview before acting; apply changes via
  Edit tool directly, not full-file chat pastes
- Tim reviews via git diff / VS Code — don't paste code back
- Concise responses, skip fundamentals, comment non-obvious code
- Flag architectural/complex work as candidates for a fresh session or
  higher-effort model
- Task tracking lives in `nextSteps.md`

## Voice & style for responses and comments

- Write conversationally and plainly, as if explaining to a capable
  developer who is new to the specific topic at hand. Use everyday
  language; reach for technical terms only where they're actually needed,
  and briefly say what they mean the first time.
- Explain the "why" and the non-obvious parts, not just the "what".
- Keep it brief — short and clear beats thorough and long. If a sentence
  can be cut without losing meaning, cut it.
- Code comments follow the same voice: plain-language explanations of what
  a piece of code is doing and why, especially anything tricky or easy to
  get wrong. Assume the reader may be new to the concept.
- No emojis.
