import * as store from '../../../platform/storage/json-store';
import { createNotesService } from '../domain/service';
export const { get, save } = createNotesService(store);
