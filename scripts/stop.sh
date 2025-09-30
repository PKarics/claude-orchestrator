#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${BLUE}🛑 Stopping Claude Orchestrator...${NC}"

# Stop orchestrator
if [ -f "$PROJECT_ROOT/data/orchestrator.pid" ]; then
    ORCHESTRATOR_PID=$(cat "$PROJECT_ROOT/data/orchestrator.pid")
    if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping orchestrator (PID: $ORCHESTRATOR_PID)...${NC}"
        kill $ORCHESTRATOR_PID
        rm "$PROJECT_ROOT/data/orchestrator.pid"
    fi
fi

# Stop worker
if [ -f "$PROJECT_ROOT/data/worker.pid" ]; then
    WORKER_PID=$(cat "$PROJECT_ROOT/data/worker.pid")
    if kill -0 $WORKER_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping worker (PID: $WORKER_PID)...${NC}"
        kill $WORKER_PID
        rm "$PROJECT_ROOT/data/worker.pid"
    fi
fi

# Stop Docker containers
echo -e "${BLUE}Stopping Docker containers...${NC}"
docker compose down

echo -e "${GREEN}✅ All services stopped${NC}"