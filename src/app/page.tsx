'use client';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { store, type Customer, type MenuItem } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { hashPin, verifyPin } from '@/lib/pin';

const ADMIN_MOBILE = process.env.NEXT_PUBLIC_ADMIN_MOBILE || '';

function downloadQrPng(svgId: string, filename: string) {
  const svg = document.getElementById(svgId) as unknown as SVGSVGElement | null;
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, 0, 0, 512, 512);
    const a = document.createElement('a');
    a.download = filename; a.href = canvas.toDataURL('image/png'); a.click();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}

export default function Home() {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<'card' | 'owner'>('card');
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [ownerTab, setOwnerTab] = useState('dashboard');
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pinMsg, setPinMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [newItem, setNewItem] = useState({ name: '', price: '' });
  const [stampsNeeded, setStampsNeeded] = useState(10);

  useEffect(() => { store.load().then(() => { setLoaded(true); setStampsNeeded(store.state.settings.stamps_needed); }); return store.subscribe(() => setTick((t) => t + 1)); }, []);
  useEffect(() => { try { const id = localStorage.getItem('hc-me'); if (id) setMeId(id); } catch { /* ignore */ } }, []);

  const s = store.state;
  const me: Customer | null = useMemo(() => s.customers.find((c) => c.id === meId) || null, [s, meId]);
  const joinUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const pending = s.txns.filter((t) => t.status === 'pending');
  const stats = {
    total: s.customers.length,
    active: s.customers.filter((c) => c.status === 'active').length,
    completed: s.customers.reduce((a, c) => a + c.completed_cards, 0),
    pending: pending.length,
    approved: s.txns.filter((t) => t.status === 'approved').length,
    declined: s.txns.filter((t) => t.status === 'declined').length,
    earned: s.customers.filter((c) => c.reward_ready).length + s.redemptions.length,
    redeemed: s.redemptions.length,
  };
  const filtered = s.customers.filter((c) => {
    const q = search.toLowerCase();
    const hit = !q || c.full_name.toLowerCase().includes(q) || c.mobile.includes(q) || c.member_id.toLowerCase().includes(q);
    if (!hit) return false;
    if (filter === 'active') return c.status === 'active';
    if (filter === 'eligible') return c.reward_ready;
    if (filter === 'completed') return c.completed_cards > 0;
    if (filter === 'inactive') return c.status !== 'active';
    return true;
  });
  const selected = s.customers.find((c) => c.id === selectedId) || null;

  async function doRegister(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const r = await store.register(name, phone);
    if (r.error) { setErr(r.error); return; }
    if (r.customer) {
      setMeId(r.customer.id);
      try { localStorage.setItem('hc-me', r.customer.id); } catch { /* ignore */ }
      setMsg(`Welcome, ${r.customer.full_name}! Your Member ID is ${r.customer.member_id}.`);
    }
  }
  async function doLogin(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const mobile = phone.replace(/\D/g, '').slice(-10);
    const c = s.customers.find((x) => x.mobile === mobile);
    if (!c) { setErr('No card found for this mobile number. Please register first.'); return; }
    setMeId(c.id);
    try { localStorage.setItem('hc-me', c.id); } catch { /* ignore */ }
    setMsg(`Welcome back, ${c.full_name}!`);
  }
  async function requestStamp() {
    if (!me) return; setErr(''); setMsg('');
    const r = await store.requestStamp(me.id);
    if (r.error) setErr(r.error); else setMsg('Stamp requested! Show your card at the cart — the owner will accept it.');
  }
  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setPinMsg('');
    if (!s.settings.pin_hash) {
      if (pin.length < 4) { setPinMsg('Choose a PIN of at least 4 digits.'); return; }
      await store.setPin(pin); setUnlocked(true); setPin(''); setPinMsg('PIN set. Keep it safe — only you should know it.');
    } else if (await verifyPin(pin, s.settings.pin_hash)) {
      setUnlocked(true); setPin('');
    } else setPinMsg('Wrong PIN. Try again.');
  }

  if (!loaded) return <div className="wrap"><p>Loading…</p></div>;

  return (
    <div>
      <header className="hero">
        <h1>🥙 Hygienic Cart</h1>
        <p>Eat 10 times, 11th Vada Pav FREE • Besa, Nagpur, Maharashtra</p>
        <div><span className="badge">Digital Loyalty Rewards</span><span className="badge">₹ INR</span></div>
      </header>
      <div className="wrap">
        <div className="notice amber">
          <b>Database:</b> {isSupabaseConfigured ? 'Connected to Supabase — customers and stamps are shared.' : 'Local demo mode — Supabase is not configured yet, so data is stored only in this browser. Follow the README to connect Supabase for real shared data.'}
          <br /><b>SMS:</b> Not connected — no MSG91 / Fast2SMS account yet. Nothing is claimed sent. Every message is written to the SMS log in the Owner Section. See README for setup.
        </div>

        <div className="tabs">
          <button className={tab === 'card' ? 'on' : ''} onClick={() => setTab('card')}>My Stamp Card</button>
          <button className={tab === 'owner' ? 'on' : ''} onClick={() => setTab('owner')}>Owner Section</button>
        </div>

        {tab === 'card' && (
          <div>
            {!me ? (
              <div className="card">
                <h2>Join the Loyalty Program</h2>
                <p>Register once with your full name and mobile number. One card per mobile number — no duplicates. Returning customers: enter your mobile number to open your existing card.</p>
                <form onSubmit={doRegister}>
                  <label>Full Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarthak Sharma" required /></label>
                  <div className="mt" />
                  <label>Mobile Number<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" required /></label>
                  <button className="bigbtn" type="submit">Register — Get My Card</button>
                </form>
                <form onSubmit={doLogin}>
                  <button className="btn ghost" type="submit">I already have a card — log in with my mobile number</button>
                </form>
                <p><small className="mut">OTP verification switches on only once SMS is connected (see Owner → Settings). Until then, your card opens with name + mobile.</small></p>
                {err && <div className="notice red">{err}</div>}
                {msg && <div className="notice green">{msg}</div>}
              </div>
            ) : (
              <div>
                <div className="stampcard">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{me.full_name}</b><span className="mid">{me.member_id}</span></div>
                  <h2 style={{ color: '#fff', margin: '10px 0 4px' }}>{me.stamps}/{s.settings.stamps_needed} STAMPS COMPLETED</h2>
                  <p style={{ margin: '4px 0 12px' }}>{me.reward_ready ? '🎉 Your FREE Vada Pav is ready! Show this card at the cart.' : `${s.settings.stamps_needed - me.stamps} MORE PURCHASE${s.settings.stamps_needed - me.stamps === 1 ? '' : 'S'} TO GET YOUR FREE VADA PAV!`}</p>
                  <div className="bar"><div style={{ width: `${(me.stamps / s.settings.stamps_needed) * 100}%` }} /></div>
                  <div className="stamps">
                    {Array.from({ length: s.settings.stamps_needed }).map((_, i) => (
                      <div key={i} className={'stamp' + (i < me.stamps ? ' done' : '')}>{i < me.stamps ? '✓' : i + 1}</div>
                    ))}
                    <div className="stamp free" style={{ gridColumn: 'span 2' }}>FREE<br />11th Vada Pav</div>
                  </div>
                  <p className="mid">Total approved purchases: {me.total_approved} • Completed cards: {me.completed_cards} • Rewards redeemed: {me.rewards_redeemed}</p>
                </div>

                <div className="card">
                  <h2>Just bought something?</h2>
                  <p>No need to pick what you ate — just tap below.</p>
                  <button className="bigbtn" onClick={requestStamp}>Request My Stamp</button>
                  {err && <div className="notice red">{err}</div>}
                  {msg && <div className="notice green">{msg}</div>}
                  <p><small className="mut">1 approved purchase = 1 stamp. Only the owner can approve it — you cannot stamp your own card.</small></p>
                </div>

                <div className="card">
                  <h2>Your QR Code</h2>
                  <p>Show this at the cart so staff can find your card.</p>
                  <div className="qrbox"><QRCode id="my-qr" value={`${joinUrl}#${me.member_id}`} size={180} /></div>
                  <div className="mt"><button className="btn gold" onClick={() => downloadQrPng('my-qr', `${me.member_id}-qr.png`)}>Download QR (PNG)</button></div>
                  <p className="mt"><small className="mut">Member ID: {me.member_id} • Mobile: {me.mobile}</small></p>
                  <button className="btn ghost" onClick={() => { setMeId(null); try { localStorage.removeItem('hc-me'); } catch { /* ignore */ } }}>Log out of this card</button>
                </div>

                <div className="card">
                  <h2>Your History</h2>
                  {s.txns.filter((t) => t.customer_id === me.id).length === 0 ? <p>No requests yet.</p> : (
                    <table><thead><tr><th>Date</th><th>What</th><th>Status</th></tr></thead><tbody>
                      {s.txns.filter((t) => t.customer_id === me.id).map((t) => (
                        <tr key={t.id}><td>{new Date(t.created_at).toLocaleString('en-IN')}</td><td>{t.item_name}</td><td><span className={`pill ${t.status}`}>{t.status}</span>{t.reason ? ` — ${t.reason}` : ''}</td></tr>
                      ))}
                    </tbody></table>
                  )}
                  {s.redemptions.filter((r) => r.customer_id === me.id).length > 0 && (
                    <p className="mt">🎉 Free Vada Pav redeemed {s.redemptions.filter((r) => r.customer_id === me.id).length} time(s).</p>
                  )}
                </div>
              </div>
            )}

            <div className="card">
              <h2>How it works</h2>
              <p>1️⃣ Scan the QR at the cart and register once.<br />2️⃣ Buy anything, tap <b>Request My Stamp</b>.<br />3️⃣ The owner accepts it — 1 stamp added.<br />4️⃣ At 10 stamps, your 11th Vada Pav is FREE.<br />5️⃣ After redeeming, a new cycle starts from 0.</p>
              <h2 className="mt">Menu</h2>
              <table><tbody>
                {s.menu.filter((m) => m.active).map((m: MenuItem) => (
                  <tr key={m.id}><td>{m.name}</td><td><b>₹{m.price}</b></td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
        )}

        {tab === 'owner' && (
          <div>
            {!unlocked ? (
              <div className="card">
                <h2>Owner Section — PIN Locked</h2>
                <p>{s.settings.pin_hash ? 'Enter your owner PIN to open the dashboard.' : 'First time here? Set your owner PIN now. Only you should know it.'}</p>
                <form onSubmit={unlock}>
                  <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Owner PIN (4+ digits)" inputMode="numeric" required />
                  <button className="bigbtn" type="submit">{s.settings.pin_hash ? 'Unlock Dashboard' : 'Set My PIN'}</button>
                </form>
                {pinMsg && <div className="notice green">{pinMsg}</div>}
              </div>
            ) : (
              <div>
                <div className="subtabs">
                  {['dashboard', 'approvals', 'customers', 'rewards', 'menu', 'qr', 'sms', 'activity', 'settings'].map((t) => (
                    <button key={t} className={ownerTab === t ? 'on' : ''} onClick={() => setOwnerTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>

                {ownerTab === 'dashboard' && (
                  <div className="card"><h2>Dashboard Overview</h2>
                    <div className="stats">
                      <div className="stat"><b>{stats.total}</b><span>Total customers</span></div>
                      <div className="stat"><b>{stats.active}</b><span>Active customers</span></div>
                      <div className="stat"><b>{stats.completed}</b><span>Completed cards</span></div>
                      <div className="stat"><b>{stats.pending}</b><span>Pending approvals</span></div>
                      <div className="stat"><b>{stats.approved}</b><span>Approved purchases</span></div>
                      <div className="stat"><b>{stats.declined}</b><span>Declined purchases</span></div>
                      <div className="stat"><b>{stats.earned}</b><span>Free Vada Pav earned</span></div>
                      <div className="stat"><b>{stats.redeemed}</b><span>Rewards redeemed</span></div>
                    </div>
                    <p className="mt"><small className="mut">Recent activity:</small></p>
                    {s.audit.slice(0, 5).map((a) => <p key={a.id}><small>{new Date(a.created_at).toLocaleString('en-IN')} — {a.detail}</small></p>)}
                  </div>
                )}

                {ownerTab === 'approvals' && (
                  <div className="card"><h2>Pending Approvals ({pending.length})</h2>
                    {pending.length === 0 ? <p>No pending requests. 🎉</p> : pending.map((t) => (
                      <div key={t.id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                        <b>{t.customer_name}</b> ({t.member_id}) • {t.mobile}<br />
                        <small>{t.item_name} • Qty {t.quantity} • {new Date(t.created_at).toLocaleString('en-IN')}</small>
                        <div className="row mt">
                          <button className="btn ok" onClick={() => store.decideTxn(t.id, true)}>ACCEPT PURCHASE</button>
                          <input style={{ maxWidth: 220 }} placeholder="Decline reason (optional)" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
                          <button className="btn no" onClick={() => { store.decideTxn(t.id, false, declineReason); setDeclineReason(''); }}>DECLINE PURCHASE</button>
                        </div>
                      </div>
                    ))}
                    <h2 className="mt">All Transactions</h2>
                    <table><thead><tr><th>Date</th><th>Customer</th><th>Status</th></tr></thead><tbody>
                      {s.txns.slice(0, 30).map((t) => <tr key={t.id}><td>{new Date(t.created_at).toLocaleDateString('en-IN')}</td><td>{t.customer_name} ({t.member_id})</td><td><span className={`pill ${t.status}`}>{t.status}</span></td></tr>)}
                    </tbody></table>
                  </div>
                )}

                {ownerTab === 'customers' && (
                  <div className="card"><h2>Customer Management</h2>
                    <input placeholder="Search name, mobile or Member ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="subtabs">
                      {(['all', 'active', 'eligible', 'completed', 'inactive'] as const).map((f) => (
                        <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
                      ))}
                    </div>
                    {filtered.length === 0 ? <p>No customers match.</p> : (
                      <table><thead><tr><th>ID</th><th>Name</th><th>Mobile</th><th>Stamps</th><th>Left</th><th>Cards</th><th>Redeemed</th><th>Status</th></tr></thead><tbody>
                        {filtered.map((c) => (
                          <tr key={c.id} onClick={() => setSelectedId(c.id)} style={{ cursor: 'pointer' }}>
                            <td>{c.member_id}</td><td>{c.full_name}{c.reward_ready ? ' ⭐' : ''}</td><td>{c.mobile}</td>
                            <td>{c.stamps}/{s.settings.stamps_needed}</td><td>{s.settings.stamps_needed - c.stamps}</td>
                            <td>{c.completed_cards}</td><td>{c.rewards_redeemed}</td><td>{c.status}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    )}
                    {selected && (
                      <div className="notice green">
                        <b>{selected.full_name} ({selected.member_id})</b> — joined {new Date(selected.created_at).toLocaleDateString('en-IN')}, {selected.stamps}/{s.settings.stamps_needed} stamps, {selected.total_approved} approved, {selected.rewards_redeemed} redeemed.
                        <div className="row mt">
                          <button className="btn gold" onClick={() => store.redeem(selected.id)}>REDEEM REWARD</button>
                          <button className="btn ghost" onClick={() => store.setCustomerStatus(selected.id, selected.status === 'active' ? 'inactive' : 'active')}>{selected.status === 'active' ? 'Mark inactive' : 'Mark active'}</button>
                          <button className="btn ghost" onClick={() => setSelectedId(null)}>Close</button>
                        </div>
                        {s.txns.filter((t) => t.customer_id === selected.id).map((t) => (
                          <p key={t.id}><small>{new Date(t.created_at).toLocaleString('en-IN')} — {t.item_name} — <span className={`pill ${t.status}`}>{t.status}</span></small></p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {ownerTab === 'rewards' && (
                  <div className="card"><h2>Reward Management</h2>
                    <p>Eligible now: <b>{s.customers.filter((c) => c.reward_ready).length}</b> • Already redeemed: <b>{s.redemptions.length}</b> • Pending redemption: <b>{s.customers.filter((c) => c.reward_ready).length}</b></p>
                    {s.customers.filter((c) => c.reward_ready).length === 0 ? <p>No one is eligible right now.</p> : s.customers.filter((c) => c.reward_ready).map((c) => (
                      <div key={c.id} className="row" style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                        <span><b>{c.full_name}</b> ({c.member_id}) — 10/{s.settings.stamps_needed} stamps</span>
                        <button className="btn gold" onClick={() => store.redeem(c.id)}>REDEEM REWARD</button>
                      </div>
                    ))}
                    <h2 className="mt">Redemption History</h2>
                    {s.redemptions.length === 0 ? <p>None yet.</p> : s.redemptions.map((r) => <p key={r.id}><small>{new Date(r.redeemed_at).toLocaleString('en-IN')} — {r.customer_name} ({r.member_id})</small></p>)}
                  </div>
                )}

                {ownerTab === 'menu' && (
                  <div className="card"><h2>Menu Management</h2>
                    <p><small className="mut">Every approved purchase earns 1 stamp, whatever the item or quantity. Update prices here — you can change this list to the current Half / Full menu at any time.</small></p>
                    {s.menu.map((m: MenuItem) => (
                      <div key={m.id} className="row" style={{ marginBottom: 8 }}>
                        <input style={{ flex: 2 }} value={m.name} onChange={(e) => store.saveMenu(s.menu.map((x) => x.id === m.id ? { ...x, name: e.target.value } : x))} />
                        <input style={{ flex: 1 }} type="number" value={m.price} onChange={(e) => store.saveMenu(s.menu.map((x) => x.id === m.id ? { ...x, price: Number(e.target.value) || 0 } : x))} />
                        <button className="btn ghost" onClick={() => store.saveMenu(s.menu.map((x) => x.id === m.id ? { ...x, active: !x.active } : x))}>{m.active ? 'Disable' : 'Enable'}</button>
                        <button className="btn no" onClick={() => store.saveMenu(s.menu.filter((x) => x.id !== m.id))}>Delete</button>
                      </div>
                    ))}
                    <div className="row mt">
                      <input placeholder="New item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                      <input placeholder="Price ₹" type="number" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
                      <button className="btn gold" onClick={() => { if (!newItem.name || !newItem.price) return; store.saveMenu([...s.menu, { id: 'm' + Date.now(), name: newItem.name, price: Number(newItem.price), active: true }]); setNewItem({ name: '', price: '' }); }}>Add Item</button>
                    </div>
                  </div>
                )}

                {ownerTab === 'qr' && (
                  <div className="card"><h2>QR Code Management</h2>
                    <p>Print this QR at the cart. New customers scan it to open this page and register; returning customers open their existing card.</p>
                    <div className="qrbox"><QRCode id="join-qr" value={joinUrl || 'https://hygienic-cart-loyalty.vercel.app'} size={200} /></div>
                    <div className="row mt">
                      <button className="btn gold" onClick={() => downloadQrPng('join-qr', 'hygienic-cart-loyalty-qr.png')}>Download QR (PNG)</button>
                      <button className="btn ghost" onClick={() => { try { navigator.clipboard.writeText(joinUrl); alert('Registration link copied: ' + joinUrl); } catch { alert(joinUrl); } }}>Copy Registration Link</button>
                      <button className="btn ghost" onClick={() => window.print()}>Print Poster</button>
                    </div>
                    <p className="mt"><small className="mut">Registration link: {joinUrl || '— (set after you deploy on Vercel)'}</small></p>
                    <p><small className="mut">Staff: to find a customer, search their Member ID, name or mobile in the Customers tab — no camera scanner is built in yet.</small></p>
                  </div>
                )}

                {ownerTab === 'sms' && (
                  <div className="card"><h2>SMS Log</h2>
                    <div className="notice amber"><b>SMS is NOT connected.</b> No MSG91 / Fast2SMS account exists yet, so nothing has been sent. Every message below was written to this log only. To connect a real provider, see README → SMS setup (account, DLT registration, API key in Vercel env vars). OTP verification switches on only once SMS is connected. Admin mobile for alerts: {ADMIN_MOBILE || 'not set'}.</div>
                    {s.sms.length === 0 ? <p>No messages logged yet.</p> : s.sms.map((m) => (
                      <div key={m.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
                        <span className="pill pending">{m.status}</span> <b>{m.kind}</b> → {m.to_mobile} <small className="mut">{new Date(m.created_at).toLocaleString('en-IN')}</small>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '6px 0 0' }}>{m.message}</pre>
                      </div>
                    ))}
                  </div>
                )}

                {ownerTab === 'activity' && (
                  <div className="card"><h2>Activity / Audit Log</h2>
                    {s.audit.length === 0 ? <p>Nothing yet.</p> : s.audit.map((a) => <p key={a.id}><small>{new Date(a.created_at).toLocaleString('en-IN')} — <b>{a.action}</b> — {a.detail}</small></p>)}
                  </div>
                )}

                {ownerTab === 'settings' && (
                  <div className="card"><h2>Settings</h2>
                    <label>Stamps needed for a FREE Vada Pav
                      <input type="number" value={stampsNeeded} onChange={(e) => setStampsNeeded(Number(e.target.value) || 10)} />
                    </label>
                    <button className="btn gold mt" onClick={() => store.setStampsNeeded(stampsNeeded)}>Save Stamps Setting</button>
                    <div className="mt">
                      <label>Change Owner PIN<input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="New PIN (4+ digits)" /></label>
                      <button className="btn ghost mt" onClick={() => { if (pin.length >= 4) { store.setPin(pin); setPin(''); alert('PIN changed.'); } }}>Change PIN</button>
                    </div>
                    <div className="notice amber mt">
                      <b>SMS setup:</b> provider is configurable with env vars — SMS_PROVIDER (msg91 / fast2sms), MSG91_API_KEY / FAST2SMS_API_KEY, sender ID and DLT template IDs. Full steps are in README.md. Until then, SMS stays “not_configured” and OTP stays off.
                      <br /><b>Database:</b> {isSupabaseConfigured ? 'Supabase connected.' : 'Not connected — run supabase/schema.sql in your Supabase project and set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.'}
                    </div>
                    <button className="btn ghost" onClick={() => setUnlocked(false)}>Lock Owner Section</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <footer style={{ textAlign: 'center', padding: '20px', color: '#7a6a58', fontSize: 13 }}>
        Hygienic Cart • Plot No. 10, Near Shrikrishna Mandir, Revati Nagar, Besa, Nagpur — 440034 • Instagram @hygienicvadapav
      </footer>
    </div>
  );
}
