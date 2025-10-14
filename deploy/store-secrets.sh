#!/bin/bash

################################################################################
# Store Secrets in Key Vault
# 
# This script helps you store secrets in Azure Key Vault:
# - Retell API key (for signature verification)
# - Per-agent configurations (Square credentials + bearer tokens)
################################################################################

set -e

# Load deployment info
if [ ! -f "deploy/deployment-info.json" ]; then
    echo "❌ deployment-info.json not found. Run azure-deploy.sh first."
    exit 1
fi

KEY_VAULT_NAME=$(jq -r '.keyVaultName' deploy/deployment-info.json)

echo "=========================================="
echo "  Store Secrets in Key Vault"
echo "=========================================="
echo ""
echo "Key Vault: $KEY_VAULT_NAME"
echo ""

################################################################################
# Store Retell API Key
################################################################################
echo "📝 Step 1: Store Retell API Key"
echo "This key is used to verify webhook signatures from Retell."
echo ""
read -p "Enter your Retell API Key: " RETELL_API_KEY

if [ -z "$RETELL_API_KEY" ]; then
    echo "❌ Retell API Key cannot be empty"
    exit 1
fi

az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "retell-api-key" \
    --value "$RETELL_API_KEY"

echo "✓ Retell API Key stored"
echo ""

################################################################################
# Store Agent Configurations
################################################################################
echo "📝 Step 2: Store Agent Configurations"
echo "Each Retell agent needs:"
echo "  - Agent ID (from Retell)"
echo "  - Bearer Token (generate a secure random token)"
echo "  - Square Access Token"
echo "  - Square Location ID"
echo "  - Square Environment (sandbox or production)"
echo "  - Timezone (e.g., America/New_York)"
echo ""

while true; do
    read -p "Add an agent configuration? (yes/no): " add_agent
    
    if [ "$add_agent" != "yes" ]; then
        break
    fi
    
    echo ""
    read -p "Agent ID (from Retell): " AGENT_ID
    
    # Generate a secure bearer token
    echo ""
    echo "Generating secure Bearer Token..."
    BEARER_TOKEN=$(openssl rand -base64 32)
    echo "Generated Bearer Token: $BEARER_TOKEN"
    echo "⚠️  SAVE THIS TOKEN - You'll need it in Retell webhook configuration!"
    echo ""
    
    read -p "Square Access Token: " SQUARE_ACCESS_TOKEN
    read -p "Square Location ID: " SQUARE_LOCATION_ID
    read -p "Square Environment (sandbox/production): " SQUARE_ENV
    read -p "Timezone (e.g., America/New_York): " TIMEZONE
    
    # Create JSON configuration
    AGENT_CONFIG=$(cat <<EOF
{
  "agentId": "$AGENT_ID",
  "bearerToken": "$BEARER_TOKEN",
  "squareAccessToken": "$SQUARE_ACCESS_TOKEN",
  "squareLocationId": "$SQUARE_LOCATION_ID",
  "squareEnvironment": "$SQUARE_ENV",
  "timezone": "$TIMEZONE"
}
EOF
)
    
    # Store in Key Vault
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "agent-$AGENT_ID" \
        --value "$AGENT_CONFIG"
    
    echo "✓ Agent configuration stored: agent-$AGENT_ID"
    echo ""
    
    # Save bearer token to file for reference
    echo "$AGENT_ID: Bearer $BEARER_TOKEN" >> deploy/agent-tokens.txt
done

echo ""
echo "=========================================="
echo "  ✓ Secrets Stored Successfully!"
echo "=========================================="
echo ""
echo "Secrets in Key Vault:"
az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "[].name" -o table
echo ""

if [ -f "deploy/agent-tokens.txt" ]; then
    echo "⚠️  IMPORTANT: Bearer tokens saved to deploy/agent-tokens.txt"
    echo "   Use these tokens in your Retell webhook configuration:"
    echo "   Header: Authorization: Bearer <token>"
    echo ""
    cat deploy/agent-tokens.txt
    echo ""
    echo "⚠️  Keep this file secure and don't commit it to git!"
fi
