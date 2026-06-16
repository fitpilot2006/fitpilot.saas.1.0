---
name: AI plan routes pattern for member portal
description: How AI workout/diet plans work for member self-service vs admin
---

## Rule
AI plan routes have two modes: admin (assign to any member) and member (always self).

**Why:** Members should only see and create their own plans. Admins see all gym plans.

**How to apply:**
- Admin: `GET /api/ai-workout` returns all gym plans; `POST /api/ai-workout` requires memberId in body
- Member: `GET /api/ai-workout/me` returns own plans; `POST /api/ai-workout/me` auto-assigns memberId from JWT email lookup

The `/me` endpoints look up member record by `(gymId, email)` — requires `members_gym_email_idx` index.
