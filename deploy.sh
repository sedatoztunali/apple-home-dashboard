#!/bin/bash

# Apple Home Dashboard - Build & Deployment Script for Home Assistant
# This script builds the TypeScript project and deploys it to your Home Assistant instance

set -e

# Configuration
HA_HOST="100.64.239.128"
HA_PORT="8123"
DASHBOARD_NAME="apple-home-dashboard"
USER="ginnie"
CONFIG_PATH="/home/ginnie/homeassistant/data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏠 Apple Home Dashboard - Deployment Script${NC}"
echo "========================================"

# Check if we have the required files
echo -e "${YELLOW}🔧 Building project...${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build completed successfully${NC}"
else
    echo -e "${RED}❌ Error: Build failed${NC}"
    echo "Run 'npm run build' manually to see detailed error output"
    exit 1
fi

if [ ! -f "dist/apple-home-strategy.js" ]; then
    echo -e "${RED}❌ Error: dist/apple-home-strategy.js not found after build${NC}"
    exit 1
fi

# Function to check if Home Assistant is reachable
check_ha_connection() {
    echo -e "${YELLOW}🔍 Checking Home Assistant connection...${NC}"
    if curl -s -f "http://${HA_HOST}:${HA_PORT}" > /dev/null; then
        echo -e "${GREEN}✅ Home Assistant is reachable at ${HA_HOST}:${HA_PORT}${NC}"
        return 0
    else
        echo -e "${RED}❌ Cannot reach Home Assistant at ${HA_HOST}:${HA_PORT}${NC}"
        echo "Please check:"
        echo "  1. Home Assistant is running"
        echo "  2. The IP address (${HA_HOST}) is correct"
        echo "  3. The port (${HA_PORT}) is correct"
        echo "  4. No firewall is blocking the connection"
        return 1
    fi
}

# Function to deploy via SCP (if SSH is available)
deploy_via_scp() {
    echo -e "${YELLOW}🚀 Deploying via SCP...${NC}"
    
    # Create www/community directory if it doesn't exist
    echo -e "${YELLOW}📁 Creating directory structure...${NC}"
    if ssh "${USER}@${HA_HOST}" "mkdir -p ${CONFIG_PATH}/www/community/${DASHBOARD_NAME}" 2>/dev/null; then
        echo -e "${GREEN}✅ Directory structure ready${NC}"
    else
        echo -e "${RED}❌ Failed to create directory structure${NC}"
        return 1
    fi

    # Copy the JavaScript file
    echo -e "${YELLOW}📦 Copying apple-home-strategy.js...${NC}"
    if scp "dist/apple-home-strategy.js" "${USER}@${HA_HOST}:${CONFIG_PATH}/www/community/${DASHBOARD_NAME}/" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ File deployed successfully to ${CONFIG_PATH}/www/community/${DASHBOARD_NAME}/${NC}"
        return 0
    else
        echo -e "${RED}❌ SCP file transfer failed${NC}"
        return 1
    fi
}

# Function to show manual deployment instructions
show_manual_instructions() {
    echo -e "${YELLOW}📖 Manual Deployment Instructions${NC}"
    echo "=================================="
    echo
    echo "Since automatic deployment isn't available, please follow these steps:"
    echo
    echo "1. 📁 Access your Home Assistant file system (via SSH, Samba, or File Editor add-on)"
    echo
    echo "2. 📂 Navigate to your Home Assistant config directory (usually /config)"
    echo
    echo "3. 🗂️ Create this directory structure:"
    echo "   config/"
    echo "   └── www/"
    echo "       └── community/"
    echo "           └── ${DASHBOARD_NAME}/"
    echo
    echo "4. 📋 Copy the following file to that directory:"
    echo "   - dist/apple-home-strategy.js"
    echo
    echo "5. ⚙️ Add resource in Home Assistant UI:"
    echo "   a) Go to Settings > Dashboards"
    echo "   b) Click the three dots menu > Resources"
    echo "   c) Click 'Add Resource'"
    echo "   d) URL: /hacsfiles/${DASHBOARD_NAME}/apple-home-strategy.js"
    echo "   e) Resource type: JavaScript Module"
    echo "   f) Click 'Create'"
    echo
    echo "6. 🔄 Restart Home Assistant"
    echo
    echo "7. ➕ Create a new dashboard in Home Assistant with this YAML:"
    echo "   strategy:"
    echo "     type: custom:apple-home-strategy"
    echo "   views: []"
    echo
    echo -e "${BLUE}💡 Alternative: Install via HACS${NC}"
    echo "1. Go to HACS > Frontend"
    echo "2. Click the three dots menu > Custom repositories"
    echo "3. Add this repository URL"
    echo "4. Install 'Apple Home Dashboard Strategy'"
}

# Function to create a sample dashboard configuration
create_sample_config() {
    echo -e "${YELLOW}📝 Sample dashboard configuration:${NC}"
    echo ""
    echo "To create a new dashboard in Home Assistant, use this YAML:"
    echo ""
    echo "strategy:"
    echo "  type: custom:apple-home-strategy"
    echo "views: []"
    echo ""
    echo "Alternative with custom view title:"
    echo "strategy:"
    echo "  type: custom:apple-home-strategy"
    echo "views:"
    echo "  - title: \"My Smart Home\""
    echo "    path: \"home\""
    echo "    icon: \"mdi:home-assistant\""
    echo ""
}

# Function to check dependencies
check_dependencies() {
    echo -e "${YELLOW}🔍 Checking dependencies...${NC}"
    
    echo "📋 Required Home Assistant configuration:"
    echo "  ✓ Areas configured in Home Assistant"
    echo "  ✓ Light entities assigned to areas"
    echo "  ✓ Supported entities: lights, covers, climate, fans, media players, locks"
    echo
    echo "💡 The Apple Home Dashboard works independently - no additional cards needed!"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting deployment process...${NC}"
    echo
    
    # Check connection first
    if ! check_ha_connection; then
        echo
        show_manual_instructions
        create_sample_config
        check_dependencies
        exit 1
    fi
    
    # Try SCP deployment
    if command -v scp > /dev/null && command -v ssh > /dev/null; then
        if deploy_via_scp; then
            echo
            echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
            echo -e "${GREEN}✅ Build: SUCCESS${NC}"
            echo -e "${GREEN}✅ Deploy: SUCCESS${NC}"
            echo
            echo "Next steps:"
            echo "1. 📝 Add resource in Home Assistant UI:"
            echo "   • Go to Settings > Dashboards"
            echo "   • Click three dots menu > Resources"
            echo "   • Click 'Add Resource'"
            echo "   • URL: /hacsfiles/${DASHBOARD_NAME}/apple-home-strategy.js"
            echo "   • Resource type: JavaScript Module"
            echo "   • Click 'Create'"
            echo
            echo "2. 🔄 Restart Home Assistant"
            echo
            echo "3. ➕ Create a new dashboard with the provided configuration"
        else
            echo
            echo -e "${YELLOW}⚠️ Build succeeded but SCP deployment failed${NC}"
            echo -e "${GREEN}✅ Build: SUCCESS${NC}"
            echo -e "${RED}❌ Deploy: FAILED${NC}"
            show_manual_instructions
        fi
    else
        echo -e "${YELLOW}⚠️ SSH/SCP not available${NC}"
        echo -e "${GREEN}✅ Build: SUCCESS${NC}"
        echo -e "${YELLOW}⚠️ Deploy: SKIPPED (manual required)${NC}"
        show_manual_instructions
    fi
    
    create_sample_config
    check_dependencies
    
    echo
    echo -e "${GREEN}🏠 Apple Home Dashboard deployment process complete!${NC}"
    echo -e "${BLUE}Visit: http://${HA_HOST}:${HA_PORT} to configure your new dashboard${NC}"
}

# Help function
show_help() {
    echo "Apple Home Dashboard Deployment Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -host HOST             Set Home Assistant host (default: 10.0.0.42)"
    echo "  -port PORT             Set Home Assistant port (default: 8123)"
    echo
    echo "Examples:"
    echo "  $0                     Deploy with default settings"
    echo "  $0 -host 192.168.1.100 Deploy to different IP"
    echo "  $0 -port 8124          Deploy to different port"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -host)
            HA_HOST="$2"
            shift 2
            ;;
        -port)
            HA_PORT="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
