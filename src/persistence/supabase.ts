"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AppData } from "@/store/app-store";

/**
 * Опційна хмарна синхронізація прогресу через Supabase.
 * Працює лише якщо задано NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Без них застосунок повністю працює локально (localStorage).
 * Схема таблиці та RLS-політики: supabase/migrations/0001_app_snapshots.sql.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(URL_ && KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) client = createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export async function getCurrentUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export async function sendMagicLink(email: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase не налаштовано");
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/settings` } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function pushSnapshot(data: AppData): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase не налаштовано");
  const user = await getCurrentUser();
  if (!user) throw new Error("Спершу увійдіть");
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from("app_snapshots").upsert({ user_id: user.id, data, schema_version: data.schemaVersion, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

export async function pullSnapshot(): Promise<{ data: AppData; updatedAt: string } | null> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase не налаштовано");
  const user = await getCurrentUser();
  if (!user) throw new Error("Спершу увійдіть");
  const { data, error } = await sb.from("app_snapshots").select("data, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { data: data.data as AppData, updatedAt: data.updated_at as string };
}
