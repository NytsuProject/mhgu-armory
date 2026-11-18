import { esc } from './app.js';
import { equipTalisman } from './builder-model.js';
import { signed } from './skill-guide.js';

const $ = id => document.getElementById(id);
const skill = i => $(`b-talisman-skill-${i}`);
const points = i => $(`b-talisman-points-${i}`);

export function initTalismanEditor(build, catalog, onSave) {
  const dialog = $('b-talisman-editor');
  const sorted = [...catalog].sort((a, b) => a.es.localeCompare(b.es, 'es'));
  function listSkills(i, selected) {
    const rows = sorted.filter(s => s.points[i].length && (!i || s.en !== skill(0).value));
    skill(i).innerHTML = '<option value="">Sin habilidad</option>' + rows.map(s =>
      `<option value="${esc(s.en)}">${esc(s.es)}</option>`).join('');
    skill(i).value = rows.some(s => s.en === selected) ? selected : '';
    skill(i).disabled = i === 1 && !skill(0).value;
  }
  function listPoints(i, selected) {
    const values = sorted.find(s => s.en === skill(i).value)?.points[i] || [];
    points(i).innerHTML = values.length ? values.map(n => `<option value="${n}">${signed(n)}</option>`).join('') : '<option>—</option>';
    points(i).disabled = !values.length;
    if (values.length) points(i).value = values.includes(selected) ? selected : values.find(n => n > 0) ?? values[0];
  }
  for (const i of [0, 1]) skill(i).onchange = () => {
    listPoints(i);
    if (i === 0) {
      const previous = Number(points(1).value);
      listSkills(1, skill(0).value && skill(1).value); listPoints(1, previous);
    }
  };
  $('b-talisman-cancel').onclick = () => dialog.close();
  $('b-talisman-form').onsubmit = e => {
    e.preventDefault();
    const skills = [0, 1].filter(i => skill(i).value).map(i => [skill(i).value, Number(points(i).value)]);
    const error = equipTalisman(build, { name: $('b-talisman-name').value, deco: Number($('b-talisman-slots').value), skills }, catalog);
    $('b-talisman-error').textContent = error;
    if (!error) { dialog.close(); onSave(); }
  };
  return () => {
    const p = build.talisman.piece;
    $('b-talisman-name').value = p?.name || '';
    $('b-talisman-slots').value = p?.deco || 0;
    $('b-talisman-error').textContent = '';
    for (const i of [0, 1]) { listSkills(i, p?.sk[i]?.[0]); listPoints(i, p?.sk[i]?.[2]); }
    dialog.showModal();
  };
}
