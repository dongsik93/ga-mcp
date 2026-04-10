#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient } from "./auth.js";
import { GA4Client } from "./ga.js";

const CLIENT_SECRET_PATH =
  process.env.GA_CLIENT_SECRET_PATH ||
  new URL("../client_secret.json", import.meta.url).pathname;

let ga4: GA4Client | null = null;

async function getGA4(): Promise<GA4Client> {
  if (!ga4) {
    const auth = await getAuthenticatedClient(CLIENT_SECRET_PATH);
    ga4 = new GA4Client(auth);
  }
  return ga4;
}

const server = new McpServer({
  name: "ga-mcp",
  version: "0.1.0",
});

// --- Tools ---

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
  "GA4 커스텀 리포트 실행. 원하는 메트릭과 디멘션을 자유롭게 조합 가능",
  {
    propertyId: z.string().describe("GA4 속성 ID (숫자)"),
    startDate: z.string().describe("시작일 (YYYY-MM-DD 또는 7daysAgo, 30daysAgo 등)"),
    endDate: z.string().describe("종료일 (YYYY-MM-DD 또는 today, yesterday 등)"),
    metrics: z
      .array(z.string())
      .describe(
        "메트릭 목록 (예: totalUsers, sessions, screenPageViews, bounceRate, averageSessionDuration)"
      ),
    dimensions: z
      .array(z.string())
      .optional()
      .describe(
        "디멘션 목록 (예: pagePath, pageTitle, sessionSource, country, city, date, deviceCategory)"
      ),
    limit: z.number().optional().describe("최대 행 수 (기본 100)"),
    orderBy: z.string().optional().describe("정렬 기준 필드명"),
    orderDesc: z.boolean().optional().describe("내림차순 여부 (기본 true)"),
  },
  async (params) => {
    const client = await getGA4();
    const result = await client.runReport(params);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_top_pages",
  "인기 페이지 조회 (페이지뷰, 세션, 체류시간, 이탈률)",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getTopPages(propertyId, startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_traffic_sources",
  "트래픽 소스 분석 (소스/매체별 세션, 사용자, 이탈률)",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getTrafficSources(propertyId, startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_user_overview",
  "사용자 개요 (총 사용자, 신규, 세션, 페이지뷰, 체류시간, 이탈률 등)",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
  },
  async ({ propertyId, startDate, endDate }) => {
    const client = await getGA4();
    const result = await client.getUserOverview(propertyId, startDate, endDate);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_users_by_country",
  "국가별 사용자 분석",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
    limit: z.number().optional().describe("최대 행 수 (기본 20)"),
  },
  async ({ propertyId, startDate, endDate, limit }) => {
    const client = await getGA4();
    const result = await client.getUsersByCountry(propertyId, startDate, endDate, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_users_by_device",
  "기기별 사용자 분석 (desktop, mobile, tablet)",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
  },
  async ({ propertyId, startDate, endDate }) => {
    const client = await getGA4();
    const result = await client.getUsersByDevice(propertyId, startDate, endDate);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_trend_by_date",
  "일별 트렌드 분석 (페이지뷰, 세션, 사용자 추이)",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
    startDate: z.string().describe("시작일"),
    endDate: z.string().describe("종료일"),
  },
  async ({ propertyId, startDate, endDate }) => {
    const client = await getGA4();
    const result = await client.getPagesByDate(propertyId, startDate, endDate);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "get_realtime",
  "실시간 활성 사용자 및 페이지뷰 조회",
  {
    propertyId: z.string().describe("GA4 속성 ID"),
  },
  async ({ propertyId }) => {
    const client = await getGA4();
    const result = await client.getRealtimeReport(propertyId);
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
