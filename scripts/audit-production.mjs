import { spawnSync } from 'node:child_process';

const acknowledgedUpstreamPackages = new Set([]);

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
    `Acknowledged upstream findings: ${acknowledged.map(({ name }) => name).join(', ')}`
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
