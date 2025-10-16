#!/bin/bash

# Elite Barbershop Onboarding Script
# Generated: October 15, 2025
# Business: Elite Barbershop
# Location: L71YZWPR1TD9B (Production)

set -e  # Exit on error

echo "🚀 Onboarding Elite Barbershop..."
echo "=================================="
echo ""

# Configuration Variables
AGENT_ID="agent_895480dde586e4c3712bd4c770"
BEARER_TOKEN="772983911747a8081fcfc30b7e4c1edd3f3ff78c0e1dcecb860a281d41b00b96"
SQUARE_TOKEN="EAAAl1GMw5U8nZA-GsBixNSjKQvSl0ktYKGzIrC09XHY0tQzn8wrZRfIGx-owqpQ"
SQUARE_APP_ID="sq0idp-Ha6sz9iJDuMD2L7XPtgLoQ"
LOCATION_ID="L71YZWPR1TD9B"
SQUARE_ENV="production"
TIMEZONE="America/New_York"  # EST
BUSINESS_NAME="Elite Barbershop"
CONTACT_EMAIL="hello@fluentfront.ai"
CONTACT_PHONE="+12677210098"
RETELL_API_KEY="key_66b498a95ba7bf2f46d5fda5ab62"

# Your Key Vault name
KEY_VAULT_NAME="square-middleware-kv"

echo "📝 Configuration:"
echo "  Business: $BUSINESS_NAME"
echo "  Agent ID: $AGENT_ID"
echo "  Location ID: $LOCATION_ID"
echo "  Environment: $SQUARE_ENV"
echo "  Timezone: $TIMEZONE"
echo ""

# Step 1: Store Retell API Key (if not already stored)
echo "🔑 Step 1: Storing Retell API Key in Key Vault..."
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "retell-api-key" \
  --value "$RETELL_API_KEY" \
  --output none

echo "✅ Retell API Key stored successfully"
echo ""

# Step 2: Create agent configuration JSON
echo "🔑 Step 2: Storing Elite Barbershop configuration..."

CONFIG=$(cat <<EOF
{
  "agentId": "${AGENT_ID}",
  "bearerToken": "${BEARER_TOKEN}",
  "squareAccessToken": "${SQUARE_TOKEN}",
  "squareApplicationId": "${SQUARE_APP_ID}",
  "squareLocationId": "${LOCATION_ID}",
  "squareEnvironment": "${SQUARE_ENV}",
  "timezone": "${TIMEZONE}",
  "businessName": "${BUSINESS_NAME}",
  "contactEmail": "${CONTACT_EMAIL}",
  "contactPhone": "${CONTACT_PHONE}"
}
EOF
)

# Store in Key Vault (agent ID without 'agent_' prefix for secret name)
SECRET_NAME="agent-895480dde586e4c3712bd4c770"

az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name "$SECRET_NAME" \
  --value "$CONFIG" \
  --output none

echo "✅ Elite Barbershop configuration stored successfully"
echo ""

# Step 3: Verify storage
echo "🔍 Step 3: Verifying configuration..."

STORED_CONFIG=$(az keyvault secret show \
  --vault-name "$KEY_VAULT_NAME" \
  --name "$SECRET_NAME" \
  --query "value" -o tsv)

if [ -n "$STORED_CONFIG" ]; then
  echo "✅ Configuration verified in Key Vault"
  echo ""
  echo "Stored configuration:"
  echo "$STORED_CONFIG" | jq .
else
  echo "❌ Failed to verify configuration"
  exit 1
fi

echo ""
echo "=================================="
echo "✅ ONBOARDING COMPLETE!"
echo "=================================="
echo ""
echo "📋 Elite Barbershop Access Details:"
echo ""
echo "Bearer Token (SAVE THIS SECURELY!):"
echo "  $BEARER_TOKEN"
echo ""
echo "API Base URL:"
echo "  https://square-middleware-prod-api.azurewebsites.net"
echo ""
echo "Agent ID:"
echo "  $AGENT_ID"
echo ""
echo "Square Location ID:"
echo "  $LOCATION_ID"
echo ""
echo "Contact Email:"
echo "  $CONTACT_EMAIL"
echo ""
echo "Next Steps:"
echo "  1. Configure Retell webhook URL in Retell dashboard"
echo "  2. Run test calls to verify integration"
echo "  3. Check Application Insights for monitoring"
echo ""
echo "Webhook URL for Retell:"
echo "  https://square-middleware-prod-api.azurewebsites.net/api/webhooks/retell"
echo ""
echo "=================================="
