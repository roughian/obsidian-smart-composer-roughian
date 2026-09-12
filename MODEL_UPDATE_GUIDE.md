---
created: 2026-07-25T12:21
modify: 2026-07-25T12:21
tags:
  - system
  - AI
  - smart-composer
---

# Smart Composer Plan 모델 업데이트 가이드

> [!summary]
> 새 Plan 모델은 대부분 카탈로그 한 곳과 테스트만 수정하면 된다. 요청 형식이 바뀐 경우에만 provider/adapter까지 건드린다.

## 빠른 작업 순서

1. 모델명을 기억으로 추정하지 말고 공식 문서에서 실제 ID, 사용 가능 계정, reasoning/thinking 단계와 요청 형식을 확인한다.
	- OpenAI: [Models](https://developers.openai.com/api/docs/models)
	- Claude Code: [Model configuration](https://support.claude.com/en/articles/11940350-claude-code-model-configuration)
2. `src/core/llm/planModelCatalog.ts`의 `PLAN_MODEL_CATALOG`에 모델을 추가한다.
	- `id`: 설정 화면에 저장되는 고유 ID. 예: `gpt-5.6-sol (plan)`
	- `model`: 서버로 보내는 공식 모델 ID. 예: `gpt-5.6-sol`
	- 교체되는 이전 모델은 `LEGACY_PLAN_MODEL_ALIASES`에 `이전 ID → 새 ID`로 추가한다.
3. 기능 조건이 달라진 경우에만 아래 파일을 수정한다.
	- OpenAI reasoning 단계/기본값: `src/core/llm/openaiPlanModels.ts`의 `GPT_PLAN_MODEL_RULES`에 모델별 허용 effort와 기본값을 등록한다. 새 effort 집합이 필요하면 `src/types/chat-model.types.ts`에 상수를 추가한다.
	- Claude adaptive thinking 규칙: `src/core/llm/claudePlanModels.ts`, `src/core/llm/claudeCodeMessageAdapter.ts`
	- 이미지 생성 등 모델별 기능: `src/core/llm/providerCapabilities.ts`
	- 단순 모델 추가라면 설정 스키마 버전을 올리지 않는다. 카탈로그 병합과 alias가 기존 설정을 자동 이전한다.
4. 관련 테스트를 함께 갱신한다.
	- `src/core/llm/planModelCatalog.test.ts`
	- `src/core/llm/openaiPlanModels.test.ts`
	- `src/core/llm/openaiCodexProvider.test.ts`
	- `src/core/llm/claudeCodeMessageAdapter.test.ts`
	- 저장 구조가 바뀐 경우에만 `src/settings/schema/migrations/`에 migration과 테스트를 추가한다.
5. 검증한다.

~~~bash
npm run lint:check
npm test -- --runInBand
npm run build
~~~

6. Obsidian에서 Smart Composer를 껐다 켠 뒤 모델 목록, reasoning/thinking 선택과 실제 응답을 확인한다. 실제 호출은 Plan 사용량을 소비한다.

## 이미지 기능 파일 위치

- 이미지 생성에 쓸 모델 결정: `src/core/image/resolve-image-model.ts` (설정의 이미지 모델 → 채팅 모델 fallback 순)
- 이미지 생성 허용 모델·비전 지원 여부: `src/core/llm/providerCapabilities.ts`의 `IMAGE_GENERATION_PLAN_MODELS`, `VISION_PROVIDER_TYPES`
- API 키 방식 이미지 모델(Gemini `gemini-3.1-flash-image`/`gemini-3-pro-image`, xAI `grok-imagine-image-2.0`): `src/core/image/image-model-catalog.ts`의 `API_IMAGE_MODEL_CATALOG`(설정 로드 시 `mergeImageModelCatalog`로 자동 추가, `isApiImageModel`이 capability `imageGeneration`/`imageOnly` 결정). 새 이미지 모델을 추가하려면 카탈로그와 `API_IMAGE_MODEL_NAMES` 두 곳에 넣는다. 실제 호출은 `GeminiProvider.generateImage`(`geminiImage.ts`, generateContent + responseModalities), `XaiProvider.generateImage`(`xaiImage.ts`, `/v1/images/generations` b64_json, 참조 이미지 미지원). 어댑터는 `isImageGenerator`로 provider를 판별하고 `sniffImageMimeType`으로 PNG/JPEG 확장자를 정한다.
- 붙여넣기 이미지 전처리(MIME 허용 목록, 2048px 축소, 20MB 상한): `src/utils/llm/image-preprocess.ts`, `src/utils/llm/image.ts`
- 생성 진행/결과 채팅 표시: `src/utils/chat/image-echo.ts`의 `buildImageProgressMessage`(큐잉 즉시 callout 자리표시) → `buildImageEchoMessage`(`<smtcmp_block>` 임베드)가 같은 id로 제자리 교체(`upsertChatMessage`)
- 이미지 Apply: `Chat.tsx` applyMutation에서 `isImageEchoBlock`이면 LLM 없이 `src/core/image/image-apply.ts`의 `openImageApplyView`가 커서 줄 아래에 참조를 넣은 diff를 ApplyView(Accept Incoming/Current/Both)로 연다. 태스크 카드 "Insert embed"도 같은 경로.
- 저장 위치(Vault folder / Eagle library (direct) / CMDS Eagle (sync)): 설정 `imageGeneration.destination`(`src/core/image/image-destination.ts`). direct는 `src/core/image/eagle-client.ts`가 Obsidian `requestUrl`로 Eagle 로컬 API(`imageGeneration.eagleApiBaseUrl`, 기본 `http://localhost:41595`)의 `addFromPath` → `item/info` 폴링 → `library/info`를 호출하고, `eagle-paths.ts`가 `[![name](file:///…/images/<id>.info/<name>.<ext>)](eagle://item/<id>)` 형태의 참조를 만든다. sync는 커뮤니티 플러그인 `cmds-eagle`(id 고정)의 `settings.imagePasteBehavior`를 따른다(`eagle-bridge.ts`). 전달 오케스트레이션은 `image-delivery.ts`; 성공 시 볼트 사본을 휴지통으로 보내고 실패하면 사본 유지 + `artifact.metadata.destinationError`로 채팅 경고. resolved destination 값: `vault | eagle(direct) | cmds-eagle(플러그인) | cloud`.
- 생성 결과 채팅 에코: `src/utils/chat/image-echo.ts`, `src/components/chat-view/useImageTaskEcho.ts`
- img2img 참조 이미지 저장소: `src/core/image/reference-image-store.ts` (`.smtcmp_json_db/references/`)

## 지켜야 할 안전 규칙

- `data.json`의 OAuth access/refresh token 값을 출력하거나 복사하지 않는다.
- Claude Plan의 `riskAcceptedVersion`을 자동으로 넣지 않는다. 사용자가 설정 화면에서 직접 동의해야 한다.
- OpenAI/Claude Plan은 비공개 구독 경로에 의존하므로 endpoint, 필수 header와 system message를 근거 없이 바꾸지 않는다.
- 요청한 모델을 사용할 수 없을 때 다른 모델로 조용히 대체하지 말고 명확한 오류를 표시한다.
- Gemini 소비자 Plan 연결은 현재 중단 상태이므로 공식 지원 경로가 확인되기 전에는 다시 활성화하지 않는다.

## 원본 UI 보존 규칙

- `ChatView.tsx`는 원본처럼 `containerEl.children[1]`에 직접 mount한다.
- 과거 사용자 메시지는 `UserMessageItem`에서 원본 `ChatUserInput` 카드로 표시해 채팅 턴 경계를 유지한다.
- 새 큐/상태 패널은 `.smtcmp-chat-messages` 스크롤 안에 둔다. 헤더와 최종 입력창 사이의 최상위 flex 구조를 늘리지 않는다.
- `styles.css`의 원본 스타일을 교체하거나 별도 스킨을 강제하지 말고, 새 기능에 필요한 Obsidian 테마 변수 기반 스타일만 뒤에 추가한다.

## 다음 작업자에게 줄 짧은 요청문

> 공식 최신 모델 문서를 먼저 확인하고 `MODEL_UPDATE_GUIDE.md` 순서대로 Plan 모델만 갱신해 줘. 기존 OAuth 설정, API-key 모델, 원본 채팅 UI는 보존하고 전체 테스트와 빌드까지 실행해 줘.
