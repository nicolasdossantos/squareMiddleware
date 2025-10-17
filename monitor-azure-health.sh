#!/bin/bash
# Monitor Azure App Health and Uptime
# Usage: ./monitor-azure-health.sh

AZURE_URL="https://production-square-middleware-api.azurewebsites.net"
HEALTH_ENDPOINT="$AZURE_URL/api/health"

echo "🔍 Monitoring Azure App Service Health"
echo "======================================"
echo "App URL: $AZURE_URL"
echo "Health Endpoint: $HEALTH_ENDPOINT"
echo ""

# Check if app is responding
echo "📡 Checking connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$HEALTH_ENDPOINT")

if [ "$HTTP_CODE" = "000" ]; then
  echo "❌ App is DOWN - Connection failed"
  echo ""
  echo "Possible causes:"
  echo "  1. Deployment still in progress (wait 3-5 minutes)"
  echo "  2. App crashed during startup"
  echo "  3. Azure service issue"
  echo ""
  echo "Check Azure logs:"
  echo "  az webapp log tail --name square-middleware-prod-api --resource-group square-middleware-prod-rg"
  exit 1
fi

echo "✅ App is responding (HTTP $HTTP_CODE)"
echo ""

# Get detailed health info
echo "🩺 Health Check Response:"
echo "------------------------"
RESPONSE=$(curl -s -w "\n---\nHTTP: %{http_code}\nTime: %{time_total}s\nSize: %{size_download} bytes" "$HEALTH_ENDPOINT")
echo "$RESPONSE"
echo ""

# Extract uptime if available
UPTIME=$(echo "$RESPONSE" | grep -o '"uptime":[0-9]*' | grep -o '[0-9]*')
if [ -n "$UPTIME" ]; then
  UPTIME_MINS=$((UPTIME / 60))
  UPTIME_SECS=$((UPTIME % 60))
  echo "⏱️  Current Uptime: ${UPTIME_MINS}m ${UPTIME_SECS}s"
  
  if [ "$UPTIME" -lt 180 ]; then
    echo "⚠️  Warning: Low uptime (${UPTIME}s) - app may have recently restarted"
  else
    echo "✅ Good uptime - app is stable"
  fi
fi

echo ""
echo "💡 Tips:"
echo "  - Run this script every 5 minutes to monitor stability"
echo "  - Uptime should continuously increase"
echo "  - Response time should be <100ms for health checks"
echo ""
echo "🔗 Full health check: $HEALTH_ENDPOINT"
echo "🔗 Detailed health: $AZURE_URL/api/health/detailed"
