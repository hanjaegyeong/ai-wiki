# 현재 진행 중인 플랜

> 시작: 2026-04-10
> 항목: 배치로직 — 직접 웹서치/유튜브 API 호출 후 에이전트는 채택만

---

## 목표
현재 에이전트(researcher, reference-collector)가 WebSearch로 직접 검색하는 구조를
→ 스크립트가 웹서치 API + YouTube Data API로 원본 데이터를 먼저 가져오고
→ 에이전트는 가져온 결과에서 가장 적합한 자료를 채택만 하는 구조로 변경.
에이전트 호출 횟수와 토큰 사용을 최소화한다.

## 확정 사항
- **웹서치 API**: Tavily Search (1,000쿼리/월 무료, 카드 불필요)
- **영상 API**: YouTube Data API v3 (10,000 units/일 무료)
- **키워드당 4쿼리**: CSE 영어 10개 + CSE 한국어 10개 + YouTube 영어 10개 + YouTube 한국어 10개
- **에이전트 역할**: 검색 안 함. 수집된 문서 20개에서 refs 5개 채택, 영상 20개에서 3개 채택 (EN2+KO1)
- **YouTube 영상 선정 기준**: 조회수(viewCount)를 판단 기준에 포함

## 미결정 사항
- 스크립트 실행 환경: Node.js (build.js 이미 있음) vs Python vs Shell
- 에이전트에 전달할 데이터 포맷: JSON 파일? 프롬프트 인라인?
- API 키 관리: .env 파일? launchd에서 접근 가능해야 함

## 체크리스트
- [ ] 웹서치 API 선정 및 API 키 발급
- [ ] YouTube Data API 키 발급 및 할당량 확인
- [ ] fetch 스크립트 작성 (웹서치 + YouTube 호출 → JSON 출력)
- [ ] 에이전트 정의 수정 (researcher.md, reference-collector.md) — 검색 대신 채택 역할로
- [ ] add-keyword 스킬 워크플로우 수정 — 스크립트 실행 → 에이전트 채택 순서로
- [ ] scheduling-add 스킬 워크플로우 수정
- [ ] .env / API 키 관리 구조 세팅 (.gitignore 포함)
- [ ] launchd 스케줄러에서 환경변수 접근 확인
- [ ] 기존 키워드 1개로 end-to-end 테스트

## 진행 로그
| 시간 | 작업 내용 |
|------|----------|
