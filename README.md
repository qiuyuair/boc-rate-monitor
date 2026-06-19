# 中国银行汇率监控

监控中国银行外汇牌价（AUD/CNY、USD/CNY），当澳元卖出价变动超过阈值时通过 Telegram 推送通知。

- `workers.js` — Cloudflare Workers 版本（当前使用）
- `boc.py` — 早期 Python 本地脚本版本

## Cloudflare Workers 部署

1. 在 Cloudflare 创建 KV 命名空间，绑定到 Worker（变量名 `EXCHANGE_KV`）
2. 设置 Secrets：`TG_BOT_TOKEN`、`TG_CHAT_ID`
3. 在 Workers 设置中连接此 GitHub 仓库并同步部署

手动触发：`GET /run`

## 本地 Python 脚本（可选）

```bash
export TG_BOT_TOKEN=your_token
export TG_CHAT_ID=your_chat_id
python boc.py
```
