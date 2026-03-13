import { supabase } from "./supabase";

const LEADERBOARD_TABLE = "runflowrun_leaderboard";

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

function normalizeSubmission(entry: LeaderboardSubmission) {
  return {
    nickname: entry.nickname.trim().slice(0, 24),
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

export async function fetchLeaderboardEntryByNickname(nickname: string) {
  const trimmedNickname = nickname.trim().slice(0, 24);
  if (!trimmedNickname) return null;

  const { data, error } = await supabase
    .from(LEADERBOARD_TABLE)
    .select("id, nickname, character_id, score, distance, total_points, created_at")
    .eq("nickname", trimmedNickname)
    .maybeSingle();

  if (error) throw error;
  return (data as LeaderboardRow | null) ?? null;
}

export async function fetchTopLeaderboard(limit = 10) {
  const { data, error } = await supabase
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

  const { data, error } = await supabase
    .from(LEADERBOARD_TABLE)
    .insert(sanitized)
    .select("id, nickname, character_id, score, distance, total_points, created_at")
    .single();

  if (error) throw error;
  return data as LeaderboardRow;
}

export async function submitBestLeaderboardScore(entry: LeaderboardSubmission) {
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

  const { data, error } = await supabase
    .from(LEADERBOARD_TABLE)
    .upsert(sanitized, { onConflict: "nickname" })
    .select("id, nickname, character_id, score, distance, total_points, created_at")
    .single();

  if (error) throw error;
  return {
    status: existingEntry ? ("updated-best" as const) : ("inserted-best" as const),
    row: data as LeaderboardRow,
  };
}
