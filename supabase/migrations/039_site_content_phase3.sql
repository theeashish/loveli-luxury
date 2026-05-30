-- 039_site_content_phase3.sql
--
-- Site content CMS Phase 3: seeds the remaining editable sections so the
-- owner can manage them from /admin/content/site without an engineer.
--
--   partner_landing        — the hero block on /partners
--   policies_authenticity  — the authenticity policy page body
--   policies_delivery      — the delivery policy page body (+ zones table)
--   policies_refund        — the refund policy page body (+ qualifying bullets)
--   home_find_your_scent   — the homepage quiz prompts and result labels
--   home_marquee           — the brand marquee strip
--
-- Schemas live in src/lib/content/site.ts; getSection() falls back to in-code
-- defaults if a row is missing or malformed, so a bad edit can never break
-- the public site.

INSERT INTO public.site_content (section_key, body) VALUES
  ('partner_landing', jsonb_build_object(
    'eyebrow',        'Loveli Luxury · Partner Program',
    'headline',       'Build a *luxury fragrance* business',
    'microtag',       'Five ranks · Verified retail performance · Editorial brand access',
    'subhead',        'A discreet, invite-only partner program for creators, resellers, and regional curators of modern African luxury fragrance. Earn alongside the house, advance through verified retail performance, not recruitment scale, and grow with a brand that takes restraint seriously.',
    'ctaLabel',       'Join via your sponsor',
    'secondaryLabel', 'See the rank ladder ↓',
    'secondaryHref',  '#tiers',
    'inviteNote',     'Invite-only · Sponsor code required'
  )),
  ('policies_authenticity', jsonb_build_object(
    'lead',  'Every fragrance is authenticity verified before dispatch.',
    'intro', 'Counterfeit perfume is a real problem in our region. We built Loveli Luxury knowing that a customer''s first concern isn''t going to be the scent. It''s whether the bottle in their hand is the real one. So our process starts well before the prompt to pay.',
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'How we source',
        'body',  'Our inventory comes from a small set of authorised distributors — the same channels that supply premium retail across East Africa. Each consignment arrives with its house documentation. Anything that doesn''t match the paperwork is returned at our expense, not yours.'
      ),
      jsonb_build_object(
        'title', 'How we store',
        'body',  'Temperature-stable, low-light storage in our Nairobi facility. Fragrance is fragile chemistry: heat, light, and rough handling change how a scent behaves on skin. Our handling protocol exists so the bottle on your dresser smells exactly like the one the house signed off.'
      ),
      jsonb_build_object(
        'title', 'How we seal',
        'body',  'Every order is hand-inspected, sealed, and tamper-banded before the rider arrives. Open the box on camera if you want — we keep unboxing-friendly packaging precisely because we expect you to scrutinise it. If the seal is broken on arrival, do not accept the parcel. Ping our Concierge and we send a replacement.'
      ),
      jsonb_build_object(
        'title', 'If something is wrong',
        'body',  'We refund or replace anything that fails authenticity inspection post-delivery. See the refund policy for the mechanics. The fastest route is Concierge on WhatsApp. We don''t make you write an email and wait.'
      )
    )
  )),
  ('policies_delivery', jsonb_build_object(
    'lead',  'Honest timelines, real couriers.',
    'intro', 'We dispatch from Nairobi the same day if your order is paid and confirmed before 14:00 EAT, the next morning otherwise. From there, time depends on where you are. The table below reflects what we actually see, not the marketing version.',
    'zonesHeading', 'By region',
    'zonesHeaderLeft', 'Where you are',
    'zonesHeaderRight', 'Expect',
    'zones', jsonb_build_array(
      jsonb_build_object('label', 'Nairobi metro (CBD, Westlands, Kilimani, Kileleshwa, Karen, Lavington, Eastlands)', 'window', '24–48 hours'),
      jsonb_build_object('label', 'Kiambu, Machakos, Kajiado (peri-Nairobi)', 'window', '24–72 hours'),
      jsonb_build_object('label', 'Mombasa, Kisumu, Nakuru, Eldoret (major cities)', 'window', '2–3 business days'),
      jsonb_build_object('label', 'Western Kenya: Kakamega, Kisii, Bungoma, Busia', 'window', '2–4 business days'),
      jsonb_build_object('label', 'Coastal towns, Mt. Kenya region, Rift Valley counties', 'window', '3–5 business days'),
      jsonb_build_object('label', 'Far-flung counties (Lodwar, Mandera, Lamu, Marsabit)', 'window', '4–7 business days')
    ),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Couriers we use',
        'body',  'Within Nairobi metro: motorcycle riders, contactless drop, signed receipt. Across counties: G4S Courier or Wells Fargo. Far-flung addresses: Posta EMS with G4S last-mile where available. We pick the route that actually delivers, not the cheapest one, and absorb the difference.'
      ),
      jsonb_build_object(
        'title', 'Tracking',
        'body',  'Every order gets a unique order number (looks like LL-2026-000123). Visit loveli-luxury.vercel.app/track/<your-order-number> any time to see status, courier reference, and expected delivery. No login required. The order number is enough.'
      ),
      jsonb_build_object(
        'title', 'If a delivery is late',
        'body',  'Ping our Concierge on WhatsApp with the order number. We chase the courier and reroute on our side; you don''t sit on hold. If your delivery is more than 48 hours beyond the window above, we waive the next dispatch fee on your next order.'
      )
    )
  )),
  ('policies_refund', jsonb_build_object(
    'lead',  'Sealed and second-guessing? Send it back.',
    'intro', 'Fragrance is a hygiene product. Once a bottle is opened, the next person in line can''t safely receive it. That''s why our refund policy looks the way it does: strict on the seal, generous on everything else.',
    'qualifiesHeading', 'What qualifies',
    'qualifiesIntro',   'A standard refund applies when:',
    'qualifies', jsonb_build_array(
      'The tamper seal is intact and the cellophane is unbroken.',
      'The bottle is unsprayed.',
      'You contact us within 7 days of delivery (we look at your tracking).',
      'The packaging is in the same condition we sent it in.'
    ),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'How to start one',
        'body',  'WhatsApp our Concierge with your order number. We arrange return collection at our cost. We don''t ask you to find a courier. Once we receive the parcel and confirm the seal, we reverse the M-Pesa transaction within 5 business days. You''ll see the reversal on the same number you paid from.'
      ),
      jsonb_build_object(
        'title', 'If the bottle is wrong on arrival',
        'body',  'Damaged in transit, wrong fragrance picked, seal compromised, scent clearly off. That''s not a refund situation, that''s our error and we replace immediately. Open the box on camera if you can; it speeds the loop. See the authenticity policy for what happens next.'
      ),
      jsonb_build_object(
        'title', 'What doesn''t qualify',
        'body',  'Sprayed bottles. Bottles outside the 7-day window. Discovery / sample kits (these are non-refundable by their nature). Custom or limited-edition orders where the bottle has been engraved or otherwise personalised. Anything where the seal or cellophane has been broken, even if the scent itself wasn''t applied.'
      ),
      jsonb_build_object(
        'title', 'Distributor / partner returns',
        'body',  'Onboarding kit purchases are covered by the same 7-day, sealed-only rule. Commission and tier consequences of a refund are documented in the partner agreement; the short version is that refunded orders aren''t commissionable, and any commission already paid on a refunded order is clawed back against the next payout.'
      )
    )
  )),
  ('home_find_your_scent', jsonb_build_object(
    'eyebrow',        'Find your scent',
    'headline',       'A small ritual, *three quiet questions*.',
    'resultEyebrow',  'Your scent',
    'meetCtaPrefix',  'Meet',
    'tryAgainLabel',  'Try again',
    'steps', jsonb_build_array(
      jsonb_build_object(
        'prompt', 'How do you want to enter the room?',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'Quietly, but unforgettably',          'tag', 'soft'),
          jsonb_build_object('label', 'Like the door just opened on a story', 'tag', 'mysterious'),
          jsonb_build_object('label', 'Sun-warm, smiling',                    'tag', 'fresh'),
          jsonb_build_object('label', 'Tailored. Decided.',                   'tag', 'bold')
        )
      ),
      jsonb_build_object(
        'prompt', 'Pick a time of day:',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'First light through linen curtains', 'tag', 'fresh'),
          jsonb_build_object('label', 'Gold hour, almost dusk',              'tag', 'warm'),
          jsonb_build_object('label', 'Late, candlelit, low music',          'tag', 'mysterious'),
          jsonb_build_object('label', 'High noon, somewhere by the sea',     'tag', 'fresh')
        )
      ),
      jsonb_build_object(
        'prompt', 'And finally, your evening looks like:',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'Slow dinner, longer conversation',  'tag', 'warm'),
          jsonb_build_object('label', 'A single glass, a balcony, a friend','tag', 'soft'),
          jsonb_build_object('label', 'A room you walked into and changed', 'tag', 'bold'),
          jsonb_build_object('label', 'A walk you take alone, on purpose',  'tag', 'mysterious')
        )
      )
    )
  )),
  ('home_marquee', jsonb_build_object(
    'separator', '✦',
    'items', jsonb_build_array(
      'OCEAN DESIRE',
      'CRIMSON NOIR',
      'SUNSET BLISS',
      'AFAR',
      'VANILLA SMOKE',
      'ROSE NOIR',
      'LOVELI SIGNATURE',
      'AMBER VESPERS',
      'WHITE OUD'
    )
  ))
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '039_site_content_phase3',
  jsonb_build_object(
    'description',
    'Site content CMS Phase 3: seeded partner_landing, policies_authenticity, policies_delivery, policies_refund, home_find_your_scent, home_marquee. Components convert to async server components that read via getSection() with the in-code defaults as fallback.'
  )
);

NOTIFY pgrst, 'reload schema';
