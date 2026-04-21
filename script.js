'use strict';

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey:            "AIzaSyAD809uwf9ZcMml-bbDXtJw8vaWFjvLOQg",
  authDomain:        "vote-buttons-13652.firebaseapp.com",
  projectId:         "vote-buttons-13652",
  storageBucket:     "vote-buttons-13652.firebasestorage.app",
  messagingSenderId: "910772982997",
  appId:             "1:910772982997:web:2bb50708d47710c420be5c",
  measurementId:     "G-D71WMNXZ8F"
};

/* TRANSLATIONS */
const i18n = {
  th: {
    loading:       "กำลังโหลด...",
    appTitle:      "คะแนนเสียงมหาชน",
    votePrompt:    "เลือกทีมที่คุณชื่นชอบ",
    voteOnce:      "โหวตได้ 1 ครั้งต่อคน",
    liveScore:     "คะแนนเรียลไทม์",
    currentScore:  "คะแนนล่าสุด",
    thankYou:      "ขอบคุณที่โหวต!",
    votingClosed:  "การโหวตยังไม่เปิด",
    waitAdmin:     "กรุณารอผู้ดูแลระบบเปิดการโหวต",
    adminTitle:    "⚙️ ตั้งค่า",
    voteControl:   "ควบคุมการโหวต",
    inactive:      "ปิดอยู่",
    active:        "เปิดอยู่",
    voteMinutes:   "เวลาโหวต (นาที)",
    teams:         "ทีม",
    addTeam:       "เพิ่มทีม",
    teams2:        "ทีม",
    resetVotes:    "ล้างคะแนน",
    save:          "บันทึก",
    resetConfirm:  "ยืนยันการล้างคะแนนทั้งหมด?",
    resetDone:     "🔄 ล้างคะแนนแล้ว",
    saved:         "✅ บันทึกแล้ว",
    alreadyVoted:  "คุณโหวตไปแล้ว",
    votedFor:      (name) => `คุณโหวต ${name} แล้ว! 🎉`,
    votes:         "คะแนน",
    timeUp:        "หมดเวลาโหวตแล้ว",
    totalVotes:    (n) => `รวม ${n} โหวต`,
    back:          "กลับ",
    noTeams:       "ยังไม่มีทีม กรุณาตั้งค่าก่อน",
  },
  en: {
    loading:       "Loading...",
    appTitle:      "Popular Vote",
    votePrompt:    "Vote for your favorite team",
    voteOnce:      "One vote per person",
    liveScore:     "Live Scores",
    currentScore:  "Current Scores",
    thankYou:      "Thanks for voting!",
    votingClosed:  "Voting is not open",
    waitAdmin:     "Please wait for admin to open voting",
    adminTitle:    "⚙️ Settings",
    voteControl:   "Vote Control",
    inactive:      "Closed",
    active:        "Open",
    voteMinutes:   "Duration (minutes)",
    teams:         "Teams",
    addTeam:       "Add Team",
    teams2:        "teams",
    resetVotes:    "Clear Votes",
    save:          "Save",
    resetConfirm:  "Confirm clear all votes?",
    resetDone:     "🔄 Votes cleared",
    saved:         "✅ Saved",
    alreadyVoted:  "You already voted",
    votedFor:      (name) => `You voted for ${name}! 🎉`,
    votes:         "votes",
    timeUp:        "Voting time is up",
    totalVotes:    (n) => `${n} total votes`,
    back:          "Back",
    noTeams:       "No teams configured",
  }
};

/* STATE */
let lang          = 'th'; 
let db            = null; 
let settings      = null; 
let votes         = {}; 
let myVote        = null; 
let timerInterval = null; 

// ใช้ Object เดียวเก็บ Chart ทั้งหมดเพื่อความเป็นระเบียบและจัดการง่าย
const chartInstances = {}; 

let adminMinutes = 5; 

const TEAM_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ec4899',
  '#8b5cf6','#06b6d4','#f97316','#84cc16'
];

/* i18n FUNCTIONS */
function t(key, ...args) {
  // ตรวจสอบว่ามีตัวแปร i18n และมีภาษานั้นๆ หรือไม่
  if (typeof i18n === 'undefined' || !i18n[lang]) return key;
  
  const val = i18n[lang][key];

  // ถ้าคำแปลเป็นฟังก์ชัน (เช่น votedFor) ให้ส่ง args เข้าไปประมวลผล
  if (typeof val === 'function') return val(...args);
  
  // ถ้าเป็น String ปกติให้คืนค่าออกไปเลย ถ้าไม่มีให้คืนค่า Key
  return val || key;
}

function applyTranslations() {
  if (typeof i18n === 'undefined' || !i18n[lang]) return;

  // 1. แปลภาษา Element ที่มี data-i18n ทั้งหมด
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // ใช้ฟังก์ชัน t(key) เพื่อดึงคำแปลที่ถูกต้อง
    el.textContent = t(key);
  });

  // 2. [จุดสำคัญ] อัปเดตตัวหนังสือบนปุ่มภาษา (id="lang-label")
  const langLabel = document.getElementById('lang-label');
  if (langLabel) {
    // ถ้าปัจจุบันเป็น 'th' ปุ่มควรโชว์ 'EN'
    // ถ้าปัจจุบันเป็น 'en' ปุ่มควรโชว์ 'ไทย' (หรือ 'TH')
    langLabel.textContent = (lang === 'th') ? 'EN' : 'ไทย';
  }
  
  // กำหนดภาษาให้ตัวเอกสาร (เพื่อ SEO และ Accessibility)
  document.documentElement.lang = lang;
}

function toggleLanguage() {
  // 1. สลับค่าระหว่าง 'th' และ 'en'
  lang = (lang === 'th') ? 'en' : 'th';
  
  // 2. บันทึกไว้ในเครื่องผู้ชม
  localStorage.setItem('audience_lang', lang);
  
  // 3. สั่งให้ตัวหนังสือบนหน้าจอเปลี่ยนทันที
  applyTranslations();
  
  // 4. อัปเดตส่วนที่สร้างด้วย JavaScript (รายชื่อทีมและกราฟ)
  if (typeof renderTeams === 'function') renderTeams();
  if (typeof updateCharts === 'function') updateCharts();
  
  // 5. แสดง Toast แจ้งเตือนภาษาใหม่
  if (typeof showToast === 'function') {
    const msg = (lang === 'th') ? '🇹🇭 ภาษาไทย' : '🇬🇧 English';
    showToast(msg, 'info');
  }
}


/*  FIREBASE INIT */
function initFirebase() {
  if (db) return; // ✅ ป้องกันการสร้าง Connection ซ้อน (ถ้ามี db แล้วให้หยุด)
  
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  db = firebase.firestore();

  // 1. ฟัง Settings จาก Firestore
  db.collection('audience_config').doc('settings').onSnapshot(doc => {
    if (doc.exists) {
      const newData = doc.data();
      
      // ✅ เช็คก่อนว่าข้อมูลเปลี่ยนจริงไหม (เช่น isOpen หรือ teams เปลี่ยน) 
      // เพื่อไม่ให้วาดใหม่พร่ำเพรื่อ
      if (JSON.stringify(settings) === JSON.stringify(newData)) return;

      settings = newData;
      adminMinutes = settings.minutes || 5;
      
      // ตัวเดียวจบ: เพราะ handleSettingsChange มี renderTeams อยู่ข้างในแล้ว
      if (typeof handleSettingsChange === 'function') {
        handleSettingsChange();
      }
    }
  }, error => {
    console.error("❌ Settings Sync Error:", error);
  });

  // 2. ฟังคะแนนโหวต
  db.collection('audience_votes').onSnapshot(snapshot => {
    let newVotes = {}; 
    if (!snapshot.empty) {
      snapshot.forEach(doc => {
        newVotes[doc.id] = doc.data();
      });
    }
    
    // ✅ เช็คว่าคะแนนเปลี่ยนจริงไหมก่อนจะวาดใหม่
    if (JSON.stringify(votes) === JSON.stringify(newVotes)) return;
    
    votes = newVotes;

    // วาด UI เฉพาะเมื่อข้อมูลพร้อม
    if (settings && settings.teams) {
      // ใช้ requestAnimationFrame เพื่อให้ Browser หาจังหวะวาดที่ลื่นที่สุด (ลดอาการกระพริบ)
      window.requestAnimationFrame(() => {
        if (typeof renderTeams === 'function') renderTeams();
        if (typeof updateCharts === 'function') updateCharts();
      });
    }
  }, error => {
    console.error("❌ Votes Sync Error:", error);
  });
}

/* SETTINGS CHANGE  */
function handleSettingsChange() {
  if (!settings) return;

  // 1. ตรวจสอบสัญญาณการรีเซ็ต หรือ อัปเดตใหม่จาก Admin
  const lastLocalVoteTime = localStorage.getItem('audienceVote_timestamp') || 0;
  const serverUpdateTime = settings.lastUpdated ? settings.lastUpdated.toMillis() : 0;

  // ⚡️ ตรวจพบสัญญาณใหม่ (เวลาเซิร์ฟเวอร์ใหม่กว่าเวลาที่เราเคยบันทึกไว้)
  if (serverUpdateTime > lastLocalVoteTime) {
    console.log("♻️ Reset signal detected. Redirecting everyone to loading...");

    // ล้างข้อมูลการโหวตเก่าในเครื่องทิ้ง
    localStorage.removeItem('audienceVote_teamIndex');
    localStorage.removeItem('audienceVote_timestamp');
    myVote = null;

    // บังคับเด้งกลับไปหน้าจอ Loading ทันทีตามที่คุณต้องการ
    showScreen('screen-loading');

    // หน่วงเวลาหน้า Loading ไว้ 1.2 วินาทีเพื่อให้ดูเนียน และรอให้ Firebase เคลียร์ข้อมูลเสร็จ
    setTimeout(() => {
      // เมื่อโหลดเสร็จแล้ว ค่อยตัดสินใจว่าจะพาไปหน้าไหนต่อ (เช่น หน้าโหวต หรือ หน้าปิดโหวต)
      processScreenRouting();
    }, 1200);

    // หยุดการทำงานของฟังก์ชันนี้ไว้แค่นี้ก่อน เพื่อรอผลจาก setTimeout ด้านบน
    return;
  }

  // หากไม่ใช่จังหวะ Reset ให้ทำงานตามปกติ
  processScreenRouting();
}

/* ======================================================
   [FUNCTION: PROCESS SCREEN ROUTING]
   โลจิกการเลือกหน้าจอ (แยกออกมาเพื่อให้เรียกใช้หลังจากหน้า Loading)
   ====================================================== */
function processScreenRouting() {
  if (!settings) return;

  applyTranslations();

  // 1. ซิงค์สถานะการโหวตปัจจุบัน (ควรเป็น null หากเพิ่งโดน Reset)
  const savedVote = localStorage.getItem('audienceVote_teamIndex');
  myVote = (savedVote !== null) ? parseInt(savedVote, 10) : null;

  // 2. ตรวจสอบเงื่อนไขเวลา
  const now = Date.now();
  const isExpired = settings.openUntil && now >= settings.openUntil;

  // 3. การเลือกหน้าจอที่จะแสดงผล
  if (settings.isOpen && !isExpired) {
    // --- กรณี: เปิดโหวต ---
    if (myVote !== null) {
      showScreen('screen-voted');
      updateVotedScreen();
    } else {
      showScreen('screen-vote');
      if (typeof startCountdown === 'function') startCountdown();
    }
  } else {
    // --- กรณี: ปิดโหวต หรือ เวลาหมด ---
    if (typeof clearTimerInterval === 'function') clearTimerInterval();
    
    if (myVote !== null) {
      showScreen('screen-voted');
      updateVotedScreen();
    } else {
      showScreen('screen-closed');
      if (typeof updateClosedChart === 'function') updateClosedChart();
    }
  }

  // 4. อัปเดต UI อื่นๆ (ปุ่มทีม และ กราฟ)
  if (typeof renderTeams === 'function') renderTeams();
  if (typeof updateCharts === 'function') updateCharts();
}

/*RENDER TEAMS */
function renderTeams() {
  const grid = document.getElementById('teams-grid');
  if (!grid) return;

  // 1. เช็คว่ามีข้อมูลทีมหรือไม่
  if (!settings || !settings.teams || settings.teams.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--clr-text-muted);padding:32px">${t('noTeams')}</p>`;
    return;
  }

  const teams = settings.teams;
  // คำนวณคะแนนรวม (รองรับกรณี votes เป็นค่าว่างหลัง Reset)
  const totalVotes = Object.values(votes).reduce((a, v) => a + (Number(v?.count) || 0), 0);

  // 2. จัดการ Layout Class
  grid.className = 'teams-grid';
  if (teams.length === 1) grid.classList.add('single');
  else if (teams.length === 3) grid.classList.add('three');

  // 3. เตรียมข้อมูลลำดับ (Ranking)
  const ranked = teams.map((name, idx) => ({
    idx, 
    count: Number(votes[idx]?.count) || 0
  })).sort((a, b) => b.count - a.count);

  grid.innerHTML = '';
  
  teams.forEach((name, idx) => {
    const count = Number(votes[idx]?.count) || 0;
    const pct   = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const rank  = ranked.findIndex(r => r.idx === idx) + 1;
    const colorClass = `tc-${idx % 8}`;
    const emoji = getTeamEmoji(idx);
    
    // สถานะการโหวต
    const isVoted = myVote === idx;
    const isDisabled = myVote !== null || !settings.isOpen;

    const btn = document.createElement('button');
    btn.className = `team-btn ${colorClass} ${isVoted ? 'voted-this' : ''}`;
    btn.disabled = isDisabled;
    
    // ใส่ข้อมูลภายใน
    btn.innerHTML = `
      <span class="team-rank">#${rank}</span>
      <span class="team-emoji">${emoji}</span>
      <span class="team-name">${name}</span>
      <span class="team-score">${count}</span>
      <span class="team-pct">${pct}%</span>
    `;

    // Event Listeners
    btn.onclick = () => castVote(idx, name);
    
    // Animation
    btn.style.animationDelay = `${idx * 0.05}s`;
    
    grid.appendChild(btn);
  });

  // 5. อัปเดตยอดรวมคะแนน
  const totalEl = document.getElementById('total-votes-display');
  if (totalEl) {
    totalEl.textContent = t('totalVotes', totalVotes);
  }
}

function getTeamEmoji(idx) {
  const emojis = ['','','','','','','',''];
  return emojis[idx % emojis.length];
}

/* CAST VOTE */
async function castVote(teamIdx, teamName) {
  // 1. ป้องกันการโหวตซ้ำหรือโหวตตอนปิดระบบ
  if (myVote !== null || !settings?.isOpen) return;

  // 2. ล็อกปุ่มทั้งหมดทันทีเพื่อป้องกันการกดซ้ำ (UI UX)
  const allButtons = document.querySelectorAll('.team-btn');
  allButtons.forEach(btn => btn.disabled = true);

  const now = Date.now();

  // 3. ตรวจสอบเรื่องเวลาโหวตอีกครั้งก่อนส่งข้อมูล
  if (settings.openUntil && now >= settings.openUntil) {
    showToast(t('timeUp'), 'error');
    if (typeof handleSettingsChange === 'function') handleSettingsChange();
    return;
  }

  // 4. บันทึกสถานะลงเครื่องผู้ใช้ (Local)
  myVote = teamIdx;
  localStorage.setItem('audienceVote_teamIndex', teamIdx);
  
  // ⭐️ จุดสำคัญ: บันทึกเวลาที่โหวต เพื่อใช้เทียบกับ lastUpdated ของแอดมิน
  localStorage.setItem('audienceVote_timestamp', now); 

  const teamRef = db.collection('audience_votes').doc(teamIdx.toString());
  
  try {
    // 5. ส่งข้อมูลไปยัง Firebase
    // ใช้ Increment เพื่อความแม่นยำกรณีโหวตพร้อมกันจำนวนมาก
    teamRef.set({
      count: firebase.firestore.FieldValue.increment(1),
      teamName: teamName,
      lastVoteAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => {
        // กรณี Firebase ทำงานผิดพลาด: คืนสถานะให้ผู้ใช้กดใหม่ได้
        console.error("Firebase Vote Error:", err);
        myVote = null;
        localStorage.removeItem('audienceVote_teamIndex');
        localStorage.removeItem('audienceVote_timestamp'); // ล้างเวลาด้วย
        showToast("Error: " + err.message, "error");
        if (typeof renderTeams === 'function') renderTeams(); 
    });

    // 6. แจ้งเตือนผู้ใช้ (Feedback)
    // ใช้ String Template แทนหากฟังก์ชัน t() ไม่รองรับการแทนที่ค่า
    const voteMsg = typeof t === 'function' ? `${t('votedFor')} ${teamName}` : `Voted for ${teamName}`;
    showToast(voteMsg, 'success');
    
    // 7. หน่วงเวลาเล็กน้อยเพื่อให้เห็น Effect ก่อนเปลี่ยนหน้า
    setTimeout(() => {
      showScreen('screen-voted');
      if (typeof updateVotedScreen === 'function') updateVotedScreen();
    }, 700);

  } catch (error) {
    console.error("Critical Vote Error:", error);
    myVote = null;
    localStorage.removeItem('audienceVote_teamIndex');
    localStorage.removeItem('audienceVote_timestamp');
  }
}

/* VOTED SCREEN  */
function updateVotedScreen() {
  // 1. ตรวจสอบก่อนว่าเคยโหวตหรือยัง
  if (myVote === null) return;

  // 2. ดึงชื่อทีมจาก settings
  const teamName = (settings && settings.teams && settings.teams[myVote] !== undefined) 
                   ? settings.teams[myVote] 
                   : '—';
  
  // 3. ดึง Emoji ประจำทีมนั้นมาแสดงด้วย
  const emoji = getTeamEmoji(myVote);
  
  const confirmEl = document.getElementById('voted-confirm-text');
  if (confirmEl) {
    // แสดงผล: "คุณโหวตให้ทีม 🦊 ทีม A" (ตัวอย่าง)
    confirmEl.innerHTML = `<br> <span style="font-size: 1.5rem; font-weight: 800; color: var(--clr-accent);"> ${emoji} ${teamName} </span>`;
  }
}

/* --- CLOSED CHART --- */
function updateClosedChart() {
  const wrap = document.getElementById('closed-chart-wrap');
  const canvas = document.getElementById('preview-chart');
  
  // 1. ตรวจสอบความพร้อม
  if (!settings?.teams?.length || !canvas) return;
  
  // 2. เช็คว่ามีการโหวตเกิดขึ้นจริงไหม (ป้องกันกราฟว่างเปล่า)
  const hasVotes = Object.keys(votes).length > 0;
  
  if (!hasVotes) {
    if (wrap) wrap.classList.add('hidden');
    return;
  }

  // 3. แสดง Wrap ก่อนวาดกราฟ (สำคัญมาก: Canvas ต้อง Visible กราฟถึงจะวาดสวย)
  if (wrap) wrap.classList.remove('hidden');

  // 4. วาดกราฟโดยหน่วงเวลาเล็กน้อยเพื่อให้ Layout ของ Browser คำนวณเสร็จ
  setTimeout(() => {
    if (typeof renderChart === 'function') {
      renderChart(canvas, 'preview-chart');
    }
  }, 50);
}

/* CHARTS */
function getChartData() {
  const teams = settings?.teams || [];
  const labels = teams.map(n => n);
  const data = teams.map((_, i) => {
  const voteDoc = votes[i];
  return (voteDoc && voteDoc.count) ? Number(voteDoc.count) : 0;
  });

  const colors = teams.map((_, i) => TEAM_COLORS[i % TEAM_COLORS.length]);
  return { labels, data, colors };
}

// ฟังก์ชันสร้าง HTML สำหรับแท่งกราฟ
function createBarHTML(label, count, percentage, color) {
  return `
    <div class="chart-row">
      <div class="chart-info">
        <span class="chart-label">${label}</span>
        <span class="chart-value" style="color: ${color}">${count} ${t('votes')}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: ${percentage}%; background: ${color}; box-shadow: 0 0 10px ${color}44;"></div>
      </div>
    </div>
  `;
}

function updateCharts() {
  if (!settings?.teams?.length) return;

  const { labels, data, colors } = getChartData();
  const maxVotes = Math.max(...data, 1); // ป้องกันการหารด้วย 0
  const totalVotes = data.reduce((a, b) => a + b, 0);

  // อัปเดตตัวเลขยอดรวม
  const totalDisplay = document.getElementById('total-votes-display');
  if (totalDisplay) totalDisplay.textContent = totalVotes;

  // รายการ Container ที่ต้องการอัปเดต
  const containers = {
    'main-css-chart': document.getElementById('main-css-chart'),
    'voted-css-chart': document.getElementById('voted-css-chart'),
    'preview-css-chart': document.getElementById('preview-css-chart')
  };

  const chartHTML = labels.map((label, i) => {
    const count = data[i];
    const percentage = (count / maxVotes) * 100;
    return createBarHTML(label, count, percentage, colors[i]);
  }).join('');

  // อัปเดตเฉพาะตัวที่แสดงผลอยู่
  Object.values(containers).forEach(container => {
    if (container && container.offsetParent !== null) {
      container.innerHTML = chartHTML;
    }
  });
}
/* COUNTDOWN TIMER */
function startCountdown() {
  clearTimerInterval();
  
  const el = document.getElementById('timer-display');
  if (!el) return;

  // 1. ตรวจสอบว่ามีเวลาสิ้นสุดกำหนดไว้หรือไม่
  if (!settings?.openUntil) {
    el.textContent = '--:--';
    el.classList.remove('urgent');
    return;
  }

  // 2. แสดงผลครั้งแรกทันที (ป้องกันอาการเลขกระตุกตอนเริ่ม)
  updateTimerDisplay();

  // 3. เริ่มลูปนับถอยหลัง
  timerInterval = setInterval(() => {
    const remaining = settings.openUntil - Date.now();
    
    if (remaining <= 0) {
      // หยุดเวลา
      clearTimerInterval();
      el.textContent = '00:00';
      el.classList.add('urgent'); // แสดงสถานะหมดเวลาเป็นสีแดง
      
      // แจ้งเตือนและเปลี่ยนหน้า
      if (typeof showToast === 'function') showToast(t('timeUp'), 'info');
      
      // หน่วงเวลาเล็กน้อยเพื่อให้ผู้ใช้เห็น 00:00 ก่อนเด้งหน้าจอ
      setTimeout(() => {
        if (typeof handleSettingsChange === 'function') handleSettingsChange();
      }, 1500);
      return;
    }
    
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el || !settings?.openUntil) return;

  const remaining = Math.max(0, settings.openUntil - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  // ใช้ padStart เพื่อให้เป็น 00:00 เสมอ
  el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // การจัดการ Class แบบปลอดภัย (ไม่ทับ Class เดิม)
  if (remaining < 30000) { // ถ้าน้อยกว่า 30 วินาที
    el.classList.add('urgent');
  } else {
    el.classList.remove('urgent');
  }
}

function clearTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/* ADMIN PANEL */
function openAdmin() {
  const password = prompt("🔑 กรุณาใส่รหัสผ่านแอดมิน:");

  // ตรวจสอบรหัสผ่าน
  if (password === "Admin1234") {
    // ถ้ารหัสถูกต้อง ให้เปิดแผงควบคุม
    const overlay = document.getElementById('admin-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      // โหลดข้อมูลล่าสุดเข้าสู่ Input
      if (typeof renderAdminTeams === 'function') renderAdminTeams();
      showToast("🔐 เข้าสู่ระบบแอดมินแล้ว", "success");
    }
  } else if (password !== null) {
    // ถ้ารหัสผิด (และไม่ได้กด Cancel)
    showToast("❌ รหัสผ่านไม่ถูกต้อง!", "error");
  }
}

function closeAdmin() {
  const overlay = document.getElementById('admin-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (typeof updateCharts === 'function') updateCharts();
}

function closeAdminIfOutside(e) {
  if (e.target === document.getElementById('admin-overlay')) closeAdmin();
}

function renderAdminPanel() {
  const toggle = document.getElementById('vote-toggle');
  if (toggle) {
    toggle.checked = !!settings?.isOpen;
    updateVoteStatusLabel(toggle.checked);
  }
  const minDisplay = document.getElementById('minutes-display');
  if (minDisplay) minDisplay.textContent = adminMinutes;
  const container = document.getElementById('admin-teams-inputs');
  if (container && container.children.length === 0) { 
    // ให้ Render เฉพาะตอนที่ตู้คอนเทนเนอร์ว่างเปล่า (ตอนเปิดครั้งแรก)
    renderAdminTeamInputs();
  }
}

function renderAdminTeamInputs() {
  const container = document.getElementById('admin-teams-inputs');
  if (!container) return;
  container.innerHTML = '';
  const teams = (settings?.teams && settings.teams.length > 0) ? settings.teams : [''];
  
  teams.forEach((name, idx) => {
    container.appendChild(createTeamInputRow(idx + 1, name));
  });
  updateTeamCount();
}

function createTeamInputRow(num, val) {
  const row = document.createElement('div');
  row.className = 'input-item';
  row.innerHTML = `
    <span class="input-num">${num}</span>
    <input class="dynamic-input" type="text" value="${val}" placeholder="${t('addTeam')}..." />
    <button class="remove-btn" onclick="removeTeamRow(this)">×</button>
  `;
  return row;
}

// ฟังก์ชันเสริม: สั่ง Update ตัวหนังสือ Active/Inactive ทันทีที่สลับสวิตช์
document.getElementById('vote-toggle')?.addEventListener('change', (e) => {
  updateVoteStatusLabel(e.target.checked);
});

function addTeamInput() {
  const container = document.getElementById('admin-teams-inputs');
  const num = container.children.length + 1;
  container.appendChild(createTeamInputRow(num, ''));
  updateTeamCount();
  container.lastElementChild.querySelector('input').focus();
}

function removeTeamRow(btn) {
  btn.closest('.input-item').remove();
  // Renumber
  document.querySelectorAll('#admin-teams-inputs .input-num')
    .forEach((el, i) => el.textContent = i + 1);
  updateTeamCount();
}

function updateTeamCount() {
  const count = document.getElementById('admin-teams-inputs')?.children.length || 0;
  const el    = document.getElementById('team-count-label');
  if (el) el.innerHTML = `${count} <span data-i18n="teams2">${t('teams2')}</span>`;
}

function changeMinutes(delta) {
  adminMinutes = Math.max(1, Math.min(60, adminMinutes + delta));
  document.getElementById('minutes-display').textContent = adminMinutes;
}

function updateVoteStatusLabel(isOpen) {
  const el = document.getElementById('vote-status-label');
  if (el) el.textContent = isOpen ? t('active') : t('inactive');
}

async function toggleVoting(isOpen) {
    // 1. UI Feedback ทันทีเพื่อให้ Admin รู้ว่าระบบรับคำสั่งแล้ว
    updateVoteStatusLabel(isOpen);
    
    // 2. คำนวณเวลาสิ้นสุด
    // แนะนำ: ใช้ค่าจาก adminMinutes ที่แอดมินปรับในหน้าจอ
    const openUntil = isOpen ? Date.now() + (adminMinutes * 60 * 1000) : null;

    const docRef = db.collection('audience_config').doc('settings');

    try {
        // 3. ใช้ set แบบ merge: true เป็นหลัก เพื่อความกระชับของโค้ด 
        // (จัดการได้ทั้งกรณีมี doc แล้วหรือยังไม่มี)
        await docRef.set({
            isOpen: isOpen,
            openUntil: openUntil,
            minutes: adminMinutes,
            // เพิ่ม Timestamp เพื่อใช้อ้างอิงเวลาที่เซิร์ฟเวอร์
            lastToggleAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 4. แจ้งเตือนสถานะ
        const statusMsg = isOpen ? t('active') : t('inactive');
        showToast(`Voting is now ${statusMsg}`, 'info');

    } catch (e) {
        console.error("Toggle Voting Error:", e);
        showToast("Failed to update voting status", "error");
        
        // ถ้า Error ให้ดีดสวิตช์กลับ
        const toggle = document.getElementById('vote-toggle');
        if (toggle) toggle.checked = !isOpen;
        updateVoteStatusLabel(!isOpen);
    }
}

async function saveAdminSettings() {
    const saveBtn = document.querySelector('.admin-actions .save-btn'); // ตรวจสอบ Class ให้ตรงกับ HTML
    const inputs = document.querySelectorAll('#admin-teams-inputs .dynamic-input');
    
    // 1. ดึงชื่อทีมและกรองช่องว่าง (Validation)
    const teams = Array.from(inputs).map(i => i.value.trim()).filter(v => v);
    
    if (teams.length === 0) {
        showToast(t('noTeams'), 'error');
        return;
    }

    const isVoteOpen = document.getElementById('vote-toggle').checked;

    // 2. โลจิกจัดการเวลา (Time Management)
    let openUntil = null;
    if (isVoteOpen) {
        // หากแอดมินแค่แก้ชื่อทีมขณะโหวตอยู่ (settings.isOpen เป็น true อยู่แล้ว) ให้ใช้เวลาเดิม
        // แต่ถ้าเป็นการกด "เปิดโหวตใหม่" (จากเดิมปิดอยู่) ให้เริ่มนับเวลาใหม่ตามนาทีที่ตั้งไว้
        openUntil = (settings && settings.isOpen && settings.openUntil) 
                    ? settings.openUntil 
                    : Date.now() + (adminMinutes * 60 * 1000);
    }

    try {
        // ล็อกปุ่มป้องกันการกดซ้ำ (UI Feedback)
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '⌛...';
        }

        // 3. ตรวจสอบว่ามีการเปลี่ยนแปลงสำคัญที่ต้องล้างคะแนนหรือไม่
        // (เช่น เปลี่ยนชื่อทีม หรือเปิดโหวตรอบใหม่)
        const isTeamChanged = JSON.stringify(settings?.teams) !== JSON.stringify(teams);
        const isOpeningNewRound = isVoteOpen && !settings?.isOpen;

        if (isTeamChanged || isOpeningNewRound) {
            console.log("🔄 Important change detected. Resetting global votes...");
            await resetVotes(); // ฟังก์ชันล้างคะแนนใน Firebase ที่เราเขียนไว้
        }

        // 4. บันทึกข้อมูลลง Firestore
        await db.collection('audience_config').doc('settings').set({
            teams: teams,
            minutes: adminMinutes,
            isOpen: isVoteOpen,
            openUntil: openUntil,
            // ⭐️ หัวใจสำคัญ: ส่งเวลาที่บันทึกล่าสุดเพื่อให้เครื่องลูกเช็คและ Force Reset LocalStorage
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast(t('saved'), 'success');
        closeAdmin();

    } catch (error) {
        console.error("❌ Save Settings Error:", error);
        showToast("Error saving settings", "error");
    } finally {
        // คืนสถานะปุ่ม
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `💾 <span>${t('save')}</span>`;
        }
    }
}
async function resetVotes() {
    if (!confirm(t('resetConfirm'))) return;

    try {
        const batch = db.batch();

        // 1. ล้างคะแนนใน audience_votes (ลบข้อมูลโหวตเดิมทิ้ง)
        const voteSnap = await db.collection('audience_votes').get();
        voteSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. อัปเดต settings เพื่อปิดระบบและส่งสัญญาณ Reset
        const settingsRef = db.collection('audience_config').doc('settings');
        batch.update(settingsRef, {
            isOpen: false,
            openUntil: null,
            teams: [],    // ล้างรายชื่อทีม
            minutes: 5,   // รีเซ็ตนาทีพื้นฐาน
            // ⭐️ หัวใจสำคัญ: ส่งสัญญาณเวลาใหม่เพื่อให้เครื่องลูกตรวจพบการเปลี่ยนแปลง
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastReset: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ยืนยันการล้างข้อมูลทั้งหมดไปยัง Firebase
        await batch.commit();

        // 3. ล้าง Local State ในเครื่องแอดมินเอง
        localStorage.removeItem('audienceVote_teamIndex');
        localStorage.removeItem('audienceVote_timestamp'); // ล้างเวลาโหวตด้วย
        myVote = null;
        
        // ล้างหน้าจอ Input ใน Admin Panel ให้ว่างเปล่าทันที
        const container = document.getElementById('admin-teams-inputs');
        if (container) container.innerHTML = ''; 
        if (typeof updateTeamCount === 'function') updateTeamCount();

        showToast(t('resetDone'), 'info');
        closeAdmin();

        // 4. บังคับให้หน้าจอแอดมินเองกลับไปหน้าโหลดเพื่อ Sync ข้อมูลใหม่
        showScreen('screen-loading');
        setTimeout(() => {
            if (typeof handleSettingsChange === 'function') handleSettingsChange();
        }, 1000);

    } catch (error) {
        console.error("Reset Error:", error);
        showToast("Error resetting: " + error.message, "error");
    }
}

/* SCREEN MANAGEMENT */
function showScreen(id) {
  const screens = document.querySelectorAll('.screen');
  const targetEl = document.getElementById(id);
  
  if (!targetEl) {
    console.error(`Screen ID "${id}" not found.`);
    return;
  }

  // 1. ปิดหน้าจออื่นทั้งหมด
  screens.forEach(s => {
    s.classList.remove('active');
    // เพิ่มการจัดการเพื่อหยุดการทำงานบางอย่างในหน้าจอที่ถูกปิด (ถ้าจำเป็น)
  });

  // 2. เปิดหน้าจอเป้าหมาย
  targetEl.classList.add('active');

  // 3. การอัปเดตชาร์ต (Chart Update Logic)
  // เพิ่มเวลาเป็น 100ms เพื่อให้แน่ใจว่า Transition ของ CSS เริ่มทำงานและ Element มีตัวตนจริง
  setTimeout(() => {
    if (typeof updateCharts === 'function') {
      updateCharts();
    }
  }, 100);

  // 4. พิเศษ: ถ้าเป็นหน้า Admin ให้ Re-render ข้อมูลล่าสุดเสมอ
  if (id === 'admin-overlay' || targetEl.classList.contains('admin-panel')) {
    if (typeof renderAdminPanel === 'function') renderAdminPanel();
  }
}

/* TOAST */
let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast', 2800);
}

/*  INIT */
function init() {
  console.log("🚀 App Initializing...");

  // 1. ตั้งค่าภาษาเริ่มต้น (ทำก่อนเพื่อเลี่ยงภาษาพื้นฐานกะพริบ)
  try {
    // พยายามโหลดภาษาที่ผู้ใช้เคยเลือกไว้ (ถ้ามี)
    const savedLang = localStorage.getItem('audience_lang');
    if (savedLang) lang = savedLang;
    
    applyTranslations();
  } catch (e) {
    console.error('Translation init error:', e);
  }

  // 2. ตรวจสอบประวัติการโหวต
  try {
    const saved = localStorage.getItem('audienceVote_teamIndex');
    myVote = (saved !== null) ? parseInt(saved, 10) : null;
    if (myVote !== null) console.log("✅ Resume session: Voted for index", myVote);
  } catch (e) {
    myVote = null;
    console.warn("Could not access localStorage:", e);
  }

  // 3. เริ่มต้นระบบ Firebase
  // แนะนำ: แสดงหน้า Loading เบื้องต้น (ถ้ามี ID นี้ใน HTML)
  // showScreen('screen-loading'); 

  try {
    if (typeof initFirebase === 'function') {
      initFirebase();
    } else {
      throw new Error("initFirebase function not found");
    }
  } catch (e) {
    console.error('🔥 Firebase boot error:', e);
    showScreen('screen-closed');
    if (typeof showToast === 'function') {
        showToast("System unavailable. Please refresh.", "error");
    }
  }

  // 4. ติดตั้งระบบ Gesture (Swipe)
  if (typeof setupSwipe === 'function') {
    setupSwipe();
  }

  // 5. ปรับปรุง UX สำหรับ Mobile
  initMobileOptimizations();
  initTheme();
}

/** * รวมการตั้งค่าเฉพาะทางสำหรับมือถือ 
 */
function initMobileOptimizations() {
  // ป้องกันการ Zoom เมื่อแตะปุ่มรัวๆ บน iOS
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
  }, { passive: false });

  // ป้องกันการ "ลากหน้าจอลงเพื่อ Refresh" (Pull-to-refresh) 
  // ในหน้าโหวตเพื่อไม่ให้เสียจังหวะ (เลือกใช้ตามความเหมาะสม)
  // document.body.style.overscrollBehavior = 'contain';
}

/* SWIPE GESTURE บน voted screen */
function setupSwipe() {
  const votedScreen = document.getElementById('screen-voted');
  if (!votedScreen) return;

  let startX = 0;
  let startY = 0; // เพิ่มการเก็บค่าแนวตั้งเพื่อป้องกันการปัดมั่ว

  votedScreen.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].clientX;
    startY = e.changedTouches[0].clientY;
  }, { passive: true });

  votedScreen.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // เงื่อนไข: ปัดขวาเกิน 80px และไม่เป็นการปัดขึ้น/ลง (dy ต้องน้อยกว่า dx)
    // และระบบโหวตต้องยังเปิดอยู่
    if (dx > 80 && Math.abs(dy) < 50 && settings?.isOpen) {
      console.log("➡️ Swiped right: Returning to vote screen");
      showScreen('screen-vote');
    }
  }, { passive: true });
}

/* --- ENTRY POINT --- */
// ใช้ DOMContentLoaded เพื่อเริ่มระบบเมื่อโครงสร้าง HTML โหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
  console.log("🛠️ DOM Ready. Starting Audience Vote App...");
  init();
});

/* START */
document.addEventListener('DOMContentLoaded', init);


function goHome() {
  console.log("🏠 Going Home...");

  // 1. บังคับไปหน้า Loading ทันที (เพื่อให้ User รู้สึกว่าแอปกำลังอัปเดต)
  showScreen('screen-loading');

  // 2. หน่วงเวลาสั้นๆ เพื่อความเนียนของ UI
  setTimeout(() => {
    // 3. เรียกใช้ handleSettingsChange() ที่เราเขียนไว้ดีแล้ว 
    // ให้มันเป็นคนตัดสินใจเองว่า ณ เวลานั้น ควรจะไปหน้า Vote, Voted หรือ Closed
    if (typeof handleSettingsChange === 'function') {
      handleSettingsChange();
    }
  }, 500); // หน่วงไว้ครึ่งวินาที
}

/* TOGGLE THEME */
function toggleTheme() {
  const body = document.body;
  const icon = document.getElementById('theme-icon');
  
  // 1. สลับ Class .light-mode
  body.classList.toggle('light-mode');
  
  // 2. ตรวจสอบสถานะเพื่อเปลี่ยนไอคอนและบันทึกค่า
  const isLight = body.classList.contains('light-mode');
  if (icon) {
    icon.textContent = isLight ? '☀️' : '🌙';
    // เพิ่ม Effect การหมุน
    icon.parentElement.classList.remove('rotate-icon');
    void icon.offsetWidth; // Trigger reflow
    icon.parentElement.classList.add('rotate-icon');
  }

  localStorage.setItem('audience_theme', isLight ? 'light' : 'dark');
}

/* INIT THEME */
function initTheme() {
  const savedTheme = localStorage.getItem('audience_theme');
  const icon = document.getElementById('theme-icon');
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    if (icon) icon.textContent = '☀️';
  }
}
