// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔔 notifications.js
//
//  ★ 사용법: index.html에서 app.js 바로 위에 추가
//     <script type="module" src="notifications.js"></script>
//     <script type="module" src="app.js"></script>
//
//  ★ VAPID_PUBLIC_KEY 는 아래 [4단계]에서 발급받은 키로 교체!
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase 설정 (app.js와 동일) ────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBHfwsHew71Bo6kWmkpfoiimZ7xzRnM0Yg",
  authDomain:        "uniplus50pray.firebaseapp.com",
  projectId:         "uniplus50pray",
  storageBucket:     "uniplus50pray.firebasestorage.app",
  messagingSenderId: "1015188366263",
  appId:             "1:1015188366263:web:c822be79ce3d8fb8a27e32"
};

// 이미 초기화된 경우 재사용
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ① Service Worker 등록
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service Worker 등록 완료');
    return reg;
  } catch (e) {
    console.error('SW 등록 실패', e);
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ② 알림 권한 요청 + FCM 토큰 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ★★★ 아래 키를 Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징
//       → 웹 푸시 인증서 에서 발급받은 VAPID 공개 키로 교체하세요 ★★★
const VAPID_PUBLIC_KEY = 'BL1fSV-LxECDmceA81TStYPbNN61a9X9RjhMcBPHWkW24CP0sQl2uIUz7sMwxp_ZiltaTzUNP4Sjh27wvKjU97Y';

async function requestNotificationPermission(personId = null) {
  // 이미 허용된 경우 바로 토큰 저장
  if (Notification.permission === 'granted') {
    await saveFcmToken(personId);
    return true;
  }
  // 이미 거부된 경우 포기
  if (Notification.permission === 'denied') return false;

  // 처음: 권한 요청
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  await saveFcmToken(personId);
  return true;
}

async function saveFcmToken(personId = null) {
  try {
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    });
    if (!token) return;

    // Firestore fcmTokens 컬렉션에 저장
    // personId가 있으면 작정 기도 개인화 알림에 활용
    const tokenId = btoa(token).slice(0, 20); // 짧은 ID
    await setDoc(doc(db, 'fcmTokens', tokenId), {
      token,
      personId: personId || null,
      updatedAt: serverTimestamp(),
      userAgent: navigator.userAgent.slice(0, 100)
    }, { merge: true });

    console.log('✅ FCM 토큰 저장 완료');
  } catch (e) {
    console.error('FCM 토큰 저장 실패', e);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ③ 앱이 열려있을 때 포그라운드 알림 처리
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setupForegroundNotifications() {
  try {
    const messaging = getMessaging(firebaseApp);
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'UNI+ 기도';
      const body  = payload.notification?.body  || '';
      showInAppToast(title, body);
    });
  } catch (e) {
    console.error('포그라운드 알림 설정 실패', e);
  }
}

// 앱 안에서 보여주는 토스트 (잠금화면 대신)
function showInAppToast(title, body) {
  const existing = document.getElementById('notif-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'notif-toast';
  toast.innerHTML = `
    <div style="
      position:fixed; top:20px; right:20px; z-index:9999;
      background:rgba(168,208,239,0.95);
      border:1px solid #4692f2;
      border-radius:16px; padding:14px 18px;
      max-width:300px; box-shadow:0 8px 32px rgba(0,0,0,0.2);
      backdrop-filter:blur(12px);
      animation: toastIn .4s cubic-bezier(.16,1,.3,1);
    ">
      <div style="font-size:13px;font-weight:600;color:#020678;margin-bottom:4px;">🙏 ${title}</div>
      <div style="font-size:12px;color:#3a6090;">${body}</div>
    </div>
    <style>
      @keyframes toastIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
    </style>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ④ 사람 선택 시 personId 업데이트 (작정 알림 개인화)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function updateTokenPersonId(personId) {
  const storedTokenId = localStorage.getItem('fcm_token_id');
  if (!storedTokenId) return;
  try {
    await setDoc(doc(db, 'fcmTokens', storedTokenId), {
      personId,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ⑤ 초기화 — 페이지 로드 시 자동 실행
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(async () => {
  await registerSW();

  // 알림 권한이 이미 있으면 바로 토큰 갱신
  if (Notification.permission === 'granted') {
    await saveFcmToken();
    setupForegroundNotifications();
    return;
  }

  // 처음 방문: 3초 뒤에 알림 배너 표시
  setTimeout(() => showNotificationBanner(), 3000);
})();

// ── 알림 허용 배너 ────────────────────────────────
function showNotificationBanner() {
  if (Notification.permission !== 'default') return;
  if (document.getElementById('notif-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'notif-banner';
  banner.innerHTML = `
    <div style="
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      z-index:9999; background:rgba(168,208,239,0.97);
      border:1px solid #4692f2; border-radius:16px;
      padding:16px 20px; width:min(340px, 90vw);
      box-shadow:0 8px 32px rgba(0,0,0,0.2);
      backdrop-filter:blur(12px);
      animation: toastIn .4s cubic-bezier(.16,1,.3,1);
    ">
      <div style="font-size:14px;font-weight:600;color:#020678;margin-bottom:6px;">
        🔔 기도문 알림 받기
      </div>
      <div style="font-size:12px;color:#3a6090;margin-bottom:14px;line-height:1.6;">
        누군가 기도문을 올리거나 작정 기도 날에<br>알림을 보내드려요!
      </div>
      <div style="display:flex;gap:8px;">
        <button id="notif-allow-btn" style="
          flex:1; padding:9px; border-radius:10px;
          background:#4692f2; border:none; color:#fff;
          font-size:13px; font-weight:600; cursor:pointer;
        ">허용하기</button>
        <button id="notif-deny-btn" style="
          padding:9px 14px; border-radius:10px;
          background:transparent; border:1px solid #4692f2;
          color:#3a6090; font-size:13px; cursor:pointer;
        ">나중에</button>
      </div>
    </div>
    <style>
      @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
    </style>
  `;

  document.body.appendChild(banner);

  document.getElementById('notif-allow-btn').onclick = async () => {
    banner.remove();
    const ok = await requestNotificationPermission();
    if (ok) setupForegroundNotifications();
  };
  document.getElementById('notif-deny-btn').onclick = () => banner.remove();
}

// 외부 노출 (app.js에서 사용)
window.__notif = { requestNotificationPermission, updateTokenPersonId };
