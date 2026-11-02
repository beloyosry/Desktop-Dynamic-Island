import { app } from 'electron';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

// This fixture starts the production mini-player directly, without needing a live browser tab.
app.setPath('userData', process.env.NOVA_USER_DATA!);
void app.whenReady().then(async () => {
  const { open } = await import('../../src/modules/mini-player/main/window');
  await open({
    id: 'dQw4w9WgXcQ',
    t: 12.5,
    appId: 'chrome',
    title: 'Mini-player regression',
    onClose(time, resume) {
      writeFileSync(path.join(app.getPath('userData'), 'returned.json'), JSON.stringify({ time, resume }));
    },
  });
});
