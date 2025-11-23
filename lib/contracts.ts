// lib/contracts.ts
// このファイルは、デプロイされた新しいトークンの住所と、
// トークンと会話するためのABI（翻訳情報）を定義します。

// ✅ 新しい銀行の住所 (最新デプロイのアドレス)
export const SOLUNA_CONTRACT_ADDRESS = "0x125bF561721f414Ab3769D59Aca8927be1267f46"; 

// ✅ トークンと会話するためのABI (残高確認、送金、シンボル取得に必要な情報)
export const SOLUNA_ABI = [
  // balanceOf: 残高を確認する機能 (READ)
  { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
  // transfer: トークンを送金する機能 (WRITE) <-- 管理画面の「Send」ボタンに必要
  { "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "success", "type": "bool"}], "type": "function" },
  // decimals: 小数点以下の桁数を取得する機能 (READ)
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" },
  // symbol: トークンシンボルを取得する機能 (READ)
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "type": "function" }
];