# AGENTS.md

Purpose:
This file documents how coding agents should operate in this repo. It is the first file to read in any new session.

Rules:
- Commit after each completed task.
- Update `docs/PROJECT_PROGRESS.md` after each commit with a short summary and commit hash.
- Commit hashes are only known after commit. If needed, update the log in a follow-up "docs" commit.
- The work log tracks substantive task commits; pure log-maintenance commits do not need log entries.
- Keep changes isolated to requested areas; do not redesign UI unless explicitly asked.
- All database writes must be atomic (Prisma transaction).
- Add i18n keys (ar/en) for any new labels.
- If you notice unrelated changes you did not make, stop and ask the user before proceeding.
- When user action is required, provide step-by-step instructions.

Session startup checklist (after context compact or new chat):
1) Read `AGENTS.md`.
2) Read `docs/PROJECT_PROGRESS.md`.
3) Run `git status -sb`.
4) Run `git log -1 --oneline`.
5) Run `git diff` (and `git diff --stat` if needed).
6) Continue from the next pending item in `docs/PROJECT_PROGRESS.md`.

Commit workflow:
1) Ensure the task is complete and working.
2) Update `docs/PROJECT_PROGRESS.md` with status and commit hash.
3) Run `git status -sb` to verify scope.
4) `git add -A`
5) `git commit -m "type: short summary"` (type examples: feat, fix, chore, docs)
6) Confirm the working tree is clean.
