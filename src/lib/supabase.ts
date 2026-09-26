import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL dan SUPABASE_ANON_KEY wajib diisi di .env');
}

// Client "polos" pakai anon key.
// Di server TIDAK perlu persistSession/autoRefreshToken karena tidak ada
// satu sesi user tunggal yang dipakai bersama semua request.
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});

// Client admin pakai service role key -> bypass RLS.
// HANYA dipakai di kode server yang terpercaya, JANGAN pernah dikirim ke client.
export const supabaseAdmin: SupabaseClient | null = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

// Factory: bikin client baru yang "berperan" sebagai user tertentu,
// dengan menyisipkan access token miliknya. Berguna kalau mau query
// yang tetap tunduk ke RLS milik user tsb.
export function createUserClient(accessToken: string): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}