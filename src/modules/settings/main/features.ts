import * as store from '../../../platform/storage/json-store';
import { createFeatureService } from '../domain/service';
export { DEFAULTS } from '../domain/features';
export const { get, set, reset, onChange } = createFeatureService(store);
