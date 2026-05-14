## Role assignment plan

Four roles exist in `app_role`: `commuter`, `station_staff`, `supervisor`, `admin`. Both existing users already have `commuter`. I'll add the remaining three roles across the two accounts as requested.

### Assignments

| Email | Roles after change |
|---|---|
| `22448612@dut4life.ac.za` | commuter, **admin** |
| `ptystrapp@gmail.com` | commuter, **supervisor**, **station_staff** |

This way every non-commuter role in the system is seeded onto a real account, and the first user has full admin access while the second can test both the staff scanner (`/scan`) and supervisor override flow.

### How it will be applied

A single SQL insert into `public.user_roles` (idempotent via `ON CONFLICT (user_id, role) DO NOTHING`):

```sql
insert into public.user_roles (user_id, role)
select p.id, r.role
from public.profiles p
join (values
  ('22448612@dut4life.ac.za', 'admin'::app_role),
  ('ptystrapp@gmail.com',     'supervisor'::app_role),
  ('ptystrapp@gmail.com',     'station_staff'::app_role)
) as r(email, role) on r.email = p.email
on conflict (user_id, role) do nothing;
```

### After it runs

- `22448612@dut4life.ac.za` → can access `/admin/*` (Operations Console, CRUD, Audit, Settings).
- `ptystrapp@gmail.com` → can access `/scan` (validation) and act as supervisor for override re-auth.
- Both still keep `/book` and `/tickets` as commuters.

No schema or code changes are needed — RBAC, RLS, and routes are already wired to read from `user_roles`. After approval I'll execute the insert and you can sign in immediately.
