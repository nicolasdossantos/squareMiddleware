#!/bin/bash

################################################################################
# Configure IP Restrictions
# 
# This script configures Azure App Service IP restrictions to only allow
# traffic from Retell webhook IPs.
################################################################################

set -e

# Load deployment info
if [ ! -f "deploy/deployment-info.json" ]; then
    echo "❌ deployment-info.json not found. Run azure-deploy.sh first."
    exit 1
fi

RESOURCE_GROUP=$(jq -r '.resourceGroup' deploy/deployment-info.json)
APP_SERVICE_NAME=$(jq -r '.appServiceName' deploy/deployment-info.json)

echo "=========================================="
echo "  Configure IP Restrictions"
echo "=========================================="
echo ""
echo "App Service: $APP_SERVICE_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo ""

################################################################################
# Retell Webhook IPs
################################################################################
echo "📝 Retell Webhook IP Addresses"
echo ""
echo "You need to get the official Retell webhook IP addresses from:"
echo "  - Retell documentation"
echo "  - Retell support team"
echo "  - Retell dashboard"
echo ""
echo "Example format: 3.101.71.0/24 or 52.4.123.45/32"
echo ""

# Collect IP addresses
RETELL_IPS=()
while true; do
    read -p "Enter Retell webhook IP/CIDR (or 'done' to finish): " ip_address
    
    if [ "$ip_address" = "done" ]; then
        break
    fi
    
    if [ -n "$ip_address" ]; then
        RETELL_IPS+=("$ip_address")
        echo "  ✓ Added: $ip_address"
    fi
done

if [ ${#RETELL_IPS[@]} -eq 0 ]; then
    echo ""
    echo "⚠️  No IP addresses provided."
    echo "   Skipping IP restrictions configuration."
    echo "   You can run this script again later or configure manually."
    exit 0
fi

echo ""
echo "=========================================="
echo "Adding IP restrictions..."
echo "=========================================="

# Add rules for each Retell IP
priority=100
for ip in "${RETELL_IPS[@]}"; do
    echo ""
    echo "Adding rule for: $ip (priority: $priority)"
    
    az webapp config access-restriction add \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_SERVICE_NAME" \
        --rule-name "AllowRetell-$priority" \
        --action Allow \
        --ip-address "$ip" \
        --priority $priority
    
    echo "  ✓ Rule added"
    priority=$((priority + 10))
done

# Optional: Add your current IP for testing
echo ""
read -p "Add your current IP for testing access? (yes/no): " add_current_ip

if [ "$add_current_ip" = "yes" ]; then
    CURRENT_IP=$(curl -s https://api.ipify.org)
    echo "Your current IP: $CURRENT_IP"
    
    az webapp config access-restriction add \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_SERVICE_NAME" \
        --rule-name "AllowDeveloper" \
        --action Allow \
        --ip-address "${CURRENT_IP}/32" \
        --priority 90
    
    echo "  ✓ Your IP added (priority: 90)"
fi

# Add deny all rule (lowest priority)
echo ""
echo "Adding deny-all rule (blocks everything else)..."

az webapp config access-restriction add \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME" \
    --rule-name "DenyAll" \
    --action Deny \
    --ip-address "0.0.0.0/0" \
    --priority 1000

echo "  ✓ Deny-all rule added"

echo ""
echo "=========================================="
echo "  ✓ IP Restrictions Configured!"
echo "=========================================="
echo ""
echo "Current rules:"
az webapp config access-restriction show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_SERVICE_NAME" \
    --query "ipSecurityRestrictions[].{Name:name, IP:ipAddress, Action:action, Priority:priority}" \
    -o table

echo ""
echo "⚠️  IMPORTANT:"
echo "   Only the specified IPs can now access your API."
echo "   Make sure Retell webhooks can reach your endpoint!"
echo ""
echo "To remove restrictions later, run:"
echo "  az webapp config access-restriction remove \\"
echo "    --resource-group '$RESOURCE_GROUP' \\"
echo "    --name '$APP_SERVICE_NAME' \\"
echo "    --rule-name '<RuleName>'"
