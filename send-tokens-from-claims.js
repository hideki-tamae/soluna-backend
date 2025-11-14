// send-tokens-from-claims.js
// Node (ESM) / ethers v5 / Supabase Postgres

import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;
import { ethers } from 'ethers';

// ===========================
//  ENV 取得
// ===========================
const {
  DATABASE_URL,

  // RPC URL（どちらか片方が入っていればOK）
  SEPOLIA_RPC,
  SEPOLIA_RPC_URL,

  AUTOMATION_PRIVATE_KEY,
  SOLUNA_TOKEN_ADDRESS,

  // 金額系（名前の揺れに対応）
  TOKEN_AMOUNT_PER_CLAIM,
  CLAIM_AMOUNT,
  TOKEN_DECIMALS,
  CLAIM_DECIMALS,
} = process.env;

// どの環境変数を使うか整理
const RPC_URL = SEPOLIA_RPC_URL || SEPOLIA_RPC;
const CLAIM_AMOUNT_STR = CLAIM_AMOUNT || TOKEN_AMOUNT_PER_CLAIM || '100';
const CLAIM_DECIMALS_NUM = Number(CLAIM_DECIMALS || TOKEN_DECIMALS || 18);

// 必須チェック
if (!DATABASE_URL || !RPC_URL || !AUTOMATION_PRIVATE_KEY || !SOLUNA_TOKEN_ADDRESS) {
  console.error('❌ 必要な環境変数が足りません。');
  console.error('   DATABASE_URL, SEPOLIA_RPC(_URL), AUTOMATION_PRIVATE_KEY, SOLUNA_TOKEN_ADDRESS を確認してください。');
  process.exit(1);
}

// ===========================
//  DB 接続
// ===========================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // 開発用。本番では true 推奨
});

// ===========================
//  ethers v5: Provider / Signer / Contract
// ===========================
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(AUTOMATION_PRIVATE_KEY, provider);

const tokenAbi = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

const tokenContract = new ethers.Contract(SOLUNA_TOKEN_ADDRESS, tokenAbi, signer);
const amountToSend = ethers.utils.parseUnits(CLAIM_AMOUNT_STR, CLAIM_DECIMALS_NUM);

/**
 * PENDING ステータスの請求を検索し、トークンを送金する
 */
async function sendTokensFromClaims() {
  console.log('🚀 Starting send-tokens-from-claims...');
  console.log(`  Token:  ${SOLUNA_TOKEN_ADDRESS}`);
  console.log(
    `  Amount: ${CLAIM_AMOUNT_STR} SOLUNA (raw=${amountToSend.toString()})`
  );

  try {
    // 1. PENDING の請求を取得
    console.log('📥 Fetching PENDING claims from database...');
    const result = await pool.query(
      `
      SELECT id, recipient_address, book_id
      FROM claims
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 10
      `
    );
    const pendingClaims = result.rows;

    if (pendingClaims.length === 0) {
      console.log('📌 見つかった PENDING 件数: 0 件');
      return;
    }

    console.log(`📌 見つかった PENDING 件数: ${pendingClaims.length} 件`);
    console.log(`👛 送信元ウォレット: ${signer.address}`);

    // 2. 各 PENDING に対して送金処理
    for (const claim of pendingClaims) {
      const to = claim.recipient_address;
      console.log(
        `\n➡️  処理中 claim_id=${claim.id}, book_id=${claim.book_id}, to=${to}`
      );

      try {
        // トークン送金トランザクションを送信
        const tx = await tokenContract.transfer(to, amountToSend);
        console.log(`   ⏳ トランザクション送信: ${tx.hash}`);

        // 確定を待つ
        await tx.wait();
        console.log('   ✅ トランザクション確定');

        // 送金成功時の DB 更新
        await pool.query(
          `
          UPDATE claims
          SET status = $1,
              tx_hash = $2,
              updated_at = NOW()
          WHERE id = $3
          `,
          ['COMPLETED', tx.hash, claim.id]
        );

        console.log('   🟢 DB 更新: status=COMPLETED');
        console.log(`   🔗 Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);
      } catch (e) {
        // 送金失敗時 (ガス不足、コントラクトエラーなど)
        console.error('   ❌ 送金エラー:', e);

        await pool.query(
          `
          UPDATE claims
          SET status = $1,
              error_message = $2,
              updated_at = NOW()
          WHERE id = $3
          `,
          ['FAILED', String(e), claim.id]
        );

        console.log('   🔴 DB 更新: status=FAILED');
      }
    }

    console.log('\n🎉 すべての PENDING claim の処理が完了しました。');
  } catch (err) {
    console.error('予期せぬエラー:', err);
  } finally {
    await pool.end();
  }
}

sendTokensFromClaims();
