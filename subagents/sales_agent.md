# sales_agent Documentation

This sub-agent responds to the `/sales` command with sales-related replies.

## Supported usage

- `/sales` → shows available sales helper options
- `/sales pitch` → quick pitch template
- `/sales followup` → polite follow-up template
- `/sales objection` → objection-handling template
- `/sales close` → closing template

## Notes

- Works with either `context.command` or raw `message.text` parsing.
- If `sendMessage` exists in context, it sends directly and returns `true`.
- Otherwise returns `{ reply: string }` for compatibility with alternate runners.
