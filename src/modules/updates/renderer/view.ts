import type { IslandContext } from '../../../renderer/island/context';
import type { UpdateState } from '../domain/types';

type Context = Pick<IslandContext, '$' | 'bridge' | 'state' | 'showToast'>;
export function initializeUpdate({ $, bridge, state, showToast }: Context) {
  const showReady = (version: string) => {
    showToast('update', `Update ready · ${version}`, 'View update', 0, 12000);
    state.toastAction = () => bridge.updates.openCenter();
  };
  bridge.onUpdate(({ version }) => showReady(version));
  function status(update: UpdateState) {
    const ready = update.phase === 'ready';
    $('#open-commands').classList.toggle('update-ready', ready);
    $('#open-commands').title = ready
      ? 'An update is ready · Quick actions (Ctrl+K)'
      : 'Quick actions (Ctrl+K)';
  }
  bridge.updates.onState(status);
  void bridge.updates.status().then(status);
}
