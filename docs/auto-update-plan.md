# AI Wiki 자동 업데이트 계획

## 개요

맥북 상시 가동 + Claude Code CLI로 콘텐츠를 자동 갱신하는 구조.
구독 내 사용이므로 추가 비용 없음.

---

## 스케줄

| 작업 | 주기 | 시간 |
|------|------|------|
| 키워드 발굴 + 글쓰기 | 매일 | 매일 09:00 |

---

## 실행 구조

```
crontab (macOS)
│
└─ 매일 09:00: 키워드 발굴 + 글쓰기
    └─ claude --dangerously-skip-permissions -p "프롬프트"
        ├─ 다중 소스에서 최근 AI 핫 토픽 수집
        ├─ 기존 목록에 없는 키워드를 찾은 만큼 선정
        ├─ 키워드당 에이전트 3종 병렬 (researcher + reference-collector + importance-analyst)
        └─ index.html 반영 → 커밋+푸시
```

### 실행 방법

```bash
# crontab -e
0 9 * * * cd ~/Desktop/dev/ai-wiki && claude --dangerously-skip-permissions -p "$(cat .claude/prompts/daily-keyword.md)" >> logs/daily.log 2>&1
```

프롬프트는 `.claude/prompts/daily-keyword.md`에서 관리.

---

## 프롬프트 설계

- **daily-keyword.md**: 최근 **48시간** 이내 콘텐츠 대상, WebSearch 쿼리에 오늘 날짜 포함

---

## 데이터 소스

### 키워드 발굴용

| 소스 | 방법 | 강점 |
|------|------|------|
| GeekNews | MCP (get_articles, get_weekly_news) | 한국 개발자 커뮤니티 트렌드 |
| Hacker News | WebSearch `site:news.ycombinator.com` | 글로벌 테크 커뮤니티 |
| Reddit | WebSearch `site:reddit.com r/MachineLearning OR r/LocalLLaMA` | 연구/오픈소스 커뮤니티 |
| 테크 뉴스 | WebSearch (TechCrunch, The Verge 등) | 산업 동향 |
| arXiv | WebSearch `site:arxiv.org` | 학계 최신 연구 |

### 중요도 평가용 (키워드 등록 시 1회)

| 소스 | 방법 |
|------|------|
| GeekNews | MCP |
| GitHub | WebSearch (레포 수, 스타 규모) |
| arXiv | WebSearch (논문 수) |
| Stack Overflow | WebSearch (질문 수) |

---

## 품질 보장

| 항목 | 방법 |
|------|------|
| 글 톤/구조 | CLAUDE.md 콘텐츠 컨벤션이 자동 로드됨 |
| 중요도 근거 | importance-analyst가 reason 명시 |
| 이상 감지 | 로그 파일(logs/)로 실행 결과 추적 |
| 롤백 | 매 실행이 별도 커밋이므로 git revert로 즉시 복구 |
| 부재 시 | 키워드 없으면 기존 항목 보강으로 전환 (빈 커밋 방지) |

---

## 파일 구조

```
.claude/
├── prompts/
│   └── daily-keyword.md    # 매일 키워드 발굴 프롬프트
logs/
└── daily.log               # 일일 실행 로그
```

---

## 구현 순서

| 순서 | 작업 |
|------|------|
| 1 | .claude/prompts/daily-keyword.md 프롬프트 파일 작성 ✅ |
| 2 | crontab 등록 |
| 3 | 수동 1회 테스트 실행 후 검증 |
