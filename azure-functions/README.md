# Azure Functions - Email & SMS Senders

Async email and SMS sending functions that offload delivery from the main API.

## Benefits

- **Non-blocking**: Main API doesn't wait for email/SMS delivery (~1s saved per request)
- **Free tier**: 1M executions/month (way more than needed)
- **Retry support**: Azure Functions has built-in retry mechanisms
- **Scalable**: Auto-scales based on load

## Functions

### 1. Email Sender (`/api/email/send`)

- **Trigger**: HTTP POST
- **Auth**: Function key
- **Payload**:

```json
{
  "to": "customer@example.com",
  "subject": "Booking Confirmation",
  "text": "Plain text version",
  "html": "<p>HTML version</p>",
  "from": "optional@sender.com",
  "tenant": "agent_123"
}
```

### 2. SMS Sender (`/api/sms/send`)

- **Trigger**: HTTP POST
- **Auth**: Function key
- **Payload**:

```json
{
  "to": "+12025551234",
  "body": "Your appointment is confirmed",
  "type": "sms",
  "from": "+19998887777",
  "tenant": "agent_123"
}
```

For WhatsApp:

```json
{
  "to": "+12025551234",
  "body": "Your appointment is confirmed",
  "type": "whatsapp"
}
```

## Local Development

1. Install Azure Functions Core Tools:

```bash
npm install -g azure-functions-core-tools@4
```

2. Install dependencies:

```bash
cd azure-functions
npm install
```

3. Copy settings template:

```bash
cp local.settings.json.template local.settings.json
# Edit local.settings.json with your credentials
```

4. Start functions locally:

```bash
npm start
# Functions will run on http://localhost:7071
```

5. Test email function:

```bash
curl -X POST http://localhost:7071/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "text": "This is a test"
  }'
```

## Deployment to Azure

1. Login to Azure:

```bash
az login
```

2. Create Function App (if not exists):

```bash
az functionapp create \
  --resource-group square-middleware-prod-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --name square-middleware-async \
  --storage-account squaremiddlewarestorage
```

3. Deploy:

```bash
cd azure-functions
func azure functionapp publish square-middleware-async
```

4. Configure App Settings:

```bash
az functionapp config appsettings set \
  --name square-middleware-async \
  --resource-group square-middleware-prod-rg \
  --settings \
    EMAIL_SMTP_HOST="smtp.gmail.com" \
    EMAIL_SMTP_PORT="587" \
    EMAIL_SMTP_USER="your-email@gmail.com" \
    EMAIL_SMTP_PASS="your-app-password" \
    TWILIO_ACCOUNT_SID="your-sid" \
    TWILIO_AUTH_TOKEN="your-token" \
    TWILIO_SMS_FROM="+12025551234"
```

5. Get function keys:

```bash
# Email sender key
az functionapp function keys list \
  --name square-middleware-async \
  --resource-group square-middleware-prod-rg \
  --function-name email-sender

# SMS sender key
az functionapp function keys list \
  --name square-middleware-async \
  --resource-group square-middleware-prod-rg \
  --function-name sms-sender
```

6. Update main API environment variables:

```bash
# Add to .env.local in main API
AZURE_FUNCTION_EMAIL_URL=https://square-middleware-async.azurewebsites.net/api/email/send
AZURE_FUNCTION_EMAIL_KEY=your-function-key
AZURE_FUNCTION_SMS_URL=https://square-middleware-async.azurewebsites.net/api/sms/send
AZURE_FUNCTION_SMS_KEY=your-function-key
```

## Monitoring

View logs in Azure Portal:

- Navigate to Function App → Functions → [function-name] → Monitor
- Or use Application Insights for detailed telemetry

## Cost

- **Free tier**: 1M executions/month, 400,000 GB-s
- **Estimated usage**: ~1,000 emails/month = $0/month
- **Storage**: Minimal (~$0.01/month)

Total: **FREE** (well within free tier)
