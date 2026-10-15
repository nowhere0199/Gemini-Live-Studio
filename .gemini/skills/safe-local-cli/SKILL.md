---
name: safe-local-cli
description: Use the approved local CLI/CMD inspection tools exposed by Gemini Live Studio. Prefer read-only checks, explicit approval, bounded output and no free-form shell execution.
---

# Safe local CLI operations

## Approved tools currently exposed by Gemini Live Studio
- list_local_cli_capabilities: report whether Node.js, npm, Git, Python, Gemini CLI, Hermes CLI, Claude Code CLI, PowerShell and CMD are discoverable.
- run_approved_cli_check: run a fixed, read-only check selected from a whitelist. Checks include version queries, JavaScript syntax checks for this app, and git status for this app.
- list_available_skills: list skill names/descriptions from an explicitly selected allowlisted skill root.
- read_local_skill: read one SKILL.md file from a fixed allowlisted root after validating the skill folder and real path.

## Rules
1. Never request or synthesize arbitrary CMD, PowerShell, Node eval code, Python code, shell pipelines, or arbitrary executable arguments through this tool bridge.
2. Use the exact named check enum; do not try to smuggle additional flags or a path into a check.
3. Local capability/skill calls must be explicitly enabled by the user in Settings > Tools.
4. The UI shows each tool call and its arguments. Run the local operation through the review button, inspect its output, and explicitly return the selected JSON result to Gemini.
5. Tool results are sent to the model only when the user selects Return result. Do not send local secrets, credentials, environment files, personal documents, or arbitrary source trees.
6. Skill installation, unlinking, file modification, deployments, process termination and commands with side effects are out of scope for this read-only bridge. They require a separate reviewed workflow.
7. Limit output to useful excerpts; redact API keys and bearer tokens.
