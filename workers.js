const DIFF_THRESHOLD = 1;
const BOC_URL = "https://www.boc.cn/sourcedb/whpj/mfx_1620.html";
const AUD_NAME = "澳大利亚元";
const USD_NAME = "美元";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleJob(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      await handleJob(env);
      return new Response("OK\n", { status: 200 });
    }
    return new Response("boc-rate-monitor\n", { status: 200 });
  },
};

async function handleJob(env) {
  const res = await fetch(BOC_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0",
    },
  });

  if (!res.ok) {
    console.error("fetch BOC failed:", res.status, await res.text());
    return;
  }

  const html = await res.text();
  const data = parseRatesFromHtml(html);
  if (!data[AUD_NAME] || !data[USD_NAME]) {
    console.error("Cannot find AUD or USD in parsed data:", data);
    return;
  }

  const { cstTime, aestTime } = getCurrentTimes();

  const lastJson = await env.EXCHANGE_KV.get("exchange_rate_monitor", {
    type: "json",
  });

  let diff = 0;
  let shouldSend = false;
  let isFirstTime = false;

  if (lastJson && lastJson[AUD_NAME]) {
    diff = lastJson[AUD_NAME].sale - data[AUD_NAME].sale;
    if (diff >= DIFF_THRESHOLD || diff <= -DIFF_THRESHOLD) {
      shouldSend = true;
    }
  } else {
    isFirstTime = true;
    shouldSend = true;
  }

  if (shouldSend) {
    const msg = buildTelegramMessage({
      data,
      diff,
      cstTime,
      aestTime,
      isFirstTime,
    });
    await sendTelegram(env, msg);
    await env.EXCHANGE_KV.put("exchange_rate_monitor", JSON.stringify(data));
  }
}

function parseRatesFromHtml(html) {
  const result = {};
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = trRegex.exec(html)) !== null) {
    const trContent = match[1];
    const tds = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      const text = tdMatch[1]
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, "")
        .trim();
      if (text) tds.push(text);
    }
    if (tds.length < 3) continue;
    const name = tds[0];
    const buy = parseFloat(tds[1]);
    const sale = parseFloat(tds[2]);
    if (!isNaN(buy) && !isNaN(sale)) {
      result[name] = { buy, sale };
    }
  }
  return result;
}

function getCurrentTimes() {
  const now = new Date();
  const cstTime = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const aestTime = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return { cstTime, aestTime };
}

function buildTelegramMessage({ data, diff, cstTime, aestTime, isFirstTime }) {
  const aud = data[AUD_NAME];
  const usd = data[USD_NAME];

  if (isFirstTime) {
    return (
      `------汇率变动通知------\n\n` +
      `当前CNY/AUD汇率:\n` +
      `买入: ${aud.buy}\n` +
      `卖出: ${aud.sale}\n\n` +
      `当前CNY/USD汇率:\n` +
      `买入: ${usd.buy}\n` +
      `卖出: ${usd.sale}\n\n` +
      `时间: ${cstTime} (CST)\n          ${aestTime} (AEST)\n\n`+
      `由 Cloudflare Workers 平台驱动`
    );
  }

  return (
    `------汇率变动通知------\n\n` +
    `当前CNY/AUD汇率:\n` +
    `买入: ${aud.buy}\n` +
    `卖出: ${aud.sale}\n` +
    `变动幅度: ${diff.toFixed(2)}\n\n` +
    `当前CNY/USD汇率:\n` +
    `买入: ${usd.buy}\n` +
    `卖出: ${usd.sale}\n\n` +
    `时间: ${cstTime} (CST)\n          ${aestTime} (AEST)\n\n`+
    `由 Cloudflare Workers 平台驱动`
  );
}

async function sendTelegram(env, text) {
  const token = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;
  if (!token || !chatId) {
    console.error("TG_BOT_TOKEN or TG_CHAT_ID not set");
    return;
  }
  const body = {
    chat_id: chatId,
    text,
  };
  if (env.TG_TOPIC_ID) {
    body.message_thread_id = env.TG_TOPIC_ID;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    console.error("sendTelegram failed:", res.status, await res.text());
  }
}