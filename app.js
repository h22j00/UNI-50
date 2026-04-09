// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔥 Firebase 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  onSnapshot, addDoc, updateDoc, deleteDoc, getDocs,
  serverTimestamp, increment, arrayUnion, arrayRemove, getDoc
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

// ── 내 하트 상태 (localStorage 기반) ────────────────
function getMyLiked(personId, prayerId) {
  const key = `liked_${personId}_${prayerId}`;
  return localStorage.getItem(key) === 'true';
}
function setMyLiked(personId, prayerId, val) {
  const key = `liked_${personId}_${prayerId}`;
  if (val) localStorage.setItem(key, 'true');
  else localStorage.removeItem(key);
}

const EMOJIS = [
  '🙏','✝️','⛪','💒','📖','🕯️','🕊️','⭐',
  '🌿','🌸','🌻','🌺','🍀','🌱','🌾','🍃',
  '❤️','🧡','💛','💚','💙','💜','🤍','🩵','🩷',
  '🐑','🦌','🐶','🐱','🦊','🐰','🐵','🦁','🐯','🐴','🐷','🐮',
  '🐭','🐿️','🐧','🐼','🐻','🐨','🐥','🦆','🦅','🦕','🐳',
  '🌊','🏄','☀️','🌙'
];

// ── 상태 ─────────────────────────────────────────
let persons          = [];
let selectedPersonId = null;
let currentSlide     = 0;
let editingPrayerId  = null;
let editingPersonId  = null;
let selectedEmoji    = '🙏';
let prayersUnsub     = null;
let searchQuery      = '';

// 댓글 바텀시트
let commentSheetPersonId = null;
let commentSheetPrayerId = null;
let commentSheetUnsub    = null;
let commentHoldTimer     = null;
let editingCommentRef    = null;
const sheetCommentCache  = {}; // prayerId → comments[]

// ── 로딩 ────────────────────────────────────────
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
  syncAllGlow();
  checkSundayReset().catch(console.error);
});

function syncAllGlow() {
  persons.forEach(person => {
    onSnapshot(collection(db, 'persons', person.id, 'prayers'), snap => {
      person.prayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      person.hasGlow = person.prayers.some(pr => pr.glow);
      renderSidebar();
      if (person.id === selectedPersonId) updatePanelHeader(person);
    });
  });
}

async function checkSundayReset() {
  if (new Date().getDay() !== 0) return;
  const todayStr  = new Date().toDateString();
  if (localStorage.getItem('last-sunday-reset') === todayStr) return;
  for (const person of persons) {
    const snap = await getDocs(collection(db, 'persons', person.id, 'prayers'));
    for (const pd of snap.docs) {
      if (pd.data().glow) await updateDoc(pd.ref, { glow: false });
    }
  }
  localStorage.setItem('last-sunday-reset', todayStr);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  검색 & 사이드바
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.filterPersons = (val) => { searchQuery = val.trim(); renderSidebar(); };

function renderSidebar() {
  const list = document.getElementById('person-list');
  list.innerHTML = '';
  const filtered = searchQuery ? persons.filter(p => p.name.includes(searchQuery)) : persons;
  filtered.forEach(p => {
    const hasGlow = p.hasGlow || false;
    const btn = document.createElement('button');
    btn.className = 'person-btn' + (p.id === selectedPersonId ? ' active' : '') + (hasGlow ? ' glowing' : '');
    btn.innerHTML = `<div class="person-avatar">${p.icon}<span class="glow-dot"></span></div><span class="person-name">${p.name}</span>`;
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

  document.getElementById('all-panel').style.display   = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('all-view-btn').classList.remove('active');

  const panel = document.getElementById('person-panel');
  panel.style.display = 'flex';
  panel.style.animation = 'none';
  panel.offsetHeight;
  panel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  updatePanelHeader(person);
  renderSidebar();

  if (prayersUnsub) prayersUnsub();
  prayersUnsub = onSnapshot(collection(db, 'persons', id, 'prayers'), snapshot => {
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

  let allPrayers = [];
  for (const person of persons) {
    const snap = await getDocs(collection(db, 'persons', person.id, 'prayers'));
    for (const d of snap.docs) {
      const commSnap = await getDocs(collection(db, 'persons', person.id, 'prayers', d.id, 'comments'));
      allPrayers.push({ id: d.id, personId: person.id, personName: person.name, personIcon: person.icon, commentCount: commSnap.size, ...d.data() });
    }
  }
  allPrayers.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  if (allPrayers.length === 0) {
    container.innerHTML = '<div class="no-cards"><p>아직 기도문이 없습니다 🙏</p></div>';
    return;
  }
  renderAllCards(allPrayers);
};

let allCurrentSlide = 0;
let allPrayersCache = [];

// ── 최신 기도문 카드 (크게 보여주기) ────────────────
function buildLatestCardHtml(pr) {
  const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const pid     = pr.personId || '';
  const myLiked = getMyLiked(pid, pr.id);
  const commentCount = pr.commentCount || 0;

  return `
    <div class="latest-card">
      <div class="latest-card-label">✦ 최신 기도문</div>
      <div class="latest-card-date">${dateStr}</div>
      <div class="latest-card-text">${escHtml(pr.text)}</div>
      <div class="latest-card-footer">
        <button class="heart-btn ${myLiked ? 'liked' : ''}"
          onclick="toggleLike('${pid}','${pr.id}',this)">
          ${myLiked ? '❤️' : '🤍'} <span>${pr.likes || 0}</span>
        </button>
        <button class="comment-bubble-btn"
          id="comment-btn-${pr.id}"
          onmousedown="startCommentHold(event,'${pid}','${pr.id}')"
          onmouseup="cancelCommentHold()" onmouseleave="cancelCommentHold()"
          ontouchstart="startCommentHold(event,'${pid}','${pr.id}')"
          ontouchend="cancelCommentHold()">
          💬 <span class="comment-count">${commentCount}</span>
        </button>
        <button class="btn btn-edit" onclick="openEditModal('${pr.id}')">✏️</button>
        <button class="btn btn-danger" onclick="deletePrayer('${pr.id}')">🗑️</button>
      </div>
    </div>`;
}

// ── 미리보기 카드 (격자용) ──────────────────────────
function buildCardHtml(pr, showPersonInfo) {
  const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const commentCount = pr.commentCount || 0;
  const pid = pr.personId || '';
  const myLiked = getMyLiked(pid, pr.id);
  const preview = pr.text.length > 60 ? pr.text.slice(0, 60) + '…' : pr.text;

  const topRow = showPersonInfo ? `
    <div class="mini-card-person">
      <span>${pr.personIcon}</span>
      <span class="mini-card-name">${pr.personName}</span>
    </div>` : '';

  return `
    <div class="mini-card" onclick="openPrayerDetail('${pid}','${pr.id}','${showPersonInfo}')">
      ${topRow}
      <div class="mini-card-date">${dateStr}</div>
      <div class="mini-card-text">${escHtml(preview)}</div>
      <div class="mini-card-footer">
        <span class="mini-stat">${myLiked ? '❤️' : '🤍'} ${pr.likes || 0}</span>
        <span class="mini-stat">💬 ${commentCount}</span>
      </div>
    </div>`;
}

// ── 상세 모달 열기 ────────────────────────────────
let detailPrayerPersonId = null;
let detailPrayerId       = null;
let detailIsAllView      = false;
let personalPrayersCache = []; // withPid 캐시

window.openPrayerDetail = (personId, prayerId, isAllView) => {
  detailPrayerPersonId = personId;
  detailPrayerId       = prayerId;
  detailIsAllView      = isAllView === 'true';

  // persons / prayers 에서 찾기
  const person = persons.find(p => p.id === personId);
  const pr     = personalPrayersCache.find(pr => pr.id === prayerId && pr.personId === personId)
              || allPrayersCache.find(pr => pr.id === prayerId && pr.personId === personId)
              || person?.prayers.find(pr => pr.id === prayerId);
  if (!pr) return;
  // personName/Icon 보정 (person.prayers에는 없을 수 있음)
  if (!pr.personName && person) pr.personName = person.name;
  if (!pr.personIcon && person) pr.personIcon = person.icon;

  const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const myLiked = getMyLiked(personId, prayerId);
  const commentCount = pr.commentCount || 0;

  const personHeader = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <span style="font-size:22px;">${pr.personIcon || ''}</span>
      <span style="font-size:14px;font-weight:600;">${pr.personName || ''}</span>
      <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${dateStr}</span>
    </div>`;

  const editBtns = !detailIsAllView ? `
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
      <button class="btn btn-edit" onclick="closeDetailModal();openEditModal('${prayerId}')">✏️ 수정</button>
      <button class="btn btn-danger" onclick="closeDetailModal();deletePrayer('${prayerId}')">🗑️ 삭제</button>
    </div>` : '';

  document.getElementById('detail-person-header').innerHTML = personHeader;
  document.getElementById('detail-text').textContent        = pr.text;
  document.getElementById('detail-heart-btn').className     = `heart-btn ${myLiked ? 'liked' : ''}`;
  document.getElementById('detail-heart-btn').innerHTML     = `${myLiked ? '❤️' : '🤍'} <span>${pr.likes || 0}</span>`;
  document.getElementById('detail-comment-btn').querySelector('.comment-count').textContent = commentCount;
  document.getElementById('detail-edit-btns').innerHTML     = editBtns;

  // 댓글 버튼 hold 이벤트 재설정
  const dcBtn = document.getElementById('detail-comment-btn');
  dcBtn.onmousedown  = (e) => startCommentHold(e, personId, prayerId);
  dcBtn.onmouseup    = cancelCommentHold;
  dcBtn.onmouseleave = cancelCommentHold;
  dcBtn.ontouchstart = (e) => startCommentHold(e, personId, prayerId);
  dcBtn.ontouchend   = cancelCommentHold;

  // 댓글 수 실시간
  const dcCol = collection(doc(db, 'persons', personId, 'prayers', prayerId), 'comments');
  const dcUnsub = onSnapshot(dcCol, snap => {
    const el = document.querySelector('#detail-comment-btn .comment-count');
    if (el) el.textContent = snap.size;
    else dcUnsub();
  });

  document.getElementById('detail-modal').classList.add('open');
};

window.closeDetailModal = () => {
  document.getElementById('detail-modal').classList.remove('open');
};

window.detailToggleLike = () => {
  const btn = document.getElementById('detail-heart-btn');
  toggleLike(detailPrayerPersonId, detailPrayerId, btn);
};

window.detailOpenComment = () => {
  openCommentSheet(detailPrayerPersonId, detailPrayerId);
};

function renderAllCards(prayers) {
  allPrayersCache = prayers;
  const container = document.getElementById('all-cards-container');
  const cardsHtml = prayers.map(pr => buildCardHtml(pr, true)).join('');
  container.innerHTML = `<div class="cards-grid">${cardsHtml}</div>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  개인 카드 렌더
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderCards(prayers, personId) {
  const container = document.getElementById('cards-container');
  if (!prayers || prayers.length === 0) {
    container.innerHTML = `<div class="no-cards"><p>아직 작성된 기도 카드가 없습니다.<br>아래 버튼으로 첫 기도문을 작성해 보세요 🙏</p></div>`;
    return;
  }

  const sorted = [...prayers].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta; // 최신순
  });

  // personId를 pr에 주입
  const person2 = persons.find(p => p.id === personId);
  const withPid = sorted.map(pr => ({ ...pr, personId, personName: person2?.name || '', personIcon: person2?.icon || '' }));

  // 최신 1개는 크게, 나머지는 격자
  const latest = withPid[0];
  const rest   = withPid.slice(1);

  const latestHtml = buildLatestCardHtml(latest);
  const gridHtml   = rest.length > 0
    ? `<div class="grid-section-title">📜 이전 기도문</div><div class="cards-grid">${rest.map(pr => buildCardHtml(pr, false)).join('')}</div>`
    : '';

  personalPrayersCache = withPid;
  container.innerHTML = latestHtml + gridHtml;

  // 댓글 수 실시간 반영 (최신카드 + 미니카드 + 상세모달)
  withPid.forEach(pr => {
    const commentsCol = collection(doc(db, 'persons', personId, 'prayers', pr.id), 'comments');
    onSnapshot(commentsCol, snap => {
      const cnt = snap.size;
      // comment-btn-ID (최신카드)
      const btn = document.getElementById(`comment-btn-${pr.id}`);
      if (btn) {
        const el = btn.querySelector('.comment-count');
        if (el) el.textContent = cnt;
      }
      // 미니카드 댓글 수 — mini-stat 업데이트
      const miniCard = document.querySelector(`[onclick*="'${pr.id}'"]`);
      if (miniCard) {
        const stats = miniCard.querySelectorAll('.mini-stat');
        if (stats[1]) stats[1].textContent = `💬 ${cnt}`;
      }
      // 상세 모달
      if (detailPrayerId === pr.id) {
        const countEl = document.querySelector('#detail-comment-btn .comment-count');
        if (countEl) countEl.textContent = cnt;
      }
    });
  });
}

function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str) { return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  💬 댓글 버튼 꾹 누르기 → 바텀시트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.startCommentHold = (e, personId, prayerId) => {
  const btn = e.currentTarget;
  btn._commentFired = false;
  commentHoldTimer = setTimeout(() => {
    btn._commentFired = true;
    openCommentSheet(personId, prayerId);
  }, 500);
};
window.cancelCommentHold = () => {
  if (commentHoldTimer) { clearTimeout(commentHoldTimer); commentHoldTimer = null; }
};

// ── 바텀시트 열기 ────────────────────────────────
function openCommentSheet(personId, prayerId) {
  commentSheetPersonId = personId;
  commentSheetPrayerId = prayerId;

  if (commentSheetUnsub) { commentSheetUnsub(); commentSheetUnsub = null; }

  const sheet    = document.getElementById('comment-sheet');
  const listEl   = document.getElementById('sheet-comment-list');
  const inputEl  = document.getElementById('sheet-comment-text');
  const authorEl = document.getElementById('sheet-comment-author');

  inputEl.value  = '';
  authorEl.value = '';
  listEl.innerHTML = '<p class="no-comment-text" style="padding:28px 0;text-align:center;">불러오는 중...</p>';

  sheet.classList.add('open');
  document.getElementById('sheet-backdrop').classList.add('open');

  // 실시간 댓글 리스너
  const commentsCol = collection(doc(db, 'persons', personId, 'prayers', prayerId), 'comments');
  commentSheetUnsub = onSnapshot(commentsCol, snap => {
    const comments = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    sheetCommentCache[prayerId] = comments;
    renderSheetComments(comments, personId, prayerId);
  });

  setTimeout(() => authorEl.focus(), 420);
}

function renderSheetComments(comments, personId, prayerId) {
  const listEl = document.getElementById('sheet-comment-list');
  if (comments.length === 0) {
    listEl.innerHTML = '<p class="no-comment-text" style="padding:28px 0;text-align:center;">첫 댓글을 남겨보세요 🙏</p>';
    return;
  }

  const sorted = [...comments].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return ta - tb; // 오래된 것부터 (위→아래)
  });

  listEl.innerHTML = sorted.map(c => {
    const t = c.createdAt?.toDate ? c.createdAt.toDate() : new Date();
    const timeStr = `${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    return `
      <div class="sheet-comment-item">
        <div class="sheet-comment-meta">
          <span class="sheet-comment-author">${escHtml(c.author || '익명')}</span>
          <span class="sheet-comment-time">${timeStr}</span>
          <span style="flex:1"></span>
          <button class="comment-action-btn" onclick="openEditSheetComment('${personId}','${prayerId}','${c._docId}')" title="수정">✏️</button>
          <button class="comment-action-btn danger" onclick="deleteSheetComment('${personId}','${prayerId}','${c._docId}')" title="삭제">🗑️</button>
        </div>
        <div class="sheet-comment-text">${escHtml(c.text)}</div>
      </div>`;
  }).join('');

  // 최신 댓글로 스크롤
  listEl.scrollTop = listEl.scrollHeight;
}

window.closeCommentSheet = () => {
  document.getElementById('comment-sheet').classList.remove('open');
  document.getElementById('sheet-backdrop').classList.remove('open');
  if (commentSheetUnsub) { commentSheetUnsub(); commentSheetUnsub = null; }
  commentSheetPersonId = null;
  commentSheetPrayerId = null;
};

window.saveSheetComment = async () => {
  const text   = document.getElementById('sheet-comment-text').value.trim();
  const author = document.getElementById('sheet-comment-author').value.trim() || '익명';
  if (!text || !commentSheetPersonId) return;
  const saveBtn = document.getElementById('sheet-save-btn');
  saveBtn.disabled = true;
  await addDoc(
    collection(doc(db, 'persons', commentSheetPersonId, 'prayers', commentSheetPrayerId), 'comments'),
    { text, author, createdAt: serverTimestamp() }
  );
  document.getElementById('sheet-comment-text').value = '';
  saveBtn.disabled = false;
  document.getElementById('sheet-comment-text').focus();
};

// 댓글 삭제 (시트 내)
window.deleteSheetComment = async (personId, prayerId, commentId) => {
  if (!confirm('이 댓글을 삭제할까요?')) return;
  await deleteDoc(doc(db, 'persons', personId, 'prayers', prayerId, 'comments', commentId));
};

// 댓글 수정
window.openEditSheetComment = (personId, prayerId, commentId) => {
  editingCommentRef = doc(db, 'persons', personId, 'prayers', prayerId, 'comments', commentId);
  const cached = (sheetCommentCache[prayerId] || []).find(c => c._docId === commentId);
  document.getElementById('edit-comment-author').value = cached?.author || '';
  document.getElementById('edit-comment-text').value   = cached?.text   || '';
  document.getElementById('edit-comment-modal').classList.add('open');
  setTimeout(() => document.getElementById('edit-comment-author').focus(), 200);
};
window.closeEditCommentModal = () => {
  document.getElementById('edit-comment-modal').classList.remove('open');
  editingCommentRef = null;
};
window.saveEditComment = async () => {
  const text   = document.getElementById('edit-comment-text').value.trim();
  const author = document.getElementById('edit-comment-author').value.trim() || '익명';
  if (!text || !editingCommentRef) return;
  await updateDoc(editingCommentRef, { text, author });
  closeEditCommentModal();
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  하트 + 길게누르기 팝업
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.toggleLike = async (personId, prayerId, btn) => {
  const prayerRef = doc(db, 'persons', personId, 'prayers', prayerId);
  const isLiked   = getMyLiked(personId, prayerId);
  if (!isLiked) {
    setMyLiked(personId, prayerId, true);
    btn.classList.add('liked');
    const cur = parseInt(btn.querySelector('span').textContent) || 0;
    btn.innerHTML = `❤️ <span>${cur + 1}</span>`;
    await updateDoc(prayerRef, { likes: increment(1) });
  } else {
    setMyLiked(personId, prayerId, false);
    btn.classList.remove('liked');
    const cur = parseInt(btn.querySelector('span').textContent) || 0;
    btn.innerHTML = `🤍 <span>${Math.max(0, cur - 1)}</span>`;
    await updateDoc(prayerRef, { likes: increment(-1) });
  }
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  기도문 작성 / 수정 / 삭제
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
    await addDoc(pCol, { text, glow: true, likes: 0, liked: false, likers: [], createdAt: serverTimestamp() });
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
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = EMOJIS.map((e, i) =>
    `<button class="emoji-btn ${e===current?'selected':''}" data-emoji="${i}">${e}</button>`
  ).join('');
  picker.onclick = e => {
    const btn = e.target.closest('.emoji-btn');
    if (!btn) return;
    selectedEmoji = EMOJIS[parseInt(btn.dataset.emoji)];
    picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  };
}
window.openAddPersonModal = () => {
  editingPersonId = null; selectedEmoji = '🙏';
  document.getElementById('new-person-name').value           = '';
  document.getElementById('add-person-title').textContent    = '＋ 새 사람 추가';
  document.getElementById('add-person-save-btn').textContent = '추가';
  document.getElementById('add-person-delete-btn').style.display = 'none';
  renderEmojiPicker(selectedEmoji);
  document.getElementById('add-person-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-person-name').focus(), 200);
};
window.openEditPersonModal = () => {
  const person = persons.find(p => p.id === selectedPersonId);
  if (!person) return;
  editingPersonId = person.id; selectedEmoji = person.icon;
  document.getElementById('new-person-name').value           = person.name;
  document.getElementById('add-person-title').textContent    = '✏️ 정보 수정';
  document.getElementById('add-person-save-btn').textContent = '저장';
  document.getElementById('add-person-delete-btn').style.display = 'inline-flex';
  renderEmojiPicker(selectedEmoji);
  document.getElementById('add-person-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-person-name').focus(), 200);
};
window.closeAddPersonModal = () => document.getElementById('add-person-modal').classList.remove('open');
window.deletePerson = async () => {
  if (!editingPersonId) return;
  if (!confirm('이 사람을 삭제할까요?\n기도문과 댓글도 모두 삭제됩니다.')) return;
  // 기도문 하위 댓글까지 삭제
  const prayersSnap = await getDocs(collection(db, 'persons', editingPersonId, 'prayers'));
  for (const pd of prayersSnap.docs) {
    const commSnap = await getDocs(collection(db, 'persons', editingPersonId, 'prayers', pd.id, 'comments'));
    for (const cd of commSnap.docs) await deleteDoc(cd.ref);
    await deleteDoc(pd.ref);
  }
  await deleteDoc(doc(db, 'persons', editingPersonId));
  closeAddPersonModal();
  selectedPersonId = null;
  document.getElementById('person-panel').style.display = 'none';
  document.getElementById('empty-state').style.display  = 'block';
};
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
      if (overlay.id === 'edit-comment-modal') editingCommentRef = null;
    }
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    closeCommentSheet();
  }
});
