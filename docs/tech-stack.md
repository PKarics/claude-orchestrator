# Technology Stack

This document describes the technology choices for the Claude Orchestrator system.

## Core Technologies

### Backend Framework: NestJS + TypeScript

**Why NestJS?**
- Enterprise-grade Node.js framework with excellent TypeScript support
- Built-in dependency injection and modular architecture
- Excellent documentation and large community
- Native support for microservices patterns
- Built-in testing utilities
- Perfect for scalable applications

**Why TypeScript?**
- Type safety catches errors at compile time
- Excellent IDE support with autocomplete
- Better code maintainability
- Self-documenting code through types
- Easier refactoring

### Database: PostgreSQL + TypeORM

**Why PostgreSQL over SQLite?**
- Better concurrency handling (multiple orchestrators in future)
- JSONB support for flexible data storage
- Better performance for production workloads
- Support for connection pooling
- Row-level locking for distributed systems

**For PoC:** We can start with SQLite and migrate later using TypeORM migrations.

**Why TypeORM?**
- Works seamlessly with NestJS
- Type-safe database queries
- Easy migrations
- Support for multiple databases (SQLite → PostgreSQL migration path)

### Message Queue: Redis + BullMQ

**Why BullMQ over raw Redis lists?**
- Built-in retry logic and error handling
- Job prioritization out of the box
- Better observability (job progress, metrics)
- Delayed jobs support
- Excellent TypeScript support
- Battle-tested in production

**Why Redis?**
- Fast in-memory operations
- Reliable pub/sub mechanism
- Low latency for task distribution
- Simple deployment
- Affordable (free tiers available)

## Tech Stack Summary

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime |
| **Language** | TypeScript | 5.3+ | Type-safe development |
| **Backend Framework** | NestJS | 10.x | REST API & business logic |
| **Database (Dev)** | SQLite + TypeORM | - | Local development |
| **Database (Prod)** | PostgreSQL + TypeORM | 16+ | Production data storage |
| **Message Queue** | Redis + BullMQ | 5.x / 5.x | Task distribution |
| **API Documentation** | Swagger/OpenAPI | - | Auto-generated API docs |
| **Testing** | Jest | 29.x | Unit & integration tests |
| **Code Quality** | ESLint + Prettier | - | Linting & formatting |
| **Process Manager** | PM2 | - | Production process management |
| **Containerization** | Docker | - | Deployment |

## Worker Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js | JavaScript runtime |
| **Language** | TypeScript | Type-safe development |
| **Redis Client** | ioredis + BullMQ | Queue integration |
| **Task Execution** | child_process | Execute code safely |
| **CLI Framework** | Commander.js | CLI argument parsing |
| **Logging** | Winston | Structured logging |

## Development Tools

| Tool | Purpose |
|------|---------|
| **pnpm** | Fast, disk-efficient package manager |
| **tsx** | Fast TypeScript execution for development |
| **ts-node** | TypeScript execution for scripts |
| **nodemon** | Auto-restart on file changes |
| **Docker Compose** | Local multi-service orchestration |

## Frontend Dashboard (Simple)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | React + Vite | Fast, modern UI |
| **Styling** | TailwindCSS | Utility-first CSS |
| **HTTP Client** | Axios | API communication |
| **State Management** | React Query | Server state caching |

## Infrastructure (Production)

| Service | Technology | Cost Estimate |
|---------|-----------|---------------|
| **Orchestrator** | DigitalOcean Droplet | $6/mo |
| **Redis** | Upstash (Serverless) | $0-10/mo |
| **Database** | Supabase (PostgreSQL) | $0-25/mo |
| **Cloud Worker** | AWS Lambda or DO Droplet | $0-5/mo |
| **Monitoring** | Sentry (free tier) | $0 |

**Total PoC Cost:** $0-20/month

## Why This Stack?

### 1. Type Safety Throughout
TypeScript in both orchestrator and worker means:
- Catch bugs before runtime
- Better IDE support
- Easier onboarding for new developers
- Self-documenting code

### 2. NestJS Benefits
- Familiar structure for developers coming from Spring/ASP.NET
- Dependency injection makes testing easier
- Modular architecture scales well
- Built-in guards, interceptors, pipes for common patterns

### 3. Modern Node.js
- Node.js 20 LTS has excellent performance
- Native ES modules support
- Built-in test runner (though we use Jest)
- Good async/await support

### 4. BullMQ Over Raw Redis
```typescript
// Without BullMQ (raw Redis)
await redis.rpush('tasks', JSON.stringify(task));
const result = await redis.blpop('tasks', 5);
// Manual retry logic, error handling, etc.

// With BullMQ
await taskQueue.add('execute', task, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  priority: task.priority
});
// Retry, backoff, priority built-in!
```

### 5. TypeORM Migration Path
```typescript
// Start with SQLite for PoC
{
  type: 'sqlite',
  database: 'data/tasks.db'
}

// Switch to PostgreSQL later (just change config!)
{
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'orchestrator'
}
// All queries work the same!
```

## Package Versions (package.json)

### Orchestrator Dependencies
```json
{
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.1.17",
    "@nestjs/typeorm": "^10.0.1",
    "@nestjs/config": "^3.1.1",
    "typeorm": "^0.3.19",
    "sqlite3": "^5.1.7",
    "pg": "^8.11.3",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "uuid": "^9.0.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.2.1",
    "@nestjs/testing": "^10.3.0",
    "@types/node": "^20.10.6",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "tsx": "^4.7.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

### Worker Dependencies
```json
{
  "dependencies": {
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "commander": "^11.1.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  }
}
```

## Development Workflow

### 1. Local Development
```bash
# Install dependencies
pnpm install

# Start Redis
docker compose up redis -d

# Run orchestrator in dev mode (auto-reload)
cd apps/orchestrator
pnpm dev

# Run worker in dev mode
cd apps/worker
pnpm dev
```

### 2. Testing
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

### 3. Building for Production
```bash
# Build TypeScript
pnpm build

# Output goes to dist/ directory
node dist/main.js
```

## Comparison with Python Stack

| Aspect | Python/FastAPI | NestJS/TypeScript | Winner |
|--------|---------------|-------------------|---------|
| **Type Safety** | Optional (mypy) | Built-in | TypeScript ✅ |
| **Async Support** | asyncio | Native async/await | Tie |
| **Learning Curve** | Gentle | Steeper (DI concepts) | Python |
| **Performance** | Fast | Very fast | Tie |
| **Scalability** | Good | Excellent | TypeScript ✅ |
| **Ecosystem** | Huge | Huge | Tie |
| **Job Market** | Hot | Very hot | TypeScript ✅ |
| **Microservices** | DIY | Built-in | TypeScript ✅ |
| **Testing** | pytest (excellent) | Jest (excellent) | Tie |

## Future Enhancements

### Potential Additions
- **GraphQL API** - NestJS has excellent GraphQL support
- **WebSockets** - Real-time task updates to dashboard
- **gRPC** - For high-performance worker communication
- **CQRS** - For complex workflows (NestJS has built-in support)
- **Event Sourcing** - For audit trails
- **OpenTelemetry** - For distributed tracing

### Migration Paths
1. **SQLite → PostgreSQL** - Change TypeORM config
2. **Redis Lists → BullMQ** - Already using BullMQ
3. **Monolith → Microservices** - NestJS microservices package
4. **REST API → GraphQL** - NestJS GraphQL package

## Conclusion

The NestJS/TypeScript stack provides:
✅ **Type safety** - Catch errors early
✅ **Scalability** - Built for enterprise applications
✅ **Developer experience** - Excellent tooling and IDE support
✅ **Performance** - Node.js is fast
✅ **Community** - Large ecosystem and active community
✅ **Migration path** - Easy to evolve as needs grow

This stack is production-ready, junior-developer-friendly, and cost-effective for a PoC.