# Agent Behavioral Rules

## 1. Automated Git Commit and Push Protocol
Whenever a user task or coding request is completed, automatically stage all changes (`git add .`), commit them with a clear, descriptive commit message (`git commit -m "..."`), and push the changes to the remote Git repository (`git push origin <branch>`).

## 2. Active Architectural & Project State Maintenance
Maintain a dedicated project state document (`context/PROJECT_STATE.md`) as part of the living `/context` hub.
- Whenever architectural changes, goal shifts, new technical rules, or scope updates occur, immediately update `context/PROJECT_STATE.md` (and relevant `/context` files).
- Remove or archive deprecated architectural assumptions and replace them with the new active decisions.
- Do NOT record casual or conversational dialogue—record only actionable technical goals, architecture changes, rules, decisions, and production-readiness requirements.

## 3. Human-Centric Clean Code & Modular Feature Structure
Every piece of code written MUST be clear, highly readable, well-commented, and intuitively structured by domain functionality.
- Avoid "AI-generated code bloat", overly convoluted abstractions, unnecessary boilerplate, or opaque patterns that human developers find frustrating to read.
- Organize folders by feature capability (`modules/bucket`, `modules/storage`, `components/file`) so any engineer can instantly understand the domain flow.
- Code should read as if crafted by a world-class human principal engineer—clean, idiomatic, self-documenting, and straightforward.
