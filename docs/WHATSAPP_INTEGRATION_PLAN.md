# WhatsApp Order-Bot — Integration Plan

**Status:** Planned, not yet built (plan-first, no code yet)
**Date:** 2026-06-09
**Goal:** Let the business owner (and role-scoped staff) query their orders from WhatsApp, answered by the *existing* in-app Gemini brain — reusing the client's existing Wapikon WhatsApp Business API plan, without disturbing the customer-facing bots.

---

## 1. Summary

The owner texts a keyword (e.g. `ORDERS`) to the existing business WhatsApp number. Wapikon captures the typed question, calls a new endpoint in OrderFlow, our app runs the **same Gemini function-calling brain** already used by the in-app chatbot (8 read-only order tools, Hindi/Gujarati/English), and returns the answer. Wapikon speaks it back. Customers messaging the same number keep hitting the existing keyword/catalog bots — untouched.

**v1 scope:** read-only Q&A. **Audience:** role-scoped staff (WhatsApp number → `profiles` row → role). **Writes** (status updates, adding orders) are deferred to a later version.

---

## 2. Architecture

```
Owner/staff texts keyword "ORDERS"          (only staff know it → that IS the access gate)
        │
        ▼
Wapikon Bot Reply flow
  ├─ User Input Flow:  "What would you like to know?"  → saves typed text to #STAFF_QUERY#
  ├─ HTTP API block:   POST https://<app>/api/whatsapp/ask
  │                     headers: { X-Webhook-Secret: <secret>, Content-Type: application/json }
  │                     body:    { "question": "#STAFF_QUERY#", "phone": "#LEAD_USER_CHAT_ID#" }
  │                          │
  │                          ▼
  │                    OrderFlow /api/whatsapp/ask
  │                      1. verify shared secret
  │                      2. normalize phone → match last 10 digits → profiles row → role check
  │                      3. load short history for this phone
  │                      4. runChatTurn() = the SHARED Gemini engine (service-role client)
  │                      5. persist turn, return { "reply": "..." }
  │                          │
  │                     map response.reply → #AI_REPLY#
  ├─ Text block:       #AI_REPLY#
  └─ Loop:             "Anything else? (or send EXIT)" → back to HTTP API block
```

Customer flows (Welcome Bot, MISTRIJI CONNECT, PRICELIST, catalogue) are not modified.

---

## 3. Why this approach (decisions recap)

| Decision | Choice | Why |
|---|---|---|
| Connection | **Via Wapikon's HTTP API block** (confirmed exists) | Reuses their purchase; Wapikon owns send/receive so we need no send-API key; customer bot untouched. |
| Brain | **Our existing Gemini engine** | Wapikon's native AI Agent is *knowledge-base only* (trained on FAQ text) and cannot reach live Supabase order data. Confirmed on the AI Agent settings screen — no tools/functions/API option. |
| Auth | **Phone-number whitelist + shared secret** | WhatsApp sends no login session. Sender number (`#LEAD_USER_CHAT_ID#`) identifies the user; shared secret proves the call is really from Wapikon. |
| DB access | **`createServiceClient()`** (already in repo) | No cookies available; service role bypasses RLS, so authz is enforced by the whitelist instead. Endpoint only ever runs the read-only tools. |
| Scope | **Read-only** | Matches the 8 existing tools; safest first version. |

---

## 4. Our-side build (OrderFlow / Next.js)

### 4.1 Refactor the Gemini loop into a shared engine
**New file:** `lib/chat-engine.ts`
- Extract the function-calling loop + `executeTool()` currently inline in `app/api/chat/route.ts`.
- Export `runChatTurn({ message, history, client })`:
  - builds `contents` from history + message,
  - runs the up-to-N-round tool loop (cap at **3 rounds** for WhatsApp latency — see §8),
  - `executeTool` dispatches to `lib/supabase/chatbot-queries.ts` using the **passed-in client**,
  - returns the final text string.
- **Modify** `app/api/chat/route.ts` to become thin: auth → session client → `runChatTurn` → return. Behaviour unchanged for the in-app chat.

### 4.2 New endpoint
**New file:** `app/api/whatsapp/ask/route.ts` (POST, **not** session-gated)
1. **Verify secret:** reject `401` unless header `X-Webhook-Secret === process.env.WHATSAPP_WEBHOOK_SECRET`.
2. **Parse body:** `{ question: string, phone: string }`.
3. **Normalize phone:** strip non-digits, take **last 10 digits** (all numbers are Indian; `#LEAD_USER_CHAT_ID#` arrives as `9194…`).
4. **Identify user:** `createServiceClient()` → `select full_name, role, phone from profiles` and match on last-10-digits. If no match → return `200 { reply: "This number isn't authorised for order access. Please contact the admin." }` (200 so Wapikon still delivers the message).
5. **Role scope (v1):** any known profile (admin/staff/viewer) is allowed read access — matches current RLS where viewers already read all orders. (See §9 for true per-staff scoping.)
6. **History:** load last ~8 turns for this phone from `whatsapp_conversations` (within a 30-min window; older → fresh session).
7. **Answer:** `runChatTurn({ message: question, history, client: serviceClient })`.
8. **Persist:** insert the user message + assistant reply into `whatsapp_conversations`.
9. **Return:** `200 { reply }`.

### 4.3 WhatsApp-friendly formatting
**Modify** `lib/gemini-tools.ts`: add a WhatsApp addendum to the system instruction for this path — WhatsApp supports `*bold*`, `_italic_`, no markdown tables/headings; keep answers short. Either a `WHATSAPP_SYSTEM_INSTRUCTION` export or a formatting suffix passed into `runChatTurn`.

### 4.4 Migrations
**New file:** `supabase/migration_whatsapp_integration.sql`
```sql
-- Staff identification: map a WhatsApp number to a profile (role-scoped access).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text NULL;
-- Store the last 10 digits (Indian) OR full number; the app matches on last 10.
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_format
  CHECK (phone IS NULL OR phone ~ '^[0-9+ ]{10,15}$');

-- Short conversation memory per WhatsApp number.
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text NOT NULL,                 -- last-10-digit key
  role       text NOT NULL CHECK (role IN ('user','assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone_time
  ON whatsapp_conversations (phone, created_at DESC);
-- RLS: no anon/auth access needed; only the service role (which bypasses RLS) reads/writes.
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
```
After applying: set the owner's + staff numbers, e.g.
```sql
UPDATE profiles SET phone = '9426955161' WHERE full_name = 'Owner Name';
```
Also update the `Profile` type in `types/database.ts` to include `phone?: string | null`.

### 4.5 Env vars
Add to `.env.example`, `.env.local`, and Vercel:
```
WHATSAPP_WEBHOOK_SECRET=<long random string>   # shared with Wapikon's request header
```
(Reuses existing `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY`.)

### 4.6 Files touched — checklist
- [ ] `lib/chat-engine.ts` (new) — shared Gemini loop + executeTool
- [ ] `app/api/chat/route.ts` (modify) — call the engine
- [ ] `app/api/whatsapp/ask/route.ts` (new) — the WhatsApp endpoint
- [ ] `lib/supabase/whatsapp-history.ts` (new, optional) — load/save history helpers
- [ ] `lib/gemini-tools.ts` (modify) — WhatsApp formatting addendum
- [ ] `supabase/migration_whatsapp_integration.sql` (new)
- [ ] `types/database.ts` (modify) — `Profile.phone`
- [ ] `.env.example` (modify) — `WHATSAPP_WEBHOOK_SECRET`

---

## 5. Wapikon-side recipe (click-by-click)

> Do this **after** our endpoint is deployed (Verify needs a live URL).

### 5.1 Create the Connected HTTP API
1. **WhatsApp → Connect Account → … → WhatsApp HTTP API** (or from the flow: drop an **HTTP API** block → double-click → **Manage APIs → Create**).
2. **API NAME:** `OrderFlow AI`
3. **METHOD:** `POST`
4. **END-POINT URL:** `https://<your-vercel-domain>/api/whatsapp/ask`
5. **Header Data → Add:**
   - `Content-Type` = `application/json`
   - `X-Webhook-Secret` = `<the WHATSAPP_WEBHOOK_SECRET value>`
6. **Body Data:** toggle **JSON**, then add:
   ```json
   { "question": "#STAFF_QUERY#", "phone": "#LEAD_USER_CHAT_ID#" }
   ```
   (`#STAFF_QUERY#` = the custom field the User Input Flow saves into — create it first if needed.)
7. **TEST SUBSCRIBER ID:** pick the owner's subscriber.
8. Click **Verify** → it calls our endpoint and shows the JSON response.
   - **➜ This is the moment we confirm response-mapping:** map response field `reply` → a custom field such as `AI_REPLY`.
9. **Save** the API to activate it.

### 5.2 Build the flow (Bot Reply)
1. **WhatsApp Bot Manager → Bot Reply → Create.**
2. **Start Bot Flow** → Bot trigger keywords: `ORDERS` (optionally `ORDER`, `STATUS`); matching type **Exact** (avoids collisions).
3. **User Input Flow** → message: `👋 *Order Assistant* — what would you like to know about your orders?` → save reply to `#STAFF_QUERY#`.
4. **HTTP API** block → select `OrderFlow AI`.
5. **Text** block → `#AI_REPLY#`.
6. **Loop:** add another **User Input Flow** ("Anything else? Type your question, or send *EXIT*.") → save to `#STAFF_QUERY#` → add a **Condition** (if `EXIT` → Text "👍 Done" + end; else → connect back to the **HTTP API** block).
7. **Save.**

### 5.3 Prevent AI-Agent interception
The AI Agent is currently **"AI Agent for All Queries: ENABLED."** While a subscriber is inside an active User Input Flow, replies should feed the flow — but if testing shows the AI Agent stealing messages, set **AI as Fallback Only** (or disable "for All Queries"). Verify during testing.

---

## 6. Deployment & config order
1. Build our side (§4).
2. Generate a secret (`openssl rand -hex 24`), put in Vercel env + Wapikon header.
3. Apply the migration in Supabase; set staff `phone` values.
4. Deploy to Vercel → confirm the public URL.
5. Wire Wapikon (§5) → Verify → map response.
6. Test (§7).

---

## 7. Testing checklist
- [ ] Owner texts `ORDERS` → gets the assistant prompt.
- [ ] "how many pending?" → correct live count.
- [ ] "status of order <no>" → correct detail.
- [ ] Hindi/Gujarati question → reply in same language.
- [ ] Follow-up ("and which are overdue?") uses context.
- [ ] An **unknown** number texting `ORDERS` → polite refusal, no data leaked.
- [ ] A staff number (if added) → works and is correctly role-identified.
- [ ] Customer keywords (Hi/Price/MISTRIJI) → still hit the existing bots, unaffected.
- [ ] Endpoint rejects requests **without** the correct `X-Webhook-Secret`.

---

## 8. Risks & mitigations
- **Wapikon HTTP API timeout vs Gemini latency** — the tool loop can take a few seconds. *Confirm Wapikon's HTTP API request timeout.* Mitigate: cap the loop at 3 rounds, keep the fast text model, keep tools lean.
- **Response mapping** — only fully confirmed at Verify (§5.1 step 8). Panel's own note ("use this data to update subscriber information") strongly implies it exists.
- **AI Agent interception** — see §5.3.
- **Phone format** — confirm exact `#LEAD_USER_CHAT_ID#` format on first Verify; normalization matches last-10 digits regardless.
- **Keyword collision** — owner texting "Hi"/"Price" trips the Welcome Bot. Acceptable; staff use the dedicated keyword.
- **Cost** — each message = Gemini calls; negligible at this volume.
- **24-h window** — because the user initiates, the business may reply free-form within 24h; no paid template needed.

---

## 9. Deferred / future (v2)
- **Writes:** update status / add orders from WhatsApp (needs confirm steps + write tools + careful RLS).
- **True per-staff scoping:** today every known number sees all orders (matches app RLS). Restricting a staffer to *their* orders needs an "assigned-to" concept on `orders`, which does not exist yet.
- **Proactive alerts:** push overdue/daily-summary messages (would use Wapikon broadcast/template + the 24-h rules).
- **Quick-action buttons:** a menu (Today's summary / Overdue / Search) alongside free-text.
```
