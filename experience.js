/* Khotwa UI enhancements. All records remain in the existing IndexedDB database. */
(function () {
  'use strict';
  let chosenExercise = '';
  let selectedView = 'chart';
  let selectedMetric = 'weight';
  let historyPage = 0;
  let editId = null;
  const perPage = 12;
  const normalName = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
  const format = (value, decimals = 0) => Number(value).toLocaleString('ar-EG', { maximumFractionDigits: decimals });
  const numberOrNull = value => value === '' || value === null || value === undefined ? null : Number(value);
  const safeValue = value => E(value === null || value === undefined ? '' : value);
  const entryActions = entry => `<div class="record-actions"><button type="button" class="btn sm" data-action="edit-record" data-id="${E(entry.id)}">تعديل</button><button type="button" class="btn sm warn" data-action="delete" data-id="${E(entry.id)}">حذف</button></div>`;

  function exerciseNames(logs) {
    const names = new Map();
    for (const entry of logs) {
      const name = String(entry.data.exercise || '').trim().replace(/\s+/g, ' ');
      const key = normalName(name);
      if (key && !names.has(key)) names.set(key, name);
    }
    return names;
  }
  function dailyStats(logs) {
    const byDate = new Map();
    for (const entry of logs) {
      const weight = numberOrNull(entry.data.weight);
      const reps = Math.max(0, Number(entry.data.reps) || 0);
      let session = byDate.get(entry.date);
      if (!session) {
        session = { date: entry.date, sets: 0, bestWeight: null, repsAtTop: 0, maxReps: 0, volume: 0, weightedSets: 0 };
        byDate.set(entry.date, session);
      }
      session.sets++;
      session.maxReps = Math.max(session.maxReps, reps);
      if (weight !== null && Number.isFinite(weight) && weight >= 0) {
        session.weightedSets++;
        session.volume += weight * reps;
        if (session.bestWeight === null || weight > session.bestWeight || (weight === session.bestWeight && reps > session.repsAtTop)) {
          session.bestWeight = weight;
          session.repsAtTop = reps;
        }
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  const metricInfo = {
    weight: { label: 'أعلى وزن مسجل', unit: 'كجم', value: session => session.bestWeight },
    reps: { label: 'أعلى عدد عدات', unit: 'عدة', value: session => session.maxReps },
    volume: { label: 'إجمالي حجم المجموعات الموزونة', unit: 'كجم × عدة', value: session => session.weightedSets ? session.volume : null }
  };
  function chartMarkup(sessions, metric) {
    const def = metricInfo[metric] || metricInfo.weight;
    const points = sessions.map(session => ({ date: session.date, value: def.value(session) })).filter(p => p.value !== null && Number.isFinite(p.value));
    if (!points.length) return `<div class="empty insight-empty">مفيش بيانات كفاية للرسم ده. سجّل ${metric === 'weight' ? 'أوزان المجموعات' : 'مجموعات التمرين'} الأول.</div>`;
    const width = 740, height = 270, left = 52, right = 20, top = 25, bottom = 40;
    const values = points.map(p => p.value);
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || Math.max(max * 0.2, 1);
    const lo = Math.max(0, min - span * 0.15), hi = max + span * 0.2;
    const px = index => left + (points.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (points.length - 1));
    const py = v => top + (hi - v) * (height - top - bottom) / (hi - lo || 1);
    const ticks = [0, 1, 2, 3, 4].map(i => { const val = lo + (hi - lo) * i / 4; const y = py(val); return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="currentColor" opacity=".11"/><text x="${left - 10}" y="${y + 4}" text-anchor="end" fill="currentColor" class="chart-label">${format(val, 1)}</text>`; }).join('');
    const line = points.map((p, i) => `${px(i)},${py(p.value)}`).join(' ');
    const dots = points.map((p, i) => `<circle cx="${px(i)}" cy="${py(p.value)}" r="5" fill="var(--mint)" stroke="var(--paper)" stroke-width="3"><title>${E(p.date)} — ${format(p.value, 1)} ${E(def.unit)}</title></circle>`).join('');
    const first = points[0], last = points[points.length - 1];
    const labels = `<text x="${left}" y="${height - 10}" text-anchor="start" fill="currentColor" class="chart-label">${E(first.date)}</text>${points.length > 1 ? `<text x="${width - right}" y="${height - 10}" text-anchor="end" fill="currentColor" class="chart-label">${E(last.date)}</text>` : ''}`;
    const safeTitle = E(`${def.label} خلال ${points.length} جلسة`);
    return `<div class="chart-scroll"><svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeTitle}" xmlns="http://www.w3.org/2000/svg"><title>${safeTitle}</title>${ticks}<polyline fill="none" stroke="var(--mint)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${line}"/>${dots}${labels}</svg></div><div class="chart-meta">${E(def.label)} · ${E(def.unit)} · ${points.length} ${points.length === 1 ? 'جلسة مسجلة' : 'جلسات مسجلة'}</div>`;
  }
  function compareSessions(sessions) {
    if (sessions.length < 2) return '<div class="notice">سجّل التمرين في يومين مختلفين على الأقل عشان تظهر مقارنة الجلسات.</div>';
    const latest = sessions[sessions.length - 1], previous = sessions[sessions.length - 2];
    const delta = (current, old, unit, label) => {
      if (current === null || old === null) return `<div class="insight-stat"><span>${label}</span><strong>بيانات ناقصة</strong><small>سجّل الوزن في الجلستين</small></div>`;
      const difference = current - old;
      return `<div class="insight-stat"><span>${label}</span><strong>${difference > 0 ? '+' : ''}${format(difference, 1)} ${unit}</strong><small>${format(old, 1)} ← ${format(current, 1)}</small></div>`;
    };
    return `<div class="insight-comparison"><div class="insight-heading">آخر جلستين: <b>${E(previous.date)}</b> مقابل <b>${E(latest.date)}</b></div><div class="insight-stats">${delta(latest.bestWeight, previous.bestWeight, 'كجم', 'تغيّر أعلى وزن')}${delta(latest.maxReps, previous.maxReps, 'عدة', 'تغيّر أعلى عدات')}${delta(latest.weightedSets ? latest.volume : null, previous.weightedSets ? previous.volume : null, 'كجم × عدة', 'تغيّر حجم المجموعات')}</div><p class="hint">دي مقارنة للأرقام المسجلة فقط، مش حكم تلقائي على قوتك أو مستوى لياقتك. عدد المجموعات وظروف التمرين ممكن يختلفوا.</p></div>`;
  }
  function workout() {
    const all = group('workout');
    const names = exerciseNames(all);
    if (chosenExercise && !names.has(chosenExercise)) chosenExercise = '';
    if (!chosenExercise && names.size) chosenExercise = names.keys().next().value;
    const selected = all.filter(r => normalName(r.data.exercise) === chosenExercise);
    const sessions = dailyStats(selected);
    const unique = names.size;
    const latest = sessions.length ? sessions[sessions.length - 1] : null;
    const best = selected.filter(r => numberOrNull(r.data.weight) !== null).reduce((max, item) => Math.max(max, Number(item.data.weight)), 0);
    const nameOptions = [...names.values()].map(name => `<option value="${E(name)}"></option>`).join('');
    const controls = names.size ? `<div class="insight-filter"><label for="workout-exercise">التمرين</label><select id="workout-exercise" aria-label="اختار تمرين لعرض تطوره">${[...names].map(([id, name]) => `<option value="${E(id)}" ${id === chosenExercise ? 'selected' : ''}>${E(name)}</option>`).join('')}</select></div>` : '';
    const sessionsTable = selected.slice().sort((a, b) => b.date.localeCompare(a.date) || (Number(a.data.set) - Number(b.data.set))).slice(historyPage * perPage, (historyPage + 1) * perPage);
    const table = selected.length ? `<div class="workout-table-wrap"><table class="workout-table"><thead><tr><th>التاريخ</th><th>المجموعة</th><th>العدات</th><th>الوزن</th><th>ملاحظة</th><th>إجراءات</th></tr></thead><tbody>${sessionsTable.map(item => `<tr><td data-label="التاريخ">${E(item.date)}</td><td data-label="Set">${format(item.data.set)}</td><td data-label="Reps">${format(item.data.reps)}</td><td data-label="الوزن">${item.data.weight === '' || item.data.weight == null ? 'غير مسجل' : `${format(item.data.weight, 1)} كجم`}</td><td data-label="ملاحظة" class="workout-notes">${E(item.data.notes || '—')}</td><td data-label="إجراءات">${entryActions(item)}</td></tr>`).join('')}</tbody></table></div><div class="workout-pagination"><span>عرض ${selected.length ? historyPage * perPage + 1 : 0}–${Math.min(selected.length, (historyPage + 1) * perPage)} من ${selected.length} مجموعة</span><div class="row"><button class="btn sm" type="button" data-action="workout-page" data-page="previous" ${historyPage === 0 ? 'disabled' : ''}>السابق</button><button class="btn sm" type="button" data-action="workout-page" data-page="next" ${(historyPage + 1) * perPage >= selected.length ? 'disabled' : ''}>التالي</button></div></div>` : '<div class="empty">لسه مفيش مجموعات للتمرين ده.</div>';
    const metricTabs = Object.keys(metricInfo).map(key => `<button class="btn sm ${selectedMetric === key ? 'insight-active' : ''}" type="button" data-action="workout-metric" data-metric="${key}" aria-pressed="${selectedMetric === key}">${E(metricInfo[key].label)}</button>`).join('');
    const modes = `<div class="workout-view-tabs" role="group" aria-label="نوع العرض"><button type="button" data-action="workout-view" data-view="chart" aria-pressed="${selectedView === 'chart'}" class="btn ${selectedView === 'chart' ? 'insight-active' : ''}">◔ رسم بياني</button><button type="button" data-action="workout-view" data-view="table" aria-pressed="${selectedView === 'table'}" class="btn ${selectedView === 'table' ? 'insight-active' : ''}">▤ جدول المجموعات</button></div>`;
    return `<div class="pageintro"><p>اختار تمرين واحد، وراجع أداؤك عبر الأيام بدل ما المجموعات تختلط ببعض. كل الأرقام مبنية على تسجيلاتك فقط.</p></div><div class="grid g3"><div class="card soft"><div class="statlabel">مجموعات التمرين المختار</div><div class="statnum">${format(selected.length)}</div></div><div class="card soft"><div class="statlabel">جلسات التمرين المختار</div><div class="statnum statcolor">${format(sessions.length)}</div></div><div class="card soft"><div class="statlabel">أعلى وزن مسجل للتمرين</div><div class="statnum">${selected.some(r => numberOrNull(r.data.weight) !== null) ? `${format(best, 1)} <small>كجم</small>` : '—'}</div></div></div>
    <section class="card workout-insights"><div class="workout-insights-header"><div><h2>تطور أداء التمرين</h2><p class="muted">${latest ? `آخر جلسة: ${E(latest.date)}` : 'ابدأ بتسجيل مجموعات'}</p></div>${controls}</div>${modes}${chosenExercise ? compareSessions(sessions) : '<div class="notice">أضف تمرينك الأول عشان تشوف التطور هنا.</div>'}${selectedView === 'chart' ? `<div class="workout-chart"><div class="workout-metrics">${metricTabs}</div>${chartMarkup(sessions, selectedMetric)}</div>` : table}</section>
    <div class="sectiontitle"><h2>ضيف مجموعة جديدة</h2></div>${panel('تسجيل تمرين','كل سطر مجموعة واحدة. استخدم نفس اسم التمرين عشان المقارنة تتجمع صح.',`<form data-form="workout"><div class="formgrid">${datefield()}<div class="field"><label for="exercise">اسم التمرين</label><input id="exercise" list="exercise-options" name="exercise" value="${E(names.get(chosenExercise) || '')}" required placeholder="مثال: Flat Bench Press"><datalist id="exercise-options">${nameOptions}</datalist></div>${numfield('رقم المجموعة','set',{value:1,min:1,step:'1',required:true})}${numfield('العدات','reps',{min:0,step:'1',required:true})}${numfield('الوزن بالكيلو (اختياري)','weight',{min:0})}${txtfield('ملاحظة','notes','','اختياري')}</div><div class="formactions"><button type="submit" class="btn primary">احفظ المجموعة</button></div></form>`)}`;
  }

  const schemas = {
    workout: { title: 'تعديل المجموعة', fields: [['exercise', 'اسم التمرين', 'text', true], ['set', 'رقم المجموعة', 'number', true, 1], ['reps', 'العدات', 'number', true, 0], ['weight', 'الوزن بالكيلو', 'number', false, 0], ['notes', 'ملاحظة', 'textarea']] },
    food: { title: 'تعديل الصنف الغذائي', fields: [['name', 'الصنف', 'text', true], ['grams', 'الكمية بالجرام', 'number', true, 0.01], ['calories', 'سعرات لكل 100 جم', 'number', false, 0], ['protein', 'بروتين لكل 100 جم', 'number', false, 0], ['carbs', 'كارب لكل 100 جم', 'number', false, 0], ['satfat', 'دهون مشبعة لكل 100 جم', 'number', false, 0], ['unsatfat', 'دهون غير مشبعة لكل 100 جم', 'number', false, 0], ['otherfat', 'دهون أخرى لكل 100 جم', 'number', false, 0]] },
    body: { title: 'تعديل القياسات', fields: [['weight', 'وزن (كجم)', 'number', false, 0], ['chest', 'صدر (سم)', 'number', false, 0], ['neck', 'رقبة (سم)', 'number', false, 0], ['abdomen', 'بطن (سم)', 'number', false, 0], ['arm', 'ذراع (سم)', 'number', false, 0], ['thigh', 'فخذ (سم)', 'number', false, 0]] },
    finance: { title: 'تعديل الحركة المالية', fields: [['type', 'نوع الحركة', 'select', true, 0, ['expense:مصروف', 'income:دخل']], ['name', 'البند', 'text', true], ['amount', 'المبلغ', 'number', true, 0.01], ['category', 'التصنيف', 'text'], ['notes', 'ملاحظة', 'textarea']] },
    social: { title: 'تعديل وقت التطبيق', fields: [['name', 'اسم التطبيق', 'text', true], ['minutes', 'الدقائق', 'number', true, 0]] },
    smoking: { title: 'تعديل تسجيل اليوم', fields: [['count', 'العدد المسجل', 'number', true, 0]] },
    english: { title: 'تعديل ممارسة الإنجليزي', fields: [['skill', 'المهارة', 'select', true, 0, ['Speaking:Speaking', 'Listening:Listening', 'Writing:Writing', 'Reading:Reading', 'Mixed:Mixed']], ['minutes', 'الدقائق', 'number', true, 1], ['notes', 'ملاحظة', 'textarea']] },
    learning: { title: 'تعديل جلسة التعلم', fields: [['status', 'الحالة', 'select', true, 0, ['not-started:لسه', 'working:شغال عليها', 'review:مراجعة', 'completed:مكتملة']], ['minutes', 'الوقت بالدقائق', 'number', false, 0], ['source', 'المصدر', 'text'], ['evidence', 'دليل التطبيق', 'text'], ['notes', 'ملاحظات', 'textarea'], ['question', 'أسئلة', 'textarea'], ['self', 'التقييم الذاتي', 'select', false, 0, [':بدون تقييم', '1:1', '2:2', '3:3', '4:4', '5:5']]] },
    business: { title: 'تعديل خطوة المشروع', fields: [['status', 'الحالة', 'select', true, 0, ['not-started:لسه', 'working:شغال عليها', 'completed:اتنفذت']], ['minutes', 'الدقائق', 'number', false, 0], ['notes', 'ملاحظات', 'textarea']] },
    review: { title: 'تعديل مراجعة الأسبوع', fields: [['done', 'الإنجازات', 'textarea'], ['blockers', 'العوائق', 'textarea'], ['next', 'الأسبوع القادم', 'textarea'], ['questions', 'الأسئلة', 'textarea']] }
  };
  function editField(spec, record) {
    const [key, label, kind, required, min, choices] = spec;
    const value = record.data[key] === null || record.data[key] === undefined ? '' : record.data[key];
    const attr = `id="edit-${E(key)}" name="${E(key)}" ${required ? 'required' : ''}`;
    if (kind === 'textarea') return `<div class="field edit-wide"><label for="edit-${E(key)}">${E(label)}</label><textarea ${attr} rows="3">${safeValue(value)}</textarea></div>`;
    if (kind === 'select') return `<div class="field"><label for="edit-${E(key)}">${E(label)}</label><select ${attr}>${choices.map(entry => { const i = entry.indexOf(':'); const opt = entry.slice(0, i), label = entry.slice(i + 1); return `<option value="${E(opt)}" ${String(value) === opt ? 'selected' : ''}>${E(label)}</option>`; }).join('')}</select></div>`;
    const numeric = kind === 'number';
    return `<div class="field"><label for="edit-${E(key)}">${E(label)}</label><input ${attr} type="${numeric ? 'number' : 'text'}" ${numeric ? `min="${min ?? 0}" step="any"` : ''} value="${safeValue(value)}"></div>`;
  }
  function editor() {
    const entry = editId ? state.rows.find(row => row.id === editId) : null;
    if (!entry || !schemas[entry.collection]) return '';
    const schema = schemas[entry.collection];
    const flexibleDate = ['workout', 'food', 'body', 'finance', 'social'].includes(entry.collection);
    const dateInput = flexibleDate ? `<div class="field"><label for="edit-date">التاريخ</label><input id="edit-date" name="date" type="date" value="${E(entry.date)}" required></div>` : `<div class="field"><label>تاريخ السجل</label><strong>${E(entry.date)}</strong></div>`;
    const photo = entry.collection === 'body' ? `<div class="field edit-wide"><label for="edit-photo">تغيير الصورة (اختياري)</label><input type="file" id="edit-photo" name="photo" accept="image/*"><label class="edit-photo-remove"><input type="checkbox" name="removePhoto" value="1"> إزالة الصورة القديمة</label></div>` : '';
    return `<div class="record-editor-overlay" data-action="close-edit" role="presentation"><div class="record-editor" role="dialog" aria-modal="true" aria-labelledby="edit-record-title"><div class="record-editor-header"><h2 id="edit-record-title">${E(schema.title)}</h2><button class="btn sm" type="button" data-action="close-edit" aria-label="إغلاق التعديل">✕</button></div><p class="muted">عدّل السجل الحالي، مش هنعمل نسخة جديدة منه.</p><form data-form="edit-record" data-id="${E(entry.id)}"><div class="edit-grid">${dateInput}${schema.fields.map(spec => editField(spec, entry)).join('')}${photo}</div><div class="formactions"><button class="btn primary" type="submit">احفظ التعديل</button><button class="btn" type="button" data-action="close-edit">إلغاء</button></div></form></div></div>`;
  }
  async function submitEdit(form) {
    const record = state.rows.find(item => item.id === form.dataset.id);
    if (!record || !schemas[record.collection]) throw Error('السجل مش موجود');
    const fields = schemas[record.collection].fields;
    const data = { ...record.data };
    const formData = new FormData(form);
    for (const [name, , kind, required, min] of fields) {
      const raw = String(formData.get(name) ?? '').trim();
      if (required && raw === '') throw Error('فيه خانة مطلوبة فاضية');
      if (kind === 'number') {
        if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < (min ?? 0))) throw Error('راجع القيمة الرقمية المدخلة');
        data[name] = raw === '' ? (name === 'weight' ? '' : null) : Number(raw);
      } else data[name] = raw;
    }
    if (record.collection === 'workout' && (!data.exercise || !Number.isInteger(data.set) || !Number.isInteger(data.reps))) throw Error('اسم التمرين ورقم المجموعة والعدات المطلوبة غير صحيحة');
    if (record.collection === 'social' && data.minutes < 0) throw Error('الدقائق لازم تكون صفر أو أكتر');
    if (record.collection === 'learning' && data.status === 'completed' && !data.notes && !data.evidence) throw Error('سجل دليل أو ملاحظات قبل إكمال الجلسة');
    if (record.collection === 'body') {
      const file = form.querySelector('[name="photo"]')?.files?.[0];
      if (formData.get('removePhoto') === '1') data.photo = '';
      if (file) data.photo = await imageToDataURL(file);
    }
    const newDate = formData.get('date') ? String(formData.get('date')) : record.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) throw Error('التاريخ غير صحيح');
    await save(record.collection, newDate, data, record.id);
    editId = null;
    if (record.collection === 'workout') chosenExercise = normalName(data.exercise);
    render(); notice('التعديل اتحفظ على نفس السجل.');
  }
  window.KhotwaExperience = {
    workout, editor, entryActions, submitEdit,
    setExercise(value) { chosenExercise = normalName(value); historyPage = 0; },
    setView(value) { if (value === 'chart' || value === 'table') selectedView = value; },
    setMetric(value) { if (metricInfo[value]) selectedMetric = value; },
    movePage(direction) { const total = group('workout').filter(item => normalName(item.data.exercise) === chosenExercise).length; historyPage = Math.max(0, Math.min(Math.max(0, Math.ceil(total / perPage) - 1), historyPage + (direction === 'next' ? 1 : -1))); },
    edit(id) { if (!state.rows.some(r => r.id === id)) return; editId = id; render(); document.querySelector('.record-editor [name]')?.focus(); },
    close() { editId = null; render(); },
    isEditing() { return Boolean(editId); },
    stats: dailyStats
  };
}());