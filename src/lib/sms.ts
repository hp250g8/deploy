// SMS — honest by design.
//
// There is NO SMS provider account yet (no MSG91 / Fast2SMS).
// Until Sarthak adds one, every notification is written to the SMS log
// with status "not_configured" and the app says so plainly. Nothing is
// ever claimed sent when it was not.
//
// To connect a real provider:
//  1. Create an account at msg91.com or fast2sms.com.
//  2. Complete DLT registration (required in India for business SMS).
//  3. Get the API key, sender ID and approved template IDs.
//  4. Set SMS_PROVIDER, the API key and template IDs in Vercel env vars
//     (see .env.example) and redeploy.
//  5. Implement the provider call in /src/app/api/sms/route.ts —
//     the endpoint is already wired to this log. OTP verification
//     switches on only once SMS is configured.

export type SmsKind =
  | 'registration'
  | 'approval_request'
  | 'approved'
  | 'declined'
  | 'reward_ready'
  | 'redeemed';

export function approvalRequestMessage(name: string, mobile: string, memberId: string) {
  return `NEW PURCHASE REQUEST!\nCustomer: ${name}\nMobile: ${mobile}\nCustomer ID: ${memberId}\nPlease log in to your admin dashboard to ACCEPT or DECLINE.`;
}

export function approvedMessage(name: string, stamps: number, needed: number) {
  return `Congratulations ${name}! Your purchase has been approved. Your loyalty progress is now ${stamps}/${needed}. Keep enjoying Hygienic Cart!`;
}

export function declinedMessage(name: string, reason: string) {
  return `Hi ${name}, your Hygienic Cart purchase request was declined${reason ? `: ${reason}` : ''}. Please ask at the cart if you think this is a mistake.`;
}

export function rewardReadyMessage(name: string) {
  return `Congratulations ${name}! You have completed 10 stamps. Your FREE Vada Pav is waiting at Hygienic Cart — show your card at the cart to redeem it.`;
}

export function redeemedMessage(name: string) {
  return `Thank you ${name}! Your FREE Vada Pav has been redeemed. A new loyalty cycle has started — 0/10 stamps. Keep enjoying Hygienic Cart!`;
}
