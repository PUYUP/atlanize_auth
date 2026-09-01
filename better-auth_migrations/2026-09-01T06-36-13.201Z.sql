create table "ritize_users" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "ritize_sessions" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "ritize_users" ("id") on delete cascade, "activeOrganizationId" text, "activeTeamId" text);

create table "ritize_accounts" ("id" text not null primary key, "issuer" text not null, "accountId" text not null, "providerId" text not null, "userId" text not null references "ritize_users" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "ritize_verifications" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "ritize_organizations" ("id" text not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "createdAt" timestamptz not null, "metadata" text);

create table "ritize_teams" ("id" text not null primary key, "name" text not null, "memberCount" integer not null, "organizationId" text not null references "ritize_organizations" ("id") on delete cascade, "createdAt" timestamptz not null, "updatedAt" timestamptz);

create table "ritize_team_members" ("id" text not null primary key, "teamId" text not null references "ritize_teams" ("id") on delete cascade, "userId" text not null references "ritize_users" ("id") on delete cascade, "membershipKey" text unique, "createdAt" timestamptz);

create table "ritize_organization_members" ("id" text not null primary key, "organizationId" text not null references "ritize_organizations" ("id") on delete cascade, "userId" text not null references "ritize_users" ("id") on delete cascade, "role" text not null, "createdAt" timestamptz not null);

create table "ritize_invitations" ("id" text not null primary key, "organizationId" text not null references "ritize_organizations" ("id") on delete cascade, "email" text not null, "role" text, "teamId" text, "status" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "inviterId" text not null references "ritize_users" ("id") on delete cascade);

create index "ritize_sessions_userId_idx" on "ritize_sessions" ("userId");

create index "ritize_accounts_userId_idx" on "ritize_accounts" ("userId");

create index "ritize_verifications_identifier_idx" on "ritize_verifications" ("identifier");

create index "ritize_teams_organizationId_idx" on "ritize_teams" ("organizationId");

create index "ritize_team_members_teamId_idx" on "ritize_team_members" ("teamId");

create index "ritize_team_members_userId_idx" on "ritize_team_members" ("userId");

create index "ritize_organization_members_organizationId_idx" on "ritize_organization_members" ("organizationId");

create index "ritize_organization_members_userId_idx" on "ritize_organization_members" ("userId");

create index "ritize_invitations_organizationId_idx" on "ritize_invitations" ("organizationId");

create index "ritize_invitations_email_idx" on "ritize_invitations" ("email");

create unique index "ritize_accounts_issuer_accountId_uidx" on "ritize_accounts" ("issuer", "accountId");