import { supabase, supabaseConfigurationError } from "./supabase";

const LEADERBOARD_TABLE = "runflowrun_leaderboard";
const POLICY_SCORE_LIMIT_HINT = 50_000;

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export type LeaderboardRow = {
  id: number;
  nickname: string;
  character_id: string;
  score: number;
  distance: number;
  total_points: number;
  created_at: string;
};

export type LeaderboardSubmission = {
  nickname: string;
  character_id: string;
  score: number;
  distance: number;
};

export function normalizeNickname(nickname: string) {
  return nickname.trim().toLowerCase().slice(0, 24);
}

function normalizeSubmission(entry: LeaderboardSubmission) {
  return {
    nickname: normalizeNickname(entry.nickname),
    character_id: entry.character_id,
    score: Math.floor(entry.score),
    distance: Math.max(0, Math.floor(entry.distance)),
  };
}

function isBetterRun(nextRun: Pick<LeaderboardRow, "total_points" | "score" | "distance">, currentRun: Pick<LeaderboardRow, "total_points" | "score" | "distance">) {
  if (nextRun.total_points !== currentRun.total_points) return nextRun.total_points > currentRun.total_points;
  if (nextRun.score !== currentRun.score) return nextRun.score > currentRun.score;
  return nextRun.distance > currentRun.distance;
}

function getSupabaseErrorLike(error: unknown) {
  if (!error || typeof error !== "object") return null;
  return error as SupabaseErrorLike;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError);
  }
  return supabase;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;

  const supabaseError = getSupabaseErrorLike(error);
  if (!supabaseError) return "Error desconocido";

  const detail = [supabaseError.message, supabaseError.details, supabaseError.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  return detail || "Error desconocido";
}

function describeLeaderboardWriteError(error: unknown, entry: Pick<LeaderboardSubmission, "score">) {
  const supabaseError = getSupabaseErrorLike(error);
  const detail = getErrorMessage(error);
  const looksLikePolicyFailure =
    supabaseError?.code === "42501" ||
    /row-level security|permission denied|new row violates/i.test(detail);

  if (looksLikePolicyFailure && entry.score > POLICY_SCORE_LIMIT_HINT) {
    return `Supabase rechazo la corrida por la policy del leaderboard. Esta corrida tiene ${entry.score} puntos; si tu WITH CHECK sigue en score <= ${POLICY_SCORE_LIMIT_HINT}, hay que ampliarlo.`;
  }

  return detail;
}

export async function fetchLeaderboardEntryByNickname(nickname: string) {
  const trimmedNickname = normalizeNickname(nickname);
  if (!trimmedNickname) return null;

  const { data, error } = await requireSupabase()
    .from(LEADERBOARD_TABLE)
    .select("id, nickname, character_id, score, distance, total_points, created_at")
    .ilike("nickname", trimmedNickname)
    .maybeSingle();

  if (error) throw error;
  return (data as LeaderboardRow | null) ?? null;
}

export async function fetchTopLeaderboard(limit = 10) {
  const { data, error } = await requireSupabase()
    .from(LEADERBOARD_TABLE)
    .select("id, nickname, character_id, score, distance, total_points, created_at")
    .order("total_points", { ascending: false })
    .order("score", { ascending: false })
    .order("distance", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export async function submitLeaderboardScore(entry: LeaderboardSubmission) {
  const sanitized = normalizeSubmission(entry);
  const client = requireSupabase();

  const { data, error } = await client
    .from(LEADERBOARD_TABLE)
    .insert(sanitized)
    .select("id, nickname, character_id, score, distance, total_points, created_at")
    .single();

  if (error) throw new Error(describeLeaderboardWriteError(error, sanitized));
  return data as LeaderboardRow;
}

export async function submitBestLeaderboardScore(entry: LeaderboardSubmission) {
  const client = requireSupabase();
  const sanitized = normalizeSubmission(entry);
  const nextTotalPoints = sanitized.score + sanitized.distance;
  const existingEntry = await fetchLeaderboardEntryByNickname(sanitized.nickname);

  if (
    existingEntry &&
    !isBetterRun(
      {
        total_points: nextTotalPoints,
        score: sanitized.score,
        distance: sanitized.distance,
      },
      existingEntry
    )
  ) {
    return { status: "kept-existing" as const, row: existingEntry };
  }

  const query = existingEntry
    ? client
        .from(LEADERBOARD_TABLE)
        .update(sanitized)
        .eq("id", existingEntry.id)
    : client.from(LEADERBOARD_TABLE).insert(sanitized);

  const { data, error } = await query.select("id, nickname, character_id, score, distance, total_points, created_at").single();

  if (error) throw new Error(describeLeaderboardWriteError(error, sanitized));
  return {
    status: existingEntry ? ("updated-best" as const) : ("inserted-best" as const),
    row: data as LeaderboardRow,
  };
}
