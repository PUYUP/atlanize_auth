alter table "ba_sessions" add column "activeTeamId" text;

alter table "ba_invitations" add column "teamId" text;

create table "ba_teams" ("id" text not null primary key, "name" text not null, "memberCount" integer not null, "organizationId" text not null references "ba_organizations" ("id") on delete cascade, "createdAt" timestamptz not null, "updatedAt" timestamptz);

create table "ba_team_members" ("id" text not null primary key, "teamId" text not null references "ba_teams" ("id") on delete cascade, "userId" text not null references "ba_users" ("id") on delete cascade, "membershipKey" text unique, "createdAt" timestamptz);

create index "ba_teams_organizationId_idx" on "ba_teams" ("organizationId");

create index "ba_team_members_teamId_idx" on "ba_team_members" ("teamId");

create index "ba_team_members_userId_idx" on "ba_team_members" ("userId");