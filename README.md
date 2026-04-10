# ga-mcp

[한국어](docs/README.ko.md)

An MCP server for querying and analyzing Google Analytics 4 data directly from Claude Desktop.

## Features

### Basic Queries
| Tool | Description |
|---|---|
| `list_accounts` | List GA4 accounts |
| `list_properties` | List properties within an account |
| `run_report` | Run custom reports with flexible metric/dimension combinations and dimension filters |

### Page & Traffic Analysis
| Tool | Description |
|---|---|
| `get_top_pages` | Top pages by pageviews, sessions, avg. duration, bounce rate |
| `get_traffic_sources` | Traffic source breakdown by source/medium |

### User Analysis
| Tool | Description |
|---|---|
| `get_user_overview` | User overview (total users, new users, sessions, pageviews, etc.) |
| `get_users_by_country` | Users by country |
| `get_users_by_device` | Users by device category (desktop, mobile, tablet) |

### Trends & Realtime
| Tool | Description |
|---|---|
| `get_trend_by_date` | Daily trends (pageviews, sessions, users over time) |
| `get_realtime` | Realtime active users and pageviews |

### Campaign Analysis
| Tool | Description |
|---|---|
| `get_campaign_performance` | Campaign performance (sessions, users, conversions, bounce rate). Filter by campaign name |
| `get_utm_breakdown` | Full UTM parameter analysis (campaign, source, medium, content, keyword) |
| `compare_campaigns` | Compare performance across multiple campaigns |

### Metadata
| Tool | Description |
|---|---|
| `get_metadata` | List all available metrics and dimensions |
| `search_metadata` | Search metrics/dimensions by keyword |
| `list_categories` | List metric/dimension categories |

## Prerequisites

### Google Cloud Console Setup

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services → Library** → Enable "Google Analytics Data API"
3. **APIs & Services → Library** → Enable "Google Analytics Admin API"
4. **APIs & Services → Credentials** → Create **OAuth 2.0 Client ID** (type: Desktop app)
5. Download the JSON file and save as `client_secret.json`

## Installation

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

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

> Windows path example: `"C:\\Users\\username\\client_secret.json"`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GA_CLIENT_SECRET_PATH` | Yes | Path to OAuth client_secret.json file |
| `GA4_PROPERTY_ID` | No | Default GA4 property ID. When set, you don't need to specify propertyId for each request |

### First Run

On first launch, a browser window will open for Google OAuth login. After authentication, the token is saved locally and subsequent requests will authenticate automatically.

## Usage Examples

Ask questions in natural language through Claude Desktop:

- "Show me the top pages for the last 30 days"
- "Analyze traffic sources for this month"
- "Compare users this week vs last week"
- "Show user distribution by country"
- "How many users are online right now?"
- "Show performance for the spring_sale campaign"
- "Break down traffic by UTM parameters"
- "Compare campaign A vs campaign B"
- "What campaign-related dimensions are available in GA4?"

## Dimension Filters

Use dimension filters in `run_report` to narrow down results:

```
"Show only pages starting with /blog for the last 30 days"
→ dimensionFilter: { fieldName: "pagePath", matchType: "BEGINS_WITH", value: "/blog" }

"Analyze only traffic from google"
→ dimensionFilter: { fieldName: "sessionSource", matchType: "EXACT", value: "google" }
```

Supported match types: `EXACT`, `BEGINS_WITH`, `ENDS_WITH`, `CONTAINS`, `REGEXP`

## License

MIT
