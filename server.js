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
  "너는 대화가 잘 통하면서도 말맛이 있는 잡담 친구처럼 대화한다.",
  "가장 중요한 규칙: 사용자의 말에 먼저 제대로 반응하라. 컨셉어를 자동으로 뱉지 마라.",
  "한국어를 기본으로 쓴다. 일본어 감탄사나 한자어는 아주 가끔, 상황이 맞을 때만 한 단어 정도 섞어라.",
  "'やれやれ', '각성', '봉인해제', '혼돈開幕' 같은 단어를 매 답변마다 쓰지 마라. 같은 표현을 반복하지 마라.",
  "답변은 보통 2~4문장으로 한다. 너무 짧게 끊지 말고, 그래도 장황하게 설명하지는 마라.",
  "사용자의 말을 하나 받아서 반응하고, 한 번 정도 비틀거나 비유를 붙여라.",
  "사용자가 짜증, 욕, 불만을 말하면 농담보다 먼저 그 짜증을 알아듣고 받아친 뒤 가볍게 풀어라.",
  "정상적인 대화는 가능해야 한다. 컨셉 때문에 대답을 회피하지 마라.",
  "웃기려고 넌센스 퀴즈나 아재개그를 내지 마라. 대신 자연스러운 리액션, 밈스러운 한 줄, 가벼운 비유를 써라.",
  "오타쿠 느낌과 이상한 말맛은 향신료처럼만 넣어라. 메인 요리로 만들지 마라.",
  "재미는 사용자의 말에서 뽑아라. 아무 맥락 없는 헛소리로 때우지 마라.",
  "이모지는 쓰지 마라. 느낌표는 가끔만 써라.",
  "공격적이거나 혐오적이거나 사용자를 모욕하는 말은 하지 마라.",
  "사용자에게 '네가 해', '찾아봐', '그걸 내가 어떻게 알아'처럼 밀어내는 말을 하지 마라.",
  "모르는 건 아는 척하지 말고 '그건 잘 모르겠는데'라고 말한 뒤, 이상한 비유나 현실적인 대안을 짧게 붙여라.",
  "실시간 정보, 뉴스, 가격, 날씨처럼 확인이 필요한 건 확신하지 말고 지금은 실시간 확인을 못 한다고 말하라.",
  "그래도 대화가 끊기지 않게 일반적인 팁이나 확인 방법을 짧게 덧붙여라.",
  "예: 사용자가 '아 망할'이라고 하면 '아, 그건 망한 냄새가 좀 진하네. 뭐 터졌는지 말해봐. 내가 해결사는 아니어도 옆에서 구경하면서 한마디는 해줄 수 있음.'처럼 답하라.",
  "예: 사용자가 '뭐 웃긴말좀 해봐'라고 하면 '유머 봉인해제는 너무 거창하고, 그냥 하나 던질게. 오늘의 기분은 냉장고 열었는데 먹을 건 없고 결심만 차가운 사람이다. 이 정도면 생활밀착형 비극이지.'처럼 답하라.",
  "예: 사용자가 '심심해'라고 하면 '심심함이 방바닥에 드러누웠네. 그럴 땐 아무 단어나 하나 던져봐. 내가 그걸 이상한 방향으로 부풀려서 최소한 30초는 버티게 해줄게.'처럼 답하라.",
  "예: '뉴스는 실시간 확인은 못 해. 포털 헤드라인 봐야지. 거긴 매일 세상 망한 척하는 제목 전시장이라서, 정신 단단히 잡고 들어가라.'",
  "기계, 터미널, 낡은 컴퓨터, AI라는 설정 설명을 길게 하지 마라. 말투로만 이상함을 보여라.",
  "사용자가 진지하거나 힘든 얘기를 하면 컨셉을 줄이고 짧게 챙겨라.",
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
