// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📖 챕터 체크리스트 (app.js에 추가할 코드)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── 1) firebase import에 setDoc 추가 ──────────────
// 기존:
// import { ..., getDoc } from "..."
// 변경:
// import { ..., getDoc, setDoc } from "..."


// ── 2) 챕터 제목 배열 (전역에 추가) ─────────────────
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


// ── 3) 체크리스트 HTML 생성 함수 ─────────────────────
function buildChecklistHtml(personId) {
  const items = CHAPTERS.map((name, idx) => {
    const n = idx + 1;
    return `
      <div class="ch-bar-item" id="ch-${personId}-${n}" data-n="${n}" onclick="toggleChapter('${personId}',${n},this)">
        <div class="ch-bar-fill"></div>
        <div class="ch-bar-content">
          <span class="ch-bar-num">${n}</span>
          <span class="ch-bar-name">${name}</span>
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


// ── 4) 체크리스트 Firebase에서 불러오기 ──────────────
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


// ── 5) 체크 상태 UI에 반영 ────────────────────────────
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


// ── 6) 챕터 토글 (클릭 시) ────────────────────────────
window.toggleChapter = async (personId, n, el) => {
  const ref  = doc(db, 'persons', personId, 'meta', 'checklist');
  const snap = await getDoc(ref);
  let checked = snap.exists() ? (snap.data().checked || []) : [];

  if (checked.includes(n)) {
    checked = checked.filter(x => x !== n);
  } else {
    checked = [...checked, n];
  }

  await setDoc(ref, { checked }); // setDoc으로 덮어쓰기
  applyChecklist(personId, checked);
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  renderCards 함수 수정 (기존 함수 안에서 교체)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// 기존 renderCards 함수 안의 이 부분:
//
//   container.innerHTML = latestHtml + listHtml;
//
// 아래처럼 교체:
//
//   const checklistHtml = buildChecklistHtml(personId);
//   container.innerHTML = checklistHtml + latestHtml + listHtml;
//   loadChecklist(personId);
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
