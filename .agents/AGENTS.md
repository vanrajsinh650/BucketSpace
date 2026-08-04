# Agent Behavioral Rules

## 1. Automated Git Commit and Push Protocol
Whenever a user task or coding request is completed, automatically stage all changes (`git add .`), commit them with a clear, descriptive commit message (`git commit -m "..."`), and push the changes to the remote Git repository (`git push origin <branch>`).

## 2. Active Architectural & Project State Maintenance
Maintain a dedicated project state document (`context/PROJECT_STATE.md`) as part of the living `/context` hub.
- Whenever architectural changes, goal shifts, new technical rules, or scope updates occur, immediately update `context/PROJECT_STATE.md` (and relevant `/context` files).
- Remove or archive deprecated architectural assumptions and replace them with the new active decisions.
- Do NOT record casual or conversational dialogue—record only actionable technical goals, architecture changes, rules, decisions, and production-readiness requirements.
