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

cd "$PROJECT_ROOT"

echo -e "${BLUE}🛑 Stopping all Claude Orchestrator instances...${NC}"
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

        echo -e "${BLUE}Stopping instance: ${YELLOW}${INSTANCE_NAME}${NC}"
        "$SCRIPT_DIR/stop-instance.sh" "$INSTANCE_NAME"
        echo ""
    fi
done

if [ "$FOUND_INSTANCES" = false ]; then
    echo -e "${YELLOW}No instances found${NC}"
else
    echo -e "${GREEN}✅ All instances stopped${NC}"
fi