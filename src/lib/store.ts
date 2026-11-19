import { supabase, isSupabaseConfigured } from './supabase';
import { approvalRequestMessage, approvedMessage, declinedMessage, rewardReadyMessage, redeemedMessage, type SmsKind } from './sms';
import { hashPin } from './pin';

export interface Customer {
  id: string; member_id: string; full_name: string; mobile: string;
  stamps: number; total_approved: number; completed_cards: number;
  rewards_redeemed: number; reward_ready: boolean; status: string; created_at: string;
}
export interface Txn {
  id: string; customer_id: string; member_id: string; customer_name: string; mobile: string;
  item_name: string; quantity: number; status: 'pending' | 'approved' | 'declined';
  reason: string | null; created_at: string; decided_at: string | null;
}
export interface Redemption { id: string; customer_id: string; member_id: string; customer_name: string; redeemed_at: string; }
export interface MenuItem { id: string; name: string; price: number; active: boolean; }
export interface SmsEntry { id: string; kind: SmsKind; to_mobile: string; message: string; status: string; provider: string | null; created_at: string; }
export interface AuditEntry { id: string; action: string; detail: string; member_id: string | null; created_at: string; }
export interface Settings { pin_hash: string | null; stamps_needed: number; }

export interface State {
  customers: Customer[]; txns: Txn[]; redemptions: Redemption[];
  menu: MenuItem[]; sms: SmsEntry[]; audit: AuditEntry[]; settings: Settings;
}

export const INITIAL_MENU: MenuItem[] = [
  { id: 'm1', name: 'Classic Vada Pav', price: 40, active: true },
  { id: 'm2', name: 'Cheese Vada Pav', price: 70, active: true },
  { id: 'm3', name: 'Ulta Vada Pav', price: 60, active: true },
  { id: 'm4', name: 'Shezwan Vada Pav', price: 60, active: true },
  { id: 'm5', name: 'Dabeli', price: 40, active: true },
  { id: 'm6', name: 'Pav Bhaji', price: 80, active: true },
  { id: 'm7', name: 'Combo (Classic Vada Pav + Dabeli)', price: 50, active: true },
];

export const emptyState = (): State => ({
  customers: [], txns: [], redemptions: [], menu: INITIAL_MENU,
  sms: [], audit: [], settings: { pin_hash: null, stamps_needed: 10 },
});

const LS_KEY = 'hc-loyalty-v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();
const cleanMobile = (m: string) => m.replace(/\D/g, '').slice(-10);

// Every SMS is written to the log. Status is "not_configured" until a
// real provider is set up — nothing is ever claimed sent.
function smsEntry(kind: SmsKind, to: string, message: string): SmsEntry {
  return { id: uid(), kind, to_mobile: to, message, status: 'not_configured', provider: null, created_at: now() };
}

export class Store {
  state: State = emptyState();
  listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  emit() { this.listeners.forEach((f) => f()); }

  async load() {
    if (isSupabaseConfigured && supabase) {
      const [c, t, r, m, s, a, set] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('redemptions').select('*').order('redeemed_at', { ascending: false }),
        supabase.from('menu_items').select('*').order('created_at'),
        supabase.from('sms_log').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('settings').select('*').eq('id', 1).single(),
      ]);
      this.state = {
        customers: (c.data as Customer[]) || [],
        txns: (t.data as Txn[]) || [],
        redemptions: (r.data as Redemption[]) || [],
        menu: ((m.data as MenuItem[]) || []).length ? (m.data as MenuItem[]) : INITIAL_MENU,
        sms: (s.data as SmsEntry[]) || [],
        audit: (a.data as AuditEntry[]) || [],
        settings: set.data ? { pin_hash: set.data.pin_hash, stamps_needed: set.data.stamps_needed } : { pin_hash: null, stamps_needed: 10 },
      };
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) this.state = { ...emptyState(), ...JSON.parse(raw) };
      } catch { /* fresh start */ }
    }
    this.emit();
  }

  private async persist() {
    if (isSupabaseConfigured) return; // Supabase writes happen per-action below
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
    this.emit();
  }
  private async sbInsert(table: string, row: object) {
    if (isSupabaseConfigured && supabase) await supabase.from(table).insert(row as never);
  }
  private async sbUpdate(table: string, id: string, patch: Record<string, unknown>) {
    if (isSupabaseConfigured && supabase) await supabase.from(table).update(patch as never).eq('id', id);
  }
  private audit(action: string, detail: string, member_id: string | null = null) {
    const e: AuditEntry = { id: uid(), action, detail, member_id, created_at: now() };
    this.state.audit = [e, ...this.state.audit];
    this.sbInsert('audit_log', { action, detail, member_id });
  }
  private logSms(kind: SmsKind, to: string, message: string) {
    const e = smsEntry(kind, to, message);
    this.state.sms = [e, ...this.state.sms];
    this.sbInsert('sms_log', { kind, to_mobile: to, message, status: 'not_configured', provider: null });
    // When a provider is configured, /api/sms is called from here in
    // production — until then the entry above is the honest record.
  }

  async register(fullName: string, mobileRaw: string): Promise<{ customer?: Customer; error?: string }> {
    const mobile = cleanMobile(mobileRaw);
    if (fullName.trim().length < 2) return { error: 'Please enter your full name.' };
    if (mobile.length !== 10) return { error: 'Please enter a valid 10-digit mobile number.' };
    const existing = this.state.customers.find((c) => c.mobile === mobile);
    if (existing) return { customer: existing }; // one card per mobile, no duplicates
    const member_id = 'HC-' + String(this.state.customers.length + 1).padStart(4, '0');
    const customer: Customer = {
      id: uid(), member_id, full_name: fullName.trim(), mobile,
      stamps: 0, total_approved: 0, completed_cards: 0, rewards_redeemed: 0,
      reward_ready: false, status: 'active', created_at: now(),
    };
    this.state.customers = [customer, ...this.state.customers];
    this.audit('register', `${customer.full_name} registered (${member_id})`, member_id);
    this.logSms('registration', mobile, `Welcome ${customer.full_name}! Your Hygienic Cart loyalty card is ready. Member ID: ${member_id}. Eat 10 times, 11th Vada Pav FREE.`);
    await this.sbInsert('customers', customer);
    await this.persist();
    return { customer };
  }

  async requestStamp(customerId: string): Promise<{ error?: string }> {
    const c = this.state.customers.find((x) => x.id === customerId);
    if (!c) return { error: 'Customer not found.' };
    if (this.state.txns.some((t) => t.customer_id === customerId && t.status === 'pending'))
      return { error: 'You already have a pending stamp request. Please wait for the owner to accept it.' };
    const txn: Txn = {
      id: uid(), customer_id: c.id, member_id: c.member_id, customer_name: c.full_name,
      mobile: c.mobile, item_name: 'Purchase at Hygienic Cart', quantity: 1,
      status: 'pending', reason: null, created_at: now(), decided_at: null,
    };
    this.state.txns = [txn, ...this.state.txns];
    this.audit('request', `${c.full_name} requested a stamp`, c.member_id);
    // Admin notification — logged, not claimed sent (see sms.ts).
    this.logSms('approval_request', c.mobile, approvalRequestMessage(c.full_name, c.mobile, c.member_id));
    await this.sbInsert('transactions', txn);
    await this.persist();
    return {};
  }

  async decideTxn(txnId: string, approve: boolean, reason = ''): Promise<{ error?: string }> {
    const t = this.state.txns.find((x) => x.id === txnId);
    if (!t) return { error: 'Request not found.' };
    if (t.status !== 'pending') return { error: 'This request has already been decided.' }; // prevents duplicate approvals
    const c = this.state.customers.find((x) => x.id === t.customer_id);
    if (!c) return { error: 'Customer not found.' };
    t.status = approve ? 'approved' : 'declined';
    t.reason = approve ? null : reason || null;
    t.decided_at = now();
    if (approve) {
      // 1 approved purchase = 1 stamp, regardless of item or quantity.
      c.total_approved += 1;
      c.stamps += 1;
      if (c.stamps >= this.state.settings.stamps_needed) {
        c.stamps = this.state.settings.stamps_needed;
        c.reward_ready = true;
        c.completed_cards += 1;
        this.logSms('reward_ready', c.mobile, rewardReadyMessage(c.full_name));
      }
      this.logSms('approved', c.mobile, approvedMessage(c.full_name, c.stamps, this.state.settings.stamps_needed));
      this.audit('approve', `Approved stamp for ${c.full_name} — now ${c.stamps}/${this.state.settings.stamps_needed}`, c.member_id);
    } else {
      this.logSms('declined', c.mobile, declinedMessage(c.full_name, reason));
      this.audit('decline', `Declined stamp for ${c.full_name}${reason ? ` — ${reason}` : ''}`, c.member_id);
    }
    await this.sbUpdate('transactions', t.id, { status: t.status, reason: t.reason, decided_at: t.decided_at });
    await this.sbUpdate('customers', c.id, { stamps: c.stamps, total_approved: c.total_approved, completed_cards: c.completed_cards, reward_ready: c.reward_ready });
    await this.persist();
    return {};
  }

  async redeem(customerId: string): Promise<{ error?: string }> {
    const c = this.state.customers.find((x) => x.id === customerId);
    if (!c) return { error: 'Customer not found.' };
    if (!c.reward_ready) return { error: 'This customer has not completed 10 stamps yet.' };
    c.stamps = 0; c.reward_ready = false; c.rewards_redeemed += 1;
    const r: Redemption = { id: uid(), customer_id: c.id, member_id: c.member_id, customer_name: c.full_name, redeemed_at: now() };
    this.state.redemptions = [r, ...this.state.redemptions];
    this.logSms('redeemed', c.mobile, redeemedMessage(c.full_name));
    this.audit('redeem', `FREE Vada Pav redeemed for ${c.full_name} — new cycle started`, c.member_id);
    await this.sbInsert('redemptions', r);
    await this.sbUpdate('customers', c.id, { stamps: 0, reward_ready: false, rewards_redeemed: c.rewards_redeemed });
    await this.persist();
    return {};
  }

  async setPin(pin: string) {
    const hash = await hashPin(pin);
    this.state.settings.pin_hash = hash;
    this.audit('pin_change', 'Owner PIN set / changed');
    if (isSupabaseConfigured && supabase) await supabase.from('settings').update({ pin_hash: hash } as never).eq('id', 1);
    await this.persist();
  }
  async setStampsNeeded(n: number) {
    this.state.settings.stamps_needed = n;
    if (isSupabaseConfigured && supabase) await supabase.from('settings').update({ stamps_needed: n } as never).eq('id', 1);
    await this.persist();
  }
  async saveMenu(items: MenuItem[]) {
    this.state.menu = items;
    this.audit('menu_change', 'Menu updated');
    if (isSupabaseConfigured && supabase) {
      await supabase.from('menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('menu_items').insert(items.map(({ name, price, active }) => ({ name, price, active })) as never);
    }
    await this.persist();
  }
  async setCustomerStatus(id: string, status: string) {
    const c = this.state.customers.find((x) => x.id === id);
    if (c) { c.status = status; await this.sbUpdate('customers', id, { status }); await this.persist(); }
  }
}

export const store = new Store();
