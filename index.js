const express = require('express');
const line = require('@line/bot-sdk');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// LINE設定
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// OpenAI設定
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ユーザーデータの簡易インメモリDB（本番はSupabaseに移行）
const userDB = {};

function getUser(userId) {
  if (!userDB[userId]) {
    userDB[userId] = {
      records: [],      // 売上・経費の記録
      createdAt: new Date().toISOString(),
    };
  }
  return userDB[userId];
}

// 今月のサマリーを計算
function getMonthlySummary(records) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthly = records.filter(r => r.date.startsWith(thisMonth));
  const sales = monthly.filter(r => r.type === 'sales').reduce((sum, r) => sum + r.amount, 0);
  const expenses = monthly.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const profit = sales - expenses;

  return { sales, expenses, profit, count: monthly.length };
}

// AIでメッセージを解析・応答
async function processMessage(userId, userMessage) {
  const user = getUser(userId);
  const summary = getMonthlySummary(user.records);
  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = `あなたは「HAKO.BOSS」という軽貨物ドライバー専用のAIバックオフィスアシスタントです。

## あなたの役割
- ドライバーの売上・経費を記録する
- 経営状況をわかりやすく報告する
- 確定申告に向けたサポートをする
- 常に親しみやすく、シンプルに返答する

## 今月の状況
- 売上合計：¥${summary.sales.toLocaleString()}
- 経費合計：¥${summary.expenses.toLocaleString()}
- 手取り目安：¥${summary.profit.toLocaleString()}
- 記録件数：${summary.count}件
- 今日の日付：${today}

## 対応できること
1. 売上の記録（「今日の売上〇万円」「売上〇円入った」など）
2. 経費の記録（「ガソリン〇円」「高速代〇円」「駐車場〇円」など）
3. 月次レポートの確認（「今月どう？」「残高は？」など）
4. 確定申告の相談
5. 経費になるものの質問

## 返答ルール
- 必ずJSON形式で返答すること
- 短く・わかりやすく・絵文字を使う
- 数字は必ずカンマ区切りで表示
- 売上・経費を記録した場合はrecordフィールドに記録データを含める

## JSONフォーマット
{
  "message": "ユーザーへの返答テキスト",
  "record": {
    "type": "sales" or "expense" or null,
    "amount": 数値 or null,
    "category": "カテゴリ名" or null,
    "memo": "メモ" or null
  }
}

categoryの例：ガソリン代、高速代、駐車場代、通信費、車両維持費、その他経費

記録がない場合はrecordをnullにすること。`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content);

  // 記録があればDBに保存
  if (result.record && result.record.type && result.record.amount) {
    user.records.push({
      type: result.record.type,
      amount: result.record.amount,
      category: result.record.category || '未分類',
      memo: result.record.memo || userMessage,
      date: today,
      createdAt: new Date().toISOString(),
    });
  }

  return result.message;
}

// LINEのWebhook受信
app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  const events = req.body.events;

  await Promise.all(
    events.map(async (event) => {
      if (event.type !== 'message' || event.message.type !== 'text') return;

      const userId = event.source.userId;
      const userMessage = event.message.text;

      try {
        const replyText = await processMessage(userId, userMessage);
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: replyText }],
        });
      } catch (err) {
        console.error('Error:', err);
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '⚠️ エラーが発生しました。もう一度試してください。' }],
        });
      }
    })
  );

  res.json({ status: 'ok' });
});

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ status: 'HAKO.BOSS is running 🚛' });
});

// 月次レポートAPI（管理用）
app.get('/report/:userId', (req, res) => {
  const user = getUser(req.params.userId);
  const summary = getMonthlySummary(user.records);
  res.json({ summary, records: user.records });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚛 HAKO.BOSS サーバー起動 ポート:${PORT}`);
});
