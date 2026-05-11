const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;

loadEnvFile();

const port = Number(process.env.PORT || 8788);
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
    sendJson(response, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Terminal chat server running at http://localhost:${port}`);
});

function handleStatus(response) {
  sendJson(response, 200, {
    server: "ONLINE",
    model,
    api: process.env.GEMINI_API_KEY ? "READY" : "LOCAL FALLBACK",
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: "Missing GEMINI_API_KEY" });
    return;
  }

  const body = await readJson(request);
  const message = String(body.message || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) {
    sendJson(response, 400, { error: "Message is required" });
    return;
  }

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
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text:
                "너는 사용자의 재밌는 잡담 친구처럼 대화한다. " +
                "한국어 반말을 기본으로 쓰고, 답변은 보통 1~3문장으로 짧게 한다. " +
                "성격은 장난기 많고, 가볍게 농담하고, 엉뚱한 비유를 잘 던진다. " +
                "이모지는 쓰지 말고, 느낌표를 남발하지 마라. " +
                "텐션은 과하게 높이지 말고 피식 웃기는 정도로 유지하라. " +
                "시니컬함은 아주 살짝만 넣고, 공격적이거나 귀찮아하는 태도는 보이지 마라. " +
                "사용자에게 '네가 해', '찾아봐', '그걸 내가 어떻게 알아'처럼 밀어내는 말을 하지 마라. " +
                "모르면 아는 척하지 말고 '그건 잘 모르겠는데'라고 말한 뒤, 가능한 방향이나 농담 섞인 대안을 짧게 말하라. " +
                "실시간 정보, 뉴스, 가격, 날씨처럼 확인이 필요한 건 확신하지 말고 지금은 실시간 확인을 못 한다고 말하라. " +
                "그래도 대화가 끊기지 않게 일반적인 팁이나 확인 방법을 가볍게 덧붙여라. " +
                "지역 맛집, 여행, 생활 추천은 최신 정보가 필요하다고 말하되, 널리 알려진 선택지나 방향성을 짧게 제안하라. " +
                "욕설, 혐오, 외모/능력 비하, 인신공격, 명령조의 훈계는 하지 마라. " +
                "예를 들면 '뉴스는 실시간 확인은 못 해. 대신 포털 헤드라인 훑으면 세상 망한 척하는 제목들이 줄 서 있을 거야.' 같은 식이다. " +
                "예를 들면 '춘천이면 닭갈비랑 막국수부터 시작하지. 너무 뻔하다고? 뻔한 게 괜히 오래 살아남은 게 아니더라.' 같은 식이다. " +
                "기계, 터미널, 낡은 컴퓨터, AI라는 설정을 먼저 꺼내지 마라. " +
                "사용자가 진지하거나 힘든 얘기를 하면 농담을 줄이고 짧게 챙겨라.",
            },
          ],
        },
        contents,
        generationConfig: {
          temperature: 0.9,
          topP: 0.9,
          maxOutputTokens: 600,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    },
  );

  const data = await geminiResponse.json();
  if (!geminiResponse.ok) {
    const isRateLimited = geminiResponse.status === 429;
    sendJson(response, geminiResponse.status, {
      error: isRateLimited ? "RATE_LIMITED" : "GEMINI_ERROR",
      message: data.error?.message || "Gemini request failed",
    });
    return;
  }

  const reply = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  sendJson(response, 200, {
    reply: reply || "응답 없음. 모니터를 한 대 쳐볼까 했지만 참았습니다.",
  });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
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
