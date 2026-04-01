// ── 데이터 ──────────────────────────────────────────
const EMOJIS = ['🙏','👤','💒','🌿','✝️','🕊️','⭐','🌸','🌻','❤️','🧡','💛','💚','💙','💜','🤍','🌊','🏄'];

let data = JSON.parse(localStorage.getItem('prayer-data') || 'null') || {
  persons: [
    { id: 1, name: '김민준', icon: '🙏', prayers: [
      { id: 1, text: '주님, 민준이가 이번 시험에서 지혜와 평안함을 얻게 하시고\n그의 앞길을 인도해 주소서.\n모든 걱정과 두려움을 내려놓고\n오직 주님만 바라보게 하옵소서.', date: '2025-01-12', glow: false }
    ]},
    { id: 2, name: '이서연', icon: '👩', prayers: [] },
    { id: 3, name: '박찬호', icon: '👨', prayers: [
      { id: 1, text: '찬호 형제의 건강이 하루속히 회복되기를 기도합니다.\n주님의 치유하심의 손길이 그 위에 임하시어\n온전히 낫게 하여 주소서.', date: '2025-01-10', glow: false },
      { id: 2, text: '직장에서의 새로운 시작을 앞두고 있는 찬호 형제에게\n용기와 지혜를 허락하여 주시고\n동료들과의 관계에서 빛이 되게 하옵소서.', date: '2025-01-14', glow: false }
    ]}
  ],
  nextPersonId: 4,
  nextPrayerId: 10
};

let selectedPersonId = null;
let currentSlide = 0;
let editingPrayerId = null;

function save() {
  localStorage.setItem('prayer-data', JSON.stringify(data));
}

// ── 일요일 초기화 확인 ──────────────────────────────
function checkSundayReset() {
  const today = new Date();
  if (today.getDay() === 0) { // 일요일
    const lastReset = localStorage.getItem('last-sunday-reset');
    const todayStr = today.toDateString();
    if (lastReset !== todayStr) {
      data.persons.forEach(p => p.prayers.forEach(pr => pr.glow = false));
      localStorage.setItem('last-sunday-reset', todayStr);
      save();
    }
  }
}

// ── 사이드바 렌더 ────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('person-list');
  list.innerHTML = '';
  data.persons.forEach(p => {
    const hasGlow = p.prayers.some(pr => pr.glow);
    const btn = document.createElement('button');
    btn.className = 'person-btn' + (p.id === selectedPersonId ? ' active' : '') + (hasGlow ? ' glowing' : '');
    btn.innerHTML = `
      <div class="person-avatar">
        ${p.icon}
        <span class="glow-dot"></span>
      </div>
      <span class="person-name">${p.name}</span>
    `;
    btn.onclick = () => selectPerson(p.id);
    list.appendChild(btn);
  });
}

// ── 사람 선택 ────────────────────────────────────────
function selectPerson(id) {
  selectedPersonId = id;
  currentSlide = 0;
  const person = data.persons.find(p => p.id === id);
  if (!person) return;

  document.getElementById('empty-state').style.display = 'none';
  const panel = document.getElementById('person-panel');
  panel.style.display = 'flex';
  // 재애니메이션
  panel.style.animation = 'none';
  panel.offsetHeight;
  panel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  const hasGlow = person.prayers.some(pr => pr.glow);
  const avatarEl = document.getElementById('panel-avatar');
  avatarEl.textContent = person.icon;
  avatarEl.className = 'panel-avatar-lg' + (hasGlow ? ' glowing' : '');

  document.getElementById('panel-name').textContent = person.name;
  document.getElementById('glow-badge').style.display = hasGlow ? 'inline-flex' : 'none';

  renderCards();
  renderSidebar();
}

// ── 카드 렌더 ────────────────────────────────────────
function renderCards() {
  const person = data.persons.find(p => p.id === selectedPersonId);
  const container = document.getElementById('cards-container');
  if (!person || person.prayers.length === 0) {
    container.innerHTML = `<div class="no-cards"><p>아직 작성된 기도 카드가 없습니다.<br>아래 버튼으로 첫 기도문을 작성해 보세요 🙏</p></div>`;
    return;
  }

  const sorted = [...person.prayers].reverse(); // 최신순
  if (currentSlide >= sorted.length) currentSlide = sorted.length - 1;

  const dotsHtml = sorted.map((_, i) =>
    `<span class="dot ${i === currentSlide ? 'active' : ''}" onclick="goSlide(${i})"></span>`
  ).join('');

  const cardsHtml = sorted.map((pr) => {
    const d = new Date(pr.date);
    const dateStr = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
    return `
      <div class="prayer-card">
        <div class="card-date">${dateStr}</div>
        <div class="card-content">${escHtml(pr.text)}</div>
        <div class="card-footer">
          <div class="slider-dots">${dotsHtml}</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-edit" onclick="openEditModal('${pr.id}')">✏️ 수정</button>
            <button class="btn btn-danger" onclick="deletePrayer('${pr.id}')">삭제</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="slider-wrap">
      <div class="cards-track" id="cards-track" style="transform:translateX(-${currentSlide * 100}%)">
        ${cardsHtml}
      </div>
    </div>
    <div class="slider-nav" style="justify-content:center;margin-top:12px;">
      <button class="nav-btn" onclick="prevSlide()" ${currentSlide===0?'disabled':''}>‹</button>
      <button class="nav-btn" onclick="nextSlide()" ${currentSlide===sorted.length-1?'disabled':''}>›</button>
    </div>
  `;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function goSlide(i) { currentSlide = i; renderCards(); }
function prevSlide() { if (currentSlide > 0) { currentSlide--; renderCards(); } }
function nextSlide() {
  const person = data.persons.find(p => p.id === selectedPersonId);
  if (person && currentSlide < person.prayers.length - 1) { currentSlide++; renderCards(); }
}

// ── 기도문 작성/수정 ──────────────────────────────────
function openWriteModal() {
  editingPrayerId = null;
  document.getElementById('modal-title').textContent = '✦ 새 기도문 작성';
  document.getElementById('prayer-text').value = '';
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
}

function openEditModal(prayerId) {
  const person = data.persons.find(p => p.id === selectedPersonId);
  const prayer = person.prayers.find(pr => String(pr.id) === String(prayerId));
  if (!prayer) return;
  editingPrayerId = prayerId;
  document.getElementById('modal-title').textContent = '✏️ 기도문 수정';
  document.getElementById('prayer-text').value = prayer.text;
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
}

function closeWriteModal() {
  document.getElementById('write-modal').classList.remove('open');
}

function savePrayer() {
  const text = document.getElementById('prayer-text').value.trim();
  if (!text) { alert('기도문을 입력해 주세요.'); return; }

  const person = data.persons.find(p => p.id === selectedPersonId);
  if (!person) return;

  if (editingPrayerId !== null) {
    const prayer = person.prayers.find(pr => String(pr.id) === String(editingPrayerId));
    if (prayer) { prayer.text = text; }
  } else {
    const today = new Date().toISOString().split('T')[0];
    person.prayers.push({ id: data.nextPrayerId++, text, date: today, glow: true });
  }

  save();
  closeWriteModal();
  selectPerson(selectedPersonId);
}

function deletePrayer(prayerId) {
  if (!confirm('이 기도 카드를 삭제할까요?')) return;
  const person = data.persons.find(p => p.id === selectedPersonId);
  person.prayers = person.prayers.filter(pr => String(pr.id) !== String(prayerId));
  if (currentSlide > 0) currentSlide--;
  save();
  renderCards();
  renderSidebar();
}

// ── 사람 추가 / 수정 ─────────────────────────────────
let selectedEmoji = '🙏';
let editingPersonId = null;

function openAddPersonModal() {
  editingPersonId = null;
  document.getElementById('new-person-name').value = '';
  selectedEmoji = '🙏';
  document.getElementById('add-person-title').textContent = '＋ 새 사람 추가';
  document.getElementById('add-person-save-btn').textContent = '추가';
  renderEmojiPicker(selectedEmoji);
  document.getElementById('add-person-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-person-name').focus(), 200);
}

function openEditPersonModal() {
  const person = data.persons.find(p => p.id === selectedPersonId);
  if (!person) return;
  editingPersonId = person.id;
  document.getElementById('new-person-name').value = person.name;
  selectedEmoji = person.icon;
  document.getElementById('add-person-title').textContent = '✏️ 정보 수정';
  document.getElementById('add-person-save-btn').textContent = '저장';
  renderEmojiPicker(selectedEmoji);
  document.getElementById('add-person-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-person-name').focus(), 200);
}

function renderEmojiPicker(current) {
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = EMOJIS.map(e =>
    `<button class="emoji-btn ${e===current?'selected':''}" onclick="selectEmoji('${e}',this)">${e}</button>`
  ).join('');
}

function selectEmoji(e, btn) {
  selectedEmoji = e;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function closeAddPersonModal() {
  document.getElementById('add-person-modal').classList.remove('open');
}

function addPerson() {
  const name = document.getElementById('new-person-name').value.trim();
  if (!name) { alert('이름을 입력해 주세요.'); return; }

  if (editingPersonId !== null) {
    // 수정 모드
    const person = data.persons.find(p => p.id === editingPersonId);
    if (person) {
      person.name = name;
      person.icon = selectedEmoji;
    }
    save();
    closeAddPersonModal();
    selectPerson(editingPersonId); // 패널 헤더도 즉시 반영
  } else {
    // 추가 모드
    data.persons.push({ id: data.nextPersonId++, name, icon: selectedEmoji, prayers: [] });
    save();
    closeAddPersonModal();
    renderSidebar();
  }
}

// ── 모달 외부 클릭 닫기 ──────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ── 키보드 ──────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ── 초기화 ──────────────────────────────────────────
checkSundayReset();
renderSidebar();
