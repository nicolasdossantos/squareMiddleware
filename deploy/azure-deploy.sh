#!/bin/bash

################################################################################
# Azure Deployment Script - Square Middleware API
# 
# This script creates a new Azure infrastructure with security built-in:
# - Resource Group
# - App Service Plan (B1 tier)
# - App Service (Web App)
# - Managed Identity (System-assigned)
# - Key Vault
# - Application Insights
# 
# Region: EastUS
# Estimated Cost: ~$14/month
################################################################################

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Resource configuration
RESOURCE_GROUP="square-middleware-prod-rg"
LOCATION="eastus"
APP_SERVICE_PLAN="square-middleware-prod-app-plan"
APP_SERVICE_NAME="square-middleware-prod-api"
KEY_VAULT_NAME="square-middleware-kv"
APP_INSIGHTS_NAME="square-middleware-prod-insights"
RUNTIME="NODE|20-lts"  # Node.js 20 LTS

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Square Middleware - Azure Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Resources to be created:${NC}"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  App Service Plan: $APP_SERVICE_PLAN (B1 tier)"
echo "  App Service: $APP_SERVICE_NAME"
echo "  Key Vault: $KEY_VAULT_NAME"
echo "  Application Insights: $APP_INSIGHTS_NAME"
echo ""
echo -e "${YELLOW}Estimated monthly cost: ~$14${NC}"
echo ""
read -p "Continue with deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 0
fi

################################################################################
# Step 1: Create Resource Group
################################################################################
echo ""
echo -e "${GREEN}[1/7] Creating Resource Group...${NC}"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags Environment=Production Project=SquareMiddleware

echo -e "${GREEN}✓ Resource Group created${NC}"

################################################################################
# Step 2: Create Application Insights
################################################################################
echo ""
echo -e "${GREEN}[2/7] Creating Application Insights...${NC}"
az monitor app-insights component create \
    --app "$APP_INSIGHTS_NAME" \
    --location "$LOCATION" \
    --resource-group "$RESOURCE_GROUP" \
    --application-type web \
    --retention-time 30

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query instrumentationKey \
    --output tsv)

echo -e "${GREEN}✓ Application Insights created${NC}"
echo "  Instrumentation Key: $INSTRUMENTATION_KEY"

################################################################################
# Step 3: Create App Service Plan (B1 tier)
################################################################################
echo ""
echo -e "${GREEN}[3/7] Creating App Service Plan (B1 - ~$13/month)...${NC}"
az appservice plan create \
    --name "$APP_SERVICE_PLAN" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku B1 \
    --is-linux

echo -e "${GREEN}✓ App Service Plan created${NC}"

################################################################################
# Step 4: Create App Service (Web App)
################################################################################
echo ""
echo -e "${GREEN}[4/7] Creating App Service...${NC}"
az webapp create \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --plan "$APP_SERVICE_PLAN" \
    --runtime "$RUNTIME"

# Configure App Service settings
echo -e "${BLUE}  Configuring App Service settings...${NC}"

# Enable HTTPS only
az webapp update \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --https-only true

# Set Node.js version
az webapp config appsettings set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        WEBSITE_NODE_DEFAULT_VERSION="~20" \
        NODE_ENV="production" \
        APPINSIGHTS_INSTRUMENTATIONKEY="$INSTRUMENTATION_KEY" \
        SCM_DO_BUILD_DURING_DEPLOYMENT="true"

echo -e "${GREEN}✓ App Service created${NC}"
echo "  URL: https://${APP_SERVICE_NAME}.azurewebsites.net"

################################################################################
# Step 5: Enable Managed Identity
################################################################################
echo ""
echo -e "${GREEN}[5/7] Enabling Managed Identity...${NC}"
PRINCIPAL_ID=$(az webapp identity assign \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query principalId \
    --output tsv)

echo -e "${GREEN}✓ Managed Identity enabled${NC}"
echo "  Principal ID: $PRINCIPAL_ID"

################################################################################
# Step 6: Create Key Vault
################################################################################
echo ""
echo -e "${GREEN}[6/7] Creating Key Vault...${NC}"
az keyvault create \
    --name "$KEY_VAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku standard \
    --enable-rbac-authorization false

echo -e "${BLUE}  Granting App Service access to Key Vault...${NC}"
az keyvault set-policy \
    --name "$KEY_VAULT_NAME" \
    --object-id "$PRINCIPAL_ID" \
    --secret-permissions get list

echo -e "${GREEN}✓ Key Vault created and permissions granted${NC}"
echo "  Vault URL: https://${KEY_VAULT_NAME}.vault.azure.net"

################################################################################
# Step 7: Configure Key Vault App Setting
################################################################################
echo ""
echo -e "${GREEN}[7/7] Configuring Key Vault connection...${NC}"
az webapp config appsettings set \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        AZURE_KEY_VAULT_NAME="$KEY_VAULT_NAME"

echo -e "${GREEN}✓ Key Vault connection configured${NC}"

################################################################################
# Deployment Summary
################################################################################
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Resources Created:${NC}"
echo "  ✓ Resource Group: $RESOURCE_GROUP"
echo "  ✓ App Service Plan: $APP_SERVICE_PLAN (B1)"
echo "  ✓ App Service: $APP_SERVICE_NAME"
echo "  ✓ Managed Identity: Enabled (Principal ID: $PRINCIPAL_ID)"
echo "  ✓ Key Vault: $KEY_VAULT_NAME"
echo "  ✓ Application Insights: $APP_INSIGHTS_NAME"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Store secrets in Key Vault (see: deploy/store-secrets.sh)"
echo "  2. Configure IP restrictions (see: deploy/configure-ip-restrictions.sh)"
echo "  3. Deploy your application code"
echo "  4. Test the endpoints"
echo ""
echo -e "${BLUE}App Service URL:${NC} https://${APP_SERVICE_NAME}.azurewebsites.net"
echo -e "${BLUE}Key Vault URL:${NC} https://${KEY_VAULT_NAME}.vault.azure.net"
echo ""
echo -e "${YELLOW}Estimated Monthly Cost: ~$14${NC}"
echo "  - App Service Plan (B1): ~$13/month"
echo "  - Key Vault: ~$1/month"
echo "  - Application Insights: FREE tier (5GB/month)"
echo ""

# Save deployment info
cat > deploy/deployment-info.json <<EOF
{
  "deploymentDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "resourceGroup": "$RESOURCE_GROUP",
  "location": "$LOCATION",
  "appServicePlan": "$APP_SERVICE_PLAN",
  "appServiceName": "$APP_SERVICE_NAME",
  "appServiceUrl": "https://${APP_SERVICE_NAME}.azurewebsites.net",
  "keyVaultName": "$KEY_VAULT_NAME",
  "keyVaultUrl": "https://${KEY_VAULT_NAME}.vault.azure.net",
  "appInsightsName": "$APP_INSIGHTS_NAME",
  "managedIdentityPrincipalId": "$PRINCIPAL_ID",
  "estimatedMonthlyCost": "$14"
}
EOF

echo -e "${GREEN}Deployment info saved to: deploy/deployment-info.json${NC}"
