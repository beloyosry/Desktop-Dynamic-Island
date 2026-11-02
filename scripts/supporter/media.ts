import { chromium, type Frame, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SUPPORTER_PROFILES } from './catalog';
import { DEFAULTS, type Features } from '../../src/modules/settings/domain/features';

const run = promisify(execFile);
const root = process.cwd();
const output = 'artifacts/supporter';
const wallpaper =
  'radial-gradient(ellipse at 15% 5%, #eef1f9, transparent 58%), radial-gradient(ellipse at 90% 90%, #a7bad6, transparent 62%), linear-gradient(140deg, #bccce2, #d8dfe9 50%, #8fa7c6)';
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const css = `@font-face{font-family:Plex;src:url('/promo/src/assets/plex-arabic-500.woff2')}*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Plex,sans-serif;background:#e7edf5;color:#263a56}body[dir=rtl]{font-family:Plex,'Segoe UI',sans-serif}h1,h2,p{margin:0}h1{font-weight:650;letter-spacing:-2px;line-height:1.12}body[dir=rtl] h1{letter-spacing:0;line-height:1.4}.brand{font-size:25px;color:#4c6381}.brand img{vertical-align:middle;width:48px;height:48px;margin-inline-end:12px}.pill{display:inline-block;background:#2b405f;color:#fff;padding:10px 23px;border-radius:99px}.note{color:#4d617c;font-size:21px;line-height:1.6}.desktop{background:${wallpaper};border:1px solid #b8c9de;border-radius:30px;overflow:hidden}.poster{height:1000px;padding:62px 74px;position:relative}.poster h1{font-size:67px;max-width:1000px;margin-top:28px}.poster .sub{font-size:26px;margin-top:18px;max-width:1000px;line-height:1.5}.poster .desktop{position:absolute;inset:350px 74px 136px;display:flex;align-items:center;justify-content:center}.poster .desktop img{max-width:94%;max-height:95%;object-fit:contain}.poster footer{position:absolute;bottom:44px;inset-inline:74px;display:flex;justify-content:space-between;align-items:center;gap:20px}.poster footer .note{max-width:970px}.video{width:1080px;height:1920px;position:relative;overflow:hidden;padding:96px 72px}.video h1{font-size:83px;margin-top:58px;min-height:225px}.video .sub{font-size:35px;line-height:1.5;min-height:120px;margin-top:28px}.video .desktop{position:absolute;top:650px;left:40px;width:1000px;height:650px;box-shadow:0 25px 80px #657c9b30}.video iframe{width:1000px;height:650px;border:0;background:transparent}.video .label{position:absolute;top:1390px;left:72px;right:72px;font-size:34px;line-height:1.55}.video footer{position:absolute;bottom:82px;left:72px;right:72px}.video footer .cta{font-size:34px;font-weight:600;line-height:1.5;margin:20px 0}.video footer .note{font-size:24px}.file-token{position:absolute;left:120px;top:1160px;padding:20px 28px;border-radius:14px;background:white;color:#2b405f;box-shadow:0 10px 30px #46608550;font-size:26px;display:none}.end{position:absolute;inset:0;background:#e7edf5;display:none;padding:130px 80px;flex-direction:column;justify-content:center}.end h2{font-size:78px;line-height:1.2;margin:36px 0}.end p{font-size:32px;line-height:1.7;overflow-wrap:anywhere}.end .note{font-size:25px;margin-top:55px}.end .pill{align-self:flex-start;font-size:32px}`;
const head = (lang: string) =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dynamic Island Pro Supporter media</title><style>${css}</style></head><body dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`;
const brand = '<div class="brand"><img src="/build/icon.png" alt="">Dynamic Island Pro</div>';

async function setLayout(frame: Frame | Page, features: Partial<Features>, tab?: string) {
  await frame.evaluate(
    ({ features, tab }) => {
      window.nova.setFeatures(features);
      const demo = window as unknown as Window & {
        selectTab: (tab: string) => void;
        fire: (name: string, data: unknown) => void;
      };
      demo.fire('onHover', true);
      demo.selectTab(tab || features.defaultTab || 'media');
    },
    { features, tab },
  );
}

async function main() {
  const config = JSON.parse(await readFile('supporter/launch-config.json', 'utf8')) as {
    checkoutUrl: string | null;
    downloadUrl: string;
    supportEmail: string | null;
  };
  if (config.checkoutUrl) {
    const checkout = new URL(config.checkoutUrl);
    assert.ok(
      checkout.protocol === 'https:' &&
        (checkout.hostname === 'gumroad.com' || checkout.hostname.endsWith('.gumroad.com')),
      'Use the actual HTTPS Gumroad product URL',
    );
  }
  const ffmpeg =
    process.env.FFMPEG_PATH ||
    path.resolve('artifacts/supporter-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
  assert.ok(
    existsSync(ffmpeg),
    'Set FFMPEG_PATH to an ffmpeg executable with H.264 support (or install imageio-ffmpeg into artifacts/supporter-tools).',
  );
  for (const folder of ['customer/previews', 'marketing', 'recordings', 'qa'])
    await mkdir(`${output}/${folder}`, { recursive: true });
  const server = createServer(async (req, res) => {
    const requested = path.resolve(
      root,
      '.' + decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname),
    );
    if (!requested.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const mime: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.json': 'application/json',
      };
      res.setHeader('Content-Type', mime[path.extname(requested)] || 'application/octet-stream');
      res.end(await readFile(requested));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  const executablePath = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
  const browser = await chromium.launch({ executablePath, headless: true });
  const errors: string[] = [];
  const captures: Record<string, string> = {};
  try {
    const preview = await browser.newPage({ viewport: { width: 1000, height: 650 } });
    preview.on('pageerror', (error) => errors.push(error.message));
    for (const entry of SUPPORTER_PROFILES) {
      await preview.goto(`${base}/promo/src/island.html?state=music&ax=500&ay=120`);
      await preview.locator('html[data-ready="1"]').waitFor();
      await setLayout(preview, {
        ...DEFAULTS,
        ...entry.features,
        soundEffects: false,
        reminders: false,
        water: false,
        novaFocus: false,
        morningBrief: false,
        welcomeBack: false,
      });
      await preview.evaluate(() => {
        document.body.style.background = 'transparent';
      });
      await preview.waitForTimeout(700);
      await preview.locator(`#v-${entry.features.defaultTab}`).waitFor({ state: 'visible' });
      const bounds = await preview.locator('#island').boundingBox();
      assert.ok(bounds && bounds.width === entry.features.panelWidth);
      captures[entry.id] = (
        await preview.screenshot({
          omitBackground: true,
          clip: { x: bounds.x - 30, y: bounds.y - 30, width: bounds.width + 60, height: bounds.height + 60 },
        })
      ).toString('base64');
    }
    await preview.close();
    const poster = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    poster.on('pageerror', (error) => errors.push(error.message));
    const showPoster = async (html: string, destination: string) => {
      await poster.route('**/supporter-poster', (route) =>
        route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
      );
      await poster.goto(`${base}/supporter-poster`);
      await poster.evaluate(() => document.fonts.ready);
      await poster.screenshot({ path: destination });
      assert.ok(
        await poster.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
        'Poster must not clip',
      );
      await poster.unroute('**/supporter-poster');
    };
    for (const entry of SUPPORTER_PROFILES) {
      await showPoster(
        `${head('en')}<main class="poster">${brand}<h1>${esc(entry.name.replace('Supporter - ', ''))}</h1><p class="sub">${esc(entry.description)} <span lang="ar" dir="rtl">${entry.ar}</span></p><div class="desktop"><img src="data:image/png;base64,${captures[entry.id]}" alt="Actual island preview"></div><footer><p class="note">Real app renderer · Demonstration data · Wallpaper not included<br>Free app features. Curated layout from the $9 Supporter pack.</p><span class="pill">${entry.features.panelWidth} × ${entry.features.panelHeight}</span></footer></main></body></html>`,
        `${output}/customer/previews/${entry.id}.png`,
      );
    }
    for (const lang of ['en', 'ar']) {
      const ar = lang === 'ar';
      await showPoster(
        `${head(lang)}<main class="poster">${brand}<h1>${ar ? 'جزيرتك، على مزاج يومك.' : 'A little space. Arranged for your day.'}</h1><p class="sub">${ar ? '٦ بروفايلات جاهزة · دليل عربي وإنجليزي · مساعدة تركيب لمدة ٧ أيام' : 'Six curated layouts. English + Arabic guide. Seven days of installation help.'}</p><div class="desktop"><img style="width:49%" src="data:image/png;base64,${captures.study}"><img style="width:49%" src="data:image/png;base64,${captures.glass}"></div><footer><p class="note">${ar ? 'البرنامج مجاني. الباقة تدعم التطوير وتوفر وقت التجهيز.<br>معاينة ببيانات تجريبية. الخلفية مش ضمن الباقة.' : 'The app stays free. Your purchase supports development and saves setup time.<br>Demonstration data. Wallpaper not included.'}</p><span class="pill">${ar ? '9$ مرة واحدة' : '$9 once'}</span></footer></main></body></html>`,
        `${output}/marketing/cover-${lang}.png`,
      );
    }
    await poster.setViewportSize({ width: 1000, height: 1000 });
    await showPoster(
      `${head('en')}<main style="padding:65px;height:1000px">${brand}<h1 style="font-size:76px;margin-top:45px">Your island.<br>Your day.</h1><img style="width:100%;height:350px;object-fit:contain;margin:30px 0" src="data:image/png;base64,${captures.glass}"><p style="font-size:32px">Supporter layout pack <span class="pill">$9</span></p><p class="note" style="margin-top:30px">Six curated layouts for the free Windows app.</p></main></body></html>`,
      `${output}/marketing/thumbnail.png`,
    );
    // Render the actual bilingual customer guide, including the RTL section.
    await poster.setViewportSize({ width: 1100, height: 1200 });
    await poster.goto(`${base}/supporter/START-HERE.html`);
    await poster.screenshot({ path: `${output}/qa/guide-en.png` });
    await poster.locator('#arabic').scrollIntoViewIfNeeded();
    await poster.screenshot({ path: `${output}/qa/guide-ar.png` });
    await poster.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await poster.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Guide overflows on mobile',
    );
    await poster.screenshot({ path: `${output}/qa/guide-mobile.png` });
    await poster.close();
    const videos = [
      {
        id: '01-before-after',
        en: ['Make room for your day.', 'Start with your desktop.', 'One island. Six different moods.'],
        ar: ['مساحة صغيرة ليومك.', 'ابدأ من سطح مكتبك.', 'جزيرة واحدة، بست اختيارات.'],
      },
      {
        id: '02-music-files',
        en: [
          'Music. Files. Right here.',
          'Your media controls, a little closer.',
          'Keep a file ready for your next task.',
        ],
        ar: ['موسيقتك وملفاتك، جنبك.', 'تحكم في الموسيقى من جزيرتك.', 'خلي ملفك جاهز للخطوة اللي بعدها.'],
      },
      {
        id: '03-study',
        en: [
          'Settle into study time.',
          'Apply Study amber. Open your timer.',
          'Start a focus session. Keep notes close.',
        ],
        ar: ['جهّز وقت المذاكرة.', 'اختار ركن المذاكرة وافتح المؤقت.', 'ابدأ جلسة تركيز، وملاحظاتك جنبك.'],
      },
    ];
    const durations: { file: string; durationSeconds: number }[] = [];
    for (const lang of ['en', 'ar'] as const)
      for (const [index, video] of videos.entries()) {
        const ar = lang === 'ar',
          text = video[lang];
        const cta = config.checkoutUrl
          ? ar
            ? 'التحميل ومعاينة الباقة في وصف الفيديو'
            : 'Download + pack preview in the caption'
          : ar
            ? 'البرنامج مجاني. معاينة الباقة في الصور.'
            : 'Free app. Preview the pack in the images.';
        const destination = config.checkoutUrl
          ? new URL(config.checkoutUrl).host + new URL(config.checkoutUrl).pathname
          : 'github.com/beloyosry/Desktop-Dynamic-Island';
        const html = `${head(lang)}<main class="video">${brand}<h1>${text[0]}</h1><p class="sub" id="subtitle">${text[1]}</p><div class="desktop"><iframe id="demo" title="Real app demonstration" src="/promo/src/island.html?state=music&ax=500&ay=130"></iframe></div><div class="file-token" id="file-token">Notes.pdf</div><p class="label" id="label">${ar ? 'من أدوات البرنامج المجانية' : 'Included in the free Windows app'}</p><footer><span class="pill">${ar ? 'باقة التخصيص: 9$ مرة واحدة' : 'Curated Supporter pack: $9 once'}</span><p class="cta">${cta}</p><p class="note">${ar ? 'عرض توضيحي ببيانات تجريبية. الخلفية غير مشمولة.' : 'Staged demonstration. Wallpaper not included.'}</p></footer><div class="end" id="end">${brand}<h2>${ar ? 'البرنامج مجاني.<br>دعمك يكمل الرحلة.' : 'The app stays free.<br>Help it grow.'}</h2><span class="pill">${ar ? 'Supporter · 9$ مرة واحدة' : 'Supporter · $9 once'}</span><p style="margin-top:40px">${ar ? '٦ بروفايلات · دليل تركيب · ٧ أيام مساعدة' : '6 layouts · Setup guide · 7 days of help'}</p><p style="margin-top:50px" dir="ltr">${esc(destination)}</p><p class="note">${config.checkoutUrl ? (ar ? 'رابط الشراء والتحميل في الوصف.' : 'Purchase + free download links in the caption.') : ar ? 'الباقة قيد تجهيز صفحة البيع. الصور للمعاينة.' : 'Pack storefront is being prepared. Preview images available.'}<br>${ar ? 'تقدر تعمل نفس التخصيص بنفسك مجانًا.' : 'You can create equivalent layouts yourself for free.'}</p></div></main></body></html>`;
        const context = await browser.newContext({
          viewport: { width: 1080, height: 1920 },
          deviceScaleFactor: 1,
          recordVideo: { dir: `${output}/recordings`, size: { width: 1080, height: 1920 } },
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/supporter-video', (route) =>
          route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
        );
        await page.goto(`${base}/supporter-video`);
        const frame = page.frames().find((frame) => frame.url().includes('island.html'))!;
        await frame.locator('html[data-ready="1"]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const layout = SUPPORTER_PROFILES[index === 2 ? 0 : index === 1 ? 2 : 5];
        await setLayout(frame, {
          ...DEFAULTS,
          ...layout.features,
          soundEffects: false,
          reminders: false,
          water: false,
          novaFocus: false,
          morningBrief: false,
          welcomeBack: false,
        });
        if (index === 0)
          await page.locator('#demo').evaluate((element) => {
            (element as HTMLElement).style.opacity = '0';
          });
        await page.waitForTimeout(2200);
        if (index === 0) {
          await page.locator('#demo').evaluate((element) => {
            (element as HTMLElement).style.transition = 'opacity .6s';
            (element as HTMLElement).style.opacity = '1';
          });
          await page.waitForTimeout(2300);
          await setLayout(frame, SUPPORTER_PROFILES[0].features);
        } else if (index === 1) {
          await frame.locator('.tab[data-tab="shelf"]').click();
          await page.locator('#file-token').evaluate((element) => {
            const file = element as HTMLElement;
            file.style.display = 'block';
            file.animate(
              [
                { transform: 'translate(0,0)', opacity: 1 },
                { transform: 'translate(340px,-260px)', opacity: 1 },
                { transform: 'translate(340px,-260px)', opacity: 0 },
              ],
              { duration: 1800, fill: 'forwards' },
            );
          });
          await page.waitForTimeout(1800);
          await frame.evaluate(() => {
            const demo = window as unknown as Window & {
              fire: (name: string, data: unknown) => void;
              __mock: { SHELF: unknown[] };
            };
            demo.fire('onShelf', [
              { path: 'C:/Demo/Notes.pdf', name: 'Notes.pdf', icon: '' },
              ...demo.__mock.SHELF.slice(0, 2),
            ]);
          });
        } else {
          await frame.locator('[data-min="25"]').click();
          await frame.locator('#tm-start').click();
        }
        await page.locator('#subtitle').evaluate((element, value) => {
          element.textContent = value;
        }, text[2]);
        await page.waitForTimeout(2800);
        if (index === 2) await frame.locator('.tab[data-tab="notes"]').click();
        if (index === 0) await setLayout(frame, SUPPORTER_PROFILES[1].features);
        await page.waitForTimeout(2200);
        await page.screenshot({ path: `${output}/qa/${video.id}-${lang}.png` });
        await page.locator('#end').evaluate((element) => {
          (element as HTMLElement).style.display = 'flex';
        });
        assert.ok(
          await page.locator('#end').evaluate((element) => element.scrollHeight <= element.clientHeight),
          'Video end card clips',
        );
        await page.waitForTimeout(3500);
        const recording = page.video()!;
        await context.close();
        const file = `${video.id}-${lang}.mp4`;
        await run(
          ffmpeg,
          [
            '-y',
            '-i',
            await recording.path(),
            '-vf',
            'fps=30,format=yuv420p',
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-crf',
            '21',
            '-an',
            '-movflags',
            '+faststart',
            `${output}/marketing/${file}`,
          ],
          { maxBuffer: 4 * 1024 * 1024 },
        );
        const { stderr } = await run(ffmpeg, ['-i', `${output}/marketing/${file}`, '-f', 'null', '-'], {
          maxBuffer: 4 * 1024 * 1024,
        });
        const duration = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
        assert.ok(duration && /1080x1920/.test(stderr), 'Video must decode at portrait 1080x1920');
        const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
        assert.ok(seconds >= 10 && seconds <= 35, `Unexpected video length ${seconds}`);
        durations.push({ file, durationSeconds: seconds });
        console.log(`Rendered ${file} (${seconds}s)`);
      }
    assert.deepEqual(errors, [], 'Media rendering must not produce browser errors');
    // Customer ZIP checksums include every preview as well as the editable profiles and guide.
    const manifest = JSON.parse(await readFile(`${output}/customer/manifest.json`, 'utf8'));
    manifest.files = manifest.files.filter((file: { file: string }) => !file.file.startsWith('previews/'));
    for (const entry of SUPPORTER_PROFILES) {
      const file = `previews/${entry.id}.png`;
      manifest.files.push({
        file,
        sha256: createHash('sha256')
          .update(await readFile(`${output}/customer/${file}`))
          .digest('hex'),
      });
    }
    await writeFile(`${output}/customer/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
    await cp('supporter/gumroad-listing.md', `${output}/marketing/gumroad-listing.md`);
    await cp('supporter/launch-playbook.md', `${output}/marketing/launch-playbook.md`);
    const captions = videos
      .flatMap((video) =>
        (['en', 'ar'] as const).map((lang) => {
          const ar = lang === 'ar';
          return `## ${video.id}-${lang}.mp4\n\n${video[lang][0]} ${video[lang][2]}\n\n${ar ? 'البرنامج مجاني لويندوز. باقة Supporter بـ9 دولار مرة واحدة: 6 بروفايلات جاهزة، دليل عربي وإنجليزي، و7 أيام مساعدة تركيب. تقدر تعمل نفس التخصيص بنفسك مجانًا.' : 'Free Windows app. Optional $9 Supporter pack: six curated layouts, English/Arabic guide and seven days of installation help. You can make equivalent layouts yourself for free.'}\n\n${ar ? 'تحميل البرنامج' : 'Free app'}: ${config.downloadUrl}\n${ar ? 'معاينة الباقة' : 'Pack preview'}: ${config.checkoutUrl || (ar ? 'شوف الصور المرفقة؛ صفحة البيع لسه مش منشورة.' : 'See the attached preview images; storefront not yet published.')}\n\n${ar ? 'عرض توضيحي ببيانات تجريبية؛ الخلفية غير مشمولة.' : 'Staged demonstration; wallpaper not included.'}\n`;
        }),
      )
      .join('\n');
    await writeFile(`${output}/marketing/captions.md`, captions, 'utf8');
    await writeFile(
      `${output}/media-verification.json`,
      JSON.stringify(
        {
          browserErrors: errors,
          guideMobileWidth: 390,
          poster: '1600x1000',
          videoResolution: '1080x1920',
          videos: durations,
          checkoutConfigured: !!config.checkoutUrl,
          supportEmailConfigured: !!config.supportEmail,
          generatedFiles: await readdir(`${output}/marketing`),
        },
        null,
        2,
      ),
    );
    console.log('Six profile previews, covers, bilingual guide QA and six MP4s verified.');
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
