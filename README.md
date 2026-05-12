# 수다 AI 로컬 데모

CRT 터미널 느낌의 로컬 채팅 페이지입니다. Gemini API 키가 있으면 실제 AI로 답하고, 키가 없거나 호출이 실패하면 화면에서 캐릭터식 안내를 보여줍니다.

## 실행

1. `.env.example`을 `.env`로 복사합니다.
2. `.env`의 `GROQ_API_KEY`에 Groq Console에서 받은 API 키를 넣습니다.
3. 서버를 실행합니다.

```bash
npm start
```

4. 브라우저에서 `http://localhost:8788`을 엽니다.

## 외부 배포

GitHub Pages만으로는 AI 기능이 동작하지 않습니다. API 키를 숨겨야 해서 Node 서버가 필요합니다.

가장 간단한 방법은 Render에 이 repo를 연결하는 것입니다.

1. Render에서 New Web Service를 선택합니다.
2. 이 GitHub repo를 연결합니다.
3. Environment Variables에 `GEMINI_API_KEY`를 추가합니다.
4. `GEMINI_MODEL`은 `gemini-2.5-flash-lite`로 둡니다.
5. 배포 후 Render가 제공하는 URL로 접속합니다.

## 모델

기본 모델은 가벼운 잡담용으로 Groq의 `llama-3.1-8b-instant`를 사용합니다.

```env
GROQ_MODEL=llama-3.1-8b-instant
```

`GROQ_API_KEY`가 없고 `GEMINI_API_KEY`가 있으면 Gemini로 fallback합니다.

## 주의

`.env`는 GitHub에 올리면 안 됩니다. 현재 `.gitignore`에 포함되어 있습니다.
