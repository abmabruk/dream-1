# Dream 1 Foundation

## Principles

- Pages should render data, not own business rules.
- Validation should happen at input boundaries.
- Auth and authorization should be explicit and testable.
- Modules should map to product domains, not component folders.
- Route handlers should be versioned and predictable.

## First domain modules

- `auth`
- `users`
- `customers`
- `orders`
- `production`
- `tasks`
- `payments`
- `portal`

## Current structure

- `src/app`: routes and layouts only
- `src/lib`: shared infrastructure
- `src/modules`: domain logic
- `prisma`: database contract

## Next implementation steps

1. Add migrations and seed data for a factory workspace.
2. Expand the real auth flow with invitation, reset, and session management UI.
3. Replace placeholder pages with real dashboard, orders, CRM, and worker flows.
4. Add tests around permissions and critical order state transitions.
