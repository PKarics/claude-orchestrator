#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check for instance name argument
if [ -z "$1" ]; then
    echo -e "${RED}Error: Instance name required${NC}"
    echo "Usage: $0 <instance-name>"
    echo "Example: $0 instance1"
    exit 1
fi

INSTANCE_NAME=$1
INSTANCE_DATA_DIR="$PROJECT_ROOT/data/$INSTANCE_NAME"

cd "$PROJECT_ROOT"

echo -e "${BLUE}🛑 Stopping Claude Orchestrator instance: ${YELLOW}${INSTANCE_NAME}${NC}"

# Stop orchestrator
if [ -f "$INSTANCE_DATA_DIR/orchestrator.pid" ]; then
    ORCHESTRATOR_PID=$(cat "$INSTANCE_DATA_DIR/orchestrator.pid")
    if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping orchestrator (PID: $ORCHESTRATOR_PID)...${NC}"
        kill $ORCHESTRATOR_PID
        rm "$INSTANCE_DATA_DIR/orchestrator.pid"
    else
        echo -e "${YELLOW}Orchestrator not running (removing stale PID file)${NC}"
        rm "$INSTANCE_DATA_DIR/orchestrator.pid"
    fi
fi

# Stop worker
if [ -f "$INSTANCE_DATA_DIR/worker.pid" ]; then
    WORKER_PID=$(cat "$INSTANCE_DATA_DIR/worker.pid")
    if kill -0 $WORKER_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping worker (PID: $WORKER_PID)...${NC}"
        kill $WORKER_PID
        rm "$INSTANCE_DATA_DIR/worker.pid"
    else
        echo -e "${YELLOW}Worker not running (removing stale PID file)${NC}"
        rm "$INSTANCE_DATA_DIR/worker.pid"
    fi
fi

# Stop dashboard
if [ -f "$INSTANCE_DATA_DIR/dashboard.pid" ]; then
    DASHBOARD_PID=$(cat "$INSTANCE_DATA_DIR/dashboard.pid")
    if kill -0 $DASHBOARD_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping dashboard (PID: $DASHBOARD_PID)...${NC}"
        kill $DASHBOARD_PID
        rm "$INSTANCE_DATA_DIR/dashboard.pid"
    else
        echo -e "${YELLOW}Dashboard not running (removing stale PID file)${NC}"
        rm "$INSTANCE_DATA_DIR/dashboard.pid"
    fi
fi

# Stop Docker containers
echo -e "${BLUE}Stopping Docker containers...${NC}"
docker compose -p "claude-orchestrator-$INSTANCE_NAME" down

# Remove instance env file
if [ -f "$PROJECT_ROOT/.env.$INSTANCE_NAME" ]; then
    rm "$PROJECT_ROOT/.env.$INSTANCE_NAME"
    echo -e "${BLUE}Removed .env.$INSTANCE_NAME${NC}"
fi

echo -e "${GREEN}✅ Instance '${INSTANCE_NAME}' stopped${NC}"