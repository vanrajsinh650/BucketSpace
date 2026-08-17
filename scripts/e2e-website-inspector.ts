import http from 'node:http';
import assert from 'node:assert';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

async function fetchHttp(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
      }
    );

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runStep(suite: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ suite, name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✓ [${suite}] ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({
      suite,
      name,
      passed: false,
      durationMs: Date.now() - start,
      error: err?.message || String(err),
    });
    console.error(`  ✗ [${suite}] ${name}: ${err?.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('   BUCKETSPACE COMPREHENSIVE END-TO-END WEBSITE AUDIT');
  console.log('======================================================\n');

  // --- SUITE 1: API GATEWAY (PORT 4000) ---
  console.log('▶ Suite 1: API Gateway (http://localhost:4000)');

  await runStep('API Gateway', 'GET /healthz returns 200 OK with service metadata', async () => {
    const res = await fetchHttp('http://localhost:4000/healthz');
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.status, 'OK');
    assert.strictEqual(json.service, 'bucketspace-api');
  });

  await runStep('API Gateway', 'CORS headers allow web origin http://localhost:3000', async () => {
    const res = await fetchHttp('http://localhost:4000/healthz', {
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  });

  await runStep('API Gateway', 'POST /api/v1/telegram/upload/initiate handles invalid payload with 400 validation error', async () => {
    const res = await fetchHttp('http://localhost:4000/api/v1/telegram/upload/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalidField: true }),
    });
    assert.strictEqual(res.status, 400);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.errorCode, 'VALIDATION_ERROR');
  });

  await runStep('API Gateway', 'GET /unknown-route returns 404 Not Found', async () => {
    const res = await fetchHttp('http://localhost:4000/some-non-existent-route-xyz');
    assert.strictEqual(res.status, 404);
  });

  // --- SUITE 2: NEXT.JS FRONTEND (PORT 3000) ---
  console.log('\n▶ Suite 2: Next.js Frontend (http://localhost:3000)');

  let landingHtml = '';
  await runStep('Frontend', 'GET / returns 200 OK HTML stream with no errors', async () => {
    const res = await fetchHttp('http://localhost:3000/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('<!DOCTYPE html>'));
    landingHtml = res.body;
  });

  await runStep('Frontend', 'Landing Page contains Hero Title and Product Thesis', async () => {
    assert.ok(landingHtml.includes('Your Storage'));
    assert.ok(landingHtml.includes('One Workspace'));
    assert.ok(landingHtml.includes('Zero Lock-in'));
    assert.ok(landingHtml.includes('Telegram Cloud'));
    assert.ok(landingHtml.includes('Local SSD'));
  });

  await runStep('Frontend', 'Landing Page contains 4 Storage Backend Connect Cards', async () => {
    assert.ok(landingHtml.includes('Telegram Cloud'));
    assert.ok(landingHtml.includes('This Computer'));
    assert.ok(landingHtml.includes('Cloudflare R2'));
    assert.ok(landingHtml.includes('Supabase Storage'));
  });

  await runStep('Frontend', 'Landing Page contains Comparison Matrix & FAQ Accordion', async () => {
    assert.ok(landingHtml.includes('Why BucketSpace?'));
    assert.ok(landingHtml.includes('Google Drive / Dropbox'));
    assert.ok(landingHtml.includes('Frequently Asked Questions'));
    assert.ok(landingHtml.includes('How does Telegram Cloud storage work with BucketSpace?'));
  });

  await runStep('Frontend', 'Landing Page contains Security & Encryption Badges', async () => {
    assert.ok(landingHtml.includes('Client-Side AES-256'));
    assert.ok(landingHtml.includes('Envelope Encryption'));
    assert.ok(landingHtml.includes('Bit-Fidelity Checks'));
  });

  // --- SUITE 3: CLIENT BUNDLE & ASSETS ---
  console.log('\n▶ Suite 3: Client JavaScript Bundles & Static Assets');

  await runStep('Assets', 'Verify Next.js CSS and script tags exist in DOM', async () => {
    assert.ok(landingHtml.includes('/_next/static/'));
  });

  // --- SUMMARY ---
  console.log('\n======================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`   AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
