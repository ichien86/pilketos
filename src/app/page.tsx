"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiFetch, ApiError } from "@/lib/client-fetch";
import PasswordInput from "@/components/PasswordInput";
import InfoLuberJurdilButton from "@/components/InfoLuberJurdilButton";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin/fase",
  panitia: "/panitia",
  pemilih: "/pemilih",
  kandidat: "/kandidat/video",
  pengawas: "/pengawas",
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [salahCount, setSalahCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("pilketos_login_salah_count");
      return saved ? parseInt(saved, 10) || 0 : 0;
    }
    return 0;
  });

  // Lockout countdown: sisa detik sebelum boleh mencoba lagi
  const [lockoutSisa, setLockoutSisa] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const until = sessionStorage.getItem("pilketos_login_lockout_until");
      if (until) {
        const sisa = Math.ceil((parseInt(until, 10) - Date.now()) / 1000);
        return sisa > 0 ? sisa : 0;
      }
    }
    return 0;
  });
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLockout = useCallback((detik: number) => {
    const untilMs = Date.now() + detik * 1000;
    sessionStorage.setItem("pilketos_login_lockout_until", String(untilMs));
    setLockoutSisa(detik);
  }, []);

  useEffect(() => {
    if (lockoutSisa <= 0) {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
      return;
    }
    lockoutTimer.current = setInterval(() => {
      setLockoutSisa((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem("pilketos_login_lockout_until");
          if (lockoutTimer.current) clearInterval(lockoutTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, [lockoutSisa > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutSisa > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ role: string; wajib_ganti_password: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pilketos_login_salah_count");
      }
      if (res.wajib_ganti_password) {
        router.push("/ganti-password");
        return;
      }
      router.push(ROLE_HOME[res.role] ?? "/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        // Server rate limit — kunci form selama 60 detik
        startLockout(60);
        setError("Terlalu banyak percobaan login gagal.");
      } else if (e instanceof ApiError && e.status === 403) {
        setError(e.message + " -- coba halaman Aktivasi Akun di bawah.");
      } else {
        const nextCount = salahCount + 1;
        setSalahCount(nextCount);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pilketos_login_salah_count", String(nextCount));
        }

        const baseMsg = e instanceof Error ? e.message : "Gagal login";
        if (nextCount >= 3) {
          setError(`${baseMsg}. Khususnya bagi pemilih, silakan hubungi panitia apabila lupa username/password.`);
        } else {
          setError(baseMsg);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed top-4 right-4 z-10">
        <InfoLuberJurdilButton />
      </div>
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <div className="text-center space-y-1">
          <Image src="/logo-man3.png" alt="Logo OSIM MAN 3 Boyolali" width={88} height={90} className="mx-auto mb-1" priority />
          <h1 className="text-lg font-bold">E-Voting OSIM</h1>
          <p className="text-sm text-slate-500">MAN 3 Boyolali</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="login-username" className="text-sm font-medium block mb-1">Username (NIS/NIP/NIK)</label>
            <input
              id="login-username"
              className="w-full border rounded-lg px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium block mb-1">Password</label>
            <PasswordInput id="login-password" value={password} onChange={setPassword} required />
          </div>
          {error && (
            <div className="space-y-2">
              <p className="text-red-600 text-sm font-medium">{error}</p>
              {salahCount >= 3 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1 text-left">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950">
                    <span>⚠️</span> Percobaan login gagal ({salahCount}x)
                  </p>
                  <p className="leading-relaxed text-amber-800">
                    <strong>Khusus pemilih:</strong> Jika Anda lupa username (NIS/NIP) atau password Anda, silakan <strong>hubungi panitia pemilihan</strong> di Tempat Pemungutan Suara (TPS) untuk bantuan pengecekan data DPT.
                  </p>
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || lockoutSisa > 0}
            className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium disabled:opacity-50"
          >
            {lockoutSisa > 0
              ? `Tunggu ${lockoutSisa} detik...`
              : loading
                ? "Memproses..."
                : "Masuk"}
          </button>
        </form>
        <a href="/aktivasi" className="block text-center text-sm text-blue-600 hover:underline">
          Pertama kali login? Aktivasi akun di sini
        </a>
      </div>
    </main>
  );
}
