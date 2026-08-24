import { MongoMemoryReplSet } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach } from "vitest";

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  // Transaksi Mongo (klaim bilik, submit vote) butuh replica set -- server
  // memory biasa (non-replset) tidak mendukungnya, jadi test HARUS pakai ini
  // supaya kode transaksi yang sesungguhnya ikut teruji, bukan mock.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB_PROD = "test_prod";
  process.env.MONGODB_DB_SIMULASI = "test_simulasi";
  process.env.AUTH_JWT_SECRET = "test-auth-secret-32-characters-min";
  process.env.SECRET_CHECKIN = "test-checkin-secret-32-characters-min";
  process.env.DEFAULT_PASSWORD = "MAN3Byl";
}, 120000);

afterEach(async () => {
  const { getMongoClient } = await import("@/lib/db");
  const client = await getMongoClient();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();
  for (const d of databases) {
    if (d.name === "test_prod" || d.name === "test_simulasi") {
      await client.db(d.name).dropDatabase();
    }
  }
});

afterAll(async () => {
  const { getMongoClient } = await import("@/lib/db");
  const client = await getMongoClient();
  await client.close();
  await replSet.stop();
});
