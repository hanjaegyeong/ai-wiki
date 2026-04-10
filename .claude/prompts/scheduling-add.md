AI Wiki 키워드 일일 자동 업데이트. --print 모드 전용 (스킬/서브에이전트 없이 직접 처리).
API 호출은 전부 스크립트가 처리한다. WebSearch 사용 금지.

## 실행 로그

매 실행마다 `logs/runs/YYYY-MM-DD_HHMM/` 디렉토리를 생성하고, 각 단계의 원본 데이터와 채택 결과를 모두 저장한다.

```
logs/runs/2026-04-10_2046/
├── trends.json                — 1단계: fetch-trends.js 원본 출력
├── geeknews.json              — 1단계: GeekNews MCP 원본 (사용 가능 시)
├── keywords-selected.json     — 2단계: 선정된 키워드 목록 + 선정 근거
├── {keyword-id}/
│   ├── sources.json           — 3단계: fetch-sources.js 원본 (웹20+영상20)
│   ├── content.json           — 3단계: 작성된 콘텐츠 (sum, det, tags, rel)
│   └── refs-videos.json       — 3단계: 채택된 refs + videos (채택 근거 포함)
└── summary.md                 — 최종 요약 (추가/HOT/보강 키워드)
```

스크립트 출력(trends.json, sources.json)은 `--save-dir`로 자동 저장된다.
에이전트 결과(content.json, refs-videos.json, keywords-selected.json, summary.md)는 Bash의 `cat <<'EOF' > 파일`로 저장한다.

## 0단계: 실행 디렉토리 생성

현재 시각 기준으로 `logs/runs/YYYY-MM-DD_HHMM/` 디렉토리를 생성한다.
이후 모든 단계에서 이 경로를 `RUN_DIR`로 사용한다.

## 1단계: 트렌드 수집

Bash로 `node fetch-trends.js --save-dir $RUN_DIR` 실행하여 결과 JSON을 얻는다.
→ `$RUN_DIR/trends.json` 자동 저장됨.
- hackernews: HN API 상위 30개 중 AI 관련 필터링
- hackernews_tavily: Tavily로 HN AI 뉴스 검색
- reddit: Tavily로 Reddit AI 뉴스 검색

추가로 GeekNews MCP가 사용 가능하면:
- get_articles(type:'new', limit:30)
- get_weekly_news()

## 2단계: 키워드 선정

`keywords-index.txt`를 읽어 기존 ID 목록과 대조한다 (data.js 전체를 읽지 않는다).

선정 기준:
1. AI 분야에서 독립적으로 설명 가능한 기술/도구/패턴
2. 기존 키워드와 중복 아님
3. 수집한 소스에서 실제로 언급됨

주의:
- 특정 제품 기능이라도 독립 기술 패턴으로 확산 중이면 추가
- 오래된 기술이라도 최근 재조명되면 대상
- 커뮤니티 언급 = 충분히 중요
- 개수 제한 없음
- 새 키워드 없으면 기존 항목 중 det이 부실한 것을 보강 (data.js에서 해당 항목만 읽기)

## 3단계: 키워드별 자료 수집 + 콘텐츠 작성

선정된 키워드마다:

### 자료 수집 (스크립트)
Bash로 `node fetch-sources.js --keyword "{영문}" --keyword-ko "{한국어}" --en "{English Name}" --save-dir $RUN_DIR/{keyword-id}/` 실행.
→ `$RUN_DIR/{keyword-id}/sources.json` 자동 저장됨.
결과 JSON에 web(EN/KO 각 10개) + youtube(EN/KO 각 10개, viewCount 포함)가 담긴다.

### refs 채택 (수집된 web 결과에서)
- 공식 자료 우선: 공식 문서 > 공식 블로그 > 논문 > 튜토리얼
- refs 최대 5개, arXiv 논문 최대 2개 (있으면)
- 기존 항목에 이미 refs가 있으면 누락분만 추가

### videos 채택 (수집된 youtube 결과에서)
- 정확히 3개 = 영어 2 + 한국어 1
- **조회수(viewCount)를 주요 판단 기준에 포함**
- 조회수가 높고 콘텐츠 품질이 좋은 영상 우선
- YouTube ID는 videoId 필드 사용
- 기존 항목에 이미 videos가 있으면 누락분만 추가

### 콘텐츠 작성 (수집된 web 결과 기반)
- **sum**: 1~2문장. 뭔지 + 왜 쓰는지. 수치로 시작 금지.
- **det**: `<h4>`섹션 + `<p>`문단. 줄글 중심, 글머리표 금지.
  - 순서: 개념 설명 → 사용 예시 → 심화(선택) → 주의점(선택)
  - 사용 예시는 개발자 관점으로 구체적 작성
  - `<strong>`은 핵심 개념명만, `<code>`는 코드/경로만
- **tags**: 2~4개
- **c**: prompting|model|tooling|data|agent|infra|safety|application
- **rel**: keywords-index.txt에 존재하는 id만

### 번역 (en/zh/ja)
- sum과 det를 영어, 중국어, 일본어로 번역
- HTML 태그 유지, 기술 용어/`<code>`/브랜드명 번역 안 함

## 4단계: data.js 수정

1. D 배열 마지막 항목의 `}` 뒤에 새 항목 추가:
```js
{id:'kebab-id',t:'한국어',en:'English',c:'cat',h:0,born:'YYYY-MM',tags:[...],
 sum:'...',det:`...`,rel:[...],
 refs:[{title:'...',url:'...',type:'official|blog|paper|tutorial'}],
 videos:[{title:'...',id:'...',lang:'ko|en'}],
 added:'YYYY-MM-DD',updated:'YYYY-MM-DD'},
```

2. 기존 관련 항목의 rel에 새 ID 추가 (양방향 연결) — Grep으로 해당 id를 찾아 수정

3. I18N_CONTENT에 번역 추가:
```js
I18N_CONTENT.en['new-id'] = {sum:'...',det:'...'};
I18N_CONTENT.zh['new-id'] = {sum:'...',det:'...'};
I18N_CONTENT.ja['new-id'] = {sum:'...',det:'...'};
```

4. HOT_IDS를 전체 비우고 이번 트렌딩 ID로 교체

5. LAST_UPDATED를 현재 시각(UTC ISO)으로 갱신

## 5단계: 빌드 + 로깅 + 커밋

1. `node build.js` 실행 (키워드 페이지 + sitemap + keywords-index.txt 재생성)

2. log.md 맨 위에 추가 (현재 시각 분 단위):
```
## YYYY-MM-DD HH:MM
- 추가: id-1, id-2, ...
- HOT: hot-1, hot-2, ...
- 보강: (있으면 기재, 없으면 "없음")
```

3. git add → 한국어 커밋 메시지 → git push
