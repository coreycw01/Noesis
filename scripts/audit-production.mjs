import { spawnSync } from 'node:child_process';

// These packages are inherited from Genkit's current Google Cloud telemetry
// stack. Genkit 1.40.1 has no patched dependency path for them yet. The API
// boundary is authenticated, rate limited, input bounded, and does not expose
// the telemetry server. Unknown high/critical findings still fail this check.
const acknowledgedUpstreamPackages = new Set([
  '@genkit-ai/core',
  '@genkit-ai/firebase',
  '@genkit-ai/google-cloud',
  '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/propagator-jaeger',
  '@opentelemetry/sdk-node',
  '@opentelemetry/sdk-trace-node',
  'brace-expansion',
  'gaxios',
  'gcp-metadata',
  'glob',
  'google-gax',
  'minimatch',
  'rimraf',
]);

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = npmCli
  ? [npmCli, 'audit', '--omit=dev', '--json']
  : ['audit', '--omit=dev', '--json'];
const result = spawnSync(command, args, {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (!result.stdout) {
  console.error(result.stderr || 'npm audit did not return a report.');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit returned invalid JSON.');
  process.exit(1);
}

const severe = Object.entries(report.vulnerabilities ?? {})
  .filter(([, vulnerability]) =>
    vulnerability.severity === 'critical' || vulnerability.severity === 'high')
  .map(([name, vulnerability]) => ({ name, severity: vulnerability.severity }));

const unexpected = severe.filter(({ name }) => !acknowledgedUpstreamPackages.has(name));
const acknowledged = severe.filter(({ name }) => acknowledgedUpstreamPackages.has(name));

if (acknowledged.length > 0) {
  console.warn(
    `Acknowledged upstream Genkit findings: ${acknowledged.map(({ name }) => name).join(', ')}`
  );
}

if (unexpected.length > 0) {
  console.error(
    `Unapproved high/critical production advisories: ${unexpected
      .map(({ name, severity }) => `${name} (${severity})`)
      .join(', ')}`
  );
  process.exit(1);
}

console.log('No unapproved high or critical production advisories found.');
