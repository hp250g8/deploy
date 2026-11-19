import { NextResponse } from 'next/server';

// POST /api/sms  { to, message, kind }
// This endpoint is the single place a real SMS provider is called.
// TODAY it only logs the message and returns { sent: false, status:
// "not_configured" } — because no MSG91 / Fast2SMS account exists yet.
// It never claims a message was sent.
//
// TO CONNECT A REAL PROVIDER (after DLT registration in India):
//  1. Set SMS_PROVIDER=msg91 (or fast2sms) plus the API key, sender ID
//     and template IDs in Vercel > Settings > Environment Variables.
//  2. Replace the `if (!provider)` branch below with a fetch() to:
//       MSG91:   https://api.msg91.com/api/v5/flow/  (POST, authkey header)
//       Fast2SMS: https://www.fast2sms.com/dev/bulkV2 (POST, authorization header)
//  3. Redeploy. The app's SMS log will then record sent / failed honestly.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase();
  if (!provider || !process.env.MSG91_API_KEY && !process.env.FAST2SMS_API_KEY) {
    return NextResponse.json({
      sent: false,
      status: 'not_configured',
      to: body.to || null,
      note: 'No SMS provider is configured. Set SMS_PROVIDER and the provider API key in Vercel environment variables, then redeploy. The message was written to the SMS log in the app.',
    });
  }
  return NextResponse.json({
    sent: false,
    status: 'not_implemented',
    note: 'Provider env vars are set, but the provider API call is not implemented yet. Add the fetch() call in src/app/api/sms/route.ts — see the comments there.',
  });
}
