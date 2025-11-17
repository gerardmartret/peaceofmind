#!/bin/bash

# Drivania API Test Script
# Tests login and quote request

BASE_URL="https://preaws-publicapi.drivania.com"
USERNAME="gerardpapi"
PASSWORD="yNAF8uS1N74N"

echo "🔐 Logging in to Drivania API..."
echo "=================================="

# Login
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"password\": \"${PASSWORD}\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE" | python3 -m json.tool
  exit 1
fi

echo "✅ Login successful!"
echo "Token expires: $(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['token_ttl'])")"
echo ""

echo "📋 Requesting quote..."
echo "=================================="

# Quote Request
QUOTE_RESPONSE=$(curl -s -X POST "${BASE_URL}/quote-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "service_type": "one-way",
    "pickup": {
        "name": "BCN LEBL Barcelona El Prat Airport",
        "latitude": 41.297445,
        "longitude": 2.0811053,
        "location_type": "airport",
        "datetime": "2025-12-15 11:30:00"
    },
    "dropoff": {
        "name": "Casino BCN",
        "latitude": 41.38717,
        "longitude": 2.199746,
        "location_type": "other",
        "datetime": null
    },
    "passengers_number": 1
}')

echo "$QUOTE_RESPONSE" | python3 -m json.tool

echo ""
echo "✅ Quote request completed!"
echo ""

# Extract service_id
SERVICE_ID=$(echo $QUOTE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['service_id'])" 2>/dev/null)
if [ ! -z "$SERVICE_ID" ]; then
  echo "📝 Service ID: $SERVICE_ID"
  
  # Count vehicles
  VEHICLE_COUNT=$(echo $QUOTE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('quotes', {}).get('vehicles', [])))" 2>/dev/null)
  if [ ! -z "$VEHICLE_COUNT" ]; then
    echo "🚗 Available vehicles: $VEHICLE_COUNT"
  fi
fi

