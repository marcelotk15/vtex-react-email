# Manual Message Center procedure

This check is manual. There is no send script, no credential read, and no automatic write to the account.

The artifact to paste is the HTML with Handlebars produced by `vtex-email build`. Do not paste the resolved preview (`vtex-email preview` writes already evaluated HTML and is not a template). Do not paste a fixture into the template.

## Steps

1. Compile the email on the local machine, on Node `24.21.0`, with green `pnpm typecheck` and `pnpm test`, or with `vtex-email build` in the consumer project.
2. Open the artifact file, for example `dist/order-confirmed.html`. Confirm that fixture data (`ORD-A`, `200,00`, names) is not frozen in the file.
3. In the test account Message Center, open the matching transactional template and paste the content into the template field. Do not publish and do not create a campaign.
4. In the account's own test panel, use the case JSON. The JSON is synthetic. It is not the confirmed VTEX event envelope.
5. Read the resolved HTML and text. Compare with the case's expected local result, in the indicated excerpt.
6. If the account offers saving a draft, that is outside this procedure. Stop without sending a message to any recipient.

## What this step proves

Only evaluation of that template with that JSON in that account, on the recorded date. It does not prove the email client, the `vtex-email dev` view, or the other profile capabilities.

A divergence goes in the case record. The capability stays at its current state (`documented` or `experimental`) until the specific approval record. A positive case does not homologate the whole profile.
