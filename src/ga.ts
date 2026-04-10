import { google, analyticsdata_v1beta, analyticsadmin_v1beta } from "googleapis";
import { OAuth2Client } from "google-auth-library";

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
