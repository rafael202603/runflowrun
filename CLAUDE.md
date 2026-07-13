# runflowrun — Context for Claude Code

## PENDINGS — shared backlog
When user says "actualiza PENDINGS", "completar XX-NN", or similar:
1. Read: `C:\Users\Rafael\.claude\projects\C--Users-Rafael-CLAUDECODE\memory\backlog.md`
2. Mark completed tasks as `COMPLETADA YYYY-MM-DD` with a brief note
3. Add new tasks with next available ID (RF-NN)
4. Keep unfinished tasks as-is
5. Write back, then run: `python C:\Users\Rafael\CLAUDECODE\refresh_index.py`
Do NOT create separate PENDINGS.md files.

## Repo purpose
Web app to run Keboola flows manually. React+Vite+TS. Portable HTML/EXE build. Ushuaia Runner prototype.

## ID prefix for pendings: RF-NN
