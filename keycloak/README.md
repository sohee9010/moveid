# Keycloak 설정 (`realm-export.json`)

`moveid` realm 설정을 코드로 관리한다. `docker compose up` 시 Keycloak 이 이 파일을 import 한다.

| 항목             | 설정                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인           | 이메일을 아이디로 사용, 가입·비밀번호 찾기 허용                                                                                                         |
| 언어             | `ko`(기본), `en`                                                                                                                                        |
| 비밀번호 정책    | 8~20자, 영문·숫자·특수문자(공백 제외) 각 1개 이상, 이메일과 같으면 안 됨                                                                                |
| 무차별 대입 탐지 | 5회 실패 시 15분 임시 잠금                                                                                                                              |
| 토큰·세션        | Access Token 5분, SSO 유휴 30분, 최대 10시간                                                                                                            |
| 이벤트           | 로그인·로그아웃·가입·동의 등 저장, 90일 보관 / 관리자 이벤트 저장                                                                                       |
| 메일             | Mailpit (`mailpit:1025`)                                                                                                                                |
| 클라이언트       | `moveid-account`(5173), `moveid-admin`(5174), `moveid-ride`(5175), `moveid-charge`(5176) — 모두 public + PKCE(S256) 필수. Ride·Charge 는 동의 화면 사용 |
| 역할             | `moveid-admin`(Back Office 전체), `moveid-viewer`(조회 전용)                                                                                            |
| 사용자 프로필    | `email`, `firstName`(이름, 2~20자), `birthdate`, `terms_service`·`terms_privacy`(필수 동의), `marketing_opt_in`(선택 동의). `lastName` 은 사용하지 않음 |
| Google IdP       | `${GOOGLE_CLIENT_ID}`, `${GOOGLE_CLIENT_SECRET}` 자리표시자 → `.env` 값으로 치환                                                                        |

## 설정을 바꿀 때

1. 이 파일을 수정한다. (사용자 프로필은 `components` 안의 `kc.user.profile.config` 에 **JSON 문자열**로 들어 있다)
2. `pnpm kc:reset` — 볼륨까지 지우고 다시 import 한다.
   `--import-realm` 은 realm 이 이미 있으면 건너뛰기 때문에, 그냥 재시작하면 반영되지 않는다.

관리 콘솔(http://localhost:8080/admin)에서 바꾼 설정은 이 파일에 반영되지 않으므로, 확인용으로만 쓰고 최종 설정은 이 파일에 옮긴다.
