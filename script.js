/*
  =====================================================================
  과일 판매 게임 - MVP 프로토타입 스크립트
  파이썬에 익숙하신 분을 위한 비교 주석을 함께 달았습니다.
  =====================================================================
*/

// ----------------------------------------------------------------
// 1. 게임 상태(State) 정의
//    파이썬의 딕셔너리(dict)와 비슷하게, 객체 리터럴({})로 상태를 관리합니다.
//    예: 파이썬 -> state = {"gold": 0, "apples": 0, ...}
// ----------------------------------------------------------------
const state = {
  gold: 0,              // 보유 골드
  apples: 0,            // 아직 진열대에 올리지 않은 보유 사과(인벤토리)
  standApples: 0,       // 진열대에 올라간 사과 수
  standCapacity: 5,     // 진열대 최대 용량 (초기값)
  hasAutoHarvester: false, // 자동 수확기 구매 여부
  hasStandUpgrade: false,  // 진열대 확장 구매 여부
};

// ----------------------------------------------------------------
// 2. HTML 요소 가져오기 (DOM 참조)
//    JS의 document.getElementById()는 파이썬 GUI 라이브러리(tkinter 등)의
//    위젯 객체를 미리 변수에 담아두는 것과 비슷한 개념입니다.
// ----------------------------------------------------------------
const goldDisplay = document.getElementById("goldDisplay");
const appleDisplay = document.getElementById("appleDisplay");
const standDisplay = document.getElementById("standDisplay");

const harvestBtn = document.getElementById("harvestBtn");
const displayOneBtn = document.getElementById("displayOneBtn");
const displayAllBtn = document.getElementById("displayAllBtn");
const upgradeHarvesterBtn = document.getElementById("upgradeHarvesterBtn");
const upgradeStandBtn = document.getElementById("upgradeStandBtn");

const logBox = document.getElementById("log");

// ----------------------------------------------------------------
// 3. 로그 출력 함수
//    파이썬의 print()와 비슷하지만, 화면(HTML)에 직접 줄을 추가합니다.
// ----------------------------------------------------------------
function addLog(message) {
  const entry = document.createElement("div");
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logBox.prepend(entry); // 최신 로그가 위로 오도록 맨 앞에 삽입
}

// ----------------------------------------------------------------
// 4. 화면 갱신 함수 (렌더링)
//    state 값이 바뀔 때마다 이 함수를 호출해서 화면 텍스트를 동기화합니다.
//    파이썬으로 치면 매번 print(state)를 다시 하는 대신,
//    화면의 특정 텍스트만 갱신하는 것과 같습니다.
// ----------------------------------------------------------------
function updateUI() {
  goldDisplay.textContent = state.gold;
  appleDisplay.textContent = state.apples;
  standDisplay.textContent = `${state.standApples} / ${state.standCapacity}`;

  // 진열대가 가득 찼으면 '진열대에 올리기' 버튼 비활성화
  const standFull = state.standApples >= state.standCapacity;
  displayOneBtn.disabled = standFull || state.apples <= 0;
  displayAllBtn.disabled = standFull || state.apples <= 0;

  // 업그레이드 버튼: 골드 부족하거나 이미 구매했으면 비활성화
  upgradeHarvesterBtn.disabled = state.hasAutoHarvester || state.gold < 50;
  upgradeHarvesterBtn.textContent = state.hasAutoHarvester
    ? "구매 완료 ✅"
    : "구매 (50 골드)";

  upgradeStandBtn.disabled = state.hasStandUpgrade || state.gold < 100;
  upgradeStandBtn.textContent = state.hasStandUpgrade
    ? "구매 완료 ✅"
    : "구매 (100 골드)";
}

// ----------------------------------------------------------------
// 5. 핵심 기능 함수들
// ----------------------------------------------------------------

// [요구사항 1] 사과 수확 버튼 -> 보유량 +1
function harvestApple() {
  state.apples += 1;
  updateUI();
}

// [요구사항 2] 보유 사과를 진열대로 이동 (1개씩)
function moveOneToDisplay() {
  if (state.apples > 0 && state.standApples < state.standCapacity) {
    state.apples -= 1;
    state.standApples += 1;
    updateUI();
  }
}

// 보유 사과를 진열대 여유 공간만큼 한 번에 이동 (편의 기능)
function moveAllToDisplay() {
  // 파이썬의 min() 함수와 동일한 역할을 하는 Math.min()
  const space = state.standCapacity - state.standApples;
  const moveCount = Math.min(space, state.apples);

  if (moveCount > 0) {
    state.apples -= moveCount;
    state.standApples += moveCount;
    addLog(`사과 ${moveCount}개를 진열대에 올렸습니다.`);
    updateUI();
  }
}

// [요구사항 2] 손님(NPC) 방문 -> 진열대 사과 구매, 1개당 10골드
function customerVisit() {
  if (state.standApples <= 0) {
    addLog("손님이 방문했지만 진열대가 비어있어 그냥 돌아갔습니다.");
    return;
  }

  // 손님은 진열대에 있는 수량 내에서 1~3개를 무작위로 구매
  // 파이썬의 random.randint(1, 3)과 동일한 로직
  const wantToBuy = Math.floor(Math.random() * 3) + 1;
  const actualBuy = Math.min(wantToBuy, state.standApples);

  const earnedGold = actualBuy * 10;
  state.standApples -= actualBuy;
  state.gold += earnedGold;

  addLog(`손님이 방문해서 사과 ${actualBuy}개를 구매했습니다. (+${earnedGold} 골드)`);
  updateUI();
}

// [요구사항 3] 업그레이드 1: 자동 수확기 구매
function buyAutoHarvester() {
  if (state.hasAutoHarvester || state.gold < 50) return;

  state.gold -= 50;
  state.hasAutoHarvester = true;
  addLog("자동 수확기를 구매했습니다! 이제 1초마다 사과가 자동 생산됩니다.");

  // setInterval: 파이썬의 while True + time.sleep(1) 반복문과 비슷하게
  // "일정 시간마다 반복 실행"하는 브라우저 타이머 함수입니다.
  setInterval(() => {
    state.apples += 1;
    updateUI();
  }, 1000); // 1000ms = 1초

  updateUI();
}

// [요구사항 3] 업그레이드 2: 진열대 확장 구매
function buyStandUpgrade() {
  if (state.hasStandUpgrade || state.gold < 100) return;

  state.gold -= 100;
  state.hasStandUpgrade = true;
  state.standCapacity += 10; // 용량 증가
  addLog("진열대를 확장했습니다! 최대 용량이 10 늘어났습니다.");

  updateUI();
}

// ----------------------------------------------------------------
// 6. 이벤트 리스너 등록 (버튼 클릭 -> 함수 실행 연결)
// ----------------------------------------------------------------
harvestBtn.addEventListener("click", harvestApple);
displayOneBtn.addEventListener("click", moveOneToDisplay);
displayAllBtn.addEventListener("click", moveAllToDisplay);
upgradeHarvesterBtn.addEventListener("click", buyAutoHarvester);
upgradeStandBtn.addEventListener("click", buyStandUpgrade);

// ----------------------------------------------------------------
// 7. 손님 방문 타이머 시작 (3~6초 사이 무작위 주기로 반복 방문)
//    setInterval 대신 setTimeout을 재귀 호출해서 "매번 다른 주기"를 구현합니다.
// ----------------------------------------------------------------
function scheduleNextCustomer() {
  const nextVisitDelay = Math.floor(Math.random() * 3000) + 3000; // 3000~6000ms
  setTimeout(() => {
    customerVisit();
    scheduleNextCustomer(); // 자기 자신을 다시 예약 (재귀)
  }, nextVisitDelay);
}

// ----------------------------------------------------------------
// 8. 게임 시작
// ----------------------------------------------------------------
addLog("게임을 시작합니다. 사과를 수확해서 진열대에 올려보세요!");
updateUI();
scheduleNextCustomer();