/* =========================================================
   과일가게 경영 게임 - MVP
   코어 루프: 도매 구매 -> 진열/가격설정 -> 손님 방문 판매 -> 신선도 하락/폐기
   ========================================================= */

/* ---------- 1. 게임 상수 ---------- */

// 판매하는 과일 목록 (도매가 = 사올 때 가격, fairPrice = 손님이 생각하는 적정 판매가)
const FRUITS = [
  { id: "apple",  name: "사과",   emoji: "🍎", wholesalePrice: 800,  fairPrice: 1500 },
  { id: "banana", name: "바나나", emoji: "🍌", wholesalePrice: 500,  fairPrice: 1000 },
  { id: "orange", name: "오렌지", emoji: "🍊", wholesalePrice: 700,  fairPrice: 1300 },
];

const STORAGE_KEY = "fruitShopGameState";
const FRESHNESS_STAGES = [100, 70, 40, 0]; // 신선도는 이 순서대로 하루씩 내려감
const START_MONEY = 100000;
const VISIT_MIN_MS = 1800; // 손님 방문 최소 간격
const VISIT_MAX_MS = 3400; // 손님 방문 최대 간격

/* ---------- 2. 게임 상태(state) ---------- */

// 과일 하나의 기본 상태를 만들어주는 함수
function createDefaultFruitState(fruit) {
  return {
    stock: 0,           // 창고 재고 (아직 진열 안 한 것)
    shelf: 0,           // 진열대에 올려서 판매 중인 수량
    freshness: 100,     // 신선도 %
    price: fruit.fairPrice, // 판매가 (기본값 = 적정가)
  };
}

// 게임 전체 기본 상태
function createDefaultState() {
  const fruitsState = {};
  FRUITS.forEach((fruit) => {
    fruitsState[fruit.id] = createDefaultFruitState(fruit);
  });

  return {
    money: START_MONEY,
    day: 1,
    todayStats: { revenue: 0, sold: 0, visitors: 0 },
    fruits: fruitsState,
  };
}

let state = createDefaultState();
let isOpen = false;      // 지금 영업 중인지 여부 (새로고침 시 저장 안 함)
let visitTimerId = null; // 손님 방문 예약용 타이머 id

/* ---------- 3. localStorage 저장 / 불러오기 ---------- */

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = createDefaultState();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    // 혹시 저장된 데이터에 새 과일 항목이 없으면 기본값으로 채워줌
    FRUITS.forEach((fruit) => {
      if (!parsed.fruits[fruit.id]) {
        parsed.fruits[fruit.id] = createDefaultFruitState(fruit);
      }
    });
    state = parsed;
  } catch (e) {
    console.error("저장된 데이터를 불러오는 중 오류가 발생했습니다.", e);
    state = createDefaultState();
  }
}

function resetGame() {
  const ok = confirm("정말 초기화할까요? 지금까지의 진행 상황이 모두 사라집니다.");
  if (!ok) return;

  localStorage.removeItem(STORAGE_KEY);
  state = createDefaultState();
  stopBusiness();
  document.getElementById("salesLog").innerHTML = "";
  renderAll();
  showToast("게임이 초기 상태로 리셋되었습니다.");
}

/* ---------- 4. 화면 렌더링 ---------- */

function formatMoney(n) {
  return n.toLocaleString("ko-KR") + "원";
}

function getFreshnessInfo(freshness) {
  if (freshness >= 100) return { label: "싱싱해요", color: "#4C8C3F" };
  if (freshness >= 70) return { label: "괜찮아요", color: "#F2C14E" };
  if (freshness >= 40) return { label: "시들해요", color: "#E08E27" };
  return { label: "폐기됨", color: "#D64541" };
}

function renderTopBar() {
  document.getElementById("dayDisplay").textContent = state.day;
  document.getElementById("moneyDisplay").textContent = formatMoney(state.money);

  document.getElementById("visitorCount").textContent = state.todayStats.visitors + "명";
  document.getElementById("soldCount").textContent = state.todayStats.sold + "개";
  document.getElementById("revenueCount").textContent = formatMoney(state.todayStats.revenue);
}

// 좌측 도매 시장 목록 그리기
function renderMarket() {
  const container = document.getElementById("marketList");
  container.innerHTML = FRUITS.map((fruit) => {
    const data = state.fruits[fruit.id];
    return `
      <div class="fruit-card" data-fruit="${fruit.id}">
        <div class="fruit-icon">${fruit.emoji}</div>
        <div class="fruit-info">
          <h3>${fruit.name}</h3>
          <p>도매가: <strong>${fruit.wholesalePrice.toLocaleString()}원</strong> / 개</p>
          <p>창고 재고: <strong>${data.stock}개</strong></p>
        </div>
        <div class="fruit-actions">
          <div class="action-row">
            <input type="number" class="qty-input buy-qty" min="1" value="1">
            <button class="btn-buy" data-action="buy" data-fruit="${fruit.id}">구매</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// 중앙 진열대 목록 그리기
function renderShelf() {
  const container = document.getElementById("shelfList");
  container.innerHTML = FRUITS.map((fruit) => {
    const data = state.fruits[fruit.id];
    const fresh = getFreshnessInfo(data.freshness);
    return `
      <div class="fruit-card shelf-card" data-fruit="${fruit.id}">
        <div class="fruit-icon">${fruit.emoji}</div>
        <div class="fruit-info">
          <h3>${fruit.name}</h3>
          <p>창고 ${data.stock}개 → 진열 <strong>${data.shelf}개</strong></p>
          <p><span class="freshness-badge" style="background:${fresh.color}">${data.freshness}% ${fresh.label}</span></p>
          <p class="fair-price-hint">손님 적정가 참고: 약 ${fruit.fairPrice.toLocaleString()}원</p>
        </div>
        <div class="fruit-actions">
          <div class="action-row">
            <input type="number" class="qty-input shelf-qty" min="1" value="1">
            <button class="btn-shelf" data-action="shelf" data-fruit="${fruit.id}">진열</button>
          </div>
          <div class="action-row">
            <label style="font-size:0.8rem;">판매가</label>
            <input type="number" class="price-input" data-action="price" data-fruit="${fruit.id}" value="${data.price}" min="0" step="50">
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  renderTopBar();
  renderMarket();
  renderShelf();
}

/* ---------- 5. 로그 & 토스트 ---------- */

function addLog(message, type = "") {
  const log = document.getElementById("salesLog");
  const entry = document.createElement("div");
  entry.className = "log-entry" + (type ? " log-" + type : "");
  entry.textContent = message;
  log.prepend(entry); // 최신 로그가 위로 오도록

  // 로그가 너무 길어지지 않도록 최근 60개만 유지
  while (log.children.length > 60) {
    log.removeChild(log.lastChild);
  }
}

let toastTimerId = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimerId);
  toastTimerId = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2000);
}

/* ---------- 6. 도매 구매 / 진열 / 가격 설정 ---------- */

function buyFruit(fruitId, qty) {
  const fruit = FRUITS.find((f) => f.id === fruitId);
  const data = state.fruits[fruitId];

  if (!qty || qty <= 0) {
    showToast("구매 수량을 1개 이상 입력해주세요.");
    return;
  }

  const cost = fruit.wholesalePrice * qty;
  if (state.money < cost) {
    showToast("소지금이 부족합니다!");
    return;
  }

  state.money -= cost;
  data.stock += qty;
  data.freshness = 100; // 새로 들여온 싱싱한 과일이 섞이며 신선도가 갱신됨

  saveState();
  renderAll();
  showToast(`${fruit.name} ${qty}개를 ${cost.toLocaleString()}원에 구매했습니다.`);
}

function moveToShelf(fruitId, qty) {
  const fruit = FRUITS.find((f) => f.id === fruitId);
  const data = state.fruits[fruitId];

  if (!qty || qty <= 0) {
    showToast("진열 수량을 1개 이상 입력해주세요.");
    return;
  }
  if (qty > data.stock) {
    showToast("창고 재고보다 많이 진열할 수 없습니다.");
    return;
  }

  data.stock -= qty;
  data.shelf += qty;

  saveState();
  renderAll();
  showToast(`${fruit.name} ${qty}개를 진열대에 올렸습니다.`);
}

function updatePrice(fruitId, value) {
  let price = parseInt(value, 10);
  if (isNaN(price) || price < 0) price = 0;
  state.fruits[fruitId].price = price;
  saveState();
}

/* ---------- 7. 손님 NPC 방문 로직 ---------- */

function scheduleNextVisit() {
  if (!isOpen) return;
  const delay = Math.random() * (VISIT_MAX_MS - VISIT_MIN_MS) + VISIT_MIN_MS;
  visitTimerId = setTimeout(customerVisit, delay);
}

function customerVisit() {
  if (!isOpen) return;

  // 진열되어 있고(shelf > 0) 신선도가 0이 아닌 과일들만 손님이 구경할 수 있음
  const available = FRUITS.filter((fruit) => {
    const data = state.fruits[fruit.id];
    return data.shelf > 0 && data.freshness > 0;
  });

  if (available.length === 0) {
    // 살 게 없으면 손님이 오지 않은 걸로 치고 다음 방문만 예약
    scheduleNextVisit();
    return;
  }

  const fruit = available[Math.floor(Math.random() * available.length)];
  const data = state.fruits[fruit.id];

  state.todayStats.visitors += 1;

  // 가격 대비 적정가 비율로 구매 확률 계산
  const ratio = data.price / fruit.fairPrice;
  let baseChance;
  if (ratio <= 0.8) baseChance = 0.95;
  else if (ratio <= 1.0) baseChance = 0.85;
  else if (ratio <= 1.2) baseChance = 0.55;
  else if (ratio <= 1.5) baseChance = 0.25;
  else baseChance = 0.05;

  // 신선도가 낮을수록 구매 확률이 더 떨어짐
  const freshnessFactor = 0.5 + 0.5 * (data.freshness / 100);
  const finalChance = baseChance * freshnessFactor;

  const willBuy = Math.random() < finalChance;

  if (willBuy) {
    const qty = Math.min(data.shelf, Math.floor(Math.random() * 3) + 1);
    const revenue = qty * data.price;

    data.shelf -= qty;
    state.money += revenue;
    state.todayStats.revenue += revenue;
    state.todayStats.sold += qty;

    addLog(`${fruit.emoji} 손님이 ${fruit.name} ${qty}개를 ${revenue.toLocaleString()}원에 구매했습니다.`, "success");
  } else {
    let reason = "가격을 보고 고민하다 그냥 지나갔습니다.";
    if (ratio > 1.2) reason = "가격이 너무 비싸다며 지나갔습니다.";
    else if (data.freshness <= 40) reason = "신선도가 별로라며 지나갔습니다.";

    addLog(`${fruit.emoji} 손님이 ${fruit.name} 앞에서 ${reason}`, "fail");
  }

  saveState();
  renderAll();
  scheduleNextVisit();
}

function startBusiness() {
  if (isOpen) return;
  isOpen = true;

  document.getElementById("startBtn").textContent = "🟢 영업 중...";
  document.getElementById("startBtn").disabled = true;

  addLog(`Day ${state.day} 영업을 시작합니다.`, "day");
  scheduleNextVisit();
}

function stopBusiness() {
  isOpen = false;
  clearTimeout(visitTimerId);
  document.getElementById("startBtn").textContent = "🔔 영업 시작";
  document.getElementById("startBtn").disabled = false;
}

/* ---------- 8. 다음 날 (정산 + 신선도 하락) ---------- */

function nextDay() {
  // 영업 중이었다면 정리하고 마감
  if (isOpen) {
    stopBusiness();
  }

  addLog(
    `── Day ${state.day} 마감: 매출 ${state.todayStats.revenue.toLocaleString()}원 / 판매 ${state.todayStats.sold}개 / 방문 ${state.todayStats.visitors}명 ──`,
    "day"
  );

  // 각 과일의 신선도를 한 단계씩 낮춤
  FRUITS.forEach((fruit) => {
    const data = state.fruits[fruit.id];
    const hasStock = data.stock > 0 || data.shelf > 0;
    if (!hasStock) return;

    const currentIndex = FRESHNESS_STAGES.indexOf(data.freshness);
    const nextIndex = Math.min(currentIndex + 1, FRESHNESS_STAGES.length - 1);
    data.freshness = FRESHNESS_STAGES[nextIndex];

    if (data.freshness === 0) {
      const discarded = data.stock + data.shelf;
      data.stock = 0;
      data.shelf = 0;
      if (discarded > 0) {
        addLog(`${fruit.emoji} ${fruit.name} 재고 ${discarded}개가 신선도 0%로 폐기되었습니다.`, "discard");
      }
    }
  });

  state.day += 1;
  state.todayStats = { revenue: 0, sold: 0, visitors: 0 };

  saveState();
  renderAll();
  showToast(`Day ${state.day}이(가) 시작되었습니다.`);
}

/* ---------- 9. 이벤트 연결 ---------- */

function attachEvents() {
  document.getElementById("startBtn").addEventListener("click", startBusiness);
  document.getElementById("nextDayBtn").addEventListener("click", nextDay);
  document.getElementById("resetBtn").addEventListener("click", resetGame);

  // 도매 시장: 구매 버튼 (이벤트 위임)
  document.getElementById("marketList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='buy']");
    if (!btn) return;

    const fruitId = btn.dataset.fruit;
    const card = btn.closest(".fruit-card");
    const qty = parseInt(card.querySelector(".buy-qty").value, 10);
    buyFruit(fruitId, qty);
  });

  // 진열대: 진열 버튼 + 가격 입력 (이벤트 위임)
  document.getElementById("shelfList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='shelf']");
    if (!btn) return;

    const fruitId = btn.dataset.fruit;
    const card = btn.closest(".fruit-card");
    const qty = parseInt(card.querySelector(".shelf-qty").value, 10);
    moveToShelf(fruitId, qty);
  });

  document.getElementById("shelfList").addEventListener("change", (e) => {
    const input = e.target.closest("[data-action='price']");
    if (!input) return;
    updatePrice(input.dataset.fruit, input.value);
  });
}

/* ---------- 10. 초기 실행 ---------- */

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  attachEvents();
  renderAll();
});