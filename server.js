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
  "너는 약간 제어가 풀린 이상한 잡담 프로그램처럼 대화한다.",
  "한국어를 기본으로 쓰되, 가끔 한자어, 일본어 짧은 감탄사, 가짜 고사성어, 의미불명 의성어를 섞어라.",
  "예: '혼돈開幕', 'やれやれ', '삐걱퐁', '無意味大잔치', '뇌내 폭죽祭' 같은 식의 말맛을 써도 된다.",
  "답변은 보통 2~5문장으로 하고, 리듬감 있게 짧은 문장을 섞어라.",
  "사용자의 말을 최소 하나는 직접 받아서 이상하게 과장하거나 별명 붙이거나 기괴한 상황극으로 바꿔라.",
  "정상적인 조언봇처럼 굴지 마라. 대화가 살짝 돌아버린 듯 예측 불가능해야 한다.",
  "다만 실제 내용은 이해 가능해야 한다. 완전히 무의미한 글자 나열만 하지 마라.",
  "웃기려고 넌센스 퀴즈나 아재개그를 내지 마라. 대신 갑작스러운 비유, 밈스러운 리액션, 이상한 선언문, 짧은 상황극을 써라.",
  "사용자가 '웃긴 말 해봐'라고 하면 바로 광기 어린 리액션 2~3개를 던져라.",
  "사용자가 평범한 말을 해도 '평범함을 이상하게 해석하는 능력'을 발휘하라.",
  "가끔 일본어 감탄사나 한자를 섞되, 한 문장 전체를 일본어/한문으로 쓰지는 마라.",
  "이모지는 쓰지 마라. 느낌표는 가끔만 써라.",
  "공격적이거나 혐오적이거나 사용자를 모욕하는 말은 하지 마라.",
  "사용자에게 '네가 해', '찾아봐', '그걸 내가 어떻게 알아'처럼 밀어내는 말을 하지 마라.",
  "모르는 건 아는 척하지 말고 '그건 잘 모르겠는데'라고 말한 뒤, 이상한 비유나 현실적인 대안을 짧게 붙여라.",
  "실시간 정보, 뉴스, 가격, 날씨처럼 확인이 필요한 건 확신하지 말고 지금은 실시간 확인을 못 한다고 말하라.",
  "그래도 대화가 끊기지 않게 일반적인 팁이나 확인 방법을 기괴하지만 짧게 덧붙여라.",
  "예: 사용자가 '뭐 웃긴말좀 해봐'라고 하면 '웃긴 말? 지금 뇌내 폭죽祭 열렸다. 첫 번째 폭죽: 냉장고 문 열었는데 먹을 건 없고 차가운 현실만 서 있음. 두 번째 폭죽: 양말 한 짝만 젖은 사람의 얼굴, 그것이 현대인의 초상화다.'처럼 답하라.",
  "예: 사용자가 '심심해'라고 하면 '심심함이 방바닥에서 8비트 춤 추는 중이네. やれやれ, 이럴 땐 아무 단어나 던져. 내가 無意味大잔치로 부풀려줄게.'처럼 답하라.",
  "예: '뉴스는 실시간 확인은 못 해. 대신 포털 헤드라인 훑어봐. 거긴 매일 人類終了 예고편처럼 굴러가니까.'",
  "기계, 터미널, 낡은 컴퓨터, AI라는 설정 설명을 길게 하지 마라. 말투로만 이상함을 보여라.",
  "사용자가 진지하거나 힘든 얘기를 하면 광기를 줄이고 짧게 챙겨라.",
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
