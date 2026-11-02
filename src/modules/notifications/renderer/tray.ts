import type { IslandContext } from '../../../renderer/island/context';
import type { NotificationSnapshot, NotificationChange } from '../domain/history';
import { CATEGORIES, notificationInput } from '../domain/history';
import { presentation } from '../../../shared/renderer/presentation';
import { motionAllowed } from '../../appearance/renderer/theme';

type Context = Pick<IslandContext, '$' | 'bridge' | 'state' | 'island' | 'render' | 'feat'>;
export function initializeNotificationTray({ $, bridge, state, island, render, feat }: Context) {
  const root = $('#notification-center');
  const trigger = $<HTMLButtonElement>('#open-notifications');
  const query = $<HTMLInputElement>('#notification-query');
  const list = $('#notification-list');
  let snapshot: NotificationSnapshot = { items: [], unread: 0 };
  let unreadOnly = false;
  let wasPinned = false;
  let previousFocus: HTMLElement | null = null;
  const siblings = new Map<HTMLElement, boolean>();
  let effectTimer: ReturnType<typeof setTimeout> | undefined;
  let effectAt = 0;
  const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  const symbols: Record<keyof typeof CATEGORIES, string> = {
    system: '◉',
    downloads: '↓',
    focus: '◷',
    wellbeing: '◊',
    reminders: '☾',
    updates: '↑',
  };
  const message = (text: string) => {
    $('#notification-status').textContent = text || 'Kept locally for seven days';
  };
  function stopEffect() {
    clearTimeout(effectTimer);
    root.classList.remove('water-open', 'water-enter');
    island.classList.remove('notification-arrival');
    trigger.classList.remove('notification-ping');
  }
  function effect(opening = false) {
    if (!state.visible || document.hidden || !feat('notificationDrop') || !motionAllowed()) return;
    const now = Date.now();
    if (!opening && now - effectAt < 1500) return;
    if (!opening) effectAt = now;
    stopEffect();
    if (!root.hidden) {
      void root.offsetWidth;
      root.classList.add('water-open');
      root.classList.toggle('water-enter', opening);
    } else {
      void island.offsetWidth;
      island.classList.add('notification-arrival');
      trigger.classList.add('notification-ping');
    }
    effectTimer = setTimeout(stopEffect, 900);
  }
  async function run(action: () => Promise<NotificationSnapshot>, success: string) {
    try {
      show(await action());
      message(success);
    } catch {
      message('Could not update notifications. Try again.');
    }
  }
  function draw() {
    if (root.hidden) return;
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.notificationFocus
        : undefined;
    const scroll = list.scrollTop;
    const search = query.value.trim().toLocaleLowerCase();
    const matches = snapshot.items.filter(
      (item) =>
        (!unreadOnly || !item.read) &&
        `${item.title} ${item.detail} ${CATEGORIES[item.category]}`.toLocaleLowerCase().includes(search),
    );
    list.replaceChildren();
    for (const item of matches) {
      const row = document.createElement('article');
      row.className = 'notification-item';
      row.dataset.notificationId = item.id;
      row.dataset.read = String(item.read);
      row.dataset.category = item.category;
      const mark = document.createElement('span');
      mark.className = 'notification-symbol';
      mark.ariaHidden = 'true';
      mark.textContent = symbols[item.category];
      const content = document.createElement('button');
      content.className = 'notification-content';
      content.dataset.notificationFocus = `read-${item.id}`;
      content.setAttribute('aria-label', `${item.read ? 'Read' : 'Mark as read'}: ${item.title}`);
      content.title = [item.title, item.detail].filter(Boolean).join('\n');
      const meta = document.createElement('span');
      meta.className = 'notification-meta';
      const timestamp = new Date(item.createdAt);
      meta.textContent = `${CATEGORIES[item.category]} · ${timestamp.toDateString() === new Date().toDateString() ? clock.format(timestamp) : `${date.format(timestamp)} ${clock.format(timestamp)}`}${item.count > 1 ? ` · ×${item.count}` : ''}`;
      const title = document.createElement('b');
      title.textContent = item.title;
      title.dir = 'auto';
      const detail = document.createElement('span');
      detail.className = 'notification-detail';
      detail.id = `notification-detail-${item.id}`;
      detail.textContent = item.detail;
      detail.dir = 'auto';
      if (item.detail) content.setAttribute('aria-describedby', detail.id);
      content.append(meta, title, detail);
      content.addEventListener(
        'click',
        () => void run(() => bridge.notifications.read(item.id), 'Marked as read'),
      );
      const dismiss = document.createElement('button');
      dismiss.className = 'notification-dismiss';
      dismiss.textContent = '×';
      dismiss.dataset.notificationFocus = `dismiss-${item.id}`;
      dismiss.setAttribute('aria-label', `Dismiss ${item.title}`);
      dismiss.addEventListener(
        'click',
        () => void run(() => bridge.notifications.dismiss(item.id), 'Notification dismissed'),
      );
      row.append(mark, content, dismiss);
      list.append(row);
    }
    $('#notification-empty').hidden = matches.length > 0;
    $('#notification-empty-title').textContent = search
      ? 'No matching alerts'
      : unreadOnly
        ? 'All caught up'
        : 'A quiet little inbox';
    $('#notification-empty-detail').textContent = search
      ? 'Try another word or switch to All.'
      : unreadOnly
        ? 'Your unread alerts will appear here.'
        : 'Downloads, timers, reminders, and other island alerts collect here.';
    list.scrollTop = scroll;
    if (focused)
      (
        list.querySelector<HTMLElement>(`[data-notification-focus="${focused}"]`) || $('#notification-close')
      ).focus({ preventScroll: true });
  }
  function show(next: NotificationChange) {
    snapshot = next;
    const unread = snapshot.unread;
    $('#notification-count').textContent = unread > 9 ? '9+' : String(unread);
    $('#notification-count').hidden = unread === 0;
    trigger.setAttribute('aria-label', `Notifications${unread ? `, ${unread} unread` : ''}`);
    $('#notification-summary').textContent = unread
      ? `${unread} unread · ${snapshot.items.length} recent`
      : snapshot.items.length
        ? `${snapshot.items.length} recent · All read`
        : 'Your recent island alerts';
    $<HTMLButtonElement>('#notification-read-all').disabled = !unread;
    $<HTMLButtonElement>('#notification-clear').disabled = !snapshot.items.length;
    draw();
    if (next.arrivalId && feat('notificationTray')) effect();
  }
  function close(restoreFocus = true) {
    if (root.hidden) return;
    root.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    stopEffect();
    if (state.overlay === 'notifications') state.overlay = null;
    siblings.forEach((wasInert, element) => {
      element.inert = wasInert;
    });
    siblings.clear();
    state.pinned = wasPinned;
    if (restoreFocus && state.visible && !document.hidden) previousFocus?.focus({ preventScroll: true });
    bridge.focusInput(false);
    render();
  }
  function open() {
    if (!feat('notificationTray')) return;
    if (!root.hidden) return close();
    window.dispatchEvent(new CustomEvent('island:overlay-open', { detail: 'notifications' }));
    previousFocus = document.activeElement as HTMLElement | null;
    wasPinned = state.pinned;
    state.pinned = true;
    state.overlay = 'notifications';
    render();
    root.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.querySelectorAll<HTMLElement>('.l-expanded > :not(#notification-center)').forEach((element) => {
      siblings.set(element, element.inert);
      element.inert = true;
    });
    query.value = '';
    message('');
    draw();
    effect(true);
    bridge.focusInput(true);
    query.focus({ preventScroll: true });
    void bridge.notifications
      .get()
      .then(show)
      .catch(() => message('Could not load recent notifications.'));
  }
  presentation.openNotifications = open;
  presentation.recordNotification = (input) => {
    if (!notificationInput(input, state.features)) return;
    void bridge.notifications.record(input).catch(() => {
      if (!root.hidden) message('Could not save this notification.');
    });
  };
  trigger.addEventListener('click', open);
  $('#notification-close').addEventListener('click', () => close());
  $('#notification-backdrop').addEventListener('click', () => close());
  $('#notification-read-all').addEventListener(
    'click',
    () => void run(() => bridge.notifications.readAll(), 'All notifications marked as read'),
  );
  $('#notification-clear').addEventListener(
    'click',
    () => void run(() => bridge.notifications.clear(), 'Notifications cleared'),
  );
  $('#notification-preview').addEventListener(
    'click',
    () =>
      void run(
        () =>
          bridge.notifications.record({
            kind: 'preview',
            title: 'Water-drop preview',
            detail: 'A little ripple for your next notification.',
          }),
        'Preview added',
      ),
  );
  query.addEventListener('input', draw);
  root.querySelectorAll<HTMLButtonElement>('[data-notification-filter]').forEach((button) =>
    button.addEventListener('click', () => {
      unreadOnly = button.dataset.notificationFilter === 'unread';
      root
        .querySelectorAll<HTMLButtonElement>('[data-notification-filter]')
        .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      draw();
    }),
  );
  window.addEventListener('island:overlay-open', (event) => {
    if (event.detail !== 'notifications') close();
  });
  window.addEventListener('island:overlay-close', () => close());
  const sync = () => {
    trigger.hidden = !feat('notificationTray');
    if (trigger.hidden || !state.visible || document.hidden) close(false);
    if (!feat('notificationDrop') || !motionAllowed() || !state.visible || document.hidden) stopEffect();
  };
  window.addEventListener('island:features', sync);
  window.addEventListener('island:visibility', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('appearance:change', sync);
  window.addEventListener(
    'keydown',
    (event) => {
      if (root.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      if (event.key === 'Tab') {
        const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled),input')].filter(
          (element) => element.getClientRects().length > 0 && element.id !== 'notification-backdrop',
        );
        const index = controls.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      }
    },
    true,
  );
  bridge.notifications.onChange(show);
  void bridge.notifications
    .get()
    .then(show)
    .catch(() => message('Could not load recent notifications.'));
  sync();
}
