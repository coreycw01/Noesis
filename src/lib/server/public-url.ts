import 'server-only';

import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import { ApiError } from './api-security';
import { isBlockedHostname, isPublicInternetAddress } from '@/lib/security/network-policy';

const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export interface VerifiedPublicResource {
  url: URL;
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
}

async function resolvePublicAddress(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ApiError(400, 'Only public http and https URLs can be imported.', 'invalid_url_protocol');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (isBlockedHostname(hostname)) {
    throw new ApiError(400, 'Local or internal URLs cannot be imported.', 'private_url');
  }

  if (net.isIP(hostname)) {
    if (!isPublicInternetAddress(hostname)) throw new ApiError(400, 'Private network URLs cannot be imported.', 'private_url');
    return { address: hostname, family: net.isIPv6(hostname) ? 6 : 4 };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true }) as Array<{ address: string; family: number }>;
  } catch {
    throw new ApiError(422, 'The URL hostname could not be resolved.', 'dns_failed');
  }
  if (!addresses.length || addresses.some((entry) => !isPublicInternetAddress(entry.address))) {
    throw new ApiError(400, 'Private or ambiguous network URLs cannot be imported.', 'private_url');
  }
  return addresses[0];
}

async function readLimitedText(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    throw new ApiError(413, 'The remote response is too large to import safely.', 'response_too_large');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, 'The remote response is too large to import safely.', 'response_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchVerifiedPublicResource(
  initialUrl: URL,
  options: {
    headers?: HeadersInit;
    maxBytes?: number;
    timeoutMs?: number;
    allowedContentTypes?: string[];
  } = {},
): Promise<VerifiedPublicResource> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const resolved = await resolvePublicAddress(url);
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname: string, lookupOptions: any, callback: (...args: any[]) => void) => {
          if (lookupOptions?.all) {
            callback(null, [{ address: resolved.address, family: resolved.family }]);
          } else {
            callback(null, resolved.address, resolved.family);
          }
        },
      },
    });

    try {
      const response = await undiciFetch(url, {
        headers: options.headers,
        method: 'GET',
        redirect: 'manual',
        dispatcher,
        signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS),
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new ApiError(422, 'Redirect response is missing a location.', 'invalid_redirect');
        if (redirects === MAX_REDIRECTS) throw new ApiError(422, 'Too many redirects.', 'too_many_redirects');
        url = new URL(location, url);
        continue;
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        options.allowedContentTypes?.length
        && !options.allowedContentTypes.some((allowed) => contentType.includes(allowed))
      ) {
        throw new ApiError(415, 'The remote resource type is not supported.', 'unsupported_content_type');
      }

      const text = await readLimitedText(
        response as unknown as Response,
        options.maxBytes || DEFAULT_MAX_RESPONSE_BYTES,
      );
      return {
        url,
        status: response.status,
        ok: response.ok,
        headers: new Headers(response.headers as unknown as HeadersInit),
        text,
      };
    } finally {
      await dispatcher.close();
    }
  }
  throw new ApiError(422, 'Too many redirects.', 'too_many_redirects');
}
