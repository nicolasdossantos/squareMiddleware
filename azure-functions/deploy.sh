#!/bin/bash
#
# Deploy Azure Functions
#

set -e

FUNCTION_APP_NAME="square-middleware-functions"
RESOURCE_GROUP="square-middleware-prod-rg"

echo "🚀 Deploying Azure Functions..."

# Check if logged in
if ! az account show &>/dev/null; then
  echo "Not logged in to Azure. Running 'az login'..."
  az login
fi

# Navigate to functions directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Deploy
echo "🔧 Deploying to Azure..."
func azure functionapp publish "$FUNCTION_APP_NAME" --node

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Configure app settings (email, SMS credentials)"
echo "2. Get function keys"
echo "3. Update main API .env with function URLs and keys"
echo ""
echo "Run these commands:"
echo "  az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings ..."
echo "  az functionapp function keys list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --function-name email-sender"
