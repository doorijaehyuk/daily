# Google Integration (김비서 전용)

## 목표
- 김비서가 Google Calendar 등록
- 김비서가 Gmail unread 확인
- 김비서가 Google Drive 파일 목록 조회

## 준비물 (형님 1회)
1. Google Cloud Console > OAuth client(Desktop app) 생성
2. JSON 다운로드 후 아래 경로에 저장:
   - `/home/doorihyuk/.openclaw/workspace/secrets/google-oauth-client.json`

## 실행 순서
1) auth URL 생성
```bash
node /home/doorihyuk/.openclaw/workspace/scripts/google-workspace.mjs auth-url
```

2) 브라우저 로그인 후 redirect URL 복사해서 교환
```bash
node /home/doorihyuk/.openclaw/workspace/scripts/google-workspace.mjs auth-exchange "http://localhost:8085/oauth2callback?..."
```

3) 테스트
```bash
node /home/doorihyuk/.openclaw/workspace/scripts/google-workspace.mjs calendar-list
node /home/doorihyuk/.openclaw/workspace/scripts/google-workspace.mjs gmail-unread
node /home/doorihyuk/.openclaw/workspace/scripts/google-workspace.mjs drive-list
```

## Apple Calendar 동기화 (형님 iPhone)
- iPhone > 설정 > 캘린더 > 계정 > 계정 추가 > Google
- 같은 Google 계정 로그인
- Calendar 동기화 ON

이후 김비서가 Google Calendar에 넣은 일정이 Apple Calendar에 표시됩니다.
