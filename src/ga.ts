import { google, analyticsdata_v1beta, analyticsadmin_v1beta } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface DimensionFilter {
  fieldName: string;
  matchType: "EXACT" | "BEGINS_WITH" | "ENDS_WITH" | "CONTAINS" | "REGEXP";
  value: string;
  caseSensitive?: boolean;
}

export class GA4Client {
  private analyticsData: analyticsdata_v1beta.Analyticsdata;
  private analyticsAdmin: analyticsadmin_v1beta.Analyticsadmin;

  constructor(auth: OAuth2Client) {
    this.analyticsData = google.analyticsdata({ version: "v1beta", auth });
    this.analyticsAdmin = google.analyticsadmin({ version: "v1beta", auth });
  }

  async listAccounts() {
    const res = await this.analyticsAdmin.accounts.list();
    return (res.data.accounts || []).map((a) => ({
      name: a.name,
      displayName: a.displayName,
    }));
  }

  async listProperties(accountId: string) {
    const res = await this.analyticsAdmin.properties.list({
      filter: `parent:accounts/${accountId}`,
    });
    return (res.data.properties || []).map((p) => ({
      name: p.name,
      displayName: p.displayName,
      propertyId: p.name?.replace("properties/", ""),
    }));
  }

  async runReport(params: {
    propertyId: string;
    startDate: string;
    endDate: string;
    metrics: string[];
    dimensions?: string[];
    dimensionFilters?: DimensionFilter[];
    limit?: number;
    orderBy?: string;
    orderDesc?: boolean;
  }) {
    const request: analyticsdata_v1beta.Schema$RunReportRequest = {
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      metrics: params.metrics.map((m) => ({ name: m })),
      limit: String(params.limit || 100),
    };

    if (params.dimensions?.length) {
      request.dimensions = params.dimensions.map((d) => ({ name: d }));
    }

    if (params.dimensionFilters?.length) {
      request.dimensionFilter = this.buildDimensionFilter(params.dimensionFilters);
    }

    if (params.orderBy) {
      const isMetric = params.metrics.includes(params.orderBy);
      request.orderBys = [
        {
          desc: params.orderDesc ?? true,
          ...(isMetric
            ? { metric: { metricName: params.orderBy } }
            : { dimension: { dimensionName: params.orderBy } }),
        },
      ];
    }

    const res = await this.analyticsData.properties.runReport({
      property: `properties/${params.propertyId}`,
      requestBody: request,
    });

    return this.formatReportResponse(res.data);
  }

  // --- 편의 도구들 ---

  async getTopPages(propertyId: string, startDate: string, endDate: string, limit: number = 20) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: ["screenPageViews", "sessions", "averageSessionDuration", "bounceRate"],
      dimensions: ["pagePath", "pageTitle"],
      limit,
      orderBy: "screenPageViews",
    });
  }

  async getTrafficSources(propertyId: string, startDate: string, endDate: string, limit: number = 20) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: ["sessions", "totalUsers", "newUsers", "bounceRate"],
      dimensions: ["sessionSource", "sessionMedium"],
      limit,
      orderBy: "sessions",
    });
  }

  async getUserOverview(propertyId: string, startDate: string, endDate: string) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: [
        "totalUsers",
        "newUsers",
        "sessions",
        "screenPageViews",
        "averageSessionDuration",
        "bounceRate",
        "sessionsPerUser",
      ],
    });
  }

  async getUsersByCountry(propertyId: string, startDate: string, endDate: string, limit: number = 20) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: ["totalUsers", "sessions", "screenPageViews"],
      dimensions: ["country"],
      limit,
      orderBy: "totalUsers",
    });
  }

  async getUsersByDevice(propertyId: string, startDate: string, endDate: string) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: ["totalUsers", "sessions", "screenPageViews", "averageSessionDuration"],
      dimensions: ["deviceCategory"],
      orderBy: "totalUsers",
    });
  }

  async getPagesByDate(propertyId: string, startDate: string, endDate: string) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: ["screenPageViews", "sessions", "totalUsers"],
      dimensions: ["date"],
      orderBy: "date",
      orderDesc: false,
    });
  }

  async getRealtimeReport(propertyId: string) {
    const res = await this.analyticsData.properties.runRealtimeReport({
      property: `properties/${propertyId}`,
      requestBody: {
        metrics: [
          { name: "activeUsers" },
          { name: "screenPageViews" },
        ],
        dimensions: [
          { name: "pagePath" },
        ],
        limit: "20",
      },
    });

    return this.formatReportResponse((res as any).data);
  }

  // --- 캠페인 분석 ---

  async getCampaignPerformance(
    propertyId: string,
    startDate: string,
    endDate: string,
    limit: number = 20,
    campaignName?: string,
  ) {
    const filters: DimensionFilter[] = [];
    if (campaignName) {
      filters.push({
        fieldName: "sessionCampaignName",
        matchType: "CONTAINS",
        value: campaignName,
      });
    }

    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: [
        "sessions",
        "totalUsers",
        "newUsers",
        "screenPageViews",
        "averageSessionDuration",
        "bounceRate",
        "conversions",
      ],
      dimensions: ["sessionCampaignName", "sessionSource", "sessionMedium"],
      dimensionFilters: filters.length ? filters : undefined,
      limit,
      orderBy: "sessions",
    });
  }

  async getUtmBreakdown(
    propertyId: string,
    startDate: string,
    endDate: string,
    limit: number = 30,
  ) {
    return this.runReport({
      propertyId,
      startDate,
      endDate,
      metrics: ["sessions", "totalUsers", "newUsers", "bounceRate", "conversions"],
      dimensions: [
        "sessionCampaignName",
        "sessionSource",
        "sessionMedium",
        "sessionManualAdContent",
        "sessionGoogleAdsKeyword",
      ],
      limit,
      orderBy: "sessions",
    });
  }

  async getCampaignComparison(
    propertyId: string,
    startDate: string,
    endDate: string,
    campaignNames: string[],
  ) {
    const results: Record<string, any> = {};

    for (const name of campaignNames) {
      results[name] = await this.runReport({
        propertyId,
        startDate,
        endDate,
        metrics: [
          "sessions",
          "totalUsers",
          "newUsers",
          "screenPageViews",
          "averageSessionDuration",
          "bounceRate",
          "conversions",
        ],
        dimensions: ["sessionCampaignName"],
        dimensionFilters: [
          {
            fieldName: "sessionCampaignName",
            matchType: "EXACT",
            value: name,
          },
        ],
      });
    }

    return results;
  }

  // --- 메타데이터 ---

  async getMetadata(propertyId: string) {
    const res = await this.analyticsData.properties.getMetadata({
      name: `properties/${propertyId}/metadata`,
    });

    const dimensions = (res.data.dimensions || []).map((d) => ({
      apiName: d.apiName,
      uiName: d.uiName,
      category: d.category,
      description: d.description,
    }));

    const metrics = (res.data.metrics || []).map((m) => ({
      apiName: m.apiName,
      uiName: m.uiName,
      category: m.category,
      description: m.description,
      type: m.type,
    }));

    return { dimensions, metrics };
  }

  async searchMetadata(propertyId: string, keyword: string, type?: "dimensions" | "metrics") {
    const metadata = await this.getMetadata(propertyId);
    const lower = keyword.toLowerCase();

    const matchField = (item: any) =>
      (item.apiName?.toLowerCase().includes(lower)) ||
      (item.uiName?.toLowerCase().includes(lower)) ||
      (item.description?.toLowerCase().includes(lower)) ||
      (item.category?.toLowerCase().includes(lower));

    const result: any = {};

    if (!type || type === "dimensions") {
      result.dimensions = metadata.dimensions.filter(matchField);
    }
    if (!type || type === "metrics") {
      result.metrics = metadata.metrics.filter(matchField);
    }

    return result;
  }

  async listCategories(propertyId: string) {
    const metadata = await this.getMetadata(propertyId);

    const dimCategories = [...new Set(metadata.dimensions.map((d) => d.category).filter(Boolean))];
    const metricCategories = [...new Set(metadata.metrics.map((m) => m.category).filter(Boolean))];

    return {
      dimensionCategories: dimCategories,
      metricCategories: metricCategories,
    };
  }

  // --- 내부 유틸 ---

  private buildDimensionFilter(
    filters: DimensionFilter[]
  ): analyticsdata_v1beta.Schema$FilterExpression {
    if (filters.length === 1) {
      return {
        filter: {
          fieldName: filters[0].fieldName,
          stringFilter: {
            matchType: filters[0].matchType,
            value: filters[0].value,
            caseSensitive: filters[0].caseSensitive ?? false,
          },
        },
      };
    }

    return {
      andGroup: {
        expressions: filters.map((f) => ({
          filter: {
            fieldName: f.fieldName,
            stringFilter: {
              matchType: f.matchType,
              value: f.value,
              caseSensitive: f.caseSensitive ?? false,
            },
          },
        })),
      },
    };
  }

  private formatReportResponse(
    data: analyticsdata_v1beta.Schema$RunReportResponse | analyticsdata_v1beta.Schema$RunRealtimeReportResponse
  ) {
    const dimensionHeaders = (data.dimensionHeaders || []).map(
      (h) => h.name || "unknown"
    );
    const metricHeaders = (data.metricHeaders || []).map(
      (h) => h.name || "unknown"
    );

    const rows = (data.rows || []).map((row) => {
      const obj: Record<string, string> = {};
      (row.dimensionValues || []).forEach((v, i) => {
        obj[dimensionHeaders[i]] = v.value || "";
      });
      (row.metricValues || []).forEach((v, i) => {
        obj[metricHeaders[i]] = v.value || "";
      });
      return obj;
    });

    return {
      headers: [...dimensionHeaders, ...metricHeaders],
      rows,
      rowCount: data.rowCount || 0,
      totals: (data as any).totals,
    };
  }
}
