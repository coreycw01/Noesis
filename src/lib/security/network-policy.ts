import ipaddr from 'ipaddr.js';

export function isPublicInternetAddress(address: string) {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

export function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized === 'metadata.google.internal';
}
