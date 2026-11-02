# Two-week launch workbook

Product: Dynamic Island Pro Supporter Layout Pack 1.0.0. One-time USD 9. App stays free. Target: first 10 buyers ($90 gross, before fees/taxes/refunds); a validation target, not an income forecast.

## Before enabling checkout

- Publish and smoke-test free Windows app 2.6.1+ with corresponding source under GPL. Keep older public releases available. A local installer alone does not satisfy the public download link in the listing.
- Complete Gumroad seller verification and payout setup using the owner's own account. Confirm support/reply-to email, refund policy and product delivery in the checkout UI. Do not represent onboarding or payouts as verified until confirmed.
- Upload the customer ZIP, cover, thumbnail and six previews; paste the bilingual copy in `gumroad-listing.md`. Price $9, one-time. Test the download using Gumroad's test purchase workflow and follow the included guide from a clean profile.
- Configure the actual product URL and support email in `supporter/launch-config.json`; rerun `npm run media:supporter` and package again. Unconfigured videos explicitly say the storefront is being prepared. Only use regenerated versions when announcing availability.
- The buyer receives six JSON profiles + combined JSON, previews, bilingual HTML guide and GPL terms. Never upload this launch workbook, private accounts, test profiles, native helper sources as a "bonus", or the raw marketing-recording directory as customer content.

## Publication schedule

| Day | Material | Destination / action |
| --- | --- | --- |
| 1 | Before/after video, EN + AR | Owner's short-video channels; use matching language caption and download/product links. |
| 3 | Music + file shelf video, EN + AR | Same channels; the tools shown are free, the curated profiles are optional. |
| 5 | Study video, EN + AR | Student/productivity audiences; no paid promotion. |
| 7 | Six preview images | One relevant Windows customization community where self-promotion is explicitly allowed. Read its current rules first; disclose that you made the app. |
| 10 | Answer actual import/setup questions | Use confirmed issues to clarify the listing/guide; do not promise unbuilt features. |
| 14 | Review visits, sales, refunds and support | Decide whether to continue the offer, revise its presentation, or first improve reach. |

No accounts, communities or publication destinations have been supplied yet. Do not mark any row as posted without a real permalink. All captions and videos are prepared locally.

## Measurement (fill from actual store reports)

Keep campaign source links distinct with UTM parameters when posting. Count store page visits, not video views or app downloads. Record the reporting period and use the same source for all conversion calculations.

| Date / channel | Post permalink | Store visits | Purchases | Refunds | Gross USD | Support issues |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2026-11-02 / store published; promotion pending | — | Not measured | Not measured | Not measured | Not measured | Test checkout passed |

Conversion = purchases / store visits, only when visits > 0. Gross = purchases × 9 before discounts, refunds and deductions; actual net income comes from the payment report. Avoid projecting monthly income from this small sample.

At day 14: if at least 100 relevant product-page visits produced zero purchases, ask willing visitors what stopped them (value, setup, price or trust) and adjust the offer before building more features. Below 100 visits, improve distribution before concluding that demand is absent. This is a small experiment, not statistical proof.

## Installation support replies

English: Thanks for supporting Dynamic Island Pro. Please share your order reference, app version and the import error text. Please do not send passwords or a personal setup backup. The complete pack needs six free saved-profile slots; you can import individual files instead. Installation/import help is included for seven calendar days after purchase.

العربي: شكرًا لدعمك Dynamic Island Pro. ابعت رقم الطلب وإصدار البرنامج ونص رسالة الاستيراد. ما تبعتش كلمات مرور أو نسخة إعدادات فيها بيانات شخصية. الباقة الكاملة محتاجة 6 أماكن فاضية للبروفايلات؛ ممكن تستورد ملف واحد بدل الباقة كلها. مساعدة التركيب والاستيراد متاحة لمدة 7 أيام تقويمية من الشراء.

## Rebuild

1. `npm run build:supporter` writes customer JSON + guide + terms to `artifacts/supporter/customer`.
2. For videos, run `npx playwright install ffmpeg`, then set `FFMPEG_PATH` to an ffmpeg executable with H.264, or run `python -m pip install --target artifacts/supporter-tools imageio-ffmpeg` (the media script includes the installed Windows binary path).
3. `npm run media:supporter` builds the real renderer, captures previews, checks the guide and records three scenarios in English and Arabic. Outputs MP4 (1080×1920, H.264, silent, with on-screen text). Demonstration data is staged; these recordings are not live integration evidence.
4. Run `powershell -NoProfile -File scripts/package-supporter.ps1`. It verifies customer checksums and archives only the known delivery folders. Repackage after every regeneration.
