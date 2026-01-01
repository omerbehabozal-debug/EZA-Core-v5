#!/bin/bash
# Test Snapshot API - Debug Script

KEY="zveZEyjiW2aqBdlKpdeJbWnmaKv"
API_URL="https://api.ezacore.ai/api/public"

echo "=========================================="
echo "Testing Snapshot API"
echo "=========================================="
echo ""

echo "1. Testing Publish Endpoint..."
echo "   POST $API_URL/publish?period=daily"
echo "   Header: x-eza-publish-key: $KEY"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/publish?period=daily" \
  -H "x-eza-publish-key: $KEY")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "   Response Code: $HTTP_CODE"
echo "   Response Body: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Publish successful!"
else
  echo "❌ Publish failed!"
fi

echo ""
echo "2. Testing Read Endpoint..."
echo "   GET $API_URL/test-safety-benchmarks?period=daily"
echo "   Header: x-eza-publish-key: $KEY"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$API_URL/test-safety-benchmarks?period=daily" \
  -H "x-eza-publish-key: $KEY")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d' | head -c 200)

echo "   Response Code: $HTTP_CODE"
echo "   Response Body (first 200 chars): $BODY..."
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Read successful!"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ 403 Forbidden - Key mismatch or missing!"
  echo "   Check:"
  echo "   - Backend PUBLIC_SNAPSHOT_KEY = $KEY"
  echo "   - Frontend NEXT_PUBLIC_SNAPSHOT_KEY = $KEY"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "⚠️  404 Not Found - No snapshot available"
  echo "   Run publish first!"
else
  echo "❌ Error: HTTP $HTTP_CODE"
fi

echo ""
echo "=========================================="

