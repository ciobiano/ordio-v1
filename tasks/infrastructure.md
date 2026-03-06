# Ordio — Infrastructure Cost Analysis

**Last updated:** 2026-03-04
**Note:** Pricing from training data (May 2025). Items marked [VERIFY] may have changed.

## Total Monthly Cost by Scale

| Scale | Current Stack | Optimized Stack | Revenue (est.) | Margin |
|-------|--------------|----------------|---------------|--------|
| **10 users** (beta) | $6/mo | $6/mo | $0 | N/A |
| **100 users** (launch) | $65/mo | **$31/mo** | $1,000/mo | 96.9% |
| **500 users** (growth) | $264/mo | **$80/mo** | $5,000/mo | 98.4% |
| **1,000 users** (scale) | $548/mo | **$140/mo** | $10,000/mo | 98.6% |

## Service-by-Service Breakdown

### Vercel (Next.js hosting)
- **Free tier:** 100GB bandwidth, 100K serverless invocations, no commercial use
- **Pro ($20/mo):** 1TB bandwidth, 1M invocations, commercial use allowed
- **When to upgrade:** As soon as you launch publicly (commercial use requires Pro)
- Client-side heavy architecture keeps Vercel costs minimal

### OpenAI Whisper API (transcription)
- **Price:** $0.006/min [VERIFY]
- **Usage:** ~3.5 min avg per file, 1 transcription/user/day, 20 active days/mo
- **100 users:** ~$42/mo
- **Optimization:** Switch to **Groq Whisper** ($0.0011/min) — same model, 82% cheaper, 5x faster
- **100 users (Groq):** ~$7.70/mo

### Audio Enhancement (currently Railway → recommended Modal)
- **Railway (current):** CPU only, $30-50/mo idle, no GPU, serial processing
- **Modal (recommended):** GPU (T4/A10G), $0/mo idle, auto-scaling, pay-per-second
- **Cost per clean enhance (Modal):** ~$0.0005
- **Cost per HD enhance (Modal):** ~$0.0025
- **100 users (Modal):** ~$1.50/mo
- **Critical:** Railway cannot handle concurrent HD requests. Modal auto-scales.

### Clerk (authentication)
- **Free tier:** 10,000 MAU — sufficient to 1,000+ users
- **Pro ($25/mo):** Custom domain, remove branding, MFA
- **When to upgrade:** When you want custom domain auth or remove Clerk branding

### Convex (database)
- **Free tier:** 100K function calls/mo, 100MB storage [VERIFY]
- **Pro (~$25/mo):** 1M calls, 1GB storage [VERIFY]
- **When to upgrade:** ~500 active users with real-time subscriptions
- **Alternative:** If only storing user profiles + brand kits, Clerk metadata + Vercel KV could replace

### Stripe (USD payments)
- **Fees:** 2.9% + $0.30 per charge — no monthly minimum
- At $1K/mo revenue: ~$59 in fees
- At $10K/mo revenue: ~$590 in fees

### Paystack (NGN payments)
- **Fees:** 1.5% + ₦100, capped at ₦2,000 per transaction
- No setup cost, no monthly fee
- Settlement: next business day

### Supporting Services (all free tier)
| Service | Purpose | Free Limit |
|---------|---------|------------|
| Resend | Transactional email | 3,000 emails/mo |
| Sentry | Error monitoring | 5K errors/mo |
| PostHog | Product analytics | 1M events/mo |
| Domain (.app) | ~$1.50/mo ($18/yr) | N/A |

## Load Balancing Strategy

### The Problem
Single FastAPI process on Railway handles requests serially. 10 concurrent HD enhance requests = 150-200s queue for the last user (exceeds 120s timeout).

### The Solution: Modal Serverless GPU
Each request gets its own GPU container. Zero configuration for load balancing.

### Architecture Evolution
```
Phase A (now):     Client → Modal HTTP endpoint → GPU container → response
Phase B (100+):    Client → submit job → poll for completion → progress indicator
Phase C (500+):    HD enhance = paid-only (natural cost throttle)
```

## Key Optimization Actions

### Immediate (do now)
1. **Railway → Modal** for audio enhancement (saves $30-50/mo, adds GPU, solves concurrency)
2. **Evaluate Groq Whisper** (saves 82% on transcription costs)

### At 500+ users
3. Self-host Whisper on dedicated GPU (RunPod ~$50-80/mo vs $210 on OpenAI)
4. Consider dropping Convex if only used for user profiles (use Clerk metadata + Vercel KV)

## Verify Before Deciding
- Modal pricing: https://modal.com/pricing
- Groq pricing: https://groq.com/pricing
- Convex pricing: https://convex.dev/pricing
