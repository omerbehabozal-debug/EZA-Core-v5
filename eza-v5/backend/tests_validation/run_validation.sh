#!/bin/bash
# Pre-deployment Validation Test Runner

echo "=========================================="
echo "EZA-Core Pre-deployment Validation Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Run backend tests
echo "Running backend validation tests..."
echo "-----------------------------------"

cd "$(dirname "$0")/.." || exit

if pytest tests_validation/test_predeployment.py -v --tb=short; then
    echo -e "${GREEN}✅ Backend tests passed${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ Backend tests failed${NC}"
    FAILED=$((FAILED + 1))
fi

TOTAL=$((TOTAL + 1))

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Ready for Stage 7.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please fix before Stage 7.${NC}"
    exit 1
fi

