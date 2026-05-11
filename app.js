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
  "그 말은 일단 저장했습니다. 어디 저장했는지는 저도 모릅니다.",
  "음. 그럴 수 있습니다.",
  "지금 약간 오래된 모니터 뒤쪽 냄새 나는 대화네요.",
  "그건 커피 한 모금 마시고 다시 생각해야 합니다.",
  "명언 같기도 하고, 냉장고 메모 같기도 합니다.",
  "짝.",
  "아무렇지 않은 척하면 대체로 해결된 것처럼 보입니다.",
  "찬성합니다. 이유는 아직 디스크 읽는 중입니다.",
];

const keywordReplies = [
  {
    words: ["안녕", "ㅎㅇ", "하이", "hello"],
    replies: ["안녕.", "접속됨. 무슨 얘기든 해보세요."],
  },
  {
    words: ["심심", "지루"],
    replies: [
      "심심함은 고장난 게 아니라 대기 상태입니다.",
      "그럼 아무 말 대회 시작. 참가자는 둘뿐입니다.",
    ],
  },
  {
    words: ["배고", "밥", "라면", "치킨"],
    replies: ["일단 뭐라도 드세요.", "라면은 질문이 아니라 방향입니다."],
  },
  {
    words: ["힘들", "피곤", "졸려"],
    replies: [
      "오늘은 살아남은 것만으로도 통과입니다.",
      "잠깐 쉬세요. 배터리 3퍼센트로 계속 돌리면 발열 납니다.",
    ],
  },
  {
    words: ["웃겨", "농담", "개그"],
    replies: [
      "농담 준비했는데 플로피에 두고 왔습니다.",
      "타이밍이 생명인데 저는 시계 배터리가 약합니다.",
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
    return "질문으로 인식했습니다. 답은 아마 '그때그때 다름'입니다.";
  }

  if (normalized.length < 4) {
    return "짧군요. 좋습니다.";
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
    return pickRandom([
      "지금은 머리가 좀 멈췄어. 아무 말이나 하라면 할 수는 있는데, 그럼 너 또 뭐라 할 거잖아.",
      "잠깐 버벅이는 중. 대단한 척하려다 걸리느니 그냥 모른다고 할게.",
      "지금은 답이 잘 안 나와. 뭐, 나도 가끔 이래. 사람도 아닌데 피곤한 척은 잘하지.",
      "그건 지금 제대로 못 하겠다. 되는 척하고 아무 말 뱉는 건 좀 없어 보이잖아.",
    ]);
  }

  if (status === 503) {
    return "API 키를 못 찾고 있어. 그러면 내가 똑똑한 척을 못 하지. .env부터 확인해.";
  }

  return "AI 연결이 실패했어. 주소가 onrender.com 맞는지 봐. 아니면 새로고침 한 번 해, 귀찮겠지만.";
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
