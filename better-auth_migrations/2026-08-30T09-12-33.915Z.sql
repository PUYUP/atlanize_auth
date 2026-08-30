create table "ba_users" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "ba_sessions" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "ba_users" ("id") on delete cascade, "activeOrganizationId" text);

create table "ba_accounts" ("id" text not null primary key, "issuer" text not null, "accountId" text not null, "providerId" text not null, "userId" text not null references "ba_users" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "ba_verifications" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "ba_organizations" ("id" text not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "createdAt" timestamptz not null, "metadata" text);

create table "ba_organization_members" ("id" text not null primary key, "organizationId" text not null references "ba_organizations" ("id") on delete cascade, "userId" text not null references "ba_users" ("id") on delete cascade, "role" text not null, "createdAt" timestamptz not null);

create table "ba_invitations" ("id" text not null primary key, "organizationId" text not null references "ba_organizations" ("id") on delete cascade, "email" text not null, "role" text, "status" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "inviterId" text not null references "ba_users" ("id") on delete cascade);

create index "ba_sessions_userId_idx" on "ba_sessions" ("userId");

create index "ba_accounts_userId_idx" on "ba_accounts" ("userId");

create index "ba_verifications_identifier_idx" on "ba_verifications" ("identifier");

create index "ba_organization_members_organizationId_idx" on "ba_organization_members" ("organizationId");

create index "ba_organization_members_userId_idx" on "ba_organization_members" ("userId");

create index "ba_invitations_organizationId_idx" on "ba_invitations" ("organizationId");

create index "ba_invitations_email_idx" on "ba_invitations" ("email");

create unique index "ba_accounts_issuer_accountId_uidx" on "ba_accounts" ("issuer", "accountId");