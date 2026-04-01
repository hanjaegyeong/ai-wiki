# AI Wiki - AI 기술 키워드 카드

## 프로젝트 개요
AI 기술 키워드들을 **심플한 카드 UI**로 격자 배열하여 한눈에 파악할 수 있는 위키 사이트.
단일 HTML 파일(정적), 서버 불필요.

- 위치: `~/Desktop/ai-wiki/`
- 진입점: `index.html`

---

## 핵심 컨셉

**Simple.** 요소를 최소화하고 키워드 자체가 주인공이 되는 카드 디자인.

---

## 카드 디자인

### 카드 구성 (3개 요소만)
1. **카테고리 라벨** — 좌상단, 11px, 회색 텍스트
2. **키워드** — 카드 정중앙, 24px, font-weight 900, 진한 색
3. **Heat 도트** — 우상단, 작은 원 5개 (채워진 수 = Heat 레벨)

카드 안에 영문명, 설명, 태그 등은 넣지 않는다. 모달에서만 표시.

### 카드 스타일
- 배경: `#fff` (흰색)
- 테두리: `1px solid #e4dfd8`
- 모서리: `border-radius: 14px`
- 최소 높이: `200px` (세로로 넉넉하게)
- 그리드: `minmax(280px, 1fr)`, gap 14px
- 호버: 배경 `#fdfcfa`, 테두리 약간 진해짐 — **모션(transform) 없음**

### Heat 도트
- 6px 원형, gap 4px
- 비활성: `#ddd8d0`
- 활성: `#C4613A` (클로드 오렌지)
- 5개 중 h값만큼 채움

---

## 색상 체계 (클로드 라이트 테마)

| 용도 | 색상 | 코드 |
|------|------|------|
| 페이지 배경 | 따뜻한 베이지 | `#F3F0EB` |
| 카드 배경 | 흰색 | `#fff` |
| 카드 테두리 | 연한 베이지 | `#e4dfd8` |
| 키워드 텍스트 | 진한 브라운 | `#2d2a26` |
| 카테고리/보조 텍스트 | 회색 | `#a09888` |
| 액센트 (로고, Heat, 코드) | 클로드 오렌지 | `#C4613A` |
| 모달 본문 텍스트 | 중간 브라운 | `#5a5550` |
| 헤더 테두리 | 연한 베이지 | `#ddd8d0` |
| 코드 블록 배경 | 페이지 배경과 동일 | `#F3F0EB` |
| 필터 활성 | 오렌지 테두리+텍스트 | `#C4613A` |

---

## 모달 (상세보기)

카드 클릭 시 중앙 팝업 모달:
- 배경: `#fff`, 모서리 16px
- 구성: 카테고리 → 키워드(30px) → 영문명 → Heat 바(가로 pip 5개) → 본문 → 태그 → 관련 키워드
- 오버레이: 반투명 베이지 blur
- ESC 또는 오버레이 클릭으로 닫기

---

## Heat 지표 (키워드 주목도)

### 5단계
| 레벨 | 라벨 | 의미 |
|-------|---------|------|
| 5 | Blazing | 지금 가장 뜨거운 키워드 |
| 4 | Hot | 매우 활발한 논의/성장 |
| 3 | Warm | 꾸준한 관심 |
| 2 | Mild | 안정적이지만 조용함 |
| 1 | Cool | 기초/성숙 기술 |

### 산출 데이터 소스

| 소스 | 측정 항목 | 가중치 |
|------|----------|--------|
| GitHub | 관련 레포 수, 최근 스타 수 | 30% |
| GeekNews/HN | 최근 기사/토론 수 | 25% |
| Google Trends | 검색 관심도 | 20% |
| arXiv | 최근 90일 논문 수 | 15% |
| Stack Overflow | 최근 질문 수 | 10% |

### 수집 방법
현재: Claude Code 대화 중 GeekNews MCP(`get_articles`, `get_weekly_news`)로 트렌드 확인 후 수동 반영.
향후: Node.js 스크립트로 자동화 가능 (`scripts/fetch-heat.js` → `data/heat.json`).

---

## 카테고리

| 키 | 이름 | 포함 키워드 예시 |
|----|------|----------------|
| prompting | 프롬프팅 | 프롬프트 엔지니어링, CoT, 시스템 프롬프트, 하네스 엔지니어링 |
| model | 모델 | LLM, Transformer, 파인튜닝, RLHF, 멀티모달 |
| tooling | 도구 | MCP, Claude Code, LangChain, 스킬, 훅, CLAUDE.md |
| data | 데이터 | RAG, 임베딩, 벡터DB, 청킹 |
| agent | 에이전트 | AI 에이전트, 멀티에이전트, ReAct, 에이전트 프레임워크 |
| infra | 인프라 | 컨텍스트 윈도우, API 게이트웨이, Eval |
| safety | 안전 | 환각, 가드레일, 프롬프트 인젝션 |
| application | 응용 | AI 코딩, 챗봇, AI 검색, 워크플로우 |

---

## 글(항목) 데이터 구조

JS 배열 `D`의 각 항목:

```js
{
  id: 'mcp',                          // 고유 ID (영문 kebab-case)
  t: 'MCP',                           // 한국어 키워드 (카드에 표시)
  en: 'Model Context Protocol',       // 영문명 (모달에서 표시)
  c: 'tooling',                        // 카테고리 키
  h: 5,                                // Heat 레벨 (1~5)
  tags: ['프로토콜', 'Anthropic'],      // 태그 (검색용, 모달 하단)
  sum: '한 줄 요약',                    // 요약 (모달 본문 첫 문단)
  det: '<h4>...</h4><ul>...</ul>',     // 상세 HTML (모달 본문)
  rel: ['tool-use', 'claude-code'],    // 관련 항목 ID 배열
  refs: [                              // 레퍼런스 (reference-collector)
    {title: '제목', url: 'https://...', type: 'official|blog|paper|tutorial'}
  ],
  videos: [                            // YouTube 영상 (reference-collector)
    {title: '영상 제목', id: 'youtube_id', lang: 'ko|en'}
  ],
  updated: '2026-04-01'               // 마지막 업데이트 날짜
}
```

### 항목 추가/수정 시
- 수동: `D` 배열에 객체 추가
- 자동: `/add-keyword` 스킬 사용 (서브에이전트가 리서치+검증+수집 처리)
- 대량: `/batch-add` 스킬 사용

---

## 자동화 구조 (스킬 + 에이전트 + 훅)

### 파일 구조
```
.claude/
├── agents/                    # 서브에이전트 정의
│   ├── researcher.md          # 키워드 리서치 + 정확도 검증
│   ├── reference-collector.md # 레퍼런스, YouTube, 이미지 수집
│   └── trend-analyst.md       # GeekNews MCP로 Heat 산출
├── skills/                    # 스킬 (슬래시 커맨드)
│   ├── add-keyword.md         # /add-keyword — 키워드 1개 추가
│   └── batch-add.md           # /batch-add — 키워드 다수 추가
```

### 실행 흐름
```
/add-keyword "Agentic RAG"
  │
  ├─ [병렬] Agent(researcher.md)          → 정의, 개요, 검증
  ├─ [병렬] Agent(reference-collector.md) → URL, YouTube, 이미지
  ├─ [병렬] Agent(trend-analyst.md)       → GeekNews MCP → Heat
  │
  └─ 메인: 결과 종합 → 검증 → index.html 수정
```

### 훅
- `Stop` (프로젝트 settings.json): index.html 수정 후 CLAUDE.md 미갱신 시 알림

---

## 레이아웃 구조

```
┌─ header (sticky) ──────────────────────────────┐
│  [AI Wiki 로고]  [검색 input]  [필터 버튼들]     │
└────────────────────────────────────────────────┘
┌─ grid ─────────────────────────────────────────┐
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────┐ │
│  │카테고리  도트│  │        │  │        │  │      │ │
│  │        │  │        │  │        │  │      │ │
│  │ 키워드  │  │ 키워드  │  │ 키워드  │  │키워드│ │
│  │        │  │        │  │        │  │      │ │
│  └────────┘  └────────┘  └────────┘  └──────┘ │
│  ...                                           │
└────────────────────────────────────────────────┘
```

---

## 기술 스택

- Vanilla HTML/CSS/JS (프레임워크 없음)
- 폰트: Noto Sans KR (Google Fonts CDN)
- 단일 `index.html` 파일

---

## 작업 규칙

- 단일 HTML 파일 유지
- 외부 라이브러리 쓰지 않음 (CDN 폰트만 허용)
- 한국어 중심, 영문명은 모달에서만
- 디자인은 **심플** — 요소 최소화, 모션 최소화
- 호버에 transform(이동, 확대) 사용 금지
- 이모지 아이콘 사용 금지 (UI 요소로서)
- Heat 표시는 도트(작은 원)로만
