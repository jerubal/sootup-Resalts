#!/usr/bin/env node

/**
 * SootUp Static Analysis CI/CD Security Gate
 * 
 * Submits a target to the SootUp platform, polls for completion,
 * and breaks the build (exits 1) if taint chains or policy violations exceed thresholds.
 * 
 * Zero dependencies — uses Node.js standard library.
 */

const http = require('http');
const https = require('https');

const API_URL = process.env.SOOTUP_API_URL || 'http://localhost:8080';
const TARGET_PATH = process.env.TARGET_PATH || 'sample-target/target/classes';
const ENTRY_POINTS = (process.env.ENTRY_POINTS || 'com.sootup.sample.Main').split(',').map(s => s.trim());
const MAX_TAINT_CHAINS = parseInt(process.env.MAX_TAINT_CHAINS || '0', 10);
const MAX_POLICY_VIOLATIONS = parseInt(process.env.MAX_POLICY_VIOLATIONS || '0', 10);
const CG_ALGORITHM = process.env.CG_ALGORITHM || 'CHA';

console.log('=== SootUp Security Gate ===');
console.log(`API URL:         ${API_URL}`);
console.log(`Target Path:     ${TARGET_PATH}`);
console.log(`Entry Points:    ${ENTRY_POINTS.join(', ')}`);
console.log(`Max Allowed Taints:  ${MAX_TAINT_CHAINS}`);
console.log(`Max Allowed Policies: ${MAX_POLICY_VIOLATIONS}`);
console.log(`Algorithm:       ${CG_ALGORITHM}`);
console.log('============================\n');

function request(url, method, body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const parsed = new URL(url);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    // 1. Submit analysis job
    console.log('Submitting analysis job...');
    const submitPayload = {
      targetPath: TARGET_PATH,
      entryPoints: ENTRY_POINTS,
      bytecodeVersion: 17,
      analysisFlags: ['callGraph', 'cfg', 'jimple', 'taint'],
      cgAlgorithm: CG_ALGORITHM
    };

    const submitRes = await request(`${API_URL}/api/v1/analyses`, 'POST', submitPayload);
    const jobId = submitRes.jobId;
    console.log(`Job successfully submitted. ID: ${jobId}`);

    // 2. Poll job status
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max polling time (1s interval)

    while (!completed && attempts < maxAttempts) {
      attempts++;
      await new Promise(r => setTimeout(r, 1000));
      
      const statusRes = await request(`${API_URL}/api/v1/analyses/${jobId}`, 'GET');
      console.log(`Polling status [Attempt ${attempts}/${maxAttempts}]: ${statusRes.status} (${statusRes.progress}%)`);

      if (statusRes.status === 'COMPLETED') {
        completed = true;
      } else if (statusRes.status === 'FAILED' || statusRes.status === 'TIMED_OUT') {
        throw new Error(`SootUp job failed: ${statusRes.message}`);
      }
    }

    if (!completed) {
      throw new Error('Timeout waiting for SootUp analysis job to complete.');
    }

    // 3. Fetch results and check thresholds
    console.log('\nFetching analysis results...');
    const jobDetail = await request(`${API_URL}/api/v1/analyses/${jobId}`, 'GET');
    const taintChains = await request(`${API_URL}/api/v1/analyses/${jobId}/taint`, 'GET');

    const taintCount = taintChains.length;
    const policyCount = (jobDetail.policyViolations || []).length;

    console.log('\n=== Gate Evaluation ===');
    console.log(`Taint Chains Found:     ${taintCount} (Allowed: ${MAX_TAINT_CHAINS})`);
    console.log(`Policy Violations Found: ${policyCount} (Allowed: ${MAX_POLICY_VIOLATIONS})`);

    let failed = false;

    if (taintCount > MAX_TAINT_CHAINS) {
      console.log(`❌ FAILURE: Taint chains exceed limit of ${MAX_TAINT_CHAINS}`);
      failed = true;
    }
    if (policyCount > MAX_POLICY_VIOLATIONS) {
      console.log(`❌ FAILURE: Policy violations exceed limit of ${MAX_POLICY_VIOLATIONS}`);
      failed = true;
    }

    if (failed) {
      console.log('\n❌ SootUp Security Gate FAILED. Breaking build.');
      process.exit(1);
    } else {
      console.log('\n✅ SootUp Security Gate PASSED.');
      process.exit(0);
    }

  } catch (error) {
    console.error(`\n❌ Error running security gate: ${error.message}`);
    process.exit(1);
  }
}

run();
