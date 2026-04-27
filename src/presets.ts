import type { ReportPreset } from "./types";

export const REPORT_PRESETS: ReportPreset[] = [
  {
    id: "military-specialty-distribution",
    title: "Распределение по ВУС",
    description: "Количество кандидатов и курсантов по военно-учетным специальностям.",
    chartType: "bar",
    query: {
      metrics: [{ field: "student_count", aggregation: "count" }],
      dimensions: ["military_specialty"],
      filters: [],
      sort: [{ field: "student_count", direction: "desc" }],
      limit: 100,
    },
  },
  {
    id: "selection-statuses",
    title: "Статусы отбора",
    description: "Сколько записей находится в каждом статусе конкурсного отбора.",
    chartType: "pie",
    query: {
      metrics: [{ field: "student_count", aggregation: "count" }],
      dimensions: ["status"],
      filters: [],
      sort: [{ field: "student_count", direction: "desc" }],
      limit: 100,
    },
  },
  {
    id: "avg-final-by-group",
    title: "Средний итоговый балл по группам",
    description: "Сравнение среднего итогового результата между учебными группами.",
    chartType: "bar",
    query: {
      metrics: [{ field: "final_result", aggregation: "avg" }],
      dimensions: ["study_group"],
      filters: [],
      sort: [{ field: "avg_final_result", direction: "desc" }],
      limit: 100,
    },
  },
  {
    id: "avg-grade-by-institute",
    title: "Средний балл по институтам",
    description: "Средняя успеваемость по 100-балльной шкале в разрезе институтов.",
    chartType: "bar",
    query: {
      metrics: [{ field: "grade100", aggregation: "avg" }],
      dimensions: ["institute"],
      filters: [],
      sort: [{ field: "avg_grade100", direction: "desc" }],
      limit: 100,
    },
  },
  {
    id: "physical-by-platoon",
    title: "Физподготовка по взводам",
    description: "Средняя сумма баллов физической подготовки по взводам.",
    chartType: "line",
    query: {
      metrics: [{ field: "total_points", aggregation: "avg" }],
      dimensions: ["platoon"],
      filters: [],
      sort: [{ field: "platoon", direction: "asc" }],
      limit: 100,
    },
  },
  {
    id: "fitness-categories",
    title: "Категории годности",
    description: "Распределение по категориям годности к военной службе.",
    chartType: "pie",
    query: {
      metrics: [{ field: "student_count", aggregation: "count" }],
      dimensions: ["fitness_category"],
      filters: [],
      sort: [{ field: "student_count", direction: "desc" }],
      limit: 100,
    },
  },
];
