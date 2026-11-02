import { app } from 'electron';
import path from 'node:path';

// Initialize storage before importing any feature that reads saved data.
app.setPath(
  'userData',
  process.env.NOVA_USER_DATA || path.join(app.getPath('appData'), 'dynamic-island-pro'),
);
if (app.requestSingleInstanceLock()) void import('./application');
else app.quit();
