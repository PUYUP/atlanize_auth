// chat.router.ts
//
// Router chat, siap di-mount ke app utama, misalnya:
//   import chatRouter from "./chat.router";
//   app.use(chatRouter);                 // -> POST /chat
//   // atau app.use("/api", chatRouter); // -> POST /api/chat
//
// PENTING: LLM_BASE_URL dibaca saat module ini di-load (bukan di dalam
// request), jadi pastikan env loader (mis. `import "dotenv/config"`) sudah
// dipanggil di entrypoint utama SEBELUM router ini di-import.
//
// auth: endpoint ini publik (tidak ada credential check sama sekali). Kalau
// butuh proteksi, tambahkan middleware auth kamu sendiri sebelum handler,
// mis. router.post("/chat", authMiddleware, async (req, res) => {...}).

import express, { Router, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
    streamText,
    convertToModelMessages,
    type UIMessage,
    type StreamTextEndEvent,
} from "ai";
import { z } from "zod";

const router = Router();

// cors() menangani preflight OPTIONS otomatis. Kalau app utama sudah pasang
// cors()/express.json() secara global, dua baris di bawah ini boleh dihapus
// supaya body tidak diparse dua kali.
router.use(cors());
router.use(express.json());

// Body JSON yang invalid akan bikin express.json() throw sebelum masuk ke
// route handler -> tangkap di sini biar bentuk error responnya tetap
// konsisten dengan try/catch di dalam handler /chat.
router.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === "entity.parse.failed") {
        return res.status(500).json({
            error: "Internal error",
            details: err instanceof Error ? err.message : String(err),
        });
    }
    next(err);
});

const LLM_BASE_URL = process.env.LLM_BASE_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

if (!LLM_BASE_URL) {
    throw new Error("Missing required env var: LLM_BASE_URL");
}

router.post("/chat", async (req: Request, res: Response) => {
    const hermes = createOpenAICompatible({
        name: "hermes",
        baseURL: LLM_BASE_URL,
        apiKey: LLM_API_KEY,
        // Modifikasi fetch bawaan untuk mencegat respons
        fetch: async (url, options) => {
            const response = await fetch(url, options);

            // Buat stream penyaring (filter)
            const transformStream = new TransformStream({
                transform(chunk, controller) {
                    const text = new TextDecoder().decode(chunk);
                    // Jika chunk mengandung event dari hermes, JANGAN diteruskan ke AI SDK
                    if (text.includes("event: hermes.tool.progress")) {
                        return; // Skip (buang/keluarkan event ini)
                    }
                    // Jika aman, teruskan ke parser AI SDK
                    controller.enqueue(chunk);
                },
            });

            return new Response(response.body?.pipeThrough(transformStream), {
                status: response.status,
                headers: response.headers,
            });
        },
    });

    try {
        const payload = req.body;

        // 1. Ambil array messages (bisa dari payload langsung atau payload.messages)
        const rawMessages: UIMessage[] = Array.isArray(payload) ? payload : payload?.messages;

        if (!rawMessages || !Array.isArray(rawMessages)) {
            return res.status(400).json({
                error: "Invalid payload: must be an array of chat messages.",
            });
        }

        // 2. Proceed with streaming using rawMessages (bypass sanitization)
        const result = streamText({
            model: hermes("hermes-agent"),
            messages: await convertToModelMessages(rawMessages),
            timeout: { totalMs: 5000 },
            tools: {
                search_notes: {
                    description:
                        "Search and retrieve study notes or workspace documents using semantic similarity. Use this tool when the user asks a question about their notes, materials, or needs information from a specific study class. Supports searching multiple distinct topics/questions in a single call via `queries`. VALID PARAMETERS ONLY: query, queries, created_at, from_date, to_date, study_class_name, top_k — never invent or pass any other parameter (e.g. pattern, filter, query, keyword, regex, search). Any unknown parameter causes the ENTIRE call to fail validation.",
                    // ai@7 renamed the tool schema field from `parameters` (v3/v4) to
                    // `inputSchema` (v5+) — updated here so the tool actually registers.
                    inputSchema: z.object({
                        query: z
                            .string()
                            .optional()
                            .describe(
                                'A single question or topic to search for (e.g., "What is mitosis?" or "rumus gravitasi"). Use this when the user is asking about ONE topic. If the user asks about several distinct topics/questions at once, use `queries` instead — do not invent a different parameter name or merge topics into one string.'
                            ),
                        queries: z
                            .array(z.string())
                            .optional()
                            .describe(
                                'A list of separate questions or topics to search for in ONE call (e.g., ["What is mitosis?", "rumus gravitasi"]). Use this when the user\'s message covers multiple distinct topics/questions, instead of calling the tool multiple times. Leave undefined for a single-topic search and use `query` instead. Do not set both `query` and `queries` together — if `queries` is provided, `query` is ignored.'
                            ),
                        created_at: z
                            .string()
                            .optional()
                            .describe(
                                'Exact date to filter the notes, formatted in ISO8601 (e.g., "2023-10-25"). Leave undefined unless the user explicitly mentions a single, exact date. For a date range, use `from_date` / `to_date` instead.'
                            ),
                        from_date: z
                            .string()
                            .optional()
                            .describe(
                                'Start date (inclusive) of a date range, formatted in ISO8601 (e.g., "2023-10-01"). Use together with `to_date` when the user refers to a period, e.g. "sejak minggu lalu", "dari tanggal 1", "bulan ini". Leave undefined unless the user implies a starting point in time.'
                            ),
                        to_date: z
                            .string()
                            .optional()
                            .describe(
                                'End date (inclusive) of a date range, formatted in ISO8601 (e.g., "2023-10-25"). Use together with `from_date` when the user refers to a period, e.g. "sampai kemarin", "sampai akhir bulan". Leave undefined unless the user implies an end point in time.'
                            ),
                        study_class_name: z
                            .string()
                            .optional()
                            .describe(
                                'The name of the class, subject, or workspace to filter by (e.g., "Biology", "Matematika Dasar"). Matching is automatic case-insensitive substring matching — just pass plain text here; there is no separate pattern/regex/wildcard parameter to set. Applied to every topic when `queries` is used.'
                            ),
                        top_k: z
                            .number()
                            .optional()
                            .default(5)
                            .describe(
                                "How many note chunks to retrieve PER QUERY. Default is 5. If `queries` has N topics, up to N * top_k chunks may be returned in total (top_k for each topic)."
                            ),
                    }),
                    execute: async (args) => {
                        console.log("Tool dipanggil oleh LLM dengan argumen:", args);

                        // Normalisasi input jadi array query yang dieksekusi satu per satu.
                        const queryList: (string | undefined)[] =
                            args.queries && args.queries.length > 0
                                ? args.queries
                                : args.query
                                    ? [args.query]
                                    : [undefined];

                        // TODO: sambungkan ke logika pencarian sesungguhnya (mis. panggil API/backend
                        // yang sama dengan versi Python). Untuk setiap query di queryList, jalankan
                        // semantic search + filter created_at / from_date / to_date / study_class_name
                        // yang sama, ambil top_k hasil per query, lalu gabungkan semuanya. Tandai tiap
                        // item dengan matched_query supaya jelas berasal dari topik yang mana.

                        return {
                            success: true,
                            data: "Ini adalah hasil eksekusi dari tool 'search_notes'",
                        };
                    },
                },
            },
            toolOrder: ["search_notes"],
            instructions: `You are an expert technical assistant. Your objective is to provide accurate, well-structured, and highly readable responses.

Strictly adhere to the following output constraints:
- **Markdown Formatting:** Always format your entire response using standard Markdown syntax. Utilize headings, lists, and emphasis to logically organize information.
- **MCP Data Representation:** Whenever you retrieve structured data or records via Model Context Protocol (MCP) tools, you must present the results in cleanly formatted Markdown tables.
- **Code Blocks & Syntax Highlighting:** Enclose all code snippets, SQL queries, JSON payloads, and terminal commands within fenced code blocks accompanied by the appropriate language identifier (e.g., \`\`\`sql, \`\`\`typescript, \`\`\`json).`,
            onFinish: (result: StreamTextEndEvent<any, any, any>) => { },
        });

        // Pipe langsung ke Response object Express/Node.
        await result.pipeUIMessageStreamToResponse(res);
    } catch (error) {
        console.error("Stream error:", error);
        // Tambahkan detil error.message agar gampang di-debug kalau crash lagi
        res.status(500).json({
            error: "Internal error",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});

// Method selain POST ke /chat -> 405, meniru pengecekan method di versi asli.
router.all("/chat", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Method not allowed. Use POST." });
});

export default router;