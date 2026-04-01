// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔥 Firebase 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  onSnapshot, addDoc, updateDoc, deleteDoc, getDocs,
  query, orderBy, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBHfwsHew71Bo6kWmkpfoiimZ7xzRnM0Yg",
  authDomain:        "uniplus50pray.firebaseapp.com",
  projectId:         "uniplus50pray",
  storageBucket:     "uniplus50pray.firebasestorage.app",
  messagingSenderId: "1015188366263",
  appId:             "1:1015188366263:web:c822be79ce3d8fb8a27e32"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── 이모지 목록 ──────────────────────────────────
const EMOJIS = ['🙏','👤','💒','🌿','✝️','🕊️','⭐','🌸','🌻',
                '❤️','🧡','💛','💚','💙','💜','🤍','🌊','🏄'];

// ── 상태 ─────────────────────────────────────────
let persons          = [];
let selectedPersonId = null;
let currentSlide     = 0;
let editingPrayerId  = null;
let editingPersonId  = null;
let selectedEmoji    = '🙏';
let prayersUnsub     = null;
let commentPrayerRef = null; // 댓글 대상 기도문 ref
let commentUnsub     = null;
let searchQuery      = '';

// ── 로딩 화면 제거 ────────────────────────────────
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('sidebar').style.display        = 'flex';
  document.getElementById('main').style.display           = 'flex';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  실시간 리스너 — persons
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const personsCol = collection(db, 'persons');
onSnapshot(personsCol, snapshot => {
  persons = snapshot.docs.map(d => ({ id: d.id, ...d.data(), prayers: [] }));
  hideLoading();
  renderSidebar();
  if (selectedPersonId) {
    const p = persons.find(p => p.id === selectedPersonId);
    if (p) updatePanelHeader(p);
  }
  // 글로우 상태를 각 사람의 기도문에서 집계 (사이드바 즉시 반영용)
  syncAllGlow();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  글로우 동기화 — 모든 사람의 기도문 glow 집계
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function syncAllGlow() {
  persons.forEach(person => {
    onSnapshot(collection(db, 'persons', person.id, 'prayers'), snap => {
      person.prayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      person.hasGlow = person.prayers.some(pr => pr.glow);
      renderSidebar();
      // 현재 선택된 사람이면 헤더도 업데이트
      if (person.id === selectedPersonId) updatePanelHeader(person);
    });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  일요일 글로우 초기화
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function checkSundayReset() {
  if (new Date().getDay() !== 0) return;
  const todayStr  = new Date().toDateString();
  const lastReset = localStorage.getItem('last-sunday-reset');
  if (lastReset === todayStr) return;

  for (const person of persons) {
    const snap = await getDocs(collection(db, 'persons', person.id, 'prayers'));
    for (const pd of snap.docs) {
      if (pd.data().glow) await updateDoc(pd.ref, { glow: false });
    }
  }
  localStorage.setItem('last-sunday-reset', todayStr);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  검색
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.filterPersons = (val) => {
  searchQuery = val.trim();
  renderSidebar();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  사이드바 렌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderSidebar() {
  const list = document.getElementById('person-list');
  list.innerHTML = '';

  const filtered = searchQuery
    ? persons.filter(p => p.name.includes(searchQuery))
    : persons;

  filtered.forEach(p => {
    const hasGlow = p.hasGlow || false;
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
  currentSlide = 0;
  const person = persons.find(p => p.id === id);
  if (!person) return;

  // 전체보기 숨기고 개인 패널 보이기
  document.getElementById('all-panel').style.display    = 'none';
  document.getElementById('empty-state').style.display  = 'none';
  document.getElementById('all-view-btn').classList.remove('active');

  const panel = document.getElementById('person-panel');
  panel.style.display = 'flex';
  panel.style.animation = 'none';
  panel.offsetHeight;
  panel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  updatePanelHeader(person);
  renderSidebar();

  if (prayersUnsub) prayersUnsub();
  const pCol = collection(db, 'persons', id, 'prayers');
  prayersUnsub = onSnapshot(pCol, snapshot => {
    person.prayers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    person.hasGlow = person.prayers.some(pr => pr.glow);
    renderSidebar();
    updatePanelHeader(person);
    renderCards(person.prayers, id);
  });
}

function updatePanelHeader(person) {
  const hasGlow = person.hasGlow || false;
  const avatarEl = document.getElementById('panel-avatar');
  avatarEl.textContent = person.icon;
  avatarEl.className   = 'panel-avatar-lg' + (hasGlow ? ' glowing' : '');
  document.getElementById('panel-name').textContent   = person.name;
  document.getElementById('glow-badge').style.display = hasGlow ? 'inline-flex' : 'none';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  전체 보기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.openAllView = async () => {
  selectedPersonId = null;
  if (prayersUnsub) { prayersUnsub(); prayersUnsub = null; }

  document.getElementById('empty-state').style.display  = 'none';
  document.getElementById('person-panel').style.display = 'none';
  document.getElementById('all-view-btn').classList.add('active');
  renderSidebar();

  const allPanel = document.getElementById('all-panel');
  allPanel.style.display = 'flex';
  allPanel.style.animation = 'none';
  allPanel.offsetHeight;
  allPanel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  const container = document.getElementById('all-cards-container');
  container.innerHTML = '<p style="color:var(--text-muted);text-align:center;font-size:13px;">불러오는 중...</p>';

  // 모든 사람의 기도문 수집
  let allPrayers = [];
  for (const person of persons) {
    const snap = await getDocs(collection(db, 'persons', person.id, 'prayers'));
    snap.docs.forEach(d => {
      allPrayers.push({ id: d.id, personId: person.id, personName: person.name, personIcon: person.icon, ...d.data() });
    });
  }

  // 최신순 정렬
  allPrayers.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  if (allPrayers.length === 0) {
    container.innerHTML = '<div class="no-cards"><p>아직 기도문이 없습니다 🙏</p></div>';
    return;
  }

  // 슬라이더로 렌더
  renderAllCards(allPrayers);
};

let allCurrentSlide = 0;
let allPrayersCache = [];

function renderAllCards(prayers) {
  allPrayersCache = prayers;
  const container = document.getElementById('all-cards-container');
  if (allCurrentSlide >= prayers.length) allCurrentSlide = prayers.length - 1;

  const dotsHtml = prayers.map((_, i) =>
    `<span class="dot ${i === allCurrentSlide ? 'active' : ''}" onclick="goAllSlide(${i})"></span>`
  ).join('');

  const cardsHtml = prayers.map(pr => {
    const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
    const dateStr = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
    return `
      <div class="prayer-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:22px;">${pr.personIcon}</span>
          <span style="font-size:13px;font-weight:500;">${pr.personName}</span>
          <span class="card-date" style="margin:0;margin-left:auto;">${dateStr}</span>
        </div>
        <div class="card-content">${escHtml(pr.text)}</div>
        <div class="card-footer">
          <div class="slider-dots">${dotsHtml}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="heart-btn ${pr.liked ? 'liked' : ''}" onclick="toggleLike('${pr.personId}','${pr.id}',this)">
              ${pr.liked ? '❤️' : '🤍'} <span>${pr.likes || 0}</span>
            </button>
            <button class="btn btn-edit" onclick="openCommentModal('${pr.personId}','${pr.id}')">💬 댓글</button>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="slider-wrap">
      <div class="cards-track" style="transform:translateX(-${allCurrentSlide * 100}%)">
        ${cardsHtml}
      </div>
    </div>
    <div class="slider-nav" style="justify-content:center;margin-top:12px;">
      <button class="nav-btn" onclick="prevAllSlide()" ${allCurrentSlide===0?'disabled':''}>‹</button>
      <button class="nav-btn" onclick="nextAllSlide()" ${allCurrentSlide===prayers.length-1?'disabled':''}>›</button>
    </div>`;
}

window.goAllSlide   = i => { allCurrentSlide = i; renderAllCards(allPrayersCache); };
window.prevAllSlide = () => { if (allCurrentSlide > 0) { allCurrentSlide--; renderAllCards(allPrayersCache); } };
window.nextAllSlide = () => { if (allCurrentSlide < allPrayersCache.length - 1) { allCurrentSlide++; renderAllCards(allPrayersCache); } };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  개인 카드 렌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderCards(prayers, personId) {
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
    const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
    const dateStr = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
    return `
      <div class="prayer-card">
        <div class="card-date">${dateStr}</div>
        <div class="card-content">${escHtml(pr.text)}</div>
        <div class="card-footer">
          <div class="slider-dots">${dotsHtml}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="heart-btn ${pr.liked ? 'liked' : ''}" onclick="toggleLike('${personId}','${pr.id}',this)">
              ${pr.liked ? '❤️' : '🤍'} <span>${pr.likes || 0}</span>
            </button>
            <button class="btn btn-edit" onclick="openCommentModal('${personId}','${pr.id}')">💬</button>
            <button class="btn btn-edit" onclick="openEditModal('${pr.id}')">✏️</button>
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

window.goSlide   = i => { currentSlide = i; const p = persons.find(p => p.id === selectedPersonId); if (p) renderCards(p.prayers, p.id); };
window.prevSlide = () => { if (currentSlide > 0) { currentSlide--; const p = persons.find(p => p.id === selectedPersonId); if (p) renderCards(p.prayers, p.id); } };
window.nextSlide = () => {
  const person = persons.find(p => p.id === selectedPersonId);
  if (person && currentSlide < person.prayers.length - 1) { currentSlide++; renderCards(person.prayers, person.id); }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  하트 (좋아요)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.toggleLike = async (personId, prayerId, btn) => {
  const prayerRef = doc(db, 'persons', personId, 'prayers', prayerId);
  const isLiked = btn.classList.contains('liked');
  btn.classList.toggle('liked', !isLiked);
  const span = btn.querySelector('span');
  const cur = parseInt(span.textContent) || 0;
  span.textContent = isLiked ? cur - 1 : cur + 1;
  btn.innerHTML = `${!isLiked ? '❤️' : '🤍'} <span>${isLiked ? cur - 1 : cur + 1}</span>`;
  await updateDoc(prayerRef, { likes: increment(isLiked ? -1 : 1), liked: !isLiked });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  댓글
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.openCommentModal = (personId, prayerId) => {
  commentPrayerRef = doc(db, 'persons', personId, 'prayers', prayerId);
  document.getElementById('comment-text').value = '';
  document.getElementById('comment-modal').classList.add('open');

  // 댓글 실시간 리스너
  if (commentUnsub) commentUnsub();
  const commentsCol = collection(commentPrayerRef, 'comments');
  commentUnsub = onSnapshot(collection(commentPrayerRef, 'comments'), snap => {
    const list = document.getElementById('comment-list');
    if (snap.empty) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;">아직 댓글이 없어요</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const c = d.data();
      const t = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
      const timeStr = `${t.getMonth()+1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
      return `
        <div class="comment-item">
          <div class="comment-header">
            <span class="comment-author">${escHtml(c.author || '익명')}</span>
            <span class="comment-time">${timeStr}</span>
          </div>
          <div class="comment-text">${escHtml(c.text)}</div>
        </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  });
};

window.closeCommentModal = () => {
  document.getElementById('comment-modal').classList.remove('open');
  if (commentUnsub) { commentUnsub(); commentUnsub = null; }
};

window.saveComment = async () => {
  const text   = document.getElementById('comment-text').value.trim();
  const author = document.getElementById('comment-author').value.trim() || '익명';
  if (!text) return;
  await addDoc(collection(commentPrayerRef, 'comments'), { text, author, createdAt: serverTimestamp() });
  document.getElementById('comment-text').value = '';
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  기도문 작성 / 수정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.openWriteModal = () => {
  editingPrayerId = null;
  document.getElementById('modal-title').textContent = '✦ 새 기도문 작성';
  document.getElementById('prayer-text').value = '';
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
};

window.openEditModal = prayerId => {
  const person = persons.find(p => p.id === selectedPersonId);
  const prayer = person?.prayers.find(pr => pr.id === prayerId);
  if (!prayer) return;
  editingPrayerId = prayerId;
  document.getElementById('modal-title').textContent = '✏️ 기도문 수정';
  document.getElementById('prayer-text').value = prayer.text;
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
};

window.closeWriteModal = () => document.getElementById('write-modal').classList.remove('open');

window.savePrayer = async () => {
  const text = document.getElementById('prayer-text').value.trim();
  if (!text) { alert('기도문을 입력해 주세요.'); return; }
  const pCol = collection(db, 'persons', selectedPersonId, 'prayers');
  if (editingPrayerId) {
    await updateDoc(doc(pCol, editingPrayerId), { text });
  } else {
    await addDoc(pCol, { text, glow: true, likes: 0, liked: false, createdAt: serverTimestamp() });
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
  document.getElementById('new-person-name').value           = '';
  document.getElementById('add-person-title').textContent    = '＋ 새 사람 추가';
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
  document.getElementById('new-person-name').value           = person.name;
  document.getElementById('add-person-title').textContent    = '✏️ 정보 수정';
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
//  모달 외부 클릭 / ESC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      if (overlay.id === 'comment-modal' && commentUnsub) { commentUnsub(); commentUnsub = null; }
    }
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      if (m.id === 'comment-modal' && commentUnsub) { commentUnsub(); commentUnsub = null; }
    });
  }
});

// ── 시작 ─────────────────────────────────────────
checkSundayReset().catch(console.error);
