# Ordio — Monetization Plan

## Pricing Tiers

| Tier | Price (USD) | Price (NGN) | Features |
|------|-------------|-------------|----------|
| **Free** | $0 | ₦0 | 3 exports/day, watermark, standard audio, 3 fonts, bars waveform, bottom captions, 1:1 only |
| **Creator** | $9/mo ($7/mo annual) | ₦5,000/mo | Unlimited exports, no watermark, all fonts, all waveforms, all captions, all ratios, HD audio enhance |
| **Pro** | $19/mo ($15/mo annual) | ₦12,000/mo | Everything + brand kit, templates, background images, priority support, 4K export |
| **Agency** | $49/mo (future) | ₦30,000/mo | Team seats, batch export, API access, white-label |

## Payment Infrastructure

- **Stripe** — USD/international payments (2.9% + $0.30 per charge)
- **Paystack** — Nigerian Naira payments (1.5% + ₦100, capped at ₦2,000 per transaction)
- **Convex** — subscription state, usage counters, feature flags
- **Clerk** — authentication (free up to 10K MAU)

## Feature Gates

| Feature | Free | Creator | Pro |
|---------|------|---------|-----|
| Exports per day | 3 | Unlimited | Unlimited |
| Watermark | Yes | No | No |
| Audio enhancement | None | Clean + HD | Clean + HD |
| Fonts | 3 (Inter, Roboto, Outfit) | All (8+) | All (8+) |
| Waveform styles | Bars only | All | All |
| Caption styles | Bottom only | All | All |
| Aspect ratios | 1:1 only | All | All |
| Templates | None | 3 basic | All (8+) |
| Brand kit | No | No | Yes |
| Background images | No | Yes | Yes |
| 4K export | No | No | Yes |
| Batch export | No | No | No (Agency only) |

## Auth Architecture

- Clerk handles authentication (social logins, email/password)
- Convex stores: user profile, subscription tier, usage counters, brand kits
- Middleware checks subscription tier before gated features
- Client-side: Zustand store includes `user.tier` for UI gating

## Revenue Targets

- **Month 1:** 10 paying users = $90-190/mo
- **Month 3:** 50 paying users = $450-950/mo
- **Month 6:** 200 paying users = $1,800-3,800/mo
- **Month 12:** 500 paying users = $4,500-9,500/mo

## Implementation Order

1. Clerk auth (gate login)
2. Convex user schema (tier, usage, created_at)
3. Free tier watermark rendering
4. Usage counter middleware (3 exports/day)
5. Stripe Checkout integration
6. Paystack integration
7. Subscription webhook handlers
8. Feature gate middleware (client + server)
