// db_migrate_claims.cjs
// SOLUNA の claims テーブルを作る／足りないカラムを追加するマイグレーションスクリプト（安全版）

require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL が .env に設定されていません。');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false }, // server.js と同じ（開発用）
  });

  try {
    console.log('🚀 claims テーブルのマイグレーションを開始します…');

    // 1) claims テーブルが無ければ「id だけ」のシンプルなテーブルを作る
    await pool.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY
      )
    `);

    // 2) 必要なカラムを、存在しなければ順番に追加していく
    await pool.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS book_id TEXT
    `);

    await pool.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS passphrase_hash TEXT
    `);

    await pool.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS recipient_address TEXT
    `);

    await pool.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS status TEXT
    `);

    await pool.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    await pool.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    // 3) 住所 + book_id の組み合わせで検索しやすくするインデックス
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_claims_recipient_book
      ON claims (lower(recipient_address), book_id)
    `);

    console.log('✅ claims テーブルのマイグレーション完了');
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await pool.end();
  }
}

main();
