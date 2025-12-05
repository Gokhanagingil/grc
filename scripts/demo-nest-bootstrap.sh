#!/bin/bash
# =============================================================================
# GRC Platform - NestJS Backend Demo Bootstrap Script
# =============================================================================
# One-command setup for running the NestJS backend with PostgreSQL via Docker.
#
# Usage:
#   ./scripts/demo-nest-bootstrap.sh         # Start the demo environment
#   ./scripts/demo-nest-bootstrap.sh --seed  # Start and seed with demo data
#   ./scripts/demo-nest-bootstrap.sh --down  # Stop and remove containers
#   ./scripts/demo-nest-bootstrap.sh --logs  # View backend logs
#   ./scripts/demo-nest-bootstrap.sh --help  # Show help
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - Port 3002 available (or set APP_PORT env var)
#   - Port 5432 available (or set DB_EXTERNAL_PORT env var)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.nest.yml"

# Default values
APP_PORT="${APP_PORT:-3002}"
DB_EXTERNAL_PORT="${DB_EXTERNAL_PORT:-5432}"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

print_header() {
    echo -e "${BLUE}"
    echo "============================================================================="
    echo " GRC Platform - NestJS Backend Demo"
    echo "============================================================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "  Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        echo "  Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    # Check compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    print_success "All prerequisites met."
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --seed    Start containers and seed with demo data"
    echo "  --down    Stop and remove containers"
    echo "  --logs    View backend logs (follow mode)"
    echo "  --status  Show container status"
    echo "  --help    Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  APP_PORT           Application port (default: 3002)"
    echo "  DB_EXTERNAL_PORT   PostgreSQL external port (default: 5432)"
    echo "  JWT_SECRET         JWT secret key (default: dev secret)"
    echo ""
    echo "Examples:"
    echo "  $0                 # Start the demo environment"
    echo "  $0 --seed          # Start and seed with demo data"
    echo "  APP_PORT=4000 $0   # Start on custom port"
}

start_containers() {
    print_info "Starting containers..."
    
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.nest.yml up -d --build
    
    print_info "Waiting for services to be healthy..."
    
    # Wait for backend to be ready (max 60 seconds)
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$APP_PORT/health/ready" > /dev/null 2>&1; then
            print_success "Backend is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    print_warning "Backend may not be fully ready. Check logs with: $0 --logs"
}

seed_data() {
    print_info "Seeding demo data..."
    
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.nest.yml exec -T backend-nest npm run seed:grc
    
    print_success "Demo data seeded successfully!"
}

stop_containers() {
    print_info "Stopping containers..."
    
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.nest.yml down
    
    print_success "Containers stopped."
}

show_logs() {
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.nest.yml logs -f backend-nest
}

show_status() {
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.nest.yml ps
}

print_access_info() {
    echo ""
    echo -e "${GREEN}=============================================================================${NC}"
    echo -e "${GREEN} Demo Environment Ready!${NC}"
    echo -e "${GREEN}=============================================================================${NC}"
    echo ""
    echo "  API Base URL:     http://localhost:$APP_PORT"
    echo "  Health Check:     http://localhost:$APP_PORT/health/live"
    echo "  Ready Check:      http://localhost:$APP_PORT/health/ready"
    echo ""
    echo "  Demo Credentials:"
    echo "    Email:    admin@grc-platform.local"
    echo "    Password: TestPassword123!"
    echo ""
    echo "  Quick Test:"
    echo "    curl http://localhost:$APP_PORT/health/live"
    echo ""
    echo "  Login:"
    echo "    curl -X POST http://localhost:$APP_PORT/auth/login \\"
    echo "      -H 'Content-Type: application/json' \\"
    echo "      -d '{\"email\":\"admin@grc-platform.local\",\"password\":\"TestPassword123!\"}'"
    echo ""
    echo "  Commands:"
    echo "    View logs:      $0 --logs"
    echo "    Seed data:      $0 --seed"
    echo "    Stop:           $0 --down"
    echo "    Status:         $0 --status"
    echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

print_header

case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --down)
        stop_containers
        exit 0
        ;;
    --logs)
        show_logs
        exit 0
        ;;
    --status)
        show_status
        exit 0
        ;;
    --seed)
        check_prerequisites
        start_containers
        seed_data
        print_access_info
        exit 0
        ;;
    "")
        check_prerequisites
        start_containers
        print_access_info
        exit 0
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
