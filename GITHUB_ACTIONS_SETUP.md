# GitHub Actions Deployment Setup

## Service Principal Created ✅

A service principal has been created for GitHub Actions deployment.

**IMPORTANT:** The credentials below must be added as a GitHub secret named `AZURE_CREDENTIALS`.

## Step 1: Get the Azure Credentials

The Azure service principal credentials have been created and are stored securely.

**To retrieve the credentials, run:**

```bash
# This will display the credentials JSON needed for GitHub
az ad sp create-for-rbac \
  --name "square-middleware-github-actions" \
  --role contributor \
  --scopes /subscriptions/543ba6e2-30c1-48a0-9718-769a1f80fd82/resourceGroups/square-middleware-prod-rg \
  --sdk-auth
```

Copy the entire JSON output (including the curly braces).

## Step 2: Add to GitHub Secrets

1. Go to: https://github.com/nicolasdossantos/squareMiddleware/settings/secrets/actions

2. Click **"New repository secret"**

3. Name: `AZURE_CREDENTIALS`

4. Value: Paste the entire JSON above (including the curly braces)

5. Click **"Add secret"**

## Step 3: Test the Deployment

Once the secret is added, the next push to `main` will automatically trigger a deployment.

You can also manually trigger it:
1. Go to: https://github.com/nicolasdossantos/squareMiddleware/actions
2. Click on "Deploy to Azure App Service"
3. Click "Run workflow"

## Workflow Details

- **Trigger:** Automatic on push to `main` branch, or manual via workflow_dispatch
- **Steps:**
  1. Checkout code
  2. Set up Node.js 20.x
  3. Install dependencies with `npm ci`
  4. Run tests with `npm test`
  5. Login to Azure
  6. Deploy to Azure Web App: `square-middleware-prod-api`
  7. Logout from Azure

## Security Notes

- ✅ Service principal has Contributor role ONLY on the resource group `square-middleware-prod-rg`
- ✅ Cannot access other subscriptions or resource groups
- ✅ Credentials are stored as encrypted GitHub secrets
- ✅ Never commit these credentials to git

## Testing Locally

To test the app before deployment:
```bash
npm install
npm test
npm start
```

## Monitoring Deployments

- GitHub Actions: https://github.com/nicolasdossantos/squareMiddleware/actions
- Azure Portal: https://portal.azure.com/#@/resource/subscriptions/543ba6e2-30c1-48a0-9718-769a1f80fd82/resourceGroups/square-middleware-prod-rg/providers/Microsoft.Web/sites/square-middleware-prod-api
- App URL: https://square-middleware-prod-api.azurewebsites.net
- Health Check: https://square-middleware-prod-api.azurewebsites.net/api/health
