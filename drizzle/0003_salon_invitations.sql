CREATE TABLE IF NOT EXISTS salon_invitation (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  "tokenHash" text NOT NULL UNIQUE,
  role text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "acceptedAt" timestamp,
  "createdBy" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
