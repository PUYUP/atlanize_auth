import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

const router = Router();

/**
 * POST /api/members
 *
 * Tambahkan satu atau lebih user ke sebuah organisasi sekaligus.
 *
 * Body:
 * {
 *   organizationId: string;          // ID organisasi tujuan
 *   members: Array<{
 *     userId: string;                // ID user yang akan ditambahkan
 *     role?: "member" | "admin" | "owner";  // default: "member"
 *   }>;
 * }
 *
 * Response:
 * {
 *   results: Array<{
 *     userId: string;
 *     status: "added" | "error";
 *     member?: object;   // data member jika berhasil
 *     error?: string;    // pesan error jika gagal
 *   }>;
 *   summary: { total: number; added: number; failed: number };
 * }
 */
router.post("/", async (req, res) => {
  // Validasi sesi
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { organizationId, members } = req.body as {
    organizationId?: string;
    members?: Array<{ userId: string; role?: string }>;
  };

  // Validasi input
  if (!organizationId || typeof organizationId !== "string") {
    res
      .status(400)
      .json({ error: "organizationId is required and must be a string" });
    return;
  }

  if (!Array.isArray(members) || members.length === 0) {
    res
      .status(400)
      .json({ error: "members must be a non-empty array" });
    return;
  }

  // Proses setiap member secara paralel
  const results = await Promise.allSettled(
    members.map(({ userId, role = "member" }) =>
      auth.api.addMember({
        body: {
          organizationId,
          userId,
          role: role as "member" | "admin" | "owner",
        },
        headers: fromNodeHeaders(req.headers),
      })
    )
  );

  const output = results.map((result, i) => {
    const { userId, role = "member" } = members[i]!;

    if (result.status === "fulfilled") {
      return {
        userId,
        role,
        status: "added" as const,
        member: result.value,
      };
    }

    return {
      userId,
      role,
      status: "error" as const,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });

  const added = output.filter((r) => r.status === "added").length;
  const failed = output.filter((r) => r.status === "error").length;

  res.status(failed === output.length ? 400 : 200).json({
    results: output,
    summary: {
      total: output.length,
      added,
      failed,
    },
  });
});

export default router;
