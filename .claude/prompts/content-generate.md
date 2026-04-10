아래 검색 데이터를 바탕으로 각 키워드의 AI Wiki 항목을 작성하라.

## 키워드별 검색 데이터
{SOURCES_DATA}

## 기존 키워드 ID 목록 (rel 연결용)
{KEYWORDS_INDEX}

## 콘텐츠 작성 규칙

### sum (요약)
- 1~2문장. 이 기술이 뭔지 + 왜 쓰는지.
- 시장 규모나 수치로 시작 금지.

### det (상세)
- `<h4>`로 섹션 구분, `<p>`로 문단 구분. 줄글(prose) 중심, 글머리표 금지.
- 섹션 순서: 개념 설명 → 사용 예시 → 심화(선택) → 주의점(선택)
- 사용 예시는 개발자 관점으로 구체적 작성.
- `<strong>`은 핵심 개념/패턴명에만. `<code>`는 실제 코드/경로/명령어에만.

### refs (레퍼런스 채택)
- 수집된 web 결과에서 공식 자료 우선 최대 5개 채택.
- 우선순위: 공식 문서 > 공식 블로그 > 논문 > 튜토리얼.

### videos (영상 채택)
- 수집된 youtube 결과에서 정확히 3개 채택 (영어 2 + 한국어 1).
- **조회수(viewCount)를 주요 판단 기준에 포함.**

### 기타
- tags: 2~4개
- c: prompting|model|tooling|data|agent|infra|safety|application
- born: 기술 최초 등장 연-월 (YYYY-MM)
- rel: 기존 키워드 ID 중 관련 있는 것만
- hot: 이번 트렌드에서 화제였으면 true, 아니면 false

### 번역
- sum과 det를 영어(en), 중국어(zh), 일본어(ja)로 번역.
- HTML 태그 유지, 기술 용어/`<code>`/브랜드명 번역 안 함.

## 출력 형식
JSON 배열만 출력하라. 설명이나 다른 텍스트 없이 순수 JSON만.

```json
[{
  "id": "kebab-case-id",
  "t": "한국어 키워드",
  "en": "English Name",
  "c": "category",
  "born": "YYYY-MM",
  "tags": ["태그1", "태그2"],
  "sum": "요약...",
  "det": "<h4>개념 설명</h4><p>...</p>",
  "rel": ["related-id-1"],
  "refs": [{"title": "제목", "url": "https://...", "type": "official"}],
  "videos": [{"title": "영상제목", "id": "youtubeId", "lang": "en"}],
  "hot": true,
  "translations": {
    "en": {"sum": "...", "det": "..."},
    "zh": {"sum": "...", "det": "..."},
    "ja": {"sum": "...", "det": "..."}
  }
}]
```
