import { MongoClient, type Db } from "mongodb";

// Satu MongoClient dipakai bareng untuk DB produksi maupun simulasi (Epic 6) --
// keduanya cuma nama database berbeda di cluster/replica set yang sama, supaya
// transaksi (klaim bilik, submit vote) tetap tersedia di kedua mode tanpa
// menggandakan kode koneksi. Lihat keputusan desain #4 di rencana implementasi.

export type DbMode = "prod" | "simulasi";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI belum diset (lihat .env.example)");
  return uri;
}

function getClientPromise(): Promise<MongoClient> {
  if (!global.__mongoClientPromise) {
    const client = new MongoClient(getUri(), { maxPoolSize: 10 });
    const promise = client.connect();
    // Kalau percobaan koneksi pertama gagal (mis. network access Atlas belum
    // terbuka, blip jaringan sesaat), JANGAN cache promise yang reject --
    // tanpa ini, semua request berikutnya akan langsung gagal dengan error
    // yang sama sampai proses di-restart manual, walau masalahnya sudah beres.
    promise.catch(() => {
      if (global.__mongoClientPromise === promise) {
        global.__mongoClientPromise = undefined;
      }
    });
    global.__mongoClientPromise = promise;
  }
  return global.__mongoClientPromise;
}

function dbNameFor(mode: DbMode): string {
  const name =
    mode === "simulasi"
      ? process.env.MONGODB_DB_SIMULASI
      : process.env.MONGODB_DB_PROD;
  if (!name) throw new Error(`Nama database untuk mode "${mode}" belum diset`);
  return name;
}

export async function getMongoClient(): Promise<MongoClient> {
  return getClientPromise();
}

export async function getDb(mode: DbMode = "prod"): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbNameFor(mode));
}

/** Jalankan operasi dalam multi-document transaction Mongo (butuh replica set). */
export async function withTransaction<T>(
  mode: DbMode,
  fn: (db: Db, session: import("mongodb").ClientSession) => Promise<T>
): Promise<T> {
  const client = await getClientPromise();
  const db = client.db(dbNameFor(mode));
  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(db, session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export async function dropSimulasiDatabase(): Promise<void> {
  const db = await getDb("simulasi");
  await db.dropDatabase();
}
