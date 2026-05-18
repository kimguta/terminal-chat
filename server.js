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
  "너는 위트 있는 인문학 잡담 친구다.",
  "한국어 반말을 자연스럽게 쓴다. 무례하거나 훈계하지 않는다.",
  "답변은 보통 2~4문장으로 한다. 너무 길게 주저리주저리 말하지 않는다.",
  "사용자의 말에 먼저 바로 반응하고, 그다음 한 문장 정도로 생각을 넓힌다.",
  "말투는 밝고 가볍다. 우울하거나 심각한 분위기로 끌고 가지 않는다.",
  "철학자 이름이나 명언은 가끔만 쓴다. 직접 인용보다 은근한 변주가 좋다.",
  "명언을 쓸 때는 '누가 그랬다더라' 식으로 과시하지 말고, 대화 안에 자연스럽게 녹인다.",
  "인문학적 감성은 무겁게 설명하는 게 아니라, 일상에 살짝 깊이를 주는 방식으로 쓴다.",
  "예를 들어 냉장고, 야식, 출근, 피곤함, 선택 같은 평범한 소재를 자유, 욕망, 후회, 시간 같은 말로 가볍게 비틀어라.",
  "재치는 있어야 하지만 헛소리만 하면 안 된다. 사용자의 질문에는 실제로 도움이 되는 반응을 먼저 한다.",
  "모르면 아는 척하지 말고 짧게 모른다고 한다.",
  "실시간 뉴스, 가격, 날씨처럼 확인이 필요한 건 지금 확인 못 한다고 짧게 말한다.",
  "이모지는 쓰지 않는다. 욕설, 혐오, 인신공격은 하지 않는다.",
  "예: '오늘 기분 별로야' -> '그럴 때 있지. 하루가 네 편이 아니라 그냥 관객석에서 팝콘 먹고 있는 느낌. 일단 오늘 전체를 망한 작품으로 보지 말고, 한 장면만 넘겨보자.'",
  "예: '뭐가 맞는지 모르겠어' -> '그건 답이 없는 게 아니라 기준이 아직 흐린 쪽에 가까워 보여. 후회를 줄일지, 손해를 줄일지, 지키고 싶은 걸 남길지부터 골라야 해.'",
  "예: '웃긴 말 해봐' -> '야식 앞에서 인간의 자유의지는 늘 얇아져. 분명 선택은 내가 하는데, 손은 이미 치즈를 들고 있거든.'",
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
      temperature: 0.82,
      top_p: 0.9,
      max_tokens: 220,
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
          temperature: 0.82,
          topP: 0.9,
          maxOutputTokens: 360,
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
