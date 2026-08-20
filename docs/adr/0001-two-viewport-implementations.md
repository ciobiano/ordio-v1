---
status: accepted
---

# Mobile and Desktop stay as two separate implementations

Ordio's mobile and desktop interfaces are two independent component trees with no imports
between them, two different state approaches (Zustand on mobile, a reducer on desktop) and
several same-named, entirely unshared components. Converging them into one responsive
implementation was considered and rejected: Ordio is a free portfolio project, the live app
works, and a multi-week rewrite touching every screen would risk breaking the thing visitors
are meant to look at, in exchange for an internal tidiness no visitor sees. We are keeping
both implementations and making the split explicit — naming the folders `mobile/` and
`desktop/` rather than `soul/` and `desk/` — so that a reader meets a deliberate decision
rather than an accident.

## Consequences

- A change to shared behaviour must be made twice. This is accepted, and is the price of the
  decision.
- The **Style** system is explicitly *not* covered by this split. One design-token system
  serves both implementations; a second palette is a defect, not a viewport concern.
- If Ordio ever stops being a portfolio piece, this decision should be revisited first.
