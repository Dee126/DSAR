# CLAUDE.md

This file provides guidance for AI assistants working on the DSAR (Data Subject Access Request) repository.

## Repository Overview

**Project**: DSAR
**Repository**: Dee126/DSAR
**Status**: Initial setup — this is a new repository under active development.

DSAR typically refers to Data Subject Access Requests, a key mechanism under privacy regulations (GDPR, CCPA, etc.) that allows individuals to request access to their personal data held by an organization.

## Project Structure

This repository is in its initial state. As the project grows, update this section to reflect the directory layout.

```
DSAR/
├── CLAUDE.md          # AI assistant guidance (this file)
└── (project files to be added)
```

## Development Workflow

### Git Conventions

- **Branch naming**: Feature branches should use descriptive names (e.g., `feature/add-request-handler`, `fix/validation-error`)
- **Commit messages**: Use clear, imperative-mood messages (e.g., "Add request validation logic", "Fix date parsing in export module")
- **Pull requests**: Include a summary of changes and any testing performed

### Getting Started

1. Clone the repository
2. Check out or create your working branch
3. Make changes, commit, and push

## Key Conventions for AI Assistants

### Before Making Changes

- Read and understand existing files before modifying them
- Check for related tests when modifying functionality
- Respect existing code style and patterns

### Code Quality

- Do not introduce security vulnerabilities (OWASP top 10)
- Keep changes focused and minimal — avoid unrelated refactors
- Add tests for new functionality when a test framework is in place
- Handle personal data carefully given the privacy-sensitive nature of this project

### Privacy and Security Considerations

Given that this is a DSAR project dealing with personal data:

- Never hardcode credentials, API keys, or secrets
- Never commit `.env` files or files containing personal data
- Follow the principle of least privilege for data access
- Ensure any data processing complies with applicable privacy regulations
- Log access to personal data for audit purposes where appropriate
- Implement proper data sanitization and validation at system boundaries

## Build and Test

_No build system or test framework has been configured yet. Update this section once tooling is established._

## Dependencies

_No dependencies have been added yet. Update this section once a package manager and dependencies are established._

## CI/CD

_No CI/CD pipeline has been configured yet. Update this section once pipelines are set up._

---

**Last updated**: 2026-02-11 (initial creation)
