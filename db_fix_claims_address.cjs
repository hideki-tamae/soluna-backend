// db_fix_claims_address.cjs
// claims.address カラムの NOT NULL 制約を外すためのワンショットスクリプト

require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL が .env に設定されていません。');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false }, // server.js と同じ設定（開発用）
  });

  try {
    console.log('🚀 claims.address の NOT NULL 制約を解除します…');

    await pool.query(`
      ALTER TABLE claims
      ALTER COLUMN address DROP NOT NULL
    `);

    console.log('✅ claims.address の NOT NULL 制約を解除しました');
  } catch (err) {
    console.error('❌ Error while altering claims.address:', err);
  } finally {
    await pool.end();
  }
}

main();

