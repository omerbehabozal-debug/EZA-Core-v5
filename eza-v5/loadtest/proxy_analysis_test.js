/**
 * EZA Proxy - Load Test Script (k6)
 * 
 * Usage:
 *   k6 run proxy_analysis_test.js
 * 
 * Environment Variables:
 *   LOADTEST_BASE_URL: Base URL for API (default: http://localhost:8000)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '10m', target: 20 },  // Soak test at 20 users
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(50)<1500', 'p(90)<3000', 'p(99)<5000'], // SLA targets
    'http_req_failed': ['rate<0.01'], // Less than 1% errors
  },
};

const BASE_URL = __ENV.LOADTEST_BASE_URL || 'http://localhost:8000';

export default function () {
  const payload = JSON.stringify({
    content: "Sample content with mild manipulation risk for testing. This content contains some potentially risky language that should trigger Stage-1 analysis.",
    input_type: "text",
    domain: "media",
    policies: ["TRT"],
    provider: "openai",
    return_report: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': 'test-org-' + Math.floor(Math.random() * 10), // Multiple test orgs
      'Authorization': 'Bearer test-token', // Mock token (will fail auth, but tests rate limiting)
    },
    timeout: '30s',
  };

  const res = http.post(`${BASE_URL}/proxy/analyze`, payload, params);

  check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'has overall_scores': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.overall_scores !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Check for rate limiting (429)
  if (res.status === 429) {
    console.log('Rate limit hit, backing off');
    sleep(2);
  }

  sleep(1); // Think time between requests
}

