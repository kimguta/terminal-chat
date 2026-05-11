const terminalEl = document.querySelector("#terminal");
const messagesEl = document.querySelector("#messages");
const keyboardEl = document.querySelector("#keyboardCapture");
const resetButton = document.querySelector("#resetButton");

const DEFAULT_BOOT_STATUS = {
  server: "LOCAL",
  model: "OFFLINE",
  api: "LOCAL FALLBACK",
};

const fallbackReplies = [
  "음, 그 말은 일단 웃긴 쪽 서랍에 넣어둘게. 서랍이 좀 삐걱대긴 하는데.",
  "그럴 수 있지. 인생이 원래 가끔 저장 안 한 메모장 같잖아.",
  "좋아, 지금 대화 난이도는 컵라면 물 붓기 정도야. 근데 은근 실패하는 사람 있더라.",
  "그건 커피 한 모금 마시고 생각하면 좀 있어 보일 것 같아. 실제로 해결되진 않고.",
  "오, 방금 말은 냉장고 자석에 붙여도 될 만큼 애매하게 멋있다.",
  "일단 박수 한 번. 짝. 예산 문제로 한 번만 가능.",
  "대충 아무렇지 않은 척하면 반은 해결된 것처럼 보이더라. 인간 사회 편하지?",
  "그 얘기 듣고 3초 생각했는데, 2초는 폼이었어.",
];

const keywordReplies = [
  {
    words: ["안녕", "ㅎㅇ", "하이", "hello"],
    replies: ["왔냐. 손 흔드는 기능은 없어서 말로 때운다.", "하이. 오늘도 쓸데없는 얘기 할 준비는 됐다."],
  },
  {
    words: ["심심", "지루"],
    replies: [
      "심심하면 아무 말 대회 열자. 참가자 둘, 상품 없음. 꽤 공정하지?",
      "심심함은 뇌가 과자 찾는 소리야. 일단 물이라도 마셔, 대단한 처방인 척은 안 할게.",
    ],
  },
  {
    words: ["배고", "밥", "라면", "치킨"],
    replies: ["배고프면 일단 먹어. 철학으로 위장 채우는 기술은 아직 업데이트 안 됐어.", "라면은 질문이 아니라 방향이지. 냄비가 동의하면 시작해."],
  },
  {
    words: ["힘들", "피곤", "졸려"],
    replies: [
      "피곤하면 쉬어. 배터리 3퍼센트로 멋있는 척하면 발열만 나.",
      "오늘은 살아남은 것만으로도 출석 인정이야. 박수는 셀프로 쳐.",
    ],
  },
  {
    words: ["웃겨", "농담", "개그"],
    replies: [
      "농담? 내가 방금 엄청난 걸 준비했는데 너무 가벼워서 날아갔어.",
      "개그는 타이밍인데, 내 타이밍은 가끔 버스 놓친 사람 같아.",
    ],
  },
];

const history = [];
let isTyping = false;
let inputLineEl = null;
let inputTextEl = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldCaptureKey(event) {
  if (isTyping || !inputLineEl) return false;
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  if (event.target === resetButton) return false;

  const tagName = event.target?.tagName?.toLowerCase();
  if (tagName === "input" || tagName === "textarea") {
    return event.target === keyboardEl;
  }

  return event.key.length === 1 || event.key === "Backspace" || event.key === "Enter";
}

function focusKeyboard() {
  if (!isTyping) {
    keyboardEl.focus({ preventScroll: true });
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createMessage(role) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  messagesEl.append(message);
  scrollToBottom();
  return message;
}

function addMessage(text, role) {
  const message = createMessage(role);
  message.textContent = text;
  return message;
}

function createInputLine() {
  inputLineEl = document.createElement("div");
  inputLineEl.className = "input-line active";
  inputTextEl = document.createElement("span");
  inputLineEl.append(inputTextEl);
  messagesEl.append(inputLineEl);
  keyboardEl.value = "";
  scrollToBottom();
  focusKeyboard();
}

function removeInputLine() {
  inputLineEl?.remove();
  inputLineEl = null;
  inputTextEl = null;
}

function syncInputLine() {
  if (!inputTextEl) return;
  inputTextEl.textContent = keyboardEl.value.replace(/\r?\n/g, "");
  scrollToBottom();
}

async function getBootMessage() {
  const now = new Date().toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  try {
    const status = await fetchStatusWithRetry();

    return buildBootMessage({
      server: status.server || DEFAULT_BOOT_STATUS.server,
      model: status.model || DEFAULT_BOOT_STATUS.model,
      api: status.api || DEFAULT_BOOT_STATUS.api,
      now,
    });
  } catch {
    return buildBootMessage({ ...DEFAULT_BOOT_STATUS, now });
  }
}

async function fetchStatusWithRetry() {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Status unavailable");
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(350);
    }
  }

  throw lastError;
}

function buildBootMessage(status) {
  return [
    "C:\\CHAT> INIT",
    `TIME ${status.now}`,
    `SERVER ${status.server}`,
    `MODEL ${status.model}`,
    `API ${status.api}`,
    "TYPE AND PRESS ENTER",
    "대화 입력 가능",
  ].join("\n");
}

async function typeMessage(text, role, pace = "normal") {
  const message = createMessage(role);
  message.classList.add("typing");

  for (const char of text) {
    message.textContent += char;
    scrollToBottom();

    if (pace === "boot") {
      await sleep(char === "\n" ? 55 : 8 + Math.random() * 10);
    } else if (char === "\n") {
      await sleep(160);
    } else if (/[.?!。！？]/.test(char)) {
      await sleep(120);
    } else {
      await sleep(34 + Math.random() * 34);
    }
  }

  await sleep(180);
  message.classList.remove("typing");
  return message;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createLocalReply(userText) {
  const normalized = userText.trim().toLowerCase();
  const matched = keywordReplies.find((group) =>
    group.words.some((word) => normalized.includes(word)),
  );

  if (matched) {
    return pickRandom(matched.replies);
  }

  if (normalized.endsWith("?") || normalized.endsWith("？")) {
    return "질문이군. 답은 아마 '그때그때 다름'인데, 이러면 좀 얄밉지?";
  }

  if (normalized.length < 4) {
    return "짧네. 압축률 좋다.";
  }

  return pickRandom(fallbackReplies);
}

async function getBotReply(userText) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userText,
        history: history.slice(-8),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return createServiceErrorReply(response.status, errorData);
    }

    const data = await response.json();
    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("Empty AI reply");
    }

    return data.reply.trim();
  } catch {
    return "지금 연결이 좀 꼬였어. 헛소리로 때우면 또 들킬 테니까, 잠깐 있다가 다시 해.";
  }
}

function createServiceErrorReply(status, errorData) {
  if (status === 429 || errorData.error === "RATE_LIMITED") {
    return createLocalReply("");
  }

  if (status === 503) {
    return createLocalReply("");
  }

  return createLocalReply("");
}

async function submitCurrentLine() {
  const userText = keyboardEl.value.trim();
  if (!userText || isTyping) return;

  keyboardEl.value = "";
  removeInputLine();
  addMessage(userText, "user");
  history.push({ role: "user", content: userText });

  isTyping = true;
  keyboardEl.blur();

  const reply = await getBotReply(userText);
  await typeMessage(reply, "bot");
  history.push({ role: "bot", content: reply });

  isTyping = false;
  createInputLine();
}

async function resetChat() {
  history.length = 0;
  messagesEl.innerHTML = "";
  keyboardEl.value = "";
  isTyping = true;
  keyboardEl.blur();
  await typeMessage(await getBootMessage(), "bot", "boot");
  isTyping = false;
  createInputLine();
}

keyboardEl.addEventListener("input", syncInputLine);

keyboardEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitCurrentLine();
  }
});

document.addEventListener(
  "keydown",
  (event) => {
    if (!shouldCaptureKey(event) || document.activeElement === keyboardEl) return;

    event.preventDefault();
    focusKeyboard();

    if (event.key === "Enter") {
      submitCurrentLine();
      return;
    }

    if (event.key === "Backspace") {
      keyboardEl.value = keyboardEl.value.slice(0, -1);
    } else {
      keyboardEl.value += event.key;
    }

    syncInputLine();
  },
  true,
);

window.addEventListener("focus", focusKeyboard);

terminalEl.addEventListener("pointerdown", (event) => {
  if (event.target !== resetButton) {
    focusKeyboard();
  }
});

terminalEl.addEventListener(
  "wheel",
  (event) => {
    messagesEl.scrollTop += event.deltaY;
    event.preventDefault();
  },
  { passive: false },
);

resetButton.addEventListener("click", resetChat);

resetChat();
