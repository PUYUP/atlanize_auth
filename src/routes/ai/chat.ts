import express, { Router, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import type { UIMessage } from "@ai-sdk/react";
import { convertToModelMessages, createIdGenerator, generateText, isStepCount, pipeUIMessageStreamToResponse, streamText, tool, toUIMessageStream } from "ai";
import { google } from '@ai-sdk/google';
import z from "zod";
import { createMCPClient } from "@ai-sdk/mcp";
import { supabase } from "../../lib/supabase.js";

const router = Router();

// Tentukan berapa banyak pesan terakhir yang ingin diingat AI.
// Angka genap disarankan (misal 6: berarti 3 interaksi tanya-jawab terakhir)
const MAX_HISTORY = 6;

// cors() menangani preflight OPTIONS otomatis. Kalau app utama sudah pasang
// cors()/express.json() secara global, dua baris di bawah ini boleh dihapus
// supaya body tidak diparse dua kali.
router.use(cors());
router.use(express.json());

function getMessageText(message: UIMessage): string {
    return message.parts
        .filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join(" ")
        .trim();
}

function buildFallbackTitle(firstMessage: UIMessage): string {
    const text = getMessageText(firstMessage);
    return text.length > 60 ? text.slice(0, 60).trim() + "…" : text || "Percakapan baru";
}

function removeDuplicateMessages(messages: UIMessage[]): UIMessage[] {
    const seen = new Set();

    return messages.filter((message: UIMessage) => {
        if (seen.has(message.id)) {
            return false;
        }

        seen.add(message.id);
        return true;
    });
}

function getRecentMessages(messages: UIMessage[], maxHistory: number): UIMessage[] {
    let sliced = messages.slice(-maxHistory);

    // Buang pesan di awal yang bukan role "user" —
    // provider seperti Gemini wajib history dimulai dari user.
    const firstUserIndex = sliced.findIndex((m) => m.role === "user");
    if (firstUserIndex > 0) {
        sliced = sliced.slice(firstUserIndex);
    }

    return sliced;
}

router.post("/chat", async (req: Request, res: Response) => {
    const { messages: incomingMessages, id: chatId }: { messages: UIMessage[]; id: string } = req.body;
    const { authorization } = req.headers;
    const token = authorization?.replace(/^Bearer\s+/i, "");
    const { data: user, error } = await supabase.auth.getUser(token!);

    if (error || !user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // getting `user` from public.user
    const { data: userData } = await supabase.from('user')
        .select('*')
        .eq('auth_user_id', user.user?.id)
        .single();

    // get history of chat messages
    // --- Load history yang SUDAH tersimpan di database (source of truth) ---
    const { data: existingChat } = await supabase
        .from("chats")
        .select("messages")
        .eq("conversation_id", chatId)
        .eq("user_id", userData.id)
        .maybeSingle(); // null kalau chat baru, bukan error

    const previousMessages: UIMessage[] = existingChat?.messages ?? [];

    // Gabungkan: history dari DB + pesan baru dari client
    const messages = [...previousMessages, ...incomingMessages];

    // --- Koneksi ke MCP server (HTTP transport, direkomendasikan untuk production) ---
    let mcpTools: Record<string, any> = {};
    let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | undefined;

    try {
        mcpClient = await createMCPClient({
            transport: {
                type: "http",
                url: process.env.MCP_SERVER_URL!,
                headers: authorization
                    ? { Authorization: authorization }
                    : undefined,
            },
        });
        mcpTools = await mcpClient.tools();
    } catch (err) {
        console.error("Gagal konek ke MCP server, lanjut tanpa MCP tools:", err);
    }

    // Potong array messages agar tidak semua history dikirim
    const recentMessages = getRecentMessages(messages, MAX_HISTORY);

    const result = streamText({
        model: google('gemini-3.5-flash-lite'),
        messages: await convertToModelMessages(recentMessages),
        stopWhen: isStepCount(5),
        onEnd: async ({ usage, ...abc }) => {
            const balance = userData.token_balance;
            const { totalTokens } = usage;

            if (totalTokens && balance > 0) {
                const updatedBalance = balance - totalTokens;

                const { error } = await supabase
                    .from("user")
                    .update({ token_balance: updatedBalance })
                    .eq("id", userData.id);
            }
        },
        tools: {
            ...mcpTools,
            getCurrentDate: tool({
                description: "Mengambil tanggal dan hari saat ini (waktu server).",
                inputSchema: z.object({
                    timezone: z
                        .string()
                        .optional()
                        .describe("IANA timezone, contoh 'Asia/Jakarta'. Default Asia/Jakarta."),
                }),
                execute: async ({ timezone }) => {
                    const tz = timezone ?? "Asia/Jakarta";
                    const now = new Date();

                    return {
                        iso: now.toISOString(),
                        timezone: tz,
                        dayName: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(now),
                        date: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(now),
                        time: new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz }).format(now),
                    };
                },
            }),
        },
    });

    pipeUIMessageStreamToResponse({
        response: res,
        stream: toUIMessageStream({
            stream: result.stream,
            originalMessages: messages,
            generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
            messageMetadata: ({ part }) => {
                if (part.type === "start") {
                    return { model: "gemini-3.5-flash-lite" };
                }
                if (part.type === "finish") {
                    // part.totalUsage = akumulasi token dari SEMUA step
                    // (relevan karena kamu pakai stopWhen: isStepCount(5))
                    const totalTokens = part.totalUsage.totalTokens ?? 0;
                    return {
                        usage: {
                            inputTokens: part.totalUsage.inputTokens,
                            outputTokens: part.totalUsage.outputTokens,
                            totalTokens: part.totalUsage.totalTokens,
                        },
                        remainingBalance: userData.token_balance - totalTokens,
                    };
                }
            },
            onEnd: async ({ messages: finalMessages }) => {
                const isNewChat = messages.length === 1;
                const firstMessage = messages[0]; // UIMessage | undefined

                const payload: Record<string, any> = {
                    conversation_id: chatId,
                    user_id: userData.id,
                    messages: removeDuplicateMessages(finalMessages),
                    updated_at: new Date().toISOString(),
                };

                if (isNewChat && firstMessage) {
                    payload.title = buildFallbackTitle(firstMessage);
                }

                const { error: saveError } = await supabase
                    .from("chats")
                    .upsert(payload, { onConflict: "conversation_id" });

                if (saveError) console.error("Gagal simpan chat:", saveError);

                if (isNewChat && firstMessage) {
                    generateText({
                        model: google('gemini-3.5-flash-lite'),
                        prompt: `Buatkan judul singkat (maksimal 6 kata, tanpa tanda kutip) untuk percakapan yang dimulai dengan pesan berikut:\n\n"${getMessageText(firstMessage)}"`,
                    })
                        .then(({ text }) => {
                            const title = text.trim().replace(/^["']|["']$/g, "");
                            if (title) {
                                return supabase.from("chats").update({ title }).eq("conversation_id", chatId);
                            }
                        })
                        .catch((err) => console.error("Gagal generate judul AI:", err));
                }
            },
        }),
    });
});

// Method selain POST ke /chat -> 405, meniru pengecekan method di versi asli.
router.all("/chat", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Method not allowed. Use POST." });
});

export default router;