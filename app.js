// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔥 여기에 Firebase 콘솔에서 복사한 설정을 붙여넣으세요!
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  onSnapshot, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCADqAGXMsXDMf9JJkmb2CNr_5LEKWfZnE",
  authDomain: "uniplus-ffe52.firebaseapp.com",
  projectId: "uniplus-ffe52",
  storageBucket: "uniplus-ffe52.firebasestorage.app",
  messagingSenderId: "221278443064",
  appId: "1:221278443064:web:425148da72fe8c644738cd",
  measurementId: "G-RW3L1347H4"
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── 이모지 목록 ──────────────────────────────────
const EMOJIS = ['🙏','👤','💒','🌿','✝️','🕊️','⭐','🌸','🌻',
                '❤️','🧡','💛','💚','💙','💜','🤍','🌊','🏄'];

// ── 상태 ─────────────────────────────────────────
let persons          = [];   // Firestore에서 실시간으로 채워짐
let selectedPersonId = null;
let currentSlide     = 0;
let editingPrayerId  = null;
let editingPersonId  = null;
let selectedEmoji    = '🙏';
let prayersUnsub     = null; // 기도문 리스너 해제용

// ── 로딩 화면 제거 ────────────────────────────────
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('sidebar').style.display        = 'flex';
  document.getElementById('main').style.display           = 'flex';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  실시간 리스너 — persons 컬렉션
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const personsCol = collection(db, 'persons');
onSnapshot(query(personsCol, orderBy('createdAt')), snapshot => {
  persons = snapshot.docs.map(d => ({ id: d.id, ...d.data(), prayers: [] }));
  hideLoading();
  renderSidebar();
  // 선택된 사람이 있으면 패널 헤더도 최신화
  if (selectedPersonId) {
    const p = persons.find(p => p.id === selectedPersonId);
    if (p) updatePanelHeader(p);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  일요일 글로우 초기화
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkSundayReset() {
  if (new Date().getDay() !== 0) return;
  const todayStr  = new Date().toDateString();
  const lastReset = localStorage.getItem('last-sunday-reset');
  if (lastReset === todayStr) return;

  // 모든 기도문의 glow를 false로
  for (const person of persons) {
    const prayersSnap = await getDocs(collection(db, 'persons', person.id, 'prayers'));
    for (const pd of prayersSnap.docs) {
      if (pd.data().glow) await updateDoc(pd.ref, { glow: false });
    }
  }
  localStorage.setItem('last-sunday-reset', todayStr);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  사이드바 렌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderSidebar() {
  const list = document.getElementById('person-list');
  list.innerHTML = '';
  persons.forEach(p => {
    const hasGlow = p.hasGlow; // Firestore에서 집계
    const btn = document.createElement('button');
    btn.className = 'person-btn'
      + (p.id === selectedPersonId ? ' active'  : '')
      + (hasGlow                   ? ' glowing' : '');
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  사람 선택
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function selectPerson(id) {
  selectedPersonId = id;
  currentSlide     = 0;
  const person = persons.find(p => p.id === id);
  if (!person) return;

  document.getElementById('empty-state').style.display = 'none';
  const panel = document.getElementById('person-panel');
  panel.style.display = 'flex';
  panel.style.animation = 'none';
  panel.offsetHeight;
  panel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  updatePanelHeader(person);
  renderSidebar();

  // 기존 기도문 리스너 해제 후 새로 구독
  if (prayersUnsub) prayersUnsub();
  const prayersCol = collection(db, 'persons', id, 'prayers');
  prayersUnsub = onSnapshot(query(prayersCol, orderBy('createdAt')), snapshot => {
    person.prayers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // 글로우 집계 → 사이드바에 반영
    person.hasGlow = person.prayers.some(pr => pr.glow);
    renderSidebar();
    updatePanelHeader(person);
    renderCards(person.prayers);
  });
}

function updatePanelHeader(person) {
  const hasGlow = person.hasGlow || false;
  const avatarEl = document.getElementById('panel-avatar');
  avatarEl.textContent = person.icon;
  avatarEl.className   = 'panel-avatar-lg' + (hasGlow ? ' glowing' : '');
  document.getElementById('panel-name').textContent        = person.name;
  document.getElementById('glow-badge').style.display      = hasGlow ? 'inline-flex' : 'none';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  카드 렌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderCards(prayers) {
  const container = document.getElementById('cards-container');
  if (!prayers || prayers.length === 0) {
    container.innerHTML = `<div class="no-cards"><p>아직 작성된 기도 카드가 없습니다.<br>아래 버튼으로 첫 기도문을 작성해 보세요 🙏</p></div>`;
    return;
  }

  const sorted = [...prayers].reverse();
  if (currentSlide >= sorted.length) currentSlide = sorted.length - 1;

  const dotsHtml = sorted.map((_, i) =>
    `<span class="dot ${i === currentSlide ? 'active' : ''}" onclick="goSlide(${i})"></span>`
  ).join('');

  const cardsHtml = sorted.map(pr => {
    const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date(pr.createdAt || Date.now());
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
      </div>`;
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
    </div>`;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

window.goSlide   = i => { currentSlide = i; const p = persons.find(p=>p.id===selectedPersonId); if(p) renderCards(p.prayers); };
window.prevSlide = () => { if (currentSlide > 0) { currentSlide--; const p = persons.find(p=>p.id===selectedPersonId); if(p) renderCards(p.prayers); } };
window.nextSlide = () => {
  const person = persons.find(p => p.id === selectedPersonId);
  if (person && currentSlide < person.prayers.length - 1) { currentSlide++; renderCards(person.prayers); }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  기도문 작성 / 수정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.openWriteModal = () => {
  editingPrayerId = null;
  document.getElementById('modal-title').textContent  = '✦ 새 기도문 작성';
  document.getElementById('prayer-text').value        = '';
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
};

window.openEditModal = prayerId => {
  const person = persons.find(p => p.id === selectedPersonId);
  const prayer = person?.prayers.find(pr => pr.id === prayerId);
  if (!prayer) return;
  editingPrayerId = prayerId;
  document.getElementById('modal-title').textContent  = '✏️ 기도문 수정';
  document.getElementById('prayer-text').value        = prayer.text;
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
};

window.closeWriteModal = () => document.getElementById('write-modal').classList.remove('open');

window.savePrayer = async () => {
  const text = document.getElementById('prayer-text').value.trim();
  if (!text) { alert('기도문을 입력해 주세요.'); return; }

  const prayersCol = collection(db, 'persons', selectedPersonId, 'prayers');

  if (editingPrayerId) {
    await updateDoc(doc(prayersCol, editingPrayerId), { text });
  } else {
    await addDoc(prayersCol, { text, glow: true, createdAt: serverTimestamp() });
  }
  closeWriteModal();
};

window.deletePrayer = async prayerId => {
  if (!confirm('이 기도 카드를 삭제할까요?')) return;
  await deleteDoc(doc(db, 'persons', selectedPersonId, 'prayers', prayerId));
  if (currentSlide > 0) currentSlide--;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  사람 추가 / 수정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderEmojiPicker(current) {
  document.getElementById('emoji-picker').innerHTML = EMOJIS.map(e =>
    `<button class="emoji-btn ${e===current?'selected':''}" onclick="selectEmoji('${e}',this)">${e}</button>`
  ).join('');
}

window.selectEmoji = (e, btn) => {
  selectedEmoji = e;
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
};

window.openAddPersonModal = () => {
  editingPersonId = null;
  selectedEmoji   = '🙏';
  document.getElementById('new-person-name').value        = '';
  document.getElementById('add-person-title').textContent = '＋ 새 사람 추가';
  document.getElementById('add-person-save-btn').textContent = '추가';
  renderEmojiPicker(selectedEmoji);
  document.getElementById('add-person-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-person-name').focus(), 200);
};

window.openEditPersonModal = () => {
  const person = persons.find(p => p.id === selectedPersonId);
  if (!person) return;
  editingPersonId = person.id;
  selectedEmoji   = person.icon;
  document.getElementById('new-person-name').value        = person.name;
  document.getElementById('add-person-title').textContent = '✏️ 정보 수정';
  document.getElementById('add-person-save-btn').textContent = '저장';
  renderEmojiPicker(selectedEmoji);
  document.getElementById('add-person-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-person-name').focus(), 200);
};

window.closeAddPersonModal = () => document.getElementById('add-person-modal').classList.remove('open');

window.savePerson = async () => {
  const name = document.getElementById('new-person-name').value.trim();
  if (!name) { alert('이름을 입력해 주세요.'); return; }

  if (editingPersonId) {
    await updateDoc(doc(db, 'persons', editingPersonId), { name, icon: selectedEmoji });
  } else {
    await addDoc(personsCol, { name, icon: selectedEmoji, createdAt: serverTimestamp() });
  }
  closeAddPersonModal();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  모달 외부 클릭 / ESC 닫기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// ── 일요일 초기화 (앱 시작 시) ──────────────────
checkSundayReset().catch(console.error);
