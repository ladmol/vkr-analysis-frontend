import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

import type { AnalyticsQueryResponse, ChartType } from "./types";

interface ChartViewProps {
  result: AnalyticsQueryResponse;
  chartType: ChartType;
}

export function ChartView({ result, chartType }: ChartViewProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo(
    () => buildOption(result, chartType),
    [chartType, result],
  );

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const chart = echarts.init(chartRef.current);
    chart.setOption(option);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);

  if (result.rows.length === 0) {
    return <div className="empty-state">Нет данных для построения графика</div>;
  }

  return <div className="h-[360px] w-full" ref={chartRef} />;
}

function buildOption(
  result: AnalyticsQueryResponse,
  chartType: ChartType,
): EChartsOption {
  const dimensionColumn = result.columns[0];
  const metricColumn = result.columns[1] ?? result.columns[0];
  const labels = result.rows.map((row) => String(row[dimensionColumn.key] ?? "Итого"));
  const values = result.rows.map((row) => Number(row[metricColumn.key] ?? 0));

  if (chartType === "pie") {
    return {
      tooltip: { trigger: "item" },
      legend: {
        bottom: 0,
        type: "scroll",
      },
      series: [
        {
          name: metricColumn.label,
          type: "pie",
          radius: ["42%", "70%"],
          avoidLabelOverlap: true,
          data: labels.map((label, index) => ({
            name: label,
            value: values[index],
          })),
        },
      ],
    };
  }

  return {
    tooltip: { trigger: "axis" },
    grid: {
      left: 40,
      right: 24,
      top: 32,
      bottom: 76,
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        interval: 0,
        rotate: labels.some((label) => label.length > 12) ? 25 : 0,
      },
    },
    yAxis: {
      type: "value",
    },
    series: [
      {
        name: metricColumn.label,
        type: chartType,
        data: values,
        smooth: chartType === "line",
        areaStyle: chartType === "line" ? {} : undefined,
      },
    ],
  };
}
