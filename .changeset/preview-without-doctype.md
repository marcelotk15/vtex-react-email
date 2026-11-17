---
'@vtex-email/core': patch
'@vtex-email/preview': patch
'@vtex-email/react': patch
---

Preview accepts templates built with `Email doctype={null}`: the single-document check (HTML001) allows a missing doctype and still rejects duplicated documents. The preview's "Could not update" panel now shows the first error diagnostic instead of the first diagnostic of any severity.
