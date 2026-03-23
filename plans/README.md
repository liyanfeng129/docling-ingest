# Feature Plans

Each feature gets its own numbered folder containing planning and implementation documents.

## Structure

```
plans/
├── README.md
├── 001-feature-name/
│   ├── 01-user-stories.md      # User stories and acceptance criteria
│   ├── 02-requirements.md      # Technical requirements derived from stories
│   ├── 03-implementation-plan.md  # Step-by-step implementation plan
│   └── 04-changelog.md         # (optional) Notable decisions or changes during implementation
├── 002-feature-name/
│   └── ...
```

## Conventions

- **Numbering**: Features are numbered sequentially (`001`, `002`, ...). Documents within a feature use `01`, `02`, `03`.
- **Status**: Each feature folder name is the feature name. Add a `status: done | in-progress | planned` line at the top of `01-user-stories.md` to track overall status.
- **Minimal docs**: Not every feature needs all documents. A small feature may only have an implementation plan.

## Features

| # | Feature | Status |
|---|---------|--------|
| 001 | Query Testing Page | done |
| 002 | LLM Query Export | planned |
