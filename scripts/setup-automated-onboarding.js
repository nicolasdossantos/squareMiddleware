#!/usr/bin/env node

/**
 * Setup Script for Automated Onboarding
 * Helps configure the required environment variables
 */

const crypto = require('crypto');

console.log('\n🔐 Automated Onboarding Setup\n');
console.log('=' .repeat(60));

console.log('\n📋 Required Environment Variables:\n');

// Generate Admin API Key
const adminApiKey = crypto.randomBytes(32).toString('hex');
console.log('1. ADMIN_API_KEY (auto-generated):');
console.log(`   ${adminApiKey}\n`);

console.log('2. AZURE_SUBSCRIPTION_ID:');
console.log('   Find in: Azure Portal → Subscriptions → Overview\n');

console.log('3. AZURE_RESOURCE_GROUP:');
console.log('   Example: your-resource-group-name\n');

console.log('4. AZURE_APP_SERVICE_NAME:');
console.log('   Example: square-middleware-prod-api\n');

console.log('5. PUBLIC_URL (optional):');
console.log('   Example: https://square-middleware-prod-api.azurewebsites.net\n');

console.log('=' .repeat(60));

console.log('\n📝 Azure CLI Commands:\n');

console.log('# Get your subscription ID:');
console.log('az account show --query id -o tsv\n');

console.log('# Set environment variables in App Service:');
console.log(`az webapp config appsettings set \\
  --resource-group <your-resource-group> \\
  --name <your-app-service-name> \\
  --settings \\
    ADMIN_API_KEY="${adminApiKey}" \\
    AZURE_SUBSCRIPTION_ID="<your-subscription-id>" \\
    AZURE_RESOURCE_GROUP="<your-resource-group>" \\
    AZURE_APP_SERVICE_NAME="<your-app-service-name>" \\
    PUBLIC_URL="https://<your-app-service-name>.azurewebsites.net"
\n`);

console.log('# Enable System-assigned Managed Identity:');
console.log(`az webapp identity assign \\
  --resource-group <your-resource-group> \\
  --name <your-app-service-name>
\n`);

console.log('# Get the Managed Identity Principal ID:');
console.log(`PRINCIPAL_ID=$(az webapp identity show \\
  --resource-group <your-resource-group> \\
  --name <your-app-service-name> \\
  --query principalId -o tsv)
\n`);

console.log('# Grant Website Contributor role:');
console.log(`az role assignment create \\
  --assignee $PRINCIPAL_ID \\
  --role "Website Contributor" \\
  --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Web/sites/<app-service-name>
\n`);

console.log('=' .repeat(60));
console.log('\n✅ Setup complete! Deploy your changes and test the API.\n');
console.log('📚 See docs/AUTOMATED_ONBOARDING.md for usage examples.\n');
