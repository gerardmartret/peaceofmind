#!/bin/bash

# Drivania API Test Script
# Requests a quote and immediately confirms it with a refreshed token

set -euo pipefail

BASE_URL="https://preaws-publicapi.drivania.com"
USERNAME="gerardpapi"
PASSWORD="yNAF8uS1N74N"

LEAD_NAME=${LEAD_NAME:-"Gerard Martret"}
LEAD_EMAIL=${LEAD_EMAIL:-"gerard@drivania.com"}
LEAD_PHONE=${LEAD_PHONE:-"34612345678"}
CLIENT_REFERENCE=${CLIENT_REFERENCE:-"test-booking-gerard-$(date +%Y%m%d%H%M%S)"}

login() {
  local response
  response=$(curl -s -X POST "${BASE_URL}/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${USERNAME}\",
      \"password\": \"${PASSWORD}\"
    }")

  TOKEN=$(echo "$response" | python3 -c 'import sys, json; print(json.load(sys.stdin)["token"])')
  TOKEN_TTL=$(echo "$response" | python3 -c 'import sys, json; print(json.load(sys.stdin)["token_ttl"])')

  if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "$response" | python3 -m json.tool
    exit 1
  fi
}

echo "🔐 Logging in to Drivania API..."
echo "=================================="

login
echo "✅ Login successful!"
echo "Token expires: ${TOKEN_TTL}"
echo ""

echo "📋 Requesting quote..."
echo "=================================="

QUOTE_RESPONSE=$(curl -s -X POST "${BASE_URL}/quote-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d @- <<'JSON'
{
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
}
JSON
)

SERVICE_ID=$(QUOTE_RESPONSE="$QUOTE_RESPONSE" python3 - <<'PY'
import json, os
quote = json.loads(os.environ["QUOTE_RESPONSE"])
print(quote.get("service_id", ""))
PY
)

VEHICLE_ID=$(QUOTE_RESPONSE="$QUOTE_RESPONSE" python3 - <<'PY'
import json, os
quote = json.loads(os.environ["QUOTE_RESPONSE"])
vehicles = quote.get("quotes", {}).get("vehicles", [])
print(vehicles[0]["vehicle_id"] if vehicles else "")
PY
)

VEHICLE_COUNT=$(QUOTE_RESPONSE="$QUOTE_RESPONSE" python3 - <<'PY'
import json, os
quote = json.loads(os.environ["QUOTE_RESPONSE"])
vehicles = quote.get("quotes", {}).get("vehicles", [])
print(len(vehicles))
PY
)

if [ -z "$SERVICE_ID" ] || [ -z "$VEHICLE_ID" ]; then
  echo "❌ Failed to parse quote response:"
  echo "$QUOTE_RESPONSE" | python3 -m json.tool
  exit 1
fi

echo "✅ Quote received: service ${SERVICE_ID}, ${VEHICLE_COUNT} vehicle(s)"
echo ""

echo "📋 Creating service (booking)..."
echo "=================================="

SERVICE_RESPONSE=$(curl -s -X POST "${BASE_URL}/services" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"service_id\": \"${SERVICE_ID}\",
    \"vehicle_id\": \"${VEHICLE_ID}\",
    \"confirm\": true,
    \"lead_passenger\": {
      \"name\": \"${LEAD_NAME}\",
      \"phone_number\": \"${LEAD_PHONE}\",
      \"email\": \"${LEAD_EMAIL}\"
    },
    \"phone_number\": \"${LEAD_PHONE}\",
    \"comments\": \"Test booking creation for ${LEAD_EMAIL}\",
    \"arrival_flight_info\": {
      \"fbo_code\": \"LEBL\",
      \"transportation_number\": \"VY2208\"
    },
    \"departure_flight_info\": {
      \"fbo_code\": \"LEBL\",
      \"transportation_number\": null
    },
    \"childseats\": 0,
    \"boosters\": 0,
    \"fbo_code\": \"LEBL\",
    \"client_reference\": \"${CLIENT_REFERENCE}\",
    \"purchase_order\": \"${CLIENT_REFERENCE}\",
    \"contacts\": [
      {
        \"name\": \"${LEAD_NAME}\",
        \"email\": \"${LEAD_EMAIL}\",
        \"phone_number\": \"${LEAD_PHONE}\",
        \"recipient\": \"to\",
        \"permissions\": [
          {
            \"permission_name\": \"booking_confirmation\",
            \"email\": true,
            \"sms\": false
          }
        ]
      }
    ]
  }")

echo "$SERVICE_RESPONSE" | python3 -m json.tool

echo ""
echo "✅ Booking creation test completed!"

echo ""
echo "📋 Requesting special request (alternate endpoint)..."
echo "=================================="

SPECIAL_RESPONSE=$(curl -s -X POST "${BASE_URL}/special-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"service_id\": \"${SERVICE_ID}\",
    \"comments\": \"Special request test for ${CLIENT_REFERENCE}\",
    \"purchase_order\": \"${CLIENT_REFERENCE}\"
  }")

echo "$SPECIAL_RESPONSE" | python3 -m json.tool

