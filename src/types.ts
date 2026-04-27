export type FieldType = "string" | "number" | "date";
export type Aggregation = "count" | "avg" | "sum" | "min" | "max";
export type FilterOperator = "eq" | "in" | "gte" | "lte" | "contains";
export type SortDirection = "asc" | "desc";

export interface AnalyticsField {
  id: string;
  label: string;
  type: FieldType;
  groupable: boolean;
  filterable: boolean;
  aggregations: Aggregation[];
}

export interface MetricRequest {
  field: string;
  aggregation: Aggregation;
}

export interface FilterRequest {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface SortRequest {
  field: string;
  direction: SortDirection;
}

export interface AnalyticsQueryRequest {
  metrics: MetricRequest[];
  dimensions: string[];
  filters: FilterRequest[];
  sort: SortRequest[];
  limit: number;
}

export interface AnalyticsColumn {
  key: string;
  label: string;
  type: FieldType;
}

export interface AnalyticsQueryResponse {
  columns: AnalyticsColumn[];
  rows: Record<string, string | number | null>[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: number;
  login: string;
  role: "admin" | "operator" | "observer";
}
