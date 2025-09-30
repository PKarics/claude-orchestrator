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

echo -e "${BLUE}📊 Claude Orchestrator Instances${NC}"
echo ""

# Check for instances in data directory
if [ ! -d "$PROJECT_ROOT/data" ]; then
    echo -e "${YELLOW}No instances found${NC}"
    exit 0
fi

FOUND_INSTANCES=false

for instance_dir in "$PROJECT_ROOT/data"/*; do
    if [ -d "$instance_dir" ]; then
        INSTANCE_NAME=$(basename "$instance_dir")
        FOUND_INSTANCES=true

        echo -e "${BLUE}Instance: ${YELLOW}${INSTANCE_NAME}${NC}"

        # Check Orchestrator
        if [ -f "$instance_dir/orchestrator.pid" ]; then
            ORCHESTRATOR_PID=$(cat "$instance_dir/orchestrator.pid")
            if kill -0 $ORCHESTRATOR_PID 2>/dev/null; then
                # Try to determine the port from env file or logs
                PORT=$(grep "PORT=" "$PROJECT_ROOT/.env.$INSTANCE_NAME" 2>/dev/null | cut -d'=' -f2)
                if [ -z "$PORT" ]; then
                    PORT="unknown"
                fi
                echo -e "  Orchestrator: ${GREEN}✅ Running${NC} (PID: $ORCHESTRATOR_PID, Port: $PORT)"
            else
                echo -e "  Orchestrator: ${RED}❌ Stopped${NC} (stale PID)"
            fi
        else
            echo -e "  Orchestrator: ${RED}❌ Stopped${NC}"
        fi

        # Check Worker
        if [ -f "$instance_dir/worker.pid" ]; then
            WORKER_PID=$(cat "$instance_dir/worker.pid")
            if kill -0 $WORKER_PID 2>/dev/null; then
                echo -e "  Worker: ${GREEN}✅ Running${NC} (PID: $WORKER_PID)"
            else
                echo -e "  Worker: ${RED}❌ Stopped${NC} (stale PID)"
            fi
        else
            echo -e "  Worker: ${RED}❌ Stopped${NC}"
        fi

        # Check Docker container
        CONTAINER_NAME="claude-orchestrator-valkey-$INSTANCE_NAME"
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            REDIS_PORT=$(docker port "$CONTAINER_NAME" 6379 2>/dev/null | cut -d':' -f2)
            echo -e "  Valkey: ${GREEN}✅ Running${NC} (Port: $REDIS_PORT)"
        else
            echo -e "  Valkey: ${RED}❌ Stopped${NC}"
        fi

        echo ""
    fi
done

if [ "$FOUND_INSTANCES" = false ]; then
    echo -e "${YELLOW}No instances found${NC}"
    echo ""
    echo "To start a new instance, run:"
    echo "  ./scripts/start-instance.sh <instance-name> [orchestrator-port] [redis-port]"
fi