// Quick Notes & Checklist Scratchpad for Dynamic Island Pro
const settings = require('./settings');

const DEFAULTS = {
  text: '',
  todos: [
    { id: '1', text: 'Welcome to Dynamic Island Pro!', done: true },
    { id: '2', text: 'Scroll over island to adjust system volume', done: false },
    { id: '3', text: 'Middle-click island to play/pause media', done: false },
    { id: '4', text: 'Check out the Quick Tools tab for screen snips', done: false }
  ]
};

function get() {
  return settings.load('notes.json', DEFAULTS);
}

function save(data) {
  if (!data || typeof data !== 'object') return get();
  const clean = {
    text: typeof data.text === 'string' ? data.text : '',
    todos: Array.isArray(data.todos) ? data.todos.slice(0, 50).map((t, idx) => ({
      id: String(t.id || Date.now() + idx),
      text: String(t.text || '').slice(0, 300),
      done: Boolean(t.done)
    })) : []
  };
  settings.save('notes.json', clean);
  return clean;
}

module.exports = { get, save };
