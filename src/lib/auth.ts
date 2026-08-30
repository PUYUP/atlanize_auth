import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { organization } from "better-auth/plugins";
import { pool } from "./db.js";

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Only register a social provider once its credentials are actually
// configured, so the app still boots cleanly before OAuth is set up.
const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  // Passing a `pg.Pool` directly lets Better Auth manage the schema via its
  // built-in Kysely adapter, no extra ORM required.
  database: pool,

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Flip to true once an email provider is wired up (see the `email`
    // config in the Better Auth docs) so new accounts must verify first.
    requireEmailVerification: false,
  },

  socialProviders,

  session: {
    modelName: "ba_sessions",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },

  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: {
      // By default Better Auth parses headers like x-forwarded-for.
      // Since it's behind Nginx in docker-compose, we can just allow it
      // or specify the nginx network IP. An empty trustedProxies or trusting all proxies
      // might be required if we don't know the exact bridge IP.
      // Let's set it to true or a wildcard if it accepts boolean, or just trust common private IPs.
      // But actually, just passing an empty array to allow whatever or leaving it to parse the headers.
      // Let's define the header that nginx sets:
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },

  plugins: [
    organization({
      teams: {
        enabled: true,
        maximumTeams: 99999999999999,
        allowRemovingAllTeams: false, // Optional: prevent removing the last team
      },
      schema: {
        team: {
          modelName: "ba_teams",
        },
        teamMember: {
          modelName: "ba_team_members",
        },
        organizationRole: {
          modelName: "ba_organization_roles",
        },
        invitation: {
          modelName: "ba_invitations",
        },
        organization: {
          modelName: "ba_organizations",
        },
        member: {
          modelName: "ba_organization_members",
        },
      },
    }),
  ],

  user: {
    modelName: "ba_users",
  },
  account: {
    modelName: "ba_accounts",
  },
  verification: {
    modelName: "ba_verifications",
  },

});

export type Auth = typeof auth;
