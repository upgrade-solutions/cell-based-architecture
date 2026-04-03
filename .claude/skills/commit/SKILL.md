---
name: commit
description: Stage relevant modified files and create a git commit with a concise message
---

Run `git status` and `git diff HEAD` to see all changes, then:

1. Stage all modified tracked files (excluding node_modules, dist, build artifacts, lock files, and any files that look like secrets)
2. Write a concise commit message: one short subject line summarizing the change, following the style of recent commits in `git log --oneline -5`
3. Commit using a heredoc so formatting is preserved, appending `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
4. Run `git status` after to confirm it succeeded

Do not push. Do not amend existing commits.
