# Loveli Luxury: Project Brief

For: the owner. Last updated: 2026-05-22.
Production site: https://loveli-luxury.vercel.app

## 1. What Loveli Luxury is
A premium fragrance store for Kenya and East Africa, with an invite-only partner
program attached. Customers buy perfume. Partners build a fragrance business and
earn on their own sales plus their team's sales. The store experience leads; the
partner program is a separate, discreet door. Mobile-first, pays with M-Pesa, has
a WhatsApp concierge.

## 2. One-line status
The platform is built and live, running on M-Pesa SANDBOX (test money only). What
stands between today and real sales is mostly your inputs plus the Safaricom
Go-Live approval, not more engineering.

## 3. What works today (live on the site)
- Storefront: browse, product pages with fragrance detail, bundles, cart, M-Pesa
  checkout, order tracking, wishlist.
- Partner program: invite-only signup with a sponsor code, the 5-rank
  compensation plan, commissions, monthly close, partner dashboard, payouts.
- Admin back office: catalog, orders, compensation config, content (reviews and
  press), people, payouts, monthly close.
- Trust: authenticity, delivery, and refund policies, WhatsApp concierge, founder
  story.

## 4. Money and M-Pesa (read this carefully)
- Payments run through PayHero, which connects to Safaricom M-Pesa. The customer
  gets an STK prompt on their phone and enters their PIN.
- Right now it is on SANDBOX (test paybill 542542). No real money moves. This is
  correct and expected, not a fault.
- To take real money, follow docs/go-live-mpesa.md. In short: (1) get Safaricom
  Daraja Go-Live approval, (2) set the live channel id and auth token in Vercel,
  (3) fund the payout wallet, (4) register the callback URL. The code is ready and
  needs no change for the switch.

## 5. The compensation plan (as configured 2026-05-22)
- Products, per bottle: 30ml buys at KES 700, sells at KES 1,500 (margin 800),
  350 PV. 50ml buys at KES 1,400, sells at KES 2,800 (margin 1,400), 700 PV.
- Network commission, as a percentage of Point Value: Level 1 20%, Level 2 11%,
  Level 3 6%, Level 4 2%, Level 5 1%. Your rank sets how many levels deep you earn.
- Ranks: Ambassador, Executive, Gold Director, Platinum Director, Crown President.
  Each has personal-bottle, active-direct, and group-sales targets, a one-time
  rank bonus, and (from Executive up) a monthly lifestyle bonus.
- Ruth's adopted plan (2026-05-28) is now live end-to-end via migrations 029,
  031, and 036 — see masterplan Appendix M. Active-customer requirements are
  set per rank (Ambassador 5, Executive 20, Gold Director 50, Platinum Director
  80, Crown President 130). The maintenance grace-period scaffolding from E2
  (migration 032, Appendix I) is shipped but intentionally off
  (`min_personal_pv = 0`) until you set per-rank PV thresholds + grace windows.
  Recommend a legal review of the plan before Go-Live.

## 6. What is left before launch
- By Safaricom (external, longest lead time): Daraja Go-Live. Start it now.
- By you: a real product catalogue (only 2 test products exist today), payout
  wallet funding, receipt-email keys (Resend), trust content (real reviews, a
  founder photo and story, customer video reviews), and a legal review of the
  compensation plan.
- By me (code, on your word): E1 + E2 + types regen + performance pass all
  shipped 2026-05-28 (masterplan Appendices H and I). Activating the
  maintenance gate (E2) is a config-only step when you're ready — no further
  code change.

## 7. The premium redesign (in progress)
- Copy: purged of em dashes and AI-slop words across the whole site. Done.
- Palette: adopting your charcoal, cream, warm brown, and muted gold. In progress.
- Order via WhatsApp on product pages. In progress.
- Further visual polish (hero, sections, animation, mobile) per your brief: ongoing.
- Decision kept: no "Become a Partner" button in the hero. The program stays a
  discreet door, reached on its own page.

## 8. How changes go live
There is no git in this workspace. Each change is: edit, type-check, run tests,
build, then deploy with `vercel deploy --prod`. Deploys are manual and I run them.

## 9. Access and where things live
- Site: https://loveli-luxury.vercel.app
- Admin back office: /admin (sign in with an admin account).
- Catalogue: /admin/catalog. Compensation: /admin/comp. Orders: /admin/orders.
  Reviews and press: /admin/content/social-proof. Payouts and monthly close under
  /admin too.
- Database: Supabase project "Loveli Luxury International".
- Admin accounts: you (Ashish), and Ruth (client and admin).

## 10. Key documents
- docs/go-live-mpesa.md: the M-Pesa Go-Live runbook.
- docs/delivery-punchlist-2026-05.md: the launch checklist.
- docs/transformation-masterplan-2026-05.md: the full technical state, for any
  engineer picking this up.
