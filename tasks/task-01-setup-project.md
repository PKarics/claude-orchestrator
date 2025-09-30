# Task 01: Project Setup and Configuration (NestJS/TypeScript)

**Difficulty:** Beginner
**Estimated Time:** 2-3 hours
**Prerequisites:** Basic knowledge of Node.js, TypeScript, Git, and command line

## Goal

Set up a NestJS monorepo project structure with TypeScript, configure the development environment, and prepare for implementing the orchestrator and worker components.

## Step-by-Step Instructions

### Step 1: Verify Node.js and pnpm Installation

```bash
# Check Node.js (should be 20+)
node --version

# Install pnpm if needed
npm install -g pnpm
pnpm --version
```

### Step 2: Create Project and Initialize Git

The repository is already created at `git@github.com:PKarics/claude-orchestrator.git`. The directory structure has been set up in `~/dev/claude-orchestrator`.

### Step 3: Review Documentation

The following documentation has been created:
- [docs/architecture-overview.md](../docs/architecture-overview.md) - System architecture
- [docs/tech-stack.md](../docs/tech-stack.md) - Technology choices
- [docs/getting-started.md](../docs/getting-started.md) - Setup guide
- [docs/api-reference.md](../docs/api-reference.md) - API documentation
- [docs/development-guide.md](../docs/development-guide.md) - Development practices

### Next Task

Proceed to **Task 02** to implement the NestJS orchestrator with database and queue integration.

For full setup instructions, see the getting-started guide.