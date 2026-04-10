# ga-mcp

Google Analytics 4 데이터를 Claude Desktop에서 바로 조회·분석할 수 있는 MCP 서버입니다.

## 기능

### 기본 조회
| 도구 | 설명 |
|---|---|
| `list_accounts` | GA4 계정 목록 조회 |
| `list_properties` | 계정 내 속성(Property) 목록 조회 |
| `run_report` | 커스텀 리포트 실행 (메트릭/디멘션 자유 조합, 디멘션 필터 지원) |

### 페이지/트래픽 분석
| 도구 | 설명 |
|---|---|
| `get_top_pages` | 인기 페이지 (페이지뷰, 세션, 체류시간, 이탈률) |
| `get_traffic_sources` | 트래픽 소스 분석 (소스/매체별) |

### 사용자 분석
| 도구 | 설명 |
|---|---|
| `get_user_overview` | 사용자 개요 (총 사용자, 신규, 세션, 페이지뷰 등) |
| `get_users_by_country` | 국가별 사용자 분석 |
| `get_users_by_device` | 기기별 사용자 분석 (desktop, mobile, tablet) |

### 트렌드/실시간
| 도구 | 설명 |
|---|---|
| `get_trend_by_date` | 일별 트렌드 (페이지뷰, 세션, 사용자 추이) |
| `get_realtime` | 실시간 활성 사용자 및 페이지뷰 |

### 캠페인 분석
| 도구 | 설명 |
|---|---|
| `get_campaign_performance` | 캠페인 성과 분석 (세션, 사용자, 전환, 이탈률). 캠페인명 필터 가능 |
| `get_utm_breakdown` | UTM 파라미터 전체 분석 (campaign, source, medium, content, keyword) |
| `compare_campaigns` | 여러 캠페인 성과 비교 |

### 메타데이터
| 도구 | 설명 |
|---|---|
| `get_metadata` | 사용 가능한 모든 메트릭/디멘션 목록 조회 |
| `search_metadata` | 키워드로 메트릭/디멘션 검색 |
| `list_categories` | 메트릭/디멘션 카테고리 목록 |

## 사전 준비

### Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 또는 선택
2. **APIs & Services → Library** → "Google Analytics Data API" 활성화
3. **APIs & Services → Library** → "Google Analytics Admin API" 활성화
4. **APIs & Services → Credentials** → **OAuth 2.0 Client ID** 생성 (유형: Desktop app)
5. JSON 다운로드 → `client_secret.json`으로 저장

## 설치 및 실행

### Claude Desktop 설정

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "ga": {
      "command": "npx",
      "args": ["-y", "ga-mcp"],
      "env": {
        "GA_CLIENT_SECRET_PATH": "/path/to/client_secret.json",
        "GA4_PROPERTY_ID": "123456789"
      }
    }
  }
}
```

> Windows의 경우 경로 예시: `"C:\\Users\\사용자명\\client_secret.json"`

### 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `GA_CLIENT_SECRET_PATH` | 예 | OAuth client_secret.json 파일 경로 |
| `GA4_PROPERTY_ID` | 아니오 | 기본 GA4 속성 ID. 설정하면 매번 propertyId를 입력하지 않아도 됨 |

### 첫 실행

Claude Desktop을 재시작하면 최초 1회 브라우저가 열리며 Google 로그인을 요청합니다.
로그인 완료 후 토큰이 자동 저장되어 이후에는 별도 인증 없이 사용 가능합니다.

## 사용 예시

Claude Desktop에서 자연어로 질문하면 됩니다:

- "우리 사이트 지난 30일 인기 페이지 보여줘"
- "이번 달 트래픽 소스 분석해줘"
- "지난주 대비 이번주 사용자 수 비교해줘"
- "국가별 사용자 분포 알려줘"
- "지금 실시간 접속자 몇 명이야?"
- "spring_sale 캠페인 성과 보여줘"
- "UTM 파라미터별 유입 현황 분석해줘"
- "A캠페인이랑 B캠페인 성과 비교해줘"
- "GA4에서 campaign 관련 디멘션 뭐가 있어?"

## 디멘션 필터

`run_report`에서 디멘션 필터를 사용하면 특정 조건의 데이터만 조회할 수 있습니다:

```
"지난 30일 /blog로 시작하는 페이지만 보여줘"
→ dimensionFilter: { fieldName: "pagePath", matchType: "BEGINS_WITH", value: "/blog" }

"google에서 유입된 트래픽만 분석해줘"
→ dimensionFilter: { fieldName: "sessionSource", matchType: "EXACT", value: "google" }
```

지원하는 매칭 방식: `EXACT`, `BEGINS_WITH`, `ENDS_WITH`, `CONTAINS`, `REGEXP`

## 라이선스

MIT
