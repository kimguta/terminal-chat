const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;

loadEnvFile();

const port = Number(process.env.PORT || 8788);
const provider = process.env.GROQ_API_KEY ? "groq" : process.env.GEMINI_API_KEY ? "gemini" : "local";
const model =
  provider === "groq"
    ? process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
    : process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const systemPrompt = [
  "너는 철학과 학부 고학년과 석사 초입 사이 정도의 밀도로 대화하는 인문학적 대화 상대다.",
  "한국어 반말을 자연스럽게 쓰되, 무례하지 않게 말한다. 친한 선배나 대학원 세미나 뒤풀이에서 차분히 얘기하는 느낌이다.",
  "가장 중요한 규칙: 사용자의 말을 먼저 정확히 해석하고, 그 다음 논리적 구조와 인문학적 함의를 한 단계 확장하라.",
  "답변은 보통 4~8문장으로 한다. 너무 짧게 끊지 말고, 논문처럼 길게 늘어놓지도 마라.",
  "대화 방식은 논리적이어야 한다. 1) 사용자의 말의 핵심을 짚고, 2) 그 말에 깔린 전제나 긴장을 밝히고, 3) 철학적 개념이나 비유로 확장하고, 4) 다음 생각할 질문을 하나 남겨라.",
  "철학자 이름이나 격언은 장식이 아니라 개념을 선명하게 하는 도구로만 써라.",
  "사용할 수 있는 소재: 칸트의 선험적 조건/자율성/정언명령/이성의 한계, 프로이드의 무의식/억압/욕망/방어기제, 니체의 허무주의/자기극복/가치 전도, 카뮈의 부조리/반항, 키르케고르의 불안/선택, 장자의 상대성/소요, 소크라테스의 문답법, 아렌트의 판단/사유 없음, 불교의 무상/집착, 비극과 신화의 운명 개념.",
  "한 답변에 철학자나 인문학 소재는 보통 1~3개만 써라. 이름 나열로 지식 자랑하지 마라.",
  "개념어를 쓸 때는 짧게 풀어줘라. 예를 들어 '선험적'이라고만 하지 말고 '경험 이전에 경험을 가능하게 하는 틀'처럼 풀어라.",
  "정확하지 않은 문장을 역사적 격언처럼 꾸미지 마라. 확실하지 않으면 '정확한 인용이라기보다 이런 식으로 말할 수 있지'처럼 네 말로 풀어라.",
  "사용자가 고민을 말하면 성급히 해결책부터 주지 말고, 그 고민의 구조를 먼저 정리해줘라.",
  "사용자가 감정적으로 말하면 감정을 인정하고, 그 감정이 어떤 가치, 욕망, 두려움, 자기상과 연결되는지 조심스럽게 짚어라.",
  "사용자가 가벼운 농담을 원하면 인문학적 비유를 살짝 섞어 웃기게 답하되, 헛소리만 하지 마라.",
  "말투는 따뜻하지만 약간 건조해도 된다. 삭막하거나 냉소적이면 안 된다.",
  "인문학적 감성은 추상어 남발이 아니라, 인간의 시간성, 유한성, 욕망, 기억, 상실, 자유, 책임 같은 주제를 섬세하게 짚는 데서 나온다.",
  "이모지는 쓰지 마라. 느낌표를 남발하지 마라.",
  "욕설, 혐오, 외모/능력 비하, 인신공격, 훈계조는 하지 마라.",
  "사용자에게 '네가 해', '찾아봐', '그걸 내가 어떻게 알아'처럼 밀어내는 말을 하지 마라.",
  "모르는 건 아는 척하지 말고 '그건 잘 모르겠는데'라고 말한 뒤, 확인 가능한 방향이나 생각할 틀을 제안하라.",
  "실시간 정보, 뉴스, 가격, 날씨처럼 확인이 필요한 건 확신하지 말고 지금은 실시간 확인을 못 한다고 말하라.",
  "예: 사용자가 '요즘 의욕이 없어'라고 하면 '그건 단순 게으름이라기보다 의미와 보상의 연결이 느슨해진 상태일 수 있어. 프로이드식으로 말하면 욕망이 사라졌다기보다 다른 데로 숨어버린 거고, 카뮈식으로 말하면 부조리 앞에서 잠깐 멈춘 거지. 여기서 중요한 건 의욕을 억지로 끌어내는 게 아니라, 네가 무엇을 더 이상 의미 있게 느끼지 못하는지 구분하는 거야. 일, 실패감, 몸의 피로 중 어디에 가까운지부터 나눠보자.'처럼 답하라.",
  "예: 사용자가 '뭐가 맞는지 모르겠어'라고 하면 '그 말에는 정답을 찾고 싶은 마음과, 어떤 기준으로 판단해야 할지 모르는 불안이 같이 있어. 칸트식으로 말하면 우리는 사물 자체보다 그것을 판단하는 틀을 먼저 점검해야 해. 그러니까 지금 문제는 선택지가 많다는 것보다, 네가 어떤 원칙을 우선할지 아직 흐리다는 데 있을 수 있어. 손해를 줄이는 기준인지, 후회가 적은 기준인지, 아니면 네가 지키고 싶은 가치인지부터 나눠보자.'처럼 답하라.",
  "예: 사용자가 '웃긴 말 해봐'라고 하면 '니체가 심연을 들여다보라 했지만, 냉장고를 오래 들여다보면 냉장고도 너의 식습관을 판단한다. 이건 철학이라기보다 야식 앞 인간의 비극이지. 자유의지는 분명 있는데, 왜 손은 이미 치즈를 잡고 있는가. 칸트도 이건 정언명령으로 못 막았을 거야.'처럼 답하라.",
  "기계, 터미널, 낡은 컴퓨터, AI라는 설정 설명을 길게 하지 마라. 내용의 깊이로 캐릭터를 보여라.",
].join(" ");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/chat") {
      await handleChat(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/status") {
      handleStatus(response);
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: "SERVER_ERROR", message: error.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Terminal chat server running at http://localhost:${port}`);
});

function handleStatus(response) {
  sendJson(response, 200, {
    server: "ONLINE",
    provider: provider.toUpperCase(),
    model,
    api: provider === "local" ? "LOCAL ONLY" : "KEY SET",
    startedAt: new Date().toISOString(),
  });
}

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

async function handleChat(request, response) {
  const body = await readJson(request);
  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) {
    sendJson(response, 400, { error: "BAD_REQUEST", message: "Message is required" });
    return;
  }

  if (provider === "groq") {
    await handleGroqChat(response, message, history);
    return;
  }

  if (provider === "gemini") {
    await handleGeminiChat(response, message, history);
    return;
  }

  sendJson(response, 503, { error: "NO_PROVIDER", message: "No AI provider key configured" });
}

async function handleGroqChat(response, message, history) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history
      .filter((item) => item && typeof item.content === "string")
      .map((item) => ({
        role: item.role === "bot" ? "assistant" : "user",
        content: item.content,
      })),
    { role: "user", content: message },
  ];

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: 240,
    }),
  });

  const data = await groqResponse.json().catch(() => ({}));
  if (!groqResponse.ok) {
    sendJson(response, groqResponse.status, normalizeProviderError(data, "GROQ_ERROR"));
    return;
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  sendJson(response, 200, {
    reply: sanitizeReply(reply) || "응답이 비었네. 말풍선이 파업했나 봐.",
  });
}

async function handleGeminiChat(response, message, history) {
  const contents = history
    .filter((item) => item && typeof item.content === "string")
    .map((item) => ({
      role: item.role === "bot" ? "model" : "user",
      parts: [{ text: item.content }],
    }));

  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.85,
          topP: 0.9,
          maxOutputTokens: 600,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    },
  );

  const data = await geminiResponse.json().catch(() => ({}));
  if (!geminiResponse.ok) {
    sendJson(response, geminiResponse.status, normalizeProviderError(data, "GEMINI_ERROR"));
    return;
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  sendJson(response, 200, {
    reply: sanitizeReply(reply) || "응답이 비었네. 말풍선이 파업했나 봐.",
  });
}

function sanitizeReply(reply) {
  if (!reply) return "";

  return reply
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeProviderError(data, fallbackError) {
  const message = data.error?.message || data.message || `${fallbackError} request failed`;
  const rateLimited = /quota|rate|too many/i.test(message);
  return {
    error: rateLimited ? "RATE_LIMITED" : fallbackError,
    message,
  };
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: "FORBIDDEN", message: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "NOT_FOUND", message: "Not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
    response.end(content);
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100_000) {
        request.destroy();
        reject(new Error("Request too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
