import type { Notes } from '../domain/types';
import { presentation } from '../../../shared/renderer/presentation';
import type { IslandContext } from '../../../renderer/island/context';

type Context = Pick<IslandContext, '$' | '$$' | 'bridge' | 'celebrate'>;

export function initializeNotes(context: Context) {
  const { $, $$, bridge, celebrate } = context;
  // Quick Notes and To-Do Scratchpad for Dynamic Island Pro

  const notesText = $<HTMLTextAreaElement>('#notes-text');
  const notesStats = $('#notes-stats');
  const notesCopy = $<HTMLButtonElement>('#notes-copy');
  const notesClear = $<HTMLButtonElement>('#notes-clear');
  const notesTabs = $$<HTMLButtonElement>('.notes-tab');
  const notesPanes = $$('.notes-pane');

  const todoForm = $<HTMLFormElement>('#todo-form');
  const todoInput = $<HTMLInputElement>('#todo-input');
  const todoList = $('#todo-list');
  const todoLeft = $('#todo-left');
  const todoClearDone = $<HTMLButtonElement>('#todo-clear-done');
  const todosBadge = $('#todos-badge');

  let currentNotes: Notes = { text: '', todos: [] };
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function countStats(text: string) {
    if (!text) return '0 words';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    return `${words} word${words === 1 ? '' : 's'} · ${chars} char${chars === 1 ? '' : 's'}`;
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      bridge.notes.save(currentNotes);
    }, 400);
  }

  // --- Sub-tab switching (Scratchpad vs Todos) ---
  notesTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(850, 0.03);
      notesTabs.forEach((t) => t.classList.toggle('active', t === tab));
      const targetView = tab.dataset.notesView;
      notesPanes.forEach((pane) => {
        pane.classList.toggle('on', pane.id === `notes-pane-${targetView}`);
      });
    });
  });

  // --- Scratchpad Events ---
  if (notesText) {
    notesText.addEventListener('input', () => {
      currentNotes.text = notesText.value;
      if (notesStats) notesStats.textContent = countStats(notesText.value);
      queueSave();
    });
  }

  if (notesCopy) {
    notesCopy.addEventListener('click', async () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1050, 0.03);
      const textToCopy = currentNotes.text || '';
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        notesCopy.textContent = 'Copied!';
        notesCopy.classList.add('copied');
        if (typeof presentation.toast === 'function')
          presentation.toast('ico-text', 'Notes copied to clipboard');
        setTimeout(() => {
          notesCopy.textContent = 'Copy';
          notesCopy.classList.remove('copied');
        }, 1500);
      } catch {}
    });
  }

  if (notesClear) {
    notesClear.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(700, 0.04);
      if (!notesText.value) return;
      notesText.value = '';
      currentNotes.text = '';
      if (notesStats) notesStats.textContent = '0 words';
      queueSave();
    });
  }

  // --- To-Do List Management ---
  function renderTodos() {
    if (!todoList) return;
    todoList.innerHTML = '';
    const todos = currentNotes.todos || [];
    const pending = todos.filter((t) => !t.done).length;

    if (todosBadge) todosBadge.textContent = String(pending);
    if (todoLeft) todoLeft.textContent = `${pending} task${pending === 1 ? '' : 's'} left`;

    if (!todos.length) {
      todoList.innerHTML = '<div class="todo-empty">No tasks yet. Add one above!</div>';
      return;
    }

    todos.forEach((todo) => {
      const item = document.createElement('div');
      item.className = `todo-item${todo.done ? ' done' : ''}`;
      item.dataset.id = todo.id;

      const chk = document.createElement('button');
      chk.className = 'todo-chk';
      chk.setAttribute('aria-label', todo.done ? 'Mark incomplete' : 'Mark done');
      chk.innerHTML = '<svg class="s" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
      chk.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTodo(todo.id);
      });

      const label = document.createElement('span');
      label.className = 'todo-label';
      label.textContent = todo.text;
      label.title = todo.text;
      label.dir = 'auto';

      const del = document.createElement('button');
      del.className = 'todo-del';
      del.setAttribute('aria-label', 'Delete task');
      del.innerHTML = '<svg class="s" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTodo(todo.id);
      });

      item.append(chk, label, del);
      todoList.append(item);
    });
  }

  function toggleTodo(id: string) {
    const todo = currentNotes.todos.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    if (todo.done) {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(1200, 0.05);
      if (typeof celebrate === 'function') celebrate(['#30d158', '#ffd479']);
    } else {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(750, 0.03);
    }
    renderTodos();
    queueSave();
  }

  function deleteTodo(id: string) {
    if (typeof presentation.playClickSound === 'function') presentation.playClickSound(650, 0.03);
    currentNotes.todos = currentNotes.todos.filter((t) => t.id !== id);
    renderTodos();
    queueSave();
  }

  if (todoForm) {
    todoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = todoInput.value.trim();
      if (!val) return;
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(950, 0.04);
      currentNotes.todos.unshift({
        id: String(Date.now()),
        text: val,
        done: false,
      });
      todoInput.value = '';
      renderTodos();
      queueSave();
    });
  }

  if (todoClearDone) {
    todoClearDone.addEventListener('click', () => {
      if (typeof presentation.playClickSound === 'function') presentation.playClickSound(700, 0.04);
      currentNotes.todos = currentNotes.todos.filter((t) => !t.done);
      renderTodos();
      queueSave();
    });
  }

  // --- Initial Load ---
  bridge.notes.get().then((data) => {
    if (data) {
      currentNotes = data;
      if (notesText) {
        notesText.value = currentNotes.text || '';
        if (notesStats) notesStats.textContent = countStats(notesText.value);
      }
      renderTodos();
    }
  });
}
