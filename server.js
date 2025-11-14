// server.js (ESM 版)
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
}

const supabase = createClient(supabaseUrl, serviceKey);

// HMAC
const secret = process.env.SIGNING_SECRET || '';

function verifySignature(payload, signature) {
  if (!secret || !signature) return false;

  const data = JSON.stringify(payload);
  const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

// ヘルスチェック
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'soluna-backend' });
});

// ★ claim API 本体
app.post('/claim', async (req, res) => {
  try {
    const signature = req.header('x-signature') || '';
    const body = req.body || {};

    //  if (!verifySignature(body, signature)) {
    //   return res.status(401).json({ ok: false, error: 'invalid signature' });
    // }

    const wallet = String(body.wallet || '').trim();
    const soluna = String(body.soluna || '').trim();
    const phrase = String(body.phrase || '').trim();

    if (!wallet) {
      return res.status(400).json({ ok: false, error: 'wallet required' });
    }

    // 二重クレームチェック
    const { data: existing, error: selectError } = await supabase
      .from('claims')
      .select('id')
      .eq('wallet', wallet)
      .maybeSingle();

    if (selectError) {
      console.error('select error:', selectError);
      return res.status(500).json({ ok: false, error: 'db select error' });
    }

    if (existing) {
      return res.status(409).json({ ok: false, error: 'already claimed' });
    }

    // 新規 insert
    const { data, error } = await supabase
      .from('claims')
      .insert({
        wallet,
        soluna_literal: soluna,
        phrase,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('insert error:', error);
      return res.status(500).json({ ok: false, error: 'db insert error' });
    }

    return res.json({ ok: true, claim: data });
  } catch (e) {
    console.error('claim route error:', e);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

app.listen(port, () => {
  console.log(`SOLUNA Backend Server is running on port ${port}`);
});
