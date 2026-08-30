import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { pool } from "./db.js";
const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const socialProviders = {};
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
    database: pool,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: false,
    },
    socialProviders,
    session: {
        modelName: "ba_sessions",
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
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
            ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
        },
    },
    plugins: [
        organization({
            teams: {
                enabled: true,
                maximumTeams: 99999999999999,
                allowRemovingAllTeams: false,
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
//# sourceMappingURL=auth.js.map