#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient } from "./auth.js";
import { GA4Client } from "./ga.js";

const CLIENT_SECRET_PATH =
  process.env.GA_CLIENT_SECRET_PATH ||
  new URL("../client_secret.json", import.meta.url).pathname;

const DEFAULT_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "";

let ga4: GA4Client | null = null;

async function getGA4(): Promise<GA4Client> {
  if (!ga4) {
    const auth = await getAuthenticatedClient(CLIENT_SECRET_PATH);
    ga4 = new GA4Client(auth);
  }
  return ga4;
}

function resolvePropertyId(propertyId?: string): string {
  const id = propertyId || DEFAULT_PROPERTY_ID;
  if (!id) {
    throw new Error(
      "propertyId가 필요합니다. 파라미터로 전달하거나 GA4_PROPERTY_ID 환경변수를 설정하세요."
    );
  }
  return id;
}

const server = new McpServer({
  name: "ga-mcp",
  version: "0.2.0",
});

// propertyId 스키마: 환경변수 설정 시 선택, 미설정 시 필수
const propertyIdSchema = DEFAULT_PROPERTY_ID
  ? z.string().optional().describe("GA4 속성 ID (미입력 시 환경변수 GA4_PROPERTY_ID 사용)")
  : z.string().describe("GA4 속성 ID (숫자)");

const dimensionFilterSchema = z
  .array(
    z.object({
      fieldName: z.string().describe("필터 대상 디멘션 (예: pagePath, sessionCampaignName)"),
      matchType: z
        .enum(["EXACT", "BEGINS_WITH", "ENDS_WITH", "CONTAINS", "REGEXP"])
        .describe("매칭 방식"),
      value: z.string().describe("필터 값"),
      caseSensitive: z.boolean().optional().describe("대소문자 구분 (기본 false)"),
    })
  )
  .optional()
  .describe("디멘션 필터 목록");

// --- 기본 도구 ---

server.tool(
  "list_accounts",
  "GA4 계정 목록 조회",
  {},
  async () => {
    const client = await getGA4();
    const accounts = await client.listAccounts();
    return {
      content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }],
    };
  }
);

server.tool(
  "list_properties",
  "GA4 속성(Property) 목록 조회",
  { accountId: z.string().describe("GA4 계정 ID (숫자)") },
  async ({ accountId }) => {
    const client = await getGA4();
    const properties = await client.listProperties(accountId);
    return {
      content: [{ type: "text", text: JSON.stringify(properties, null, 2) }],
    };
  }
);

server.tool(
  "run_report",
  "GA4 커스텀 리포트 실행. 원하는 메트릭과 디멘션을 자유롭게 조합 가능. 디멘션 필터로 특정 조건 필터링 가능",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일 (YYYY-MM-DD 또는 7daysAgo, 30daysAgo 등)"),
    endDate: z.string().describe("종료일 (YYYY-MM-DD 또는 today, yesterday 등)"),
    metrics: z
      .array(z.string())
      .describe(
        "메트릭 목록 (예: totalUsers, sessions, screenPageViews, bounceRate, averageSessionDuration, conversions)"
      ),
    dimensions: z
      .array(z.string())
      .optional()
      .describe(
        "디멘션 목록 (예: pagePath, pageTitle, sessionSource, sessionMedium, sessionCampaignName, country, city, date, deviceCategory)"
      ),
    dimensionFilters: dimensionFilterSchema,
    limit: z.number().optional().describe("최대 행 수 (기본 100)"),
    orderBy: z.string().optional().describe("정렬 기준 필드명"),
    orderDesc: z.boolean().optional().describe("내림차순 여부 (기본 true)"),
  },
  async (params) => {
    const client = await getGA4();
    const result = await client.runReport({
      ...params,
      propertyId: resolvePropertyId(params.propertyId),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- 페이지/트래픽 분석 ---

server.tool(
  "get_top_pages",
  "인기 페이지 조회 (페이지뷰, 세션, 체류시간, 이탈률)",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getTopPages(resolvePropertyId(propertyId), startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_traffic_sources",
  "트래픽 소스 분석 (소스/매체별 세션, 사용자, 이탈률)",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getTrafficSources(resolvePropertyId(propertyId), startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- 사용자 분석 ---

server.tool(
  "get_user_overview",
  "사용자 개요 (총 사용자, 신규, 세션, 페이지뷰, 체류시간, 이탈률 등)",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
  },
  async ({ propertyId, startDate, endDate }) => {
    const client = await getGA4();
    const result = await client.getUserOverview(resolvePropertyId(propertyId), startDate, endDate);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_users_by_country",
  "국가별 사용자 분석",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getUsersByCountry(resolvePropertyId(propertyId), startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_users_by_device",
  "기기별 사용자 분석 (desktop, mobile, tablet)",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
  },
  async ({ propertyId, startDate, endDate }) => {
    const client = await getGA4();
    const result = await client.getUsersByDevice(resolvePropertyId(propertyId), startDate, endDate);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- 트렌드/실시간 ---

server.tool(
  "get_trend_by_date",
  "일별 트렌드 분석 (페이지뷰, 세션, 사용자 추이)",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
  },
  async ({ propertyId, startDate, endDate }) => {
    const client = await getGA4();
    const result = await client.getPagesByDate(resolvePropertyId(propertyId), startDate, endDate);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_realtime",
  "실시간 활성 사용자 및 페이지뷰 조회",
  {
    propertyId: propertyIdSchema,
  },
  async ({ propertyId }) => {
    const client = await getGA4();
    const result = await client.getRealtimeReport(resolvePropertyId(propertyId));
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- 캠페인 분석 ---

server.tool(
  "get_campaign_performance",
  "캠페인 성과 분석 (캠페인별 세션, 사용자, 전환, 이탈률). 캠페인명으로 필터 가능",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    campaignName: z.string().optional().describe("특정 캠페인명으로 필터 (부분 일치)"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, campaignName, limit }) => {
    const client = await getGA4();
    const result = await client.getCampaignPerformance(
      resolvePropertyId(propertyId),
      startDate,
      endDate,
      limit,
      campaignName,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_utm_breakdown",
  "UTM 파라미터 전체 분석 (campaign, source, medium, content, keyword)",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 30)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getUtmBreakdown(resolvePropertyId(propertyId), startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "compare_campaigns",
  "여러 캠페인 성과 비교. 캠페인명을 배열로 전달하면 각각의 성과를 비교",
  {
    propertyId: propertyIdSchema,
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    campaignNames: z
      .array(z.string())
      .describe("비교할 캠페인명 목록 (정확히 일치)"),
  },
  async ({ propertyId, startDate, endDate, campaignNames }) => {
    const client = await getGA4();
    const result = await client.getCampaignComparison(
      resolvePropertyId(propertyId),
      startDate,
      endDate,
      campaignNames,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- 메타데이터 ---

server.tool(
  "get_metadata",
  "사용 가능한 모든 메트릭/디멘션 목록 조회. 어떤 데이터를 조회할 수 있는지 확인할 때 사용",
  {
    propertyId: propertyIdSchema,
    type: z.enum(["dimensions", "metrics", "both"]).optional().describe("조회 유형 (기본 both)"),
  },
  async ({ propertyId, type }) => {
    const client = await getGA4();
    const metadata = await client.getMetadata(resolvePropertyId(propertyId));
    const result =
      type === "dimensions"
        ? { dimensions: metadata.dimensions }
        : type === "metrics"
          ? { metrics: metadata.metrics }
          : metadata;
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "search_metadata",
  "메트릭/디멘션 키워드 검색. 예: 'campaign', 'user', 'page' 등으로 관련 필드 찾기",
  {
    propertyId: propertyIdSchema,
    keyword: z.string().describe("검색 키워드"),
    type: z
      .enum(["dimensions", "metrics"])
      .optional()
      .describe("검색 대상 유형 (미지정 시 전체)"),
  },
  async ({ propertyId, keyword, type }) => {
    const client = await getGA4();
    const result = await client.searchMetadata(resolvePropertyId(propertyId), keyword, type);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "list_categories",
  "메트릭/디멘션 카테고리 목록 조회",
  {
    propertyId: propertyIdSchema,
  },
  async ({ propertyId }) => {
    const client = await getGA4();
    const result = await client.listCategories(resolvePropertyId(propertyId));
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export { main };
