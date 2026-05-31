# Enable Supabase leaked-password protection — 2-minute walkthrough

For: the owner. Written: 2026-05-30.
Project: **Loveli Luxury International** (`thweaebhxsfxuxeosjty`,
`db.thweaebhxsfxuxeosjty.supabase.co`).

## What this is and why we want it

Supabase Auth can compare every new or changed password against the
[HaveIBeenPwned](https://haveibeenpwned.com/Passwords) database (over a billion
known-breached passwords, looked up via a privacy-preserving k-anonymity hash —
the actual password never leaves the user's browser or your Supabase project).
When a user tries to set a password that already appears in a public breach,
Supabase Auth rejects the attempt and the UI tells them to pick something else.

This is the only remaining **Supabase security-advisor finding that's purely
owner-side** — all the code-side advisors are now closed (migrations 033, 041
on prod). Enabling this is one toggle in the dashboard. No code change, no
deploy, no migration.

## Why this is worth doing for a money system

Every customer who reuses the same password they use on five other sites is
one breach-list disclosure away from someone logging into their Loveli account.
Once in, that attacker can:

- Place orders against the user's saved address / payment details (low risk —
  M-Pesa STK still prompts on the user's *phone* before any debit, so funds
  don't move silently. But the order can still be created.)
- Read the user's order history and address book.
- For partner accounts: read their commission ledger, their downline tree,
  their `/account/partner/earnings` (which carries the real rates), and their
  payout history.

The breach-list check stops the most common attack vector at the door without
adding friction for users whose passwords aren't compromised.

## Before you toggle: 90-second prep

1. **Decide your minimum password length.** Supabase defaults to 6 characters;
   that's below current NIST guidance (≥ 8). I recommend bumping to **8** at
   the same time you enable the breach check. Going beyond 10–12 frustrates
   users without a meaningful security gain over what the breach check
   already does.
2. **Decide character composition.** Supabase Auth offers four levels:
   - `Letters and digits` (recommended — pairs well with the breach check)
   - `Lowercase, uppercase letters, and digits`
   - `Lowercase, uppercase letters, digits, and symbols`
   - `No requirements`
   The breach check is more useful than complex composition rules (forcing
   a `!` doesn't stop `Password1!` from being in the breach list, but the
   breach check does).
3. **Make sure you have a working admin account** with a current strong
   password. If you can't sign in, you can't disable the check from the
   dashboard.

## The walkthrough

### Step 1. Open the Supabase Auth Policies page

Browser → https://supabase.com/dashboard/project/thweaebhxsfxuxeosjty/auth/policies

(If that link doesn't go directly to the policies tab: log into
[supabase.com/dashboard](https://supabase.com/dashboard), pick the **Loveli
Luxury International** project, then in the left rail click **Authentication
→ Policies**.)

### Step 2. Find the "Password security" panel

Scroll until you see a section titled **"Password security"** or
**"Password strength"** (Supabase has renamed it once or twice; the controls
are the same). It will contain:

- A **Minimum password length** number input.
- A **Password requirements** dropdown (letters/digits/uppercase/symbols).
- A toggle labelled **"Prevent use of leaked passwords"** or
  **"Leaked password protection"**.

### Step 3. Set the values

| Control | Recommended | Notes |
|---|---|---|
| Minimum password length | **8** | Up from the default 6 |
| Password requirements | **Letters and digits** | Pairs cleanly with the breach check |
| Prevent leaked passwords | **ON** | The whole point of this walkthrough |

Hit **Save** at the bottom of the panel. The change applies immediately to
any new signup or password reset; **existing passwords are not retro-checked**
(they get checked on the next change).

### Step 4. Verify in 30 seconds

Test that the breach check is live. **Use a throwaway test email**, not a
real account. Go to `loveli-luxury.vercel.app/signup` and try to register
with the password **`password123`** (it's in the breach list — that's the
whole reason it's not a safe password). You should see Supabase reject the
signup with a message like *"Password has been leaked in a previous data
breach"* or *"Password is too weak"*.

If signup goes through, the toggle didn't apply. Re-open the dashboard, refresh
the page, and confirm the toggle reads ON. (Supabase saves are usually
instant, but I have seen the toggle revert on a stale page load. Save again
on the freshly-loaded page.)

After the test, **delete the throwaway account** from
**Authentication → Users** (search by the test email, click ⋯ → Delete user).
The signup flow may also have provisioned a `profiles` row; deleting the
auth user cascades that out per the FK rule in migration 001.

### Step 5. Tell me it's done

Once verified, this closes the last owner-side Supabase advisor in the
post-2026-05-30 hardening pass. I'll record it in the project memory and the
review doc.

## What it looks like to a user

A new visitor signing up with `MyDog1234!`:

> ❌ This password appears in a known data breach. Please choose a different
> password.

(Exact wording varies by Supabase release.)

They pick a different password and signup completes. No friction for anyone
whose password is novel.

## Rollback (if you ever need to)

Same panel, same toggle, set it **OFF**, click **Save**. No data is lost; the
historical signups that passed the check stay valid. Users who set a password
during the check window keep using whatever they picked.

I recommend **never** rolling this back for a money system — but the option
is one click away in case of an unexpected support load.

## Frequently asked questions

**Does Supabase send any password text to HaveIBeenPwned?**
No. Supabase uses HIBP's [k-anonymity range API](https://haveibeenpwned.com/API/v3#PwnedPasswords):
the user's password is hashed in their browser, the first 5 hex characters of
that hash are sent to HIBP, HIBP returns every breached hash starting with
those 5 characters, and the *full* hash comparison happens locally. The
actual password never leaves your project.

**Does it block existing users from logging in if their old password is in
the list?**
No. The check fires on **signup** and on **password change/reset**, not on
login. Existing users with breached passwords can still log in until the
next time they change their password. (If you want to force everyone to
rotate, that's a separate flow — easiest path is to send a "set a new
password" email round to all users via Supabase Auth's bulk-action UI.)

**Will the check slow down signup?**
The k-anonymity API typically returns in 50–200 ms. The user perceives
nothing different.

**Does this replace ENFORCE_ADMIN_MFA?**
No. The leaked-password check is for **everyone**; MFA is for **admins**.
Both should be on for a money system. ENFORCE_ADMIN_MFA flips separately
(see `docs/delivery-punchlist-2026-05.md`).

**Will this interact with our /admin/system/users superadmin tooling?**
No. That tool revokes roles and bans users; it never reads or sets passwords.

## Cross-references

- `docs/delivery-punchlist-2026-05.md` — the live launch checklist.
- `docs/transformation-masterplan-2026-05.md` — Appendix I and J list this as
  the remaining owner-side advisor since 2026-05-28.
- Migration 041 (`041_security_advisor_relock_2026_05.sql`) — closed the
  code-side advisors on the same sweep.
