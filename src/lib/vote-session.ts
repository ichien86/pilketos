import type { Db } from "mongodb";
import { getDb } from "@/lib/db";
import { resolveHariHMode } from "@/lib/fase-gate";
import { hashToken } from "@/lib/voteToken";
import { expireSesiIfNeeded } from "@/lib/ttl";
import type { SesiPemilih } from "@/types";

/** Resolusi voteToken -> {db, sesi} dipakai bareng oleh endpoint kandidat/submit/status. */
export async function resolveSesiByVoteToken(
  voteToken: string
): Promise<{ db: Db; sesi: SesiPemilih | null }> {
  const mode = await resolveHariHMode();
  const db = await getDb(mode);
  const tokenHash = hashToken(voteToken);
  let sesi = await db.collection<SesiPemilih>("sesi_pemilih").findOne({ token_hash: tokenHash });
  if (sesi) sesi = await expireSesiIfNeeded(db, sesi);
  return { db, sesi };
}
