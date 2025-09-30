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

# Function to find an available port starting from a base port
find_available_port() {
    local base_port=$1
    local port=$base_port
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

# Auto-generate instance name based on timestamp
INSTANCE_NAME="instance-$(date +%s)"

# Find available ports
ORCHESTRATOR_PORT=$(find_available_port 3000)
REDIS_PORT=$(find_available_port 6379)

echo -e "${BLUE}Instance: ${YELLOW}${INSTANCE_NAME}${NC}"
echo -e "${BLUE}Orchestrator port: ${YELLOW}${ORCHESTRATOR_PORT}${NC}"
echo -e "${BLUE}Redis port: ${YELLOW}${REDIS_PORT}${NC}"
echo ""

# Create instance-specific .env file
ENV_FILE="$PROJECT_ROOT/.env.$INSTANCE_NAME"
cat > "$ENV_FILE" <<EOF
# Instance Configuration
INSTANCE_NAME=$INSTANCE_NAME

# Valkey/Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=$REDIS_PORT

# Orchestrator Configuration
PORT=$ORCHESTRATOR_PORT

# Worker Configuration
WORKER_CONCURRENCY=5
EOF

# Create instance data directory
INSTANCE_DATA_DIR="$PROJECT_ROOT/data/$INSTANCE_NAME"
mkdir -p "$INSTANCE_DATA_DIR"

# Start Docker containers with instance-specific settings
echo -e "${BLUE}📦 Starting Docker containers...${NC}"
INSTANCE_NAME=$INSTANCE_NAME REDIS_PORT=$REDIS_PORT docker compose -p "claude-orchestrator-$INSTANCE_NAME" up -d

# Wait for Valkey to be ready
echo -e "${YELLOW}⏳ Waiting for Valkey to be ready...${NC}"
for i in {1..30}; do
    if docker exec "claude-orchestrator-valkey-$INSTANCE_NAME" valkey-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Valkey is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Valkey not responding, but continuing...${NC}"
    fi
    sleep 1
done

# Build all packages (if not already built)
if [ ! -d "$PROJECT_ROOT/packages/shared/dist" ]; then
    echo -e "${BLUE}🔨 Building packages...${NC}"
    pnpm build
fi

# Start orchestrator in background with instance-specific env
echo -e "${BLUE}🎯 Starting orchestrator...${NC}"
cd "$PROJECT_ROOT/apps/orchestrator"
PORT=$ORCHESTRATOR_PORT INSTANCE_NAME=$INSTANCE_NAME pnpm start > "$INSTANCE_DATA_DIR/orchestrator.log" 2>&1 &
ORCHESTRATOR_PID=$!
echo $ORCHESTRATOR_PID > "$INSTANCE_DATA_DIR/orchestrator.pid"

# Wait for orchestrator to be ready
echo -e "${YELLOW}⏳ Waiting for orchestrator to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:$ORCHESTRATOR_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Orchestrator is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Orchestrator not responding${NC}"
        cat "$INSTANCE_DATA_DIR/orchestrator.log"
        exit 1
    fi
    sleep 1
done

# Start worker in background with instance-specific env
echo -e "${BLUE}⚙️  Starting worker...${NC}"
cd "$PROJECT_ROOT/apps/worker"
INSTANCE_NAME=$INSTANCE_NAME REDIS_HOST=localhost REDIS_PORT=$REDIS_PORT pnpm start > "$INSTANCE_DATA_DIR/worker.log" 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > "$INSTANCE_DATA_DIR/worker.pid"

echo ""
echo -e "${GREEN}✨ Instance '${INSTANCE_NAME}' started successfully!${NC}"
echo ""
echo "📊 Service Status:"
echo "  - Valkey: running on port $REDIS_PORT"
echo "  - Orchestrator: http://localhost:$ORCHESTRATOR_PORT (PID: $ORCHESTRATOR_PID)"
echo "  - Worker: running (PID: $WORKER_PID)"
echo ""
echo "📝 Logs:"
echo "  - Orchestrator: tail -f $INSTANCE_DATA_DIR/orchestrator.log"
echo "  - Worker: tail -f $INSTANCE_DATA_DIR/worker.log"
echo ""
echo "🛑 To stop this instance, run: ./scripts/stop-instance.sh $INSTANCE_NAME"
echo "🛑 To stop all instances, run: ./scripts/stop-all.sh"