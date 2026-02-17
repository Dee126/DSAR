-- Seed: ensure default tenant and admin user exist in production.
-- Uses ON CONFLICT DO NOTHING so re-running is safe (idempotent).

-- 1. Default tenant
INSERT INTO "tenants" ("id", "name", "slaDefaultDays", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Acme Corp',
  30,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- 2. Admin user  (daniel.schormann@gmail.com / admin123)
INSERT INTO "users" ("id", "tenantId", "email", "name", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'daniel.schormann@gmail.com',
  'Daniel Schormann',
  '$2a$12$IkA1P3Fa9T1B6fau/lKLh.9dB7EBk0VkcNxhxA2D1E5StFolLdUnu',
  'TENANT_ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Also handle uniqueness on (tenantId, email)
-- If the user already exists with a different id, update the password hash.
INSERT INTO "users" ("id", "tenantId", "email", "name", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'daniel.schormann@gmail.com',
  'Daniel Schormann',
  '$2a$12$IkA1P3Fa9T1B6fau/lKLh.9dB7EBk0VkcNxhxA2D1E5StFolLdUnu',
  'TENANT_ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId", "email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "name" = EXCLUDED."name",
  "updatedAt" = NOW();
