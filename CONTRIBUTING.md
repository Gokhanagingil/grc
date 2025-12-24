# Contributing to GRC Platform

Thank you for your interest in contributing to the GRC Platform! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- PostgreSQL (for backend-nest)
- Git

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Gokhanagingil/grc.git
   cd grc
   ```

2. Install dependencies for the frontend:
   ```bash
   cd frontend
   npm install
   ```

3. Install dependencies for the backend (NestJS - production path):
   ```bash
   cd backend-nest
   npm install
   ```

4. Set up environment variables:
   ```bash
   cp backend-nest/.env.example backend-nest/.env
   # Edit .env with your local PostgreSQL credentials
   ```

5. Run database migrations:
   ```bash
   cd backend-nest
   npm run migration:run
   ```

6. Seed demo data (optional):
   ```bash
   npm run seed:grc
   ```

### Running the Application

Start the backend:
```bash
cd backend-nest
npm run start:dev
```

In a separate terminal, start the frontend:
```bash
cd frontend
npm start
```

The frontend will be available at http://localhost:3000 and the backend API at http://localhost:3002.

## Branching Strategy

We use a trunk-based development approach with feature branches:

- `main` - Production-ready code. All PRs merge here.
- `devin/{timestamp}-{feature-name}` - Feature branches created by Devin AI.
- `feature/{feature-name}` - Feature branches for manual development.
- `fix/{issue-description}` - Bug fix branches.
- `hotfix/{issue-description}` - Urgent production fixes.

### Branch Naming Conventions

- Use lowercase letters and hyphens.
- Keep names descriptive but concise.
- Include ticket/issue numbers when applicable.

Examples:
- `feature/audit-phase2-ui`
- `fix/login-token-refresh`
- `hotfix/security-header-missing`

## Pull Request Process

### Before Creating a PR

1. Ensure your code follows the existing style conventions.
2. Run linting:
   ```bash
   cd frontend && npx eslint src/ --ext .ts,.tsx
   ```
3. Run tests:
   ```bash
   cd backend-nest && npm run test
   cd backend-nest && npm run test:e2e
   ```
4. Update documentation if you've changed APIs or added features.
5. Ensure no secrets or credentials are committed.

### PR Checklist

Use this checklist when creating your PR:

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if applicable)
- [ ] Tests added/updated for new functionality
- [ ] All tests pass locally
- [ ] No secrets or credentials committed
- [ ] PR title is clear and descriptive
- [ ] Related issues are linked

### PR Review Process

1. Create a PR against `main` branch.
2. Fill out the PR template completely.
3. Request review from at least one team member.
4. Address review feedback promptly.
5. Ensure CI checks pass before merging.
6. Squash and merge when approved.

## Running Tests

### Frontend Tests

```bash
cd frontend
npm test              # Run tests in watch mode
npm test -- --coverage  # Run with coverage report
```

### Backend Tests (NestJS)

```bash
cd backend-nest
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:cov      # Coverage report
```

### E2E Test Requirements

E2E tests require a PostgreSQL database. The test setup uses `.env.test` for configuration:

```bash
# Default test database settings
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=123456
DB_NAME=grc_test
```

## Code Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code.
- Follow existing naming conventions (camelCase for variables/functions, PascalCase for classes/interfaces).
- Prefer `const` over `let`; avoid `var`.
- Use async/await over raw Promises.
- Add type annotations; avoid `any` when possible.

### React Components

- Use functional components with hooks.
- Keep components focused and single-purpose.
- Extract reusable logic into custom hooks.
- Use Material-UI components consistently.

### NestJS Backend

- Follow NestJS module patterns.
- Use dependency injection.
- Add validation pipes to DTOs.
- Include proper error handling.

## Commit Messages

Write clear, concise commit messages:

- Use present tense ("Add feature" not "Added feature").
- Use imperative mood ("Move cursor to..." not "Moves cursor to...").
- Keep the first line under 72 characters.
- Reference issues when applicable.

Examples:
```
feat: add audit scope locking mechanism
fix: resolve token refresh race condition
docs: update API endpoint documentation
refactor: extract common validation logic
```

## Getting Help

- Check existing documentation in the `docs/` folder.
- Review the [Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md) for system design.
- Ask questions in PR comments or team communication channels.
- For security issues, see [SECURITY.md](SECURITY.md).

## License

By contributing to this project, you agree that your contributions will be licensed under the ISC License.
