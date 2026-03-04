# CLAUDE.md — dan-music-manager

This file provides guidance for AI assistants (Claude Code and others) working in this repository.

## Project Overview

**dan-music-manager** is an AI-supported music production manager ("KI-gestützter Musikproduktions-Manager"). The project is in its initial stage with no application code yet.

- **Language**: German is used in project descriptions; code should use English identifiers and comments unless the owner specifies otherwise.
- **Author**: DaN (`mailadresse671@gmail.com`)
- **Repository state**: Early / greenfield — only a README exists so far.

---

## Repository Structure

```
dan-music-manager/
├── README.md        # Project title and one-line description
└── CLAUDE.md        # This file — AI assistant guidance
```

As the project grows, expected top-level directories include:

| Directory       | Purpose                                      |
|-----------------|----------------------------------------------|
| `src/`          | Application source code                      |
| `tests/`        | Automated test suite                         |
| `docs/`         | Documentation beyond the README              |
| `scripts/`      | Build, deployment, or utility scripts        |

Update this table as directories are created.

---

## Development Workflow

### Branching

- **main** — stable, production-ready code.
- **Feature branches** — use the pattern `feature/<short-description>` or `claude/<task-id>` for AI-driven changes.
- Never commit directly to `main` without a pull request (once the project has collaborators).

### Commits

- Write commit messages in English.
- Use the imperative mood: "Add feature X", "Fix bug Y", "Refactor Z".
- Keep the subject line under 72 characters.
- Reference issue/task IDs where applicable.

### Pull Requests

- Include a short summary of *what* changed and *why*.
- Ensure all tests pass before merging.

---

## Coding Conventions

Because the tech stack is not yet decided, the following are general defaults. **Update this section as soon as a stack is chosen.**

- **Language**: To be determined. Likely Python, Node.js/TypeScript, or a similar modern stack suitable for an AI-enhanced desktop/web application.
- **Formatting**: Use the formatter standard for the chosen language (e.g., `black`/`ruff` for Python, `prettier` for JS/TS).
- **Linting**: Enable strict linting from the start.
- **Naming**: English identifiers (variables, functions, classes, files). German is acceptable in user-facing strings only.
- **Tests**: Write tests alongside new features. Aim for meaningful coverage, not 100% at the cost of speed.
- **Secrets**: Never commit credentials, API keys, or tokens. Use environment variables and a `.env` file (excluded via `.gitignore`).

---

## AI Assistant Guidelines

### What to do

- Read existing code before suggesting modifications.
- Prefer editing existing files over creating new ones unless a new file is clearly warranted.
- Keep changes focused on the task at hand; avoid unsolicited refactors.
- When the tech stack is unclear, ask the user before proceeding with implementation.
- Follow the branching convention above; develop on the specified feature branch and push when done.

### What to avoid

- Do not add comments, docstrings, or type annotations to code you did not change.
- Do not introduce backwards-compatibility shims for code that doesn't yet exist.
- Do not create helper utilities for one-off operations.
- Do not hard-code secrets or credentials.
- Do not push to `main` directly.

### When the stack is decided

Update the following sections in this file:

1. **Repository Structure** — reflect actual directories.
2. **Coding Conventions** — replace placeholders with concrete tools and rules.
3. **Running the Project** — add install, build, test, and run commands.

---

## Running the Project

_No application code exists yet. Update this section once the stack and entry point are established._

Typical commands to document here:

```bash
# Install dependencies
<package-manager> install

# Run tests
<test-runner>

# Start the application
<start-command>

# Lint / format
<lint-command>
```

---

## Key Contacts

| Role    | Name/Handle         | Contact                      |
|---------|---------------------|------------------------------|
| Owner   | DaN                 | mailadresse671@gmail.com     |

---

*Last updated: 2026-03-04. Keep this file current as the project evolves.*
