# Contributing to Docling Ingest

Thanks for your interest in contributing! Here's how to get started.

## Reporting Issues

- Use [GitHub Issues](https://github.com/liyanfeng129/docling-ingest/issues) to report bugs or request features
- Search existing issues before opening a new one
- Include steps to reproduce, expected behavior, and actual behavior for bug reports

## Development Setup

1. Fork and clone the repo
2. Follow the **Manual Setup** instructions in the [README](README.md#manual-setup)
3. Create a branch for your changes: `git checkout -b my-feature`

### Project Structure

```
backend/
  engine/     # Python/FastAPI — PDF processing, embeddings, ChromaDB
  proxy/      # Node.js/Express — API proxy and config aggregation
frontend/     # React + Vite + Tailwind CSS
```

### Running Locally

The fastest way to get everything running is Docker Compose:

```bash
docker compose up --build
```

Or run each service individually — see the README for details.

## Submitting Changes

1. Keep PRs focused — one feature or fix per PR
2. Test your changes locally before submitting
3. Write a clear PR description explaining what changed and why
4. Link related issues (e.g., "Fixes #12")

## Code Style

- **Frontend:** Follow existing patterns. Use functional React components and hooks
- **Proxy:** Standard Express/Node.js conventions
- **Engine:** Follow PEP 8 for Python code

## Questions?

Open a [discussion](https://github.com/liyanfeng129/docling-ingest/discussions) or an issue. We're happy to help.
