import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Peran } from "@/types";

const COOKIE_NAME = "pilketos_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 jam -- cukup untuk satu hari-H

export interface SessionClaims {
  akunId: string;
  pemilihId: string | null;
  kandidatId: string | null;
  role: Peran;
  username: string;
}

function jwtSecret(): string {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s) throw new Error("AUTH_JWT_SECRET belum diset");
  return s;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, jwtSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, jwtSecret()) as SessionClaims;
  } catch {
    return null;
  }
}

/** Dipakai di route handler setelah login berhasil. */
export function setSessionCookie(res: NextResponse, claims: SessionClaims) {
  const token = signSession(claims);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.delete(COOKIE_NAME);
  return res;
}

/** Baca sesi login dari cookie request (dipakai di route handler). */
export function getSessionFromRequest(req: NextRequest): SessionClaims | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Baca sesi login dari server component / server action. */
export async function getSessionFromCookies(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function requireRole(
  claims: SessionClaims | null,
  roles: Peran[]
): claims is SessionClaims {
  return claims !== null && roles.includes(claims.role);
}

/**
 * Endpoint voting (/api/vote/*, klaim-bilik) HARUS memakai voteToken, bukan
 * sesi login pemilih -- ini menegakkan pemisahan token dari Bagian 1 dok. teknis.
 * Kalau request membawa cookie sesi login pemilih ke endpoint ini, kita tolak
 * eksplisit supaya tidak ada jalur yang diam-diam memakai identitas asli.
 */
export function rejectLoginSessionOnVoteEndpoint(
  req: NextRequest
): NextResponse | null {
  const claims = getSessionFromRequest(req);
  if (claims && claims.role === "pemilih") {
    return NextResponse.json(
      {
        error:
          "Endpoint voting hanya menerima voteToken, bukan sesi login pemilih",
      },
      { status: 401 }
    );
  }
  return null;
}
