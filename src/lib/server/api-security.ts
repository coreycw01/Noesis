import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z, type ZodType } from 'zod';
import { adminAppCheck, adminAuth } from './firebase-admin';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export interface ApiUser {
  uid: string;
  token: DecodedIdToken;
  requestId: string;
}

function bearerToken(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

function appCheckRequired() {
  if (process.env.NOESIS_REQUIRE_APP_CHECK === 'false') return false;
  return process.env.NODE_ENV === 'production' || process.env.NOESIS_REQUIRE_APP_CHECK === 'true';
}

export async function requireApiUser(
  request: Request,
  options: { verifiedEmail?: boolean; appCheck?: boolean } = {},
): Promise<ApiUser> {
  const requestId = request.headers.get('x-request-id')?.slice(0, 100) || randomUUID();
  const token = bearerToken(request);
  if (!token) throw new ApiError(401, 'Sign in is required.', 'auth_required');

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new ApiError(401, 'Your session is invalid or expired. Sign in again.', 'invalid_auth');
  }

  if (options.verifiedEmail !== false && decoded.email_verified !== true) {
    throw new ApiError(403, 'Verify your email before using this service.', 'email_not_verified');
  }

  if (options.appCheck !== false && appCheckRequired()) {
    const appCheckToken = request.headers.get('x-firebase-appcheck') || '';
    if (!appCheckToken) throw new ApiError(403, 'App verification is required.', 'app_check_required');
    try {
      await adminAppCheck().verifyToken(appCheckToken);
    } catch {
      throw new ApiError(403, 'App verification failed.', 'invalid_app_check');
    }
  }

  return { uid: decoded.uid, token: decoded, requestId };
}

export async function parseBoundedJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes: number,
): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) {
    throw new ApiError(413, 'The request is too large.', 'request_too_large');
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new ApiError(413, 'The request is too large.', 'request_too_large');
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'The request body must be valid JSON.', 'invalid_json');
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message || 'The request is invalid.', 'invalid_request');
  }
  return result.data;
}

export function apiErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof ApiError) {
    const headers = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined;
    return NextResponse.json(
      { error: error.message, code: error.code, requestId },
      { status: error.status, headers },
    );
  }

  console.error('[API] Unhandled request error', { requestId, error });
  return NextResponse.json(
    { error: 'The request could not be completed safely.', code: 'internal_error', requestId },
    { status: 500 },
  );
}

export const publicUrlSchema = z.object({
  url: z.string().trim().url().max(2_048),
  type: z.string().trim().max(40).optional(),
}).strict();
