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

# Check for instances
if [ ! -d "$PROJECT_ROOT/data" ] || [ -z "$(ls -A $PROJECT_ROOT/data 2>/dev/null)" ]; then
    echo -e "${YELLOW}No instances found${NC}"
    exit 0
fi

for instance_dir in "$PROJECT_ROOT/data"/*; do
    if [ -d "$instance_dir" ]; then
        INSTANCE_NAME=$(basename "$instance_dir")
        echo -e "${BLUE}Instance: ${YELLOW}${INSTANCE_NAME}${NC}"

        # Check Orchestrator
        echo -n "  Orchestrator: "
        if [ -f "$instance_dir/orchestrator.pid" ]; then
            ORCHESTRATOR_PID=$(cat "$instance_dir/orchestrator.pid")
            if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
                echo -e "${GREEN}✅ Running (PID: $ORCHESTRATOR_PID)${NC}"
            else
                echo -e "${RED}❌ Stopped (stale PID)${NC}"
            fi
        else
            echo -e "${RED}❌ Stopped${NC}"
        fi

        # Check Worker
        echo -n "  Worker: "
        if [ -f "$instance_dir/worker.pid" ]; then
            WORKER_PID=$(cat "$instance_dir/worker.pid")
            if kill -0 $WORKER_PID 2>/dev/null; then
                echo -e "${GREEN}✅ Running (PID: $WORKER_PID)${NC}"
            else
                echo -e "${RED}❌ Stopped (stale PID)${NC}"
            fi
        else
            echo -e "${RED}❌ Stopped${NC}"
        fi

        # Check Dashboard
        echo -n "  Dashboard: "
        if [ -f "$instance_dir/dashboard.pid" ]; then
            DASHBOARD_PID=$(cat "$instance_dir/dashboard.pid")
            if kill -0 $DASHBOARD_PID 2>/dev/null; then
                echo -e "${GREEN}✅ Running (PID: $DASHBOARD_PID)${NC}"
            else
                echo -e "${RED}❌ Stopped (stale PID)${NC}"
            fi
        else
            echo -e "${RED}❌ Stopped${NC}"
        fi

        # Check Docker
        echo -n "  Docker: "
        if docker compose -p "claude-orchestrator-$INSTANCE_NAME" ps | grep -q "Up"; then
            echo -e "${GREEN}✅ Running${NC}"
        else
            echo -e "${RED}❌ Stopped${NC}"
        fi

        echo ""
    fi
done