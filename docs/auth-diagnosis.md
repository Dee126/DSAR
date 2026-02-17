# Auth-Diagnose

## Auth-Provider

**NextAuth.js v4** mit `CredentialsProvider` (kein Supabase, kein Custom).

- Konfiguration: `src/lib/auth-options.ts`
- Route: `src/app/api/auth/[...nextauth]/route.ts`
- Session-Strategie: JWT (8 h Laufzeit)
- Login-Seite: `/login`

## Passwort-Pruefung

1. User wird per E-Mail aus der DB geladen: `prisma.user.findFirst({ where: { email } })`
2. Passwort wird mit **bcryptjs** verglichen: `compare(password, user.passwordHash)`
3. Bei Erfolg wird `lastLoginAt` aktualisiert und ein JWT-Token ausgestellt.

## Relevante Tabellen

| Tabelle | Felder | Beschreibung |
|---|---|---|
| `User` | `id`, `tenantId`, `email`, `name`, `passwordHash`, `role` | Nutzer-Accounts |
| `Tenant` | `id`, `name`, `slaDefaultDays` | Mandant / Organisation |

Unique Constraint: `@@unique([tenantId, email])` auf `User`.

## Root-Cause: Login funktioniert nicht

Das Build-Script `prisma/ensure-admin.mjs` lief bei jedem Vercel-Deploy, hat aber
den User nur **erstellt** (create), nie **aktualisiert** (update war leer: `update: {}`).

Wenn der User bereits existierte (z.B. aus einem frueheren Seed mit anderem Passwort-Hash),
wurde das Passwort **nie zurueckgesetzt**.

### Fix

`prisma/ensure-admin.mjs` Zeile 31 geaendert:

```diff
- update: {},
+ update: { passwordHash, role: "TENANT_ADMIN" },
```

Jetzt wird das Passwort bei **jedem Deploy** deterministisch auf `admin123` gesetzt.

### Zusaetzlich: Reset-Script

`scripts/reset-test-user.ts` — kann jederzeit manuell ausgefuehrt werden:

```bash
npm run reset:test-user
```

## ENV-Checkliste (Vercel)

Folgende ENV-Variablen muessen in Vercel gesetzt sein:

| Variable | Wert |
|---|---|
| `DATABASE_URL` | PostgreSQL Connection-String (Neon/Supabase DB o.ae.) |
| `NEXTAUTH_SECRET` | Beliebiger Secret-String (mind. 32 Zeichen) |
| `NEXTAUTH_URL` | Die Vercel-URL der App, z.B. `https://dsar-xxx.vercel.app` |

Falls `NEXTAUTH_URL` nicht zur tatsaechlichen Domain passt, schlaegt die CSRF-Pruefung
von NextAuth fehl und Login gibt "Try signing in with a different account" zurueck.
