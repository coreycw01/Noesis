import { NextResponse } from 'next/server';
import { apiErrorResponse, requireApiUser } from '@/lib/server/api-security';
import { readUsage } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
/** Counts change with every review, so this is never cached. */
export const dynamic = 'force-dynamic';

/**
 * What the signed-in person has spent of their AI allowance today.
 *
 * The counters live under `apiUsage`, which Firestore rules deny to every
 * client, so this is the only way a meter can show a true number. It reports
 * only the caller's own usage and never takes one.
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const usage = await readUsage(user.uid, 'ai', {
      tester: Boolean(user.token.tester || user.token.demo),
    });
    return NextResponse.json(usage, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
