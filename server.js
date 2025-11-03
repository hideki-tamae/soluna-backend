// server.js — Node 22 (ESM) / ethers v6 / Express + Postgres
// 開発用：DBはTLS暗号化のまま証明書検証OFF（本番はONに戻す）

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
const { Pool } = pg;
import { ethers } from 'ethers';

// ---- ENV ----
const {
  PORT = 3001,
  SEPOLIA_RPC,
  AUTOMATION_PRIVATE_KEY,
  DATABASE_URL,
} = process.env;

// ---- DB（開発用：検証OFF only / 二重定義しない）----
let dbPool = null;
try {
  if (DATABASE_URL) {
    dbPool = new Pool({
      connectionString: DATABASE_URL,
      // 開発だけ：TLSは張るが証明書検証は無効化
      ssl: { require: true, rejectUnauthorized: false },
    });
  } else {
    console.warn('⚠️ DATABASE_URL 未設定のため DB チェックをスキップします');
  }
} catch (e) {
  console.warn('⚠️ DB init warn:', e?.message || e);
}

// ---- Chain / Signer（未設定でも起動継続）----
let provider = null;
let signer = null;

try {
  if (SEPOLIA_RPC && AUTOMATION_PRIVATE_KEY) {
    provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    signer = new ethers.Wallet(AUTOMATION_PRIVATE_KEY, provider);
  } else {
    console.warn('⚠️ SEPOLIA_RPC / AUTOMATION_PRIVATE_KEY が未設定のためチェーン接続をスキップ');
  }
} catch (e) {
  console.warn('⚠️ Chain init warn:', e?.message || e);
}

// ---- Express ----
const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST'] }));
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

// ルート
app.get('/', (_req, res) => {
  res.send('SOLUNA Claim Server is ready.');
});

// ヘルスチェック
app.get('/health', async (_req, res) => {
  const checks = {};

  // DB
  if (dbPool) {
    try {
      await dbPool.query('SELECT 1');
      checks.db = { connected: true };
    } catch (e) {
      checks.db = { error: String(e?.message || e) };
    }
  } else {
    checks.db = { skipped: true };
  }

  // RPC/Signer
  if (provider && signer) {
    try {
      const net = await provider.getNetwork();
      const addr = await signer.getAddress();
      checks.rpc = {
        chainId: Number(net.chainId),
      };
      // サインテスト（ダミーメッセージ）
      const sig = await signer.signMessage('healthcheck');
      checks.sign = {
        signer: `0x${addr.slice(2,6)}...${addr.slice(-3)}`,
        sig: `${sig.slice(0,14)}…`,
      };
    } catch (e) {
      checks.rpc = { error: String(e?.message || e) };
    }
  } else {
    checks.rpc = { skipped: true };
  }

  const ok = !checks.db?.error;
  res.json({ ok, checks });
});

// 起動
app.listen(PORT, () => {
  console.log(`✅ SOLUNA Backend Server is running on port ${PORT}`);
});

// 起動時に一度だけDBに触ってログ
if (dbPool) {
  dbPool.query('SELECT NOW()')
    .then(() => console.log('✅ Connected successfully to Database.'))
    .catch(err => console.error('❌ Database connection error:', err?.message || err));
}
