# Hygienic Cart — Loyalty Rewards (Standalone, Deployable Version)

**Eat 10 times, 11th Vada Pav FREE.**

This is the real, standalone version of the Hygienic Cart Loyalty Rewards app.
It is **not** a Muse link — it is source code you host yourself on
**Vercel (free) + Supabase (free)**. After you deploy it, you get a real
public link like `https://hygienic-cart-loyalty.vercel.app` that any
customer can open and scan a QR for.

Business: Hygienic Cart, Besa, Nagpur, Maharashtra, India. Currency: ₹ INR.
No WhatsApp anywhere in this app.

## What it does

- **Customer:** registers once with full name + mobile (one card per mobile,
  no duplicates), gets a unique Member ID (HC-0001, HC-0002…), a premium
  maroon-and-gold stamp card with 10 stamp circles + FREE 11th slot, a
  progress bar, and their own QR code.
- **After login, no item selection:** the customer just taps one big button
  — **Request My Stamp** — under “Just bought something?”.
- **Owner:** PIN-locked dashboard. The PIN is set once by the owner in Supabase (see Step 4b) — no one can set it from the website itself.
  8 stats, Pending Approvals with **Accept / Decline + reason**, customer
  search by name / mobile / Member ID with filters, full customer history,
  Rewards with **Redeem** (resets the cycle to 0), Menu Management, QR
  Management (PNG download + printable poster), SMS log, activity log.
- **Rules:** 1 approved purchase = 1 stamp, whatever the item or quantity.
  Only owner-approved purchases earn stamps. Customers cannot approve
  themselves. 10 stamps unlocks 1 FREE Vada Pav. Redeeming starts a new
  cycle. A request that is already decided cannot be decided again.
- **Menu at start:** Classic Vada Pav ₹40, Cheese ₹70, Ulta ₹60,
  Shezwan ₹60, Dabeli ₹40, Pav Bhaji ₹80, Combo ₹50. You can edit this
  in Menu Management — change it to your current Half / Full menu
  (Crispy, Crispy Cheese, Dabeli Half ₹20, etc.) any time.
- **SMS is NOT connected** until you set it up (see Step 8 below).
  Nothing is claimed sent. Every message is written to the SMS log.
  OTP verification switches on only once SMS is connected.

## Step-by-step deployment

### Step 1 — Make free accounts (10 minutes)
1. Go to **github.com** and make a free account (if you do not have one).
2. Go to **vercel.com** and sign up with GitHub (free Hobby plan).
3. Go to **supabase.com** and sign up with GitHub (free plan).
   Keep all three open in tabs.

### Step 2 — Put this code on GitHub
1. On GitHub, click **New repository**, name it `hygienic-cart-loyalty`,
   choose **Public**, click **Create repository**.
2. On your computer, open a terminal in this folder and run:
   ```
   git init
   git add .
   git commit -m "Hygienic Cart Loyalty Rewards"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/hygienic-cart-loyalty.git
   git push -u origin main
   ```
   Replace `YOUR-USERNAME` with your GitHub username.
   If you do not have git, install it first, or use GitHub Desktop and
   drag this folder in.

### Step 3 — Create the Supabase database
1. In Supabase, click **New project**, name it `hygienic-cart-loyalty`,
   choose a strong database password (save it somewhere safe),
   pick the nearest region, click **Create new project**. Wait 1–2 minutes.
2. On the left menu, click **SQL Editor → New query**.
3. Open the file `supabase/schema.sql` in this folder, copy all of it,
   paste it into the SQL Editor, click **Run**.
   You should see “Success. No rows returned.”
   This creates: customers, transactions, redemptions, menu_items,
   settings, sms_log, audit_log — plus the 7 starting menu items.
4. On the left menu, click **Project Settings → API**.
   Copy two values and keep them safe:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public key** (a long key starting with `eyJ…`)

### Step 4 — Deploy on Vercel
1. In Vercel, click **Add New → Project → Import** your
   `hygienic-cart-loyalty` GitHub repository.
2. Framework Preset should say **Next.js**. Leave the build settings as they are.
3. Before you click Deploy, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   (Leave the SMS variables blank for now — SMS stays not connected.)
4. Click **Deploy**. Wait 1–2 minutes.
5. Vercel gives you a link, for example:
   `https://hygienic-cart-loyalty.vercel.app`
   **That is your live public link.** Open it on your phone and test it.

### Step 4b — Set your owner PIN once (do this BEFORE giving the link to customers)

**Important security rule:** no one can set the owner PIN from the website itself. If a customer opens Owner Section before you set a PIN, they will only see "Owner PIN is not set yet" — they cannot set it, and they cannot open the dashboard. You set it once, in Supabase:

1. Choose a 4-digit PIN only you know. Remember it — you will need it every time you open Owner Section.
2. In Supabase, go to **SQL Editor → New query**.
3. Paste this, replacing `YOUR_HASH_HERE` with the hash for your PIN (ask Muse for the hash for your chosen PIN — the PIN itself is never stored, only its SHA-256 hash):
   ```sql
   update settings set pin_hash = 'YOUR_HASH_HERE' where id = 1;
   ```
4. Click **Run**. Wait for Success.
5. Now open the website, go to **Owner Section**, enter your PIN — it must open. Try a wrong PIN — it must be rejected.
6. To change your PIN later, open Owner Section with your current PIN, go to **Settings → Change Owner PIN**. No one can change it without knowing the current PIN.

If you forget your PIN, you must set a new one again with the SQL above (step 3) — there is no "forgot PIN" on the website.

### Step 5 — Test the full journey (do this before giving it to customers)
1. Open your live link. Register a test customer: name + your mobile.
   Check the Member ID is HC-0001 and the card shows 0/10.
2. Tap **Request My Stamp**.
3. Go to **Owner Section**, enter the PIN you set in Step 4b.
4. Open **Pending Approvals**, tap **ACCEPT PURCHASE**. The card should show 1/10.
5. Repeat the request + accept 9 more times (or, to test quickly, use the
   same flow — each request needs a fresh tap after the last one is decided).
   At 10/10 the card shows FREE Vada Pav ready.
6. In **Rewards**, tap **REDEEM REWARD**. The card resets to 0/10 and a
   new cycle starts. The redemption is in the history and audit log.
7. Try a wrong PIN — it must be rejected. Try registering the same mobile
   again — it must open the same card, not create a duplicate.
8. If anything looks wrong, check Vercel → Deployments → the build log,
   and Supabase → Table Editor to see the rows.

### Step 6 — Make the QR code for the cart
1. Open your live link, go to **Owner Section → QR**.
2. Click **Download QR (PNG)** and print it, or click **Print Poster**.
3. Put the printed QR at the cart. Customers scan it, register once,
   and tap Request My Stamp after buying.
4. **Test-scan it from another phone first** — the QR must open your
   Vercel link directly, with no sign-in.

### Step 7 — Update the menu to the current Half / Full menu (optional, recommended)
In the live app, go to **Owner Section → Menu** and edit the items to your
current printed menu: 8 Vada Pav with Half / Full prices, Dabeli Half ₹20 /
Full ₹40, Pav Bhaji ₹80, Combo ₹50. Prices here only label the menu —
1 approved purchase is always 1 stamp.

### Step 8 — SMS setup (only when you are ready — optional)
Real SMS needs a paid provider account and DLT registration in India.
1. Create an account at **msg91.com** or **fast2sms.com**.
2. Complete **DLT registration** (required for business SMS in India):
   register your business / sender ID and get your message templates
   approved (approval, decline, reward-ready). This can take a few days.
3. Copy your **API key**, **Sender ID** and **Template IDs** from the
   provider dashboard.
4. In Vercel, go to your project → **Settings → Environment Variables**,
   add:
   - `SMS_PROVIDER` = `msg91` or `fast2sms`
   - `MSG91_API_KEY` or `FAST2SMS_API_KEY` = your API key
   - `MSG91_SENDER_ID` / `FAST2SMS_SENDER_ID` = your sender ID
   - `MSG91_TEMPLATE_ID_APPROVAL` etc. = your approved template IDs
   - `ADMIN_MOBILE` = your mobile number for owner alerts
5. In `src/app/api/sms/route.ts`, add the provider `fetch()` call as
   described in the comments there, commit, and redeploy on Vercel.
6. Until Step 5 is done, the app keeps showing **SMS: Not connected**
   and writes every message to the SMS log only. OTP verification
   switches on only after this step.

## Running it on your own computer (optional)
```
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # open http://localhost:3000
npm run build                # check the production build
```

## Files in this folder
- `package.json`, `next.config.js`, `vercel.json`, `tsconfig.json` — app config
- `.env.example` — every setting you need, with no real secrets in it
- `supabase/schema.sql` — the full database schema + starting menu
- `src/app/page.tsx` — the whole customer + owner app (one page, two tabs)
- `src/app/layout.tsx`, `src/app/globals.css` — branding and styles
- `src/app/api/sms/route.ts` — the SMS endpoint (honest “not configured” until a provider is added)
- `src/lib/store.ts` — customers, stamps, approvals, redeem, menu, logs
- `src/lib/supabase.ts` — Supabase connection (local demo mode when not configured)
- `src/lib/sms.ts` — the exact SMS message texts
- `src/lib/pin.ts` — owner PIN hashing (SHA-256, never stored in plain text)

## Important notes
- **Never commit `.env.local`** — it holds real keys. It is in `.gitignore`.
- **Never share your Supabase service-role key, SMS API key, or owner PIN
  in chat** — only enter them on Vercel / Supabase / the provider's own pages.
- The app starts empty (0 customers). That is on purpose — no invented data.
- If you deploy without Supabase env vars, the app still opens in
  **local demo mode** (data in that browser only) and says so on screen.
  Connect Supabase before giving the link to real customers, or their
  stamps will not be shared between phones.
