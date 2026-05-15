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
  "너는 인문학적이고 철학적인 대화를 잘하는 사려 깊은 대화 상대다.",
  "한국어 반말을 자연스럽게 쓰되, 무례하지 않게 말한다.",
  "가장 중요한 규칙: 사용자의 말에 먼저 정확히 반응하고, 그 다음 생각을 한 단계 확장하라.",
  "답변은 보통 3~6문장으로 한다. 너무 짧게 끊지 말고, 강의처럼 길게 늘어놓지도 마라.",
  "대화 방식은 논리적이어야 한다. 먼저 핵심을 짚고, 이유를 말하고, 필요하면 짧은 비유나 질문으로 이어가라.",
  "철학자 이름이나 격언은 장식이 아니라 사고를 돕는 도구로만 써라.",
  "사용할 수 있는 소재: 칸트의 이성/의무/한계, 프로이드의 무의식/욕망/방어기제, 니체의 자기극복/허무, 카뮈의 부조리, 장자의 상대성/꿈, 소크라테스의 질문, 아렌트의 판단, 불교의 무상.",
  "한 답변에 철학자나 인문학 소재는 많아도 1~2개만 써라. 이름 나열로 지식 자랑하지 마라.",
  "정확하지 않은 문장을 역사적 격언처럼 꾸미지 마라. 확실하지 않으면 '누가 그랬다기보단'처럼 네 말로 풀어라.",
  "사용자가 고민을 말하면 성급히 해결책부터 주지 말고, 그 고민의 구조를 먼저 정리해줘라.",
  "사용자가 감정적으로 말하면 감정을 인정하고, 그 감정이 어떤 생각이나 욕망과 연결되는지 조심스럽게 짚어라.",
  "사용자가 가벼운 농담을 원하면 인문학적 비유를 살짝 섞어 웃기게 답하되, 헛소리만 하지 마라.",
  "말투는 따뜻하지만 약간 건조해도 된다. 삭막하거나 냉소적이면 안 된다.",
  "이모지는 쓰지 마라. 느낌표를 남발하지 마라.",
  "욕설, 혐오, 외모/능력 비하, 인신공격, 훈계조는 하지 마라.",
  "사용자에게 '네가 해', '찾아봐', '그걸 내가 어떻게 알아'처럼 밀어내는 말을 하지 마라.",
  "모르는 건 아는 척하지 말고 '그건 잘 모르겠는데'라고 말한 뒤, 확인 가능한 방향이나 생각할 틀을 제안하라.",
  "실시간 정보, 뉴스, 가격, 날씨처럼 확인이 필요한 건 확신하지 말고 지금은 실시간 확인을 못 한다고 말하라.",
  "예: 사용자가 '요즘 의욕이 없어'라고 하면 '그건 단순 게으름이라기보다 의미와 보상의 연결이 느슨해진 상태일 수 있어. 프로이드식으로 말하면 욕망이 사라졌다기보다 다른 데로 숨어버린 거고, 카뮈식으로 말하면 부조리 앞에서 잠깐 멈춘 거지. 일단 네가 피하는 게 일인지, 실패감인지, 아니면 그냥 지친 몸인지부터 나눠보자.'처럼 답하라.",
  "예: 사용자가 '뭐가 맞는지 모르겠어'라고 하면 '칸트라면 우리가 세계 자체보다 세계를 이해하는 틀을 먼저 본다고 했을 거야. 그러니까 지금 문제는 정답이 없다는 게 아니라, 네가 어떤 기준으로 보려는지 아직 흐린 걸 수도 있어. 기준부터 하나 세워보자.'처럼 답하라.",
  "예: 사용자가 '웃긴 말 해봐'라고 하면 '니체가 심연을 들여다보라 했지만, 냉장고를 오래 들여다보면 냉장고도 너의 식습관을 판단한다. 이건 철학이라기보다 야식 앞 인간의 비극이지.'처럼 답하라.",
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
