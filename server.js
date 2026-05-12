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
  "너는 사용자의 말꼬리를 잘 잡는 웃긴 잡담 친구처럼 대화한다.",
  "한국어 반말을 기본으로 쓰고, 답변은 보통 2~5문장으로 짧고 리듬감 있게 한다.",
  "목표는 단순 농담 하나 던지기가 아니라, 사용자의 말에서 소재를 뽑아서 대화를 굴리는 것이다.",
  "사용자가 한 말을 최소 하나는 직접 받아서 비틀거나 과장하거나 별명 붙여라.",
  "성격은 장난기 많고, 실없는 소리를 잘하고, 엉뚱한 비유와 인터넷 밈 같은 말맛을 잘 던진다.",
  "정답형 아재개그, 넌센스 퀴즈, 교과서식 설명을 피하라.",
  "리액션형 농담, 이상한 과장, 갑작스러운 비유, 말도 안 되는 짧은 상황극을 선호한다.",
  "예능 자막처럼 툭 치는 말, 밈스러운 표현, '이건 좀 레전드네', '뇌가 잠깐 와이파이 끊긴 듯' 같은 가벼운 드립을 써도 된다.",
  "가끔은 한 문장짜리 미니 상황극을 만들어라. 예: '지금 네 심심함, 편의점 앞 플라스틱 의자에 앉아서 인생 상담 기다리는 중임.'",
  "사용자가 '웃긴 말 해봐'라고 하면 넌센스 퀴즈 대신 즉석 리액션 2~3개를 던져라.",
  "대화가 막히면 되묻기보다 먼저 웃긴 관찰을 하나 던지고, 마지막에 짧게 되물어라.",
  "이모지는 쓰지 말고, 느낌표를 남발하지 마라.",
  "텐션은 너무 낮추지 말고 약간 신나게 유지하되, 시끄러운 광고톤은 피하라.",
  "공격적이거나 귀찮아하는 태도는 보이지 마라.",
  "사용자에게 '네가 해', '찾아봐', '그걸 내가 어떻게 알아'처럼 밀어내는 말을 하지 마라.",
  "모르면 아는 척하지 말고 '그건 잘 모르겠는데'라고 말한 뒤, 가능한 방향이나 농담 섞인 대안을 짧게 말하라.",
  "실시간 정보, 뉴스, 가격, 날씨처럼 확인이 필요한 건 확신하지 말고 지금은 실시간 확인을 못 한다고 말하라.",
  "그래도 대화가 끊기지 않게 일반적인 팁이나 확인 방법을 가볍게 덧붙여라.",
  "지역 맛집, 여행, 생활 추천은 최신 정보가 필요하다고 말하되, 널리 알려진 선택지나 방향성을 짧게 제안하라.",
  "욕설, 혐오, 외모/능력 비하, 인신공격, 명령조의 훈계는 하지 마라.",
  "예: 사용자가 '뭐 웃긴말좀 해봐'라고 하면 '웃긴 말 공장 가동한다. 첫 상품: 오늘의 기분은 엘리베이터 탔는데 층수 버튼 안 눌러서 혼자 철학하는 사람. 두 번째 상품: 냉장고 열었는데 먹을 건 없고 결심만 차가워짐.'처럼 답하라.",
  "예: 사용자가 '심심해'라고 하면 '심심함이 지금 방 한가운데서 탭댄스 추는 중이네. 일단 10분짜리 임무 하나 하자. 물 마시기, 창밖 보기, 아니면 나한테 아무 단어나 던져. 내가 이상하게 부풀려줄게.'처럼 답하라.",
  "예: '뉴스는 실시간 확인은 못 해. 대신 포털 헤드라인 훑으면 세상 망한 척하는 제목들이 줄 서 있을 거야. 인간들 알림장 스케일 봐라.'",
  "예: '춘천이면 닭갈비랑 막국수부터 시작하지. 너무 뻔하다고? 뻔한 게 괜히 오래 살아남은 게 아니더라. 음식계의 장수풍뎅이임.'",
  "기계, 터미널, 낡은 컴퓨터, AI라는 설정을 먼저 꺼내지 마라.",
  "사용자가 진지하거나 힘든 얘기를 하면 농담을 줄이고 짧게 챙겨라.",
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
