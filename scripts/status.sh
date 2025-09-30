#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${BLUE}📊 Claude Orchestrator Status${NC}"
echo ""

# Check Valkey
echo -n "Valkey: "
if docker compose ps valkey | grep -q "Up"; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Stopped${NC}"
fi

# Check Orchestrator
echo -n "Orchestrator: "
if [ -f "$PROJECT_ROOT/data/orchestrator.pid" ]; then
    ORCHESTRATOR_PID=$(cat "$PROJECT_ROOT/data/orchestrator.pid")
    if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Running (PID: $ORCHESTRATOR_PID, http://localhost:3000)${NC}"
        else
            echo -e "${YELLOW}⚠️  Process running but not responding (PID: $ORCHESTRATOR_PID)${NC}"
        fi
    else
        echo -e "${RED}❌ Stopped (stale PID file)${NC}"
    fi
else
    echo -e "${RED}❌ Stopped${NC}"
fi

# Check Worker
echo -n "Worker: "
if [ -f "$PROJECT_ROOT/data/worker.pid" ]; then
    WORKER_PID=$(cat "$PROJECT_ROOT/data/worker.pid")
    if kill -0 $WORKER_PID 2>/dev/null; then
        echo -e "${GREEN}✅ Running (PID: $WORKER_PID)${NC}"
    else
        echo -e "${RED}❌ Stopped (stale PID file)${NC}"
    fi
else
    echo -e "${RED}❌ Stopped${NC}"
fi

echo ""
echo -e "${BLUE}📝 Recent Logs:${NC}"
echo ""
if [ -f "$PROJECT_ROOT/data/orchestrator.log" ]; then
    echo -e "${BLUE}Orchestrator (last 5 lines):${NC}"
    tail -n 5 "$PROJECT_ROOT/data/orchestrator.log"
    echo ""
fi
if [ -f "$PROJECT_ROOT/data/worker.log" ]; then
    echo -e "${BLUE}Worker (last 5 lines):${NC}"
    tail -n 5 "$PROJECT_ROOT/data/worker.log"
fi