import { app } from 'electron';
import { createJsonStore } from './store';
// Resolve lazily, after the entry point sets the existing user-data path.
export const { load, save } = createJsonStore(() => app.getPath('userData'));
