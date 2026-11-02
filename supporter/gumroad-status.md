# Gumroad launch verification — 2026-11-02

- Account: https://byosrydevkits.gumroad.com/
- Editor: https://gumroad.com/products/jcrza/edit
- Store: https://byosrydevkits.gumroad.com/l/dynamic-island-supporter
- Product ID: `jcrza`; type: digital product; price: USD 9 once.
- Status: published and available to buy after the compatible free v2.6.1 release was published.

## Saved and verified after navigation/reload

- English/Arabic product description, two headings and three formatted inclusion bullets; app 2.6.1+ requirement, scope of support and GPL terms are stated.
- Eight cover/gallery images (two language covers and six individual profiles), and a 600×600 processed thumbnail.
- One customer attachment: `Dynamic-Island-Supporter-1.0.0.zip`. A fresh authenticated download returned HTTP 200, 3,386,288 bytes and SHA-256 `5e1d87c34b7e9795274fd21b5b3ad19bcc4d2e89d80b5d07bfd34afc5788ba1c`, exactly matching the local artifact.
- Customer content includes installation instructions and seven-day support at Byosry@gmail.com. Receipt contact is already byosry@gmail.com.
- The live product page displays $9 and an active purchase button. Creator test checkout succeeded with an explicit notice that no payment method would be charged. Gumroad displayed the purchase confirmation and receipt-sent notice.
- The download from that completed test purchase returned HTTP 200 and the exact bytes/hash above. This verifies checkout delivery, not revenue or a real payout.

## Release and marketing status

1. Resolved: after the owner connected a payout method, the product editor no longer displays Gumroad's payout-method publication warning. This verifies removal of that warning, not an actual payout. No financial details were entered or changed by the agent.
2. Free v2.6.1 is public at https://github.com/beloyosry/Desktop-Dynamic-Island/releases/tag/v2.6.1 with installer, update assets and source. Release CI passed formatting, TypeScript, 56 unit/architecture tests, 39 Electron tests and packaging/update verification. Public downloads were verified without authentication, and all 16 Supporter/Toolkit tests passed against the downloaded application. The installer is unsigned.
3. Test checkout and delivery succeeded. No real payment or payout was performed, and the test purchase is not counted as revenue.
4. `checkoutUrl` now points to the live store. Regenerated marketing end cards and captions use that URL. The original verified customer ZIP is retained; marketing regeneration does not replace the attachment. No social channels or community destinations have been supplied. No promotional posts or buyer-support messages were sent. Use the two-week launch workbook to record real traffic and sales.

The existing portfolio product and account financial settings were left untouched. Verification evidence is recorded in `docs/verification.md` and local `artifacts/supporter` reports.
