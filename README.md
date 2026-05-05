# 🚛 HAKO.BOSS - セットアップガイド

## 必要なもの（全部無料で始められる）

| サービス | 用途 | 費用 |
|---------|------|------|
| LINE Developers | LINEBot | 無料 |
| Vercel | サーバー公開 | 無料 |
| OpenAI | AI処理 | 従量課金（初期数百円） |

---

## ステップ1：LINE公式アカウント作成

1. https://developers.line.biz/ja/ にアクセス
2. LINEアカウントでログイン
3. 「プロバイダー作成」→「Messaging API チャネル作成」
4. チャネル名：「HAKO.BOSS」（仮）
5. 「Messaging API設定」タブを開く
6. **Channel Secret** をコピー
7. **Channel Access Token** を発行してコピー

---

## ステップ2：OpenAI APIキー取得

1. https://platform.openai.com にアクセス
2. アカウント作成（クレジットカード登録必要）
3. 「API Keys」→「Create new secret key」
4. キーをコピー

---

## ステップ3：Vercelにデプロイ

```bash
# 1. GitHubにコードをアップロード
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/あなたのユーザー名/hakoboss.git
git push -u origin main

# 2. Vercel（https://vercel.com）でGitHubと連携
# 3. 環境変数を設定（.env.exampleの内容を入力）
```

---

## ステップ4：LINEにWebhook URLを登録

1. LINE Developersに戻る
2. 「Messaging API設定」→「Webhook URL」
3. `https://あなたのvercel URL/webhook` を入力
4. 「検証」ボタンで確認

---

## 動作確認

LINEで友達追加して以下を送ってみる：

```
今日の売上4万円
ガソリン代3000円
今月どう？
```

---

## ローカルでテストする場合

```bash
# 依存関係インストール
npm install

# .env.exampleをコピーして設定
cp .env.example .env
# .envファイルを編集してキーを入力

# サーバー起動
node index.js

# ngrokでLINEからアクセス可能にする
npx ngrok http 3000
```

---

## 今後の追加機能（フェーズ2以降）

- [ ] レシート撮影→自動入力（OCR）
- [ ] 月次レポートの自動送信（毎月1日）
- [ ] 確定申告書類の自動生成
- [ ] Supabaseでデータ永続化
- [ ] Stripe決済連携（有料プラン）
- [ ] 節税アドバイス機能
