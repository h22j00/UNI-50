// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔥 Firebase 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  onSnapshot, addDoc, updateDoc, deleteDoc, getDocs,
  serverTimestamp, increment, arrayUnion, arrayRemove, getDoc, setDoc
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
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📅 요일 작정 기도
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DAYS = ['월','화','수','목','금','토'];

// 이번 주 키 (일요일 기준) — 로컬 날짜 기준으로 계산
function getWeekKey() {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월 ~ 6=토
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  // ✅ toISOString() 대신 로컬 날짜 사용 (UTC 시차 문제 방지)
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const d = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 요일 데이터 로드
async function loadPledge(personId) {
  try {
    const ref = doc(db, 'persons', personId, 'meta', 'pledge');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    // 이번 주 키가 다르면 리셋
    if (data.weekKey !== getWeekKey()) return null;
    return data; // { day, weekKey, prayed }
  } catch(e) { return null; }
}

async function savePledge(personId, day) {
  const ref = doc(db, 'persons', personId, 'meta', 'pledge');
  await setDoc(ref, { day, weekKey: getWeekKey(), prayed: false });
}

// 기도문 작성 시 prayed = true
async function setPledgePrayed(personId) {
  try {
    const ref = doc(db, 'persons', personId, 'meta', 'pledge');
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().weekKey === getWeekKey()) {
      await updateDoc(ref, { prayed: true });
    }
  } catch(e) {}
}

// 요일 선택 팝업 열기
let pledgePersonId = null;
window.openPledgeModal = (personId) => {
  pledgePersonId = personId;
  const modal = document.getElementById('pledge-modal');
  // 버튼 초기화
  document.querySelectorAll('.pledge-day-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('pledge-confirm-btn').textContent = '요일을 선택해주세요';
  document.getElementById('pledge-confirm-btn').disabled = true;
  modal.classList.add('open');
};
window.closePledgeModal = () => {
  document.getElementById('pledge-modal').classList.remove('open');
  pledgePersonId = null;
};
window.selectPledgeDay = (day, btn) => {
  document.querySelectorAll('.pledge-day-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const confirmBtn = document.getElementById('pledge-confirm-btn');
  confirmBtn.textContent = `${day}요일로 작정하기`;
  confirmBtn.disabled = false;
  confirmBtn.dataset.day = day;
};
window.confirmPledge = async () => {
  const day = document.getElementById('pledge-confirm-btn').dataset.day;
  if (!day || !pledgePersonId) return;
  await savePledge(pledgePersonId, day);
  closePledgeModal();
  // 패널 헤더 갱신
  const person = persons.find(p => p.id === pledgePersonId);
  if (person) updatePanelHeaderWithPledge(person);
  renderSidebar();
};

// 패널 헤더 + 요일뱃지 업데이트
async function updatePanelHeaderWithPledge(person) {
  // hasGlow = 이번 주 기도문 있음 (glow:true인 기도문 존재)
  const hasGlow = person.hasGlow || false;
  const avatarEl = document.getElementById('panel-avatar');
  avatarEl.textContent = person.icon;

  const pledge = await loadPledge(person.id);
  const hasPledge = pledge && pledge.day;

  // ✅ 수정1: 뱃지 색상 기준 = hasGlow (기도문 있으면 노란색, 없으면 빨간색)
  // pledge.prayed 대신 hasGlow로 판단 → 기도문 삭제 시 자동 빨간색 복구
  const isGold = hasGlow;

  // 아바타 클래스 — 요일 설정 여부 관계없이 기도했으면 glow
  let avatarClass = 'panel-avatar-lg';
  if (hasGlow) avatarClass += ' glowing';
  avatarEl.className = avatarClass;

  // 요일 뱃지
  let badgeEl = document.getElementById('panel-day-badge');
  if (!badgeEl) {
    badgeEl = document.createElement('span');
    badgeEl.id = 'panel-day-badge';
    avatarEl.style.position = 'relative';
    avatarEl.parentNode.style.position = 'relative';
  }
  if (hasPledge) {
    badgeEl.className = 'day-pledge-badge' + (isGold ? ' gold' : ' red');
    badgeEl.textContent = pledge.day;
    avatarEl.parentNode.appendChild(badgeEl);
  } else {
    if (badgeEl.parentNode) badgeEl.parentNode.removeChild(badgeEl);
  }

  document.getElementById('panel-name').textContent = person.name;

  // glow-badge (이번 주 기도함) — 요일 선택 여부 무관하게 기도했으면 표시
  document.getElementById('glow-badge').style.display = hasGlow ? 'inline-flex' : 'none';

  // pledge-badge (요일 작정)
  let pledgeBadgeEl = document.getElementById('pledge-badge');
  if (!pledgeBadgeEl) {
    pledgeBadgeEl = document.createElement('span');
    pledgeBadgeEl.id = 'pledge-badge';
    pledgeBadgeEl.className = 'pledge-badge';
    const glowBadge = document.getElementById('glow-badge');
    glowBadge.parentNode.insertBefore(pledgeBadgeEl, glowBadge);
  }
  if (hasPledge) {
    pledgeBadgeEl.style.display = 'inline-flex';
    pledgeBadgeEl.textContent = `● ${pledge.day}요일 작정함`;
  } else {
    pledgeBadgeEl.style.display = 'none';
  }
}



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📖 챕터 체크리스트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CHAPTERS = [
  "오늘날 부흥이 긴급히 필요하다","부흥의 장애물","불신앙","오염된 교리",
  "일그러진 정통신앙","죽은 정통신앙","영적 무력증","부흥을 기대하라",
  "부흥의 특징","부흥의 목적","부흥의 영향","부흥은 어떻게 임하는가",
  "기도와 부흥","부흥의 때에 구해야 하는 것","부흥을 위해 기도하는 진정한 이유",
  "부흥이 임할 때 일어나는 일","하나님의 영광이 계시되다","하나님의 선한 형상이 나타나다",
  "예수의 얼굴에 나타난 하나님의 영광","부흥의 부담","갑자기 등장하시는 하나님",
  "부흥을 위한 위대한 기도","강렬한 열정으로 부흥을 위해 기도하라",
  "부흥, 하나님의 영이 우리 가운데 임하시는 일"
];

function buildChecklistHtml(personId) {
  const items = CHAPTERS.map((name, idx) => {
    const n = idx + 1;
    return `
      <div class="ch-bar-item" id="ch-${personId}-${n}" onclick="toggleChapter('${personId}',${n},this)">
        <div class="ch-bar-fill"></div>
        <div class="ch-bar-content">
          <span class="ch-bar-num">${n}</span>
          <span class="ch-bar-name">${escHtml(name)}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="checklist-section">
      <div class="checklist-header">
        <span class="checklist-title">📖 챕터 읽기</span>
        <span class="checklist-progress" id="checklist-progress-${personId}">0 / 24</span>
      </div>
      <div class="ch-grid">${items}</div>
      <div class="checklist-progress-bar-wrap">
        <div class="checklist-progress-bar" id="checklist-bar-${personId}" style="width:0%"></div>
      </div>
    </div>`;
}

async function loadChecklist(personId) {
  try {
    const ref = doc(db, 'persons', personId, 'meta', 'checklist');
    const snap = await getDoc(ref);
    const checked = snap.exists() ? (snap.data().checked || []) : [];
    applyChecklist(personId, checked);
  } catch (e) {
    console.error('checklist load error', e);
  }
}

function applyChecklist(personId, checked) {
  let count = 0;
  for (let n = 1; n <= 24; n++) {
    const el = document.getElementById(`ch-${personId}-${n}`);
    if (!el) continue;
    if (checked.includes(n)) { el.classList.add('checked'); count++; }
    else el.classList.remove('checked');
  }
  const prog = document.getElementById(`checklist-progress-${personId}`);
  const bar  = document.getElementById(`checklist-bar-${personId}`);
  if (prog) prog.textContent = `${count} / 24`;
  if (bar)  bar.style.width  = `${(count / 24) * 100}%`;
}

window.toggleChapter = async (personId, n, el) => {
  const ref  = doc(db, 'persons', personId, 'meta', 'checklist');
  const snap = await getDoc(ref);
  let checked = snap.exists() ? (snap.data().checked || []) : [];
  if (checked.includes(n)) {
    checked = checked.filter(x => x !== n);
  } else {
    checked = [...checked, n];
  }
  await setDoc(ref, { checked });
  applyChecklist(personId, checked);
};

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
const sheetCommentCache  = {};

// ── 로딩 ────────────────────────────────────────
function hideLoading() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('sidebar').style.display        = 'flex';
  document.getElementById('main').style.display           = 'flex';
  document.getElementById('main').classList.add('empty');
  document.getElementById('empty-state').style.cssText =
    'display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:calc(100vh - 64px); width:100%;';
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
    // pledge 캐시 로딩
    loadPledge(person.id).then(pledge => {
      person.pledgeData = pledge;
      renderSidebar();
    });
    onSnapshot(collection(db, 'persons', person.id, 'prayers'), snap => {
      person.prayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      person.hasGlow = person.prayers.some(pr => pr.glow);
      renderSidebar();
      if (person.id === selectedPersonId) updatePanelHeaderWithPledge(person);
    });
  });
}

async function checkSundayReset() {
  if (new Date().getDay() !== 0) return;
  const todayStr = new Date().toDateString();
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
    const pledgeInfo = p.pledgeData;
    const hasPledge = pledgeInfo && pledgeInfo.day;
    // ✅ 수정1: 뱃지 색상 = hasGlow 기준 (기도문 삭제시 자동 빨간색 복구)
    // ✅ 수정2: 요일 미설정이어도 기도했으면 glow 표시
    const isGold = hasGlow;
    const dayBadge = hasPledge
      ? `<span class="day-pledge-badge ${isGold ? 'gold' : 'red'}">${pledgeInfo.day}</span>`
      : '';
    const btn = document.createElement('button');
    btn.className = 'person-btn' + (p.id === selectedPersonId ? ' active' : '') + (hasGlow ? ' glowing' : '');
    btn.innerHTML = `<div class="person-avatar-wrap"><div class="person-avatar">${p.icon}<span class="glow-dot"></span></div>${dayBadge}</div><span class="person-name">${p.name}</span>`;
    btn.onclick = () => selectPerson(p.id);
    list.appendChild(btn);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  사람 선택
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function selectPerson(id) {
  selectedPersonId = id;
  currentSlide = 0;
  const person = persons.find(p => p.id === id);
  if (!person) return;

  document.getElementById('all-panel').style.display   = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('all-view-btn').classList.remove('active');
  document.getElementById('ddosimi-btn').classList.remove('active');
  document.getElementById('ddosimi-panel').style.display = 'none';
  if (ddosimiUnsub) { ddosimiUnsub(); ddosimiUnsub = null; }
  document.getElementById('main').classList.remove('empty');

  const panel = document.getElementById('person-panel');
  panel.style.display = 'flex';
  panel.style.animation = 'none';
  panel.offsetHeight;
  panel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  // 요일 작정 체크 — 이번 주 미설정이면 팝업
  const pledge = await loadPledge(id);
  person.pledgeData = pledge;
  if (!pledge) {
    openPledgeModal(id);
  }

  await updatePanelHeaderWithPledge(person);
  renderSidebar();

  if (prayersUnsub) prayersUnsub();
  prayersUnsub = onSnapshot(collection(db, 'persons', id, 'prayers'), snapshot => {
    person.prayers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    person.hasGlow = person.prayers.some(pr => pr.glow);
    renderSidebar();
    updatePanelHeaderWithPledge(person);
    renderCards(person.prayers, id);
  });
}

function updatePanelHeader(person) {
  updatePanelHeaderWithPledge(person);
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
  document.getElementById('ddosimi-btn').classList.remove('active');
  document.getElementById('ddosimi-panel').style.display = 'none';
  if (ddosimiUnsub) { ddosimiUnsub(); ddosimiUnsub = null; }
  document.getElementById('main').classList.remove('empty');
  renderSidebar();

  const allPanel = document.getElementById('all-panel');
  allPanel.style.display = 'flex';
  allPanel.style.animation = 'none';
  allPanel.offsetHeight;
  allPanel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  const container = document.getElementById('all-cards-container');
  container.innerHTML = '<p style="color:var(--text-muted);text-align:center;font-size:13px;">불러오는 중...</p>';

  // ── 챕터 현황 + 기도문 동시 로딩 ──
  let allPrayers = [];
  const chapterData = []; // { icon, name, count }

  for (const person of persons) {
    // 기도문
    const snap = await getDocs(collection(db, 'persons', person.id, 'prayers'));
    for (const d of snap.docs) {
      const commSnap = await getDocs(collection(db, 'persons', person.id, 'prayers', d.id, 'comments'));
      allPrayers.push({ id: d.id, personId: person.id, personName: person.name, personIcon: person.icon, commentCount: commSnap.size, ...d.data() });
    }
    // 챕터 체크리스트
    try {
      const chSnap = await getDoc(doc(db, 'persons', person.id, 'meta', 'checklist'));
      const checked = chSnap.exists() ? (chSnap.data().checked || []) : [];
      chapterData.push({ icon: person.icon, name: person.name, count: checked.length });
    } catch (e) {
      chapterData.push({ icon: person.icon, name: person.name, count: 0 });
    }
  }

  allPrayers.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  // 챕터 현황 렌더
  const chapterHtml = buildChapterSummaryHtml(chapterData);

  if (allPrayers.length === 0) {
    container.innerHTML = chapterHtml + '<div class="no-cards"><p>아직 기도문이 없습니다 🙏</p></div>';
    return;
  }
  allPrayersCache = allPrayers;
  const cardsHtml = allPrayers.map(pr => buildCardHtml(pr, true)).join('');
  container.innerHTML = chapterHtml +
    `<div class="prayer-list-section-title" style="margin-top:4px;">📜 기도문 목록</div>` +
    `<div class="cards-grid">${cardsHtml}</div>`;
};

function buildChapterSummaryHtml(data) {
  const rows = data.map(p => {
    const pct = Math.round(p.count / 24 * 100);
    const done = p.count === 24;
    return `
      <div class="ch-summary-row${done ? ' done' : ''}">
        <span class="ch-summary-icon">${p.icon}</span>
        <div class="ch-summary-info">
          <span class="ch-summary-name">${escHtml(p.name)}</span>
          <div class="ch-summary-bar"><div class="ch-summary-fill" style="width:${pct}%"></div></div>
        </div>
        <span class="ch-summary-num${done ? ' done' : ''}">${p.count}</span>
      </div>`;
  }).join('');

  return `
    <div class="chapter-summary-section">
      <div class="chapter-summary-header">
        <span class="chapter-summary-title">📖 챕터 읽기 현황</span>
        <span class="chapter-summary-badge">24챕터</span>
      </div>
      <div class="ch-summary-grid">${rows}</div>
    </div>`;
}

let allCurrentSlide = 0;
let allPrayersCache = [];

function buildPrayerListItem(pr) {
  const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const pid   = pr.personId || '';
  const title = pr.title || '기도문';
  const myLiked = getMyLiked(pid, pr.id);
  return `
    <div class="prayer-list-item" onclick="openPrayerDetail('${pid}','${pr.id}','false')">
      <div class="prayer-list-item-left">
        <div class="prayer-list-title">${escHtml(title)}</div>
        <div class="prayer-list-meta">
          <span>${dateStr}</span>
          <span>${myLiked ? '❤️' : '🤍'} ${pr.likes || 0}</span>
          <span>💬 <span class="comment-count-list-${pr.id}">${pr.commentCount || 0}</span></span>
        </div>
      </div>
      <span class="prayer-list-arrow">›</span>
    </div>`;
}

function buildLatestCardHtml(pr) {
  const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const pid     = pr.personId || '';
  const myLiked = getMyLiked(pid, pr.id);
  const commentCount = pr.commentCount || 0;

  return `
    <div class="latest-card">
      <div class="latest-card-label">✦ 최신 기도문</div>
      <div style="font-family:'Noto Serif KR',serif;font-size:16px;font-weight:600;color:var(--text);margin-bottom:2px;">${escHtml(pr.title || '기도문')}</div>
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
      ${pr.title ? `<div style="font-family:'Noto Serif KR',serif;font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px;">${escHtml(pr.title)}</div>` : ''}
      <div class="mini-card-text">${escHtml(preview)}</div>
      <div class="mini-card-footer">
        <span class="mini-stat">${myLiked ? '❤️' : '🤍'} ${pr.likes || 0}</span>
        <span class="mini-stat">💬 ${commentCount}</span>
      </div>
    </div>`;
}

let detailPrayerPersonId = null;
let detailPrayerId       = null;
let detailIsAllView      = false;
let personalPrayersCache = [];

window.openPrayerDetail = (personId, prayerId, isAllView) => {
  detailPrayerPersonId = personId;
  detailPrayerId       = prayerId;
  detailIsAllView      = isAllView === 'true';

  const person = persons.find(p => p.id === personId);
  const pr     = personalPrayersCache.find(pr => pr.id === prayerId && pr.personId === personId)
              || allPrayersCache.find(pr => pr.id === prayerId && pr.personId === personId)
              || person?.prayers.find(pr => pr.id === prayerId);
  if (!pr) return;
  if (!pr.personName && person) pr.personName = person.name;
  if (!pr.personIcon && person) pr.personIcon = person.icon;

  const d = pr.createdAt?.toDate ? pr.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const myLiked = getMyLiked(personId, prayerId);
  const commentCount = pr.commentCount || 0;

  const personHeader = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="font-size:22px;">${pr.personIcon || ''}</span>
      <span style="font-size:14px;font-weight:600;">${pr.personName || ''}</span>
      <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${dateStr}</span>
    </div>
    ${pr.title ? `<div style="font-family:'Noto Serif KR',serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:14px;line-height:1.4;">${escHtml(pr.title)}</div>` : ''}`;

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

  const dcBtn = document.getElementById('detail-comment-btn');
  dcBtn.onmousedown  = (e) => startCommentHold(e, personId, prayerId);
  dcBtn.onmouseup    = cancelCommentHold;
  dcBtn.onmouseleave = cancelCommentHold;
  dcBtn.ontouchstart = (e) => startCommentHold(e, personId, prayerId);
  dcBtn.ontouchend   = cancelCommentHold;

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
//  개인 카드 렌더 (체크리스트 포함)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderCards(prayers, personId) {
  const container = document.getElementById('cards-container');
  if (!prayers || prayers.length === 0) {
    const checklistHtml = buildChecklistHtml(personId);
    container.innerHTML = checklistHtml + `<div class="no-cards"><p>아직 작성된 기도문이 없습니다.<br>아래 버튼으로 첫 기도문을 작성해 보세요 🙏</p></div>`;
    loadChecklist(personId);
    return;
  }

  const sorted = [...prayers].sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  const person2 = persons.find(p => p.id === personId);
  const withPid = sorted.map(pr => ({ ...pr, personId, personName: person2?.name || '', personIcon: person2?.icon || '' }));

  const latest = withPid[0];

  const latestHtml = buildLatestCardHtml(latest);
  const cardsTitleHtml = `<div class="cards-section-title">📜 기도 카드</div>`;
  const listHtml = `<div class="prayer-list-section-title">📜 기도문 목록</div>
     <div class="prayer-list-wrap">${withPid.map(pr => buildPrayerListItem(pr)).join('')}</div>`;

  // ✅ 체크리스트 → 기도카드 제목 → 최신기도문 → 목록 순서
  const checklistHtml = buildChecklistHtml(personId);
  personalPrayersCache = withPid;
  container.innerHTML = checklistHtml + cardsTitleHtml + latestHtml + listHtml;

  // 체크리스트 상태 불러오기
  loadChecklist(personId);

  // 댓글 수 실시간 반영
  withPid.forEach(pr => {
    const commentsCol = collection(doc(db, 'persons', personId, 'prayers', pr.id), 'comments');
    onSnapshot(commentsCol, snap => {
      const cnt = snap.size;
      const btn = document.getElementById(`comment-btn-${pr.id}`);
      if (btn) {
        const el = btn.querySelector('.comment-count');
        if (el) el.textContent = cnt;
      }
      const miniCard = document.querySelector(`[onclick*="'${pr.id}'"]`);
      if (miniCard) {
        const stats = miniCard.querySelectorAll('.mini-stat');
        if (stats[1]) stats[1].textContent = `💬 ${cnt}`;
      }
      const listCount = document.querySelector(`.comment-count-list-${pr.id}`);
      if (listCount) listCount.textContent = cnt;
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
    return ta - tb;
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

window.deleteSheetComment = async (personId, prayerId, commentId) => {
  if (!confirm('이 댓글을 삭제할까요?')) return;
  await deleteDoc(doc(db, 'persons', personId, 'prayers', prayerId, 'comments', commentId));
};

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
//  하트
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
  document.getElementById('prayer-title').value = '';
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
  document.getElementById('prayer-title').value = prayer.title || '';
  document.getElementById('prayer-text').value = prayer.text;
  document.getElementById('write-modal').classList.add('open');
  setTimeout(() => document.getElementById('prayer-text').focus(), 200);
};
window.closeWriteModal = () => document.getElementById('write-modal').classList.remove('open');
window.savePrayer = async () => {
  const text  = document.getElementById('prayer-text').value.trim();
  const title = document.getElementById('prayer-title').value.trim() || '기도문';
  if (!text) { alert('기도문을 입력해 주세요.'); return; }
  const pCol = collection(db, 'persons', selectedPersonId, 'prayers');
  if (editingPrayerId) {
    await updateDoc(doc(pCol, editingPrayerId), { text, title });
  } else {
    await addDoc(pCol, { text, title, glow: true, likes: 0, liked: false, likers: [], createdAt: serverTimestamp() });
    // 기도문 작성 시 작정 prayed = true
    await setPledgePrayed(selectedPersonId);
    const person = persons.find(p => p.id === selectedPersonId);
    if (person) {
      const pledge = await loadPledge(selectedPersonId);
      person.pledgeData = pledge;
      renderSidebar();
    }
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
  document.getElementById('empty-state').style.display  = 'flex';
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
//  💕 또심이
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DDOSIMI_YEARS = [];
for (let y = 1995; y <= 2010; y++) DDOSIMI_YEARS.push(y);

function fillDdosimiSelect(selId, selectedVal) {
  const sel = document.getElementById(selId);
  sel.innerHTML = '<option value="">선택 안 함</option>';
  DDOSIMI_YEARS.forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y).slice(2);
    opt.textContent = y + '년생';
    if (String(y).slice(2) === selectedVal) opt.selected = true;
    sel.appendChild(opt);
  });
}

let editingDdosimiId = null;
let ddosimiUnsub = null;

window.openDdosimiView = () => {
  selectedPersonId = null;
  if (prayersUnsub) { prayersUnsub(); prayersUnsub = null; }

  document.getElementById('empty-state').style.display  = 'none';
  document.getElementById('person-panel').style.display = 'none';
  document.getElementById('all-panel').style.display    = 'none';
  document.getElementById('all-view-btn').classList.remove('active');
  document.getElementById('ddosimi-btn').classList.add('active');
  document.getElementById('main').classList.remove('empty');
  renderSidebar();

  const panel = document.getElementById('ddosimi-panel');
  panel.style.display = 'flex';
  panel.style.animation = 'none';
  panel.offsetHeight;
  panel.style.animation = 'slideUp .4s cubic-bezier(.16,1,.3,1)';

  // 실시간 리스너
  if (ddosimiUnsub) ddosimiUnsub();
  ddosimiUnsub = onSnapshot(collection(db, 'ddosimi'), snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    renderDdosimiCards(items);
  });
};

function renderDdosimiCards(items) {
  const container = document.getElementById('ddosimi-cards-container');
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="no-cards"><p>아직 또심이가 없습니다.<br>아래 버튼으로 첫 또심이를 추가해 보세요 💕</p></div>';
    return;
  }
  const cardsHtml = items.map(item => buildDdosimiCardHtml(item)).join('');
  container.innerHTML = `<div class="ddosimi-grid">${cardsHtml}</div>`;
}

function buildDdosimiCardHtml(item) {
  const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
  const dateStr = `${String(d.getFullYear()).slice(2)}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  const invAge  = item.invAge  ? item.invAge  + '년생' : '';
  const ddoAge  = item.ddoAge  ? item.ddoAge  + '년생' : '';
  const invName = escHtml(item.invName  || '');
  const ddoName = escHtml(item.ddoName  || '');
  const pray    = escHtml(item.pray || '').replace(/\n/g, '<br>');
  const id      = item.id;

  return `
    <div class="ddosimi-card" onclick="toggleDdosimiCard(this)">
      <div class="ddosimi-con">
        <div class="ddosimi-person">
          <div class="ddosimi-icon-col">
            <span class="ddosimi-emo">🤗</span>
            <span class="ddosimi-badge ddosimi-badge-inv">초청자</span>
          </div>
          <div class="ddosimi-text-col">
            <span class="ddosimi-age">${invAge}</span>
            <span class="ddosimi-name ddosimi-name-inv">${invName}</span>
          </div>
        </div>
        <div class="ddosimi-mid">
          <div class="ddosimi-line"></div>
          <span class="ddosimi-heart">💕</span>
          <div class="ddosimi-line"></div>
        </div>
        <div class="ddosimi-person ddosimi-person-right">
          <div class="ddosimi-text-col">
            <span class="ddosimi-age">${ddoAge}</span>
            <span class="ddosimi-name">${ddoName}</span>
          </div>
          <div class="ddosimi-icon-col">
            <span class="ddosimi-emo">💌</span>
            <span class="ddosimi-badge ddosimi-badge-ddo">또심이</span>
          </div>
        </div>
      </div>
      <div class="ddosimi-date">${dateStr}</div>
      <div class="ddosimi-pray-label">🌱 기도제목</div>
      <div class="ddosimi-pray-text">${pray}</div>
      <div class="ddosimi-overlay">
        <div class="ddosimi-ov-inner">
          <div class="ddosimi-ov-names">🤗 ${invName} <span class="ddosimi-ov-sep">💕</span> 💌 ${ddoName}</div>
          <div class="ddosimi-ov-btns">
            <button class="ddosimi-ov-btn" onclick="openDdosimiEditModal(event,'${id}')">✏️ 수정</button>
            <button class="ddosimi-ov-btn ddosimi-ov-btn-del" onclick="confirmDeleteDdosimi(event,'${id}')">🗑️ 삭제</button>
          </div>
        </div>
        <button class="ddosimi-ov-close" onclick="closeDdosimiCard(event,this)">✕</button>
      </div>
    </div>`;
}

window.toggleDdosimiCard = (card) => {
  const wasOpen = card.classList.contains('ddosimi-open');
  document.querySelectorAll('.ddosimi-card.ddosimi-open').forEach(c => c.classList.remove('ddosimi-open'));
  if (!wasOpen) card.classList.add('ddosimi-open');
};
window.closeDdosimiCard = (e, btn) => {
  e.stopPropagation();
  btn.closest('.ddosimi-card').classList.remove('ddosimi-open');
};

window.openDdosimiAddModal = () => {
  editingDdosimiId = null;
  document.getElementById('ddosimi-modal-title').textContent = '💕 새 또심이 추가';
  document.getElementById('ddosimi-inv-name').value = '';
  document.getElementById('ddosimi-ddo-name').value = '';
  document.getElementById('ddosimi-pray').value = '';
  document.getElementById('ddosimi-delete-btn').style.display = 'none';
  fillDdosimiSelect('ddosimi-inv-age', '');
  fillDdosimiSelect('ddosimi-ddo-age', '');
  document.getElementById('ddosimi-modal').classList.add('open');
  setTimeout(() => document.getElementById('ddosimi-inv-name').focus(), 200);
};

window.openDdosimiEditModal = async (e, id) => {
  e.stopPropagation();
  document.querySelectorAll('.ddosimi-card.ddosimi-open').forEach(c => c.classList.remove('ddosimi-open'));
  const snap = await getDoc(doc(db, 'ddosimi', id));
  if (!snap.exists()) return;
  const item = snap.data();
  editingDdosimiId = id;
  document.getElementById('ddosimi-modal-title').textContent = '✏️ 또심이 수정';
  document.getElementById('ddosimi-inv-name').value = item.invName || '';
  document.getElementById('ddosimi-ddo-name').value = item.ddoName || '';
  document.getElementById('ddosimi-pray').value     = item.pray    || '';
  document.getElementById('ddosimi-delete-btn').style.display = 'inline-flex';
  fillDdosimiSelect('ddosimi-inv-age', item.invAge || '');
  fillDdosimiSelect('ddosimi-ddo-age', item.ddoAge || '');
  document.getElementById('ddosimi-modal').classList.add('open');
  setTimeout(() => document.getElementById('ddosimi-inv-name').focus(), 200);
};

window.closeDdosimiModal = () => {
  document.getElementById('ddosimi-modal').classList.remove('open');
  editingDdosimiId = null;
};

window.saveDdosimi = async () => {
  const invName = document.getElementById('ddosimi-inv-name').value.trim();
  const invAge  = document.getElementById('ddosimi-inv-age').value;
  const ddoName = document.getElementById('ddosimi-ddo-name').value.trim();
  const ddoAge  = document.getElementById('ddosimi-ddo-age').value;
  const pray    = document.getElementById('ddosimi-pray').value.trim();
  if (!ddoName || !pray) { alert('또심이 이름과 기도제목을 입력해 주세요.'); return; }

  const data = { invName, invAge, ddoName, ddoAge, pray };
  if (editingDdosimiId) {
    await updateDoc(doc(db, 'ddosimi', editingDdosimiId), data);
  } else {
    await addDoc(collection(db, 'ddosimi'), { ...data, createdAt: serverTimestamp() });
  }
  closeDdosimiModal();
};

window.confirmDeleteDdosimi = async (e, id) => {
  e.stopPropagation();
  document.querySelectorAll('.ddosimi-card.ddosimi-open').forEach(c => c.classList.remove('ddosimi-open'));
  if (!confirm('이 또심이를 삭제할까요?')) return;
  await deleteDoc(doc(db, 'ddosimi', id));
};

// 기존 deleteDdosimi (모달에서 삭제 버튼용)
window.deleteDdosimi = async () => {
  if (!editingDdosimiId) return;
  if (!confirm('이 또심이를 삭제할까요?')) return;
  await deleteDoc(doc(db, 'ddosimi', editingDdosimiId));
  closeDdosimiModal();
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
