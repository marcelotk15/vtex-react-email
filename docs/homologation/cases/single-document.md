# Combined template as a single document

The combined source contains one document per branch. After evaluation, the local result has one `doctype`, one `html`, one `head`, and one `body`. The proof count is textual on the resolved string. Analyzing the combined source as if it were already the delivered email is not the criterion.

`eq` remains `experimental`. This case is the target question about accepting that source.

## Minimal template

The same `output: 'merged'` definition as [locale.md](locale.md). In the proof, the test `packages/react/src/golden-path.test.tsx` on 2026-10-02, Node `24.21.0`, Windows, the source written to `(temporary directory with a space)/order-confirmed.html` contains two `<!DOCTYPE`. The store example, with the alias, contains three documents in the source: English, alias, and fallback.

## Synthetic JSON

The proof delivery and pickup JSON, separately. Delivery selects `en-US`. Pickup has no locale and falls to the default document.

## Expected local result

Observed by the proof:

- the proof combined source has two `<!DOCTYPE`
- the English preview has one `<!DOCTYPE`
- the pickup preview has one `html`, one `head`, and one `body`
- a second `html` in the resolved string would be `HTML001` in local evaluation

## Message Center

Follow [the manual procedure](../message-center.md). Paste the combined source, not a `per-locale` variant. Request the test with the delivery JSON and, separately, with pickup. See whether the account accepts the source and whether the result is a single email.

## Evidence

The account's acceptance or refusal message, and the resolved HTML with the `html`, `head`, and `body` count. Layer: Message Center.

## Approval

The account accepts the source and each JSON returns one document. That, together with the four locale payloads, is what allows discussing moving `eq` out of `experimental`. Without both, the state does not change.

## Divergence

If the account refuses the source, record the refusal. `per-locale` variants remain available as an explicit mode. Do not change the merge to work around the refusal in this step.
