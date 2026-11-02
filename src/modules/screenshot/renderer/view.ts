import type { IslandContext } from '../../../renderer/island/context';

type Context = Pick<IslandContext, '$' | 'bridge' | 'state' | 'feat' | 'render' | 'selectTab' | 'showToast'>;

export function initializeScreenshot(context: Context) {
  const { $, bridge, state, feat, render, selectTab, showToast } = context;
  // Copied image / screenshot: a presentation.toast with the thumbnail. With "Save screenshots to Shelf" on, main
  // already put it on the Shelf for a while ("Added to Shelf ✓", a click opens the Shelf);
  // otherwise clicking saves it to Pictures\Nova Island and puts it on the Shelf.

  bridge.onScreenshot((s) => {
    $<HTMLImageElement>('.t-shot').src = s.thumb;
    const portrait = s.height > s.width;
    if (s.auto) {
      showToast('shot-auto', portrait ? 'Image saved' : 'Screenshot saved', 'Added to Shelf ✓', 0, 4500);
      state.toastAction = () => {
        selectTab('shelf');
        state.hover = true;
        render();
      };
      return;
    }
    showToast(
      'shot',
      portrait ? 'Image copied' : 'Screenshot copied',
      feat('tabShelf') ? 'Add to Shelf' : '',
      0,
      6000,
    );
    if (feat('tabShelf')) state.toastAction = () => bridge.shotToShelf();
  });
  bridge.onShotSaved((s) => showToast('shot-saved', s.name, 'On the Shelf', 0, 2600));
}
