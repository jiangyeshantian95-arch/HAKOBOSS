const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const OpenAI = require('openai');

const app = express();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const lineClient = new Client(lineConfig);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const userDB = {};

function getUser(userId) {
  if (!userDB[userId]) {
    userDB[userId] = { records: [] };
  }
  return userDB[userId];
}

function getMonthlySummary(records) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthly = records.filter(r => r.date && r.date.startsWith(thisMonth));
  const sales = monthly.filter(r => r.type === 'sales').reduce((sum, r) => sum + r.amount, 0);
  const expenses = monthly.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  return { sales, expenses, profit: sales - expenses };
}

async function processMessage(userId, userMessage) {
  const user = getUser(userId);
  const summary = getMonthlySummary(user.records);
  const today = new Date().toISOString().split('T')[0];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `あなたはHAKO.BOSSという個人事業主専用AIアシスタントです。今月：売上¥${summary.sales.toLocaleString()} 経費¥${summary.expenses.toLocaleString()} 手取り¥${summary.profit.toLocaleString()} 今日:${today} 売上・経費を記録し、経営状況を報告します。必ずJSON形式で返答してください。{"message":"返答（絵文字使用・短く）","record":{"type":"sales"か"expense"かnull,"amount":数値かnull,"category":"カテゴリ名"かnull}} 記録なし時はrecord:null`
      },
      { role: 'user', content: userMessage }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content);

  if (result.record && result.record.type && result.record.amount) {
    user.records.push({
      type: result.record.type,
      amount: result.record.amount,
      category: result.record.category || '未分類',
      date: today,
    });
  }

  return result.message;
}

app.get('/', (req, res) => {
  res.json({ status: 'HAKO.BOSS running 🚛' });
});

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  const events = req.body.events;
  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    try {
      const reply = await processMessage(event.source.userId, event.message.text);
      await lineClient.replyMessage(event.replyToken, { type: 'text', text: reply });
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
});

module.exports = app;
