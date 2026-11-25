# MoveID

가상 모빌리티 그룹의 여러 서비스를 아이디 하나로 이용하는 **통합 계정(SSO) 서비스**입니다.
Keycloak 기반 OAuth 2.0 / OpenID Connect 위에 고객용 계정 관리(Front Office), 관리자 화면(Back Office), 로그인 화면, SSO 데모 서비스를 React로 구현합니다.

> 통합 계정 서비스 업무를 이해하기 위해 만든 **학습용 가상 서비스**이며, 실제 기업·서비스와 관련이 없습니다.

🚧 개발 중입니다. 인증 흐름도와 시연 영상은 완성 후 추가합니다.

## 실행 방법

필요한 것: Node 24 이상, pnpm, Docker Desktop

```bash
cp .env.example .env      # 값 채우기 (Google 로그인은 비워 둬도 됨)
pnpm install
pnpm kc:up                # PostgreSQL + Keycloak + Mailpit 실행, 준비될 때까지 대기
pnpm dev                  # 앱 4개 실행
```

| 주소                  | 내용                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| http://localhost:5173 | MoveID 내 계정 (Front Office)                                         |
| http://localhost:5174 | MoveID 관리자 (Back Office)                                           |
| http://localhost:5175 | MoveID Ride (SSO 데모)                                                |
| http://localhost:5176 | MoveID Charge (SSO 데모)                                              |
| http://localhost:8080 | Keycloak (관리 콘솔: `/admin`, `.env` 의 `KC_BOOTSTRAP_ADMIN_*` 계정) |
| http://localhost:8025 | Mailpit (발송된 메일 확인)                                            |

| 명령                          | 설명                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `pnpm kc:up` / `pnpm kc:down` | 인증 환경 실행 / 중지 (데이터 유지)                         |
| `pnpm kc:reset`               | 데이터를 지우고 `keycloak/realm-export.json` 을 다시 import |
| `pnpm kc:logs`                | Keycloak 로그 보기                                          |

Keycloak 설정 내용은 [keycloak/README.md](keycloak/README.md)를 참고하세요.
