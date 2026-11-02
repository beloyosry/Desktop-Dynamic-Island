import type { IslandContext } from '../../../renderer/island/context';

type Context = Pick<IslandContext, '$' | 'bridge' | 'island' | 'showToast'>;

export function initializePrivacy(context: Context) {
  const { $, bridge, island, showToast } = context;
  // Mic / camera in use: dots on the island in every shape, a presentation.toast naming the app when it starts,
  // and a row in the System tab listing who is using what.

  let mic: string[] = [];
  let cam: string[] = [];

  function update(p: { mic: string[]; cam: string[] }) {
    const nextMic = p?.mic || [];
    const nextCam = p?.cam || [];
    // a presentation.toast only for apps that just started (not on every poll)
    const newCam = nextCam.filter((a) => !cam.includes(a));
    const newMic = nextMic.filter((a) => !mic.includes(a));
    if (newCam.length) showToast('privacy-cam', `${newCam.join(', ')} is using the camera`, '', 0, 3200);
    else if (newMic.length)
      showToast('privacy-mic', `${newMic.join(', ')} is using the microphone`, '', 0, 3200);
    mic = nextMic;
    cam = nextCam;

    island.classList.toggle('pv-mic', mic.length > 0);
    island.classList.toggle('pv-cam', cam.length > 0);
    const parts = [cam.length && `Camera: ${cam.join(', ')}`, mic.length && `Mic: ${mic.join(', ')}`].filter(
      Boolean,
    );
    $('#pv-row').hidden = !parts.length;
    $('#pv-apps').textContent = parts.join(' · ');
  }

  bridge.onPrivacy(update);
}
