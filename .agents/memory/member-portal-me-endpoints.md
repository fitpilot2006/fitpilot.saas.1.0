---
name: Member portal /me endpoints
description: Pattern for efficient member self-service API endpoints and route ordering requirements
---

## Rule
Add dedicated `/me` routes for member self-service instead of fetching all gym data and filtering client-side.

**Why:** The member portal originally fetched ALL members/attendance/payments for the entire gym and filtered client-side — catastrophic at scale. `/me` endpoints use indexed DB queries.

**How to apply:**
- `GET /api/members/me` — find member where `email = req.userEmail AND gymId = req.gymId`
- `GET /api/attendance/me` — query attendance by the resolved `memberId`
- `GET /api/payments/me` — same pattern
- `GET /api/ai-workout/me` and `GET /api/ai-diet/me` — plans for current member
- `POST /api/ai-workout/me` and `POST /api/ai-diet/me` — save plan, auto-assigns memberId

**Critical:** In Express route files, always register `/me` BEFORE `/:id` or Express will match the string "me" as an ID parameter.
