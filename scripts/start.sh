#!/bin/bash

set -e

echo "🚀 Starting Claude Orchestrator..."

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Start Docker containers
echo -e "${BLUE}📦 Starting Docker containers...${NC}"
docker compose up -d

# Wait for Valkey to be ready
echo -e "${YELLOW}⏳ Waiting for Valkey to be ready...${NC}"
for i in {1..30}; do
    if docker compose exec -T valkey valkey-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Valkey is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Valkey not responding, but continuing...${NC}"
    fi
    sleep 1
done

# Build all packages
echo -e "${BLUE}🔨 Building packages...${NC}"
pnpm build

# Start orchestrator in background
echo -e "${BLUE}🎯 Starting orchestrator on port 3000...${NC}"
cd "$PROJECT_ROOT/apps/orchestrator"
pnpm start > "$PROJECT_ROOT/data/orchestrator.log" 2>&1 &
ORCHESTRATOR_PID=$!
echo $ORCHESTRATOR_PID > "$PROJECT_ROOT/data/orchestrator.pid"

# Wait for orchestrator to be ready
echo -e "${YELLOW}⏳ Waiting for orchestrator to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Orchestrator is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Orchestrator not responding${NC}"
        cat "$PROJECT_ROOT/data/orchestrator.log"
        exit 1
    fi
    sleep 1
done

# Start worker in background
echo -e "${BLUE}⚙️  Starting worker...${NC}"
cd "$PROJECT_ROOT/apps/worker"
pnpm start > "$PROJECT_ROOT/data/worker.log" 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > "$PROJECT_ROOT/data/worker.pid"

echo ""
echo -e "${GREEN}✨ All services started successfully!${NC}"
echo ""
echo "📊 Service Status:"
echo "  - Valkey: running on port 6379"
echo "  - Orchestrator: http://localhost:3000 (PID: $ORCHESTRATOR_PID)"
echo "  - Worker: running (PID: $WORKER_PID)"
echo ""
echo "📝 Logs:"
echo "  - Orchestrator: tail -f $PROJECT_ROOT/data/orchestrator.log"
echo "  - Worker: tail -f $PROJECT_ROOT/data/worker.log"
echo ""
echo "🛑 To stop all services, run: ./scripts/stop.sh"