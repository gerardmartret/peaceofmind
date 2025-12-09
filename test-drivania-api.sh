#!/bin/bash

# Test script to diagnose Drivania API service creation issues
# This script helps identify if service_id and vehicle_id mismatches are the problem

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Drivania API Test Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if credentials are set
if [ -z "$DRIVANIA_API_USERNAME" ] || [ -z "$DRIVANIA_API_PASSWORD" ]; then
  echo "❌ Error: DRIVANIA_API_USERNAME and DRIVANIA_API_PASSWORD must be set"
  echo "   Run: export DRIVANIA_API_USERNAME=your_username"
  echo "        export DRIVANIA_API_PASSWORD=your_password"
  exit 1
fi

BASE_URL="${DRIVANIA_API_BASE_URL:-https://preaws-publicapi.drivania.com}"

echo "📡 Step 1: Login to get token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${DRIVANIA_API_USERNAME}\",
    \"password\": \"${DRIVANIA_API_PASSWORD}\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed:"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

echo "📋 Step 2: Request a quote"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Using sample coordinates (Boston Logan Airport to Downtown Boston)"
echo ""

QUOTE_RESPONSE=$(curl -s -X POST "${BASE_URL}/quotes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "service_type": "one-way",
    "pickup": {
      "name": "Boston Logan International Airport",
      "latitude": 42.3656,
      "longitude": -71.0096,
      "location_type": "airport",
      "datetime": "2024-12-20T10:00:00Z"
    },
    "dropoff": {
      "name": "Boston Downtown",
      "latitude": 42.3601,
      "longitude": -71.0589,
      "location_type": "other",
      "datetime": null
    },
    "passengers_number": 2
  }')

echo "$QUOTE_RESPONSE" | jq '.' 2>/dev/null || echo "$QUOTE_RESPONSE"
echo ""

SERVICE_ID=$(echo $QUOTE_RESPONSE | grep -o '"service_id":"[^"]*' | cut -d'"' -f4)
FIRST_VEHICLE_ID=$(echo $QUOTE_RESPONSE | grep -o '"vehicle_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$SERVICE_ID" ] || [ -z "$FIRST_VEHICLE_ID" ]; then
  echo "❌ Failed to extract service_id or vehicle_id from quote"
  exit 1
fi

echo "✅ Quote received:"
echo "   Service ID: $SERVICE_ID"
echo "   First Vehicle ID: $FIRST_VEHICLE_ID"
echo ""

echo "🔄 Step 3: Request a NEW quote (simulating quote refresh)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NEW_QUOTE_RESPONSE=$(curl -s -X POST "${BASE_URL}/quotes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "service_type": "one-way",
    "pickup": {
      "name": "Boston Logan International Airport",
      "latitude": 42.3656,
      "longitude": -71.0096,
      "location_type": "airport",
      "datetime": "2024-12-20T10:00:00Z"
    },
    "dropoff": {
      "name": "Boston Downtown",
      "latitude": 42.3601,
      "longitude": -71.0589,
      "location_type": "other",
      "datetime": null
    },
    "passengers_number": 2
  }')

NEW_SERVICE_ID=$(echo $NEW_QUOTE_RESPONSE | grep -o '"service_id":"[^"]*' | cut -d'"' -f4)
NEW_FIRST_VEHICLE_ID=$(echo $NEW_QUOTE_RESPONSE | grep -o '"vehicle_id":"[^"]*' | head -1 | cut -d'"' -f4)

echo "✅ New quote received:"
echo "   New Service ID: $NEW_SERVICE_ID"
echo "   New First Vehicle ID: $NEW_FIRST_VEHICLE_ID"
echo ""

echo "🧪 Step 4: Test service creation with MATCHING IDs (should work)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Using NEW service_id with NEW vehicle_id..."

SERVICE_CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/services?confirm=false" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"service_id\": \"${NEW_SERVICE_ID}\",
    \"vehicle_id\": \"${NEW_FIRST_VEHICLE_ID}\",
    \"lead_passenger\": {
      \"name\": \"Test User\",
      \"phone_number\": \"+1234567890\",
      \"email\": \"test@example.com\"
    },
    \"phone_number\": \"+1234567890\",
    \"comments\": \"Test booking\",
    \"childseats\": 0,
    \"boosters\": 0,
    \"client_reference\": \"test-$(date +%s)\",
    \"purchase_order\": \"test-$(date +%s)\",
    \"contacts\": [
      {
        \"name\": \"Test User\",
        \"email\": \"test@example.com\",
        \"phone_number\": \"+1234567890\",
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

echo "$SERVICE_CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$SERVICE_CREATE_RESPONSE"
echo ""

if echo "$SERVICE_CREATE_RESPONSE" | grep -q "service_reference"; then
  echo "✅ Service created successfully with matching IDs"
else
  echo "❌ Service creation failed even with matching IDs"
fi

echo ""
echo "🧪 Step 5: Test service creation with MISMATCHED IDs (should fail)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Using NEW service_id with OLD vehicle_id (this is the bug scenario)..."

MISMATCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/services?confirm=false" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"service_id\": \"${NEW_SERVICE_ID}\",
    \"vehicle_id\": \"${FIRST_VEHICLE_ID}\",
    \"lead_passenger\": {
      \"name\": \"Test User\",
      \"phone_number\": \"+1234567890\",
      \"email\": \"test@example.com\"
    },
    \"phone_number\": \"+1234567890\",
    \"comments\": \"Test booking with mismatch\",
    \"childseats\": 0,
    \"boosters\": 0,
    \"client_reference\": \"test-mismatch-$(date +%s)\",
    \"purchase_order\": \"test-mismatch-$(date +%s)\",
    \"contacts\": [
      {
        \"name\": \"Test User\",
        \"email\": \"test@example.com\",
        \"phone_number\": \"+1234567890\",
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

echo "$MISMATCH_RESPONSE" | jq '.' 2>/dev/null || echo "$MISMATCH_RESPONSE"
echo ""

if echo "$MISMATCH_RESPONSE" | grep -q "cannot be confirmed"; then
  echo "✅ Confirmed: Mismatched IDs cause 'cannot be confirmed' error"
  echo "   This is the bug we're experiencing!"
else
  echo "⚠️  Unexpected response for mismatched IDs"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Original Service ID: $SERVICE_ID"
echo "Original Vehicle ID: $FIRST_VEHICLE_ID"
echo "New Service ID:      $NEW_SERVICE_ID"
echo "New Vehicle ID:       $NEW_FIRST_VEHICLE_ID"
echo ""
echo "🔍 Issue: When quotes are refreshed, we must use the vehicle_id"
echo "   from the NEW quotes, not the stored one, OR we must use"
echo "   the stored service_id if using stored vehicle_id"
echo ""
