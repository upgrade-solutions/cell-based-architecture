# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## README
See the main `README.md` file for guidance on this specific repository.

## Development Flow
1. For every new session and/or feature prompted, consult the main README and any docs local to the folders being modified
2. Commit changes after scoped 
changes are complete. Make all changes on the `main` branch for now.
3. Make sure to update the README.md after any/every change

## Spec-Driven Development (default)
This project uses **OpenSpec** (`@fission-ai/openspec`) as the default spec-driven development framework. For any non-trivial feature or change, prefer the OpenSpec workflow over ad-hoc implementation:

- `/opsx:explore` — think through ideas / clarify requirements before committing to a change
- `/opsx:propose <name-or-description>` — create a change with `proposal.md`, `design.md`, `tasks.md`
- `/opsx:apply` — implement the tasks for the active change
- `/opsx:archive` — finalize and archive once shipped

Project-level OpenSpec context lives in `openspec/config.yaml`; specs in `openspec/specs/`; in-flight changes in `openspec/changes/`. Skip the OpenSpec flow only for trivial fixes, doc tweaks, or one-off experiments.

## Conventions
* In general, run commands separately, without `&&`