# Visual matrix

This matrix observes layout. It does not observe the semantics of `formatCurrency`, `replace`, `eq`, or `../`. That belongs to the Message Center cases.

Three layers, each with its own record:

- Browser view: `vtex-email dev`. Desktop is width 600 px. Mobile is width 375 px. It is not an email app.
- Message Center execution: HTML resolved by the account, still without a client.
- Real client rendering: the message as seen in the client below. Image blocking on this row is the client's own blocking. The preview “Block remote images” control only prevents requests in the iframe copy and does not count here.

## Clients

- Gmail, with the recorded surface (web or app).
- Apple Mail, with the recorded system (macOS or iOS).
- Outlook on the web.
- Classic Outlook on Windows.

Do not substitute classic Outlook with Outlook on the web.

## Scenarios

- Multiple items: the proof delivery fixture, with two orders and three items.
- Long text: a synthetic name or street long enough to break the width.
- Missing optional data: the pickup fixture, without address.
- Images blocked by the client.
- Languages supported by the example: `pt-BR` and `en-US`.

## Criterion

Each cell needs the template in [record.md](record.md), with client, version, and date. A cell without a run remains pending. One approved client does not approve the others. One approved language does not approve the other.
