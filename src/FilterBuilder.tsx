import { useMemo, useState } from "react";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import type { AnalyticsField, FilterDraft, FilterOperator } from "./types";

interface FilterBuilderProps {
  fieldValues: Record<string, Array<string | number>>;
  fields: AnalyticsField[];
  filters: FilterDraft[];
  onAdd: () => void;
  onChange: (filter: FilterDraft) => void;
  onLoadValues: (fieldId: string) => void;
  onRemove: (filterId: string) => void;
}

export function FilterBuilder({
  fieldValues,
  fields,
  filters,
  onAdd,
  onChange,
  onLoadValues,
  onRemove,
}: FilterBuilderProps) {
  return (
    <Field label="Фильтры">
      <div className="grid gap-3">
        {filters.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Фильтров нет. Все добавленные фильтры применяются через AND.
          </p>
        )}
        {filters.map((filter) => (
          <FilterRow
            fieldValues={fieldValues[filter.field] ?? []}
            fields={fields}
            filter={filter}
            key={filter.id}
            onChange={onChange}
            onLoadValues={onLoadValues}
            onRemove={onRemove}
          />
        ))}
        <Button className="w-fit" onClick={onAdd} type="button" variant="outline">
          + Добавить фильтр
        </Button>
      </div>
    </Field>
  );
}

function FilterRow({
  fieldValues,
  fields,
  filter,
  onChange,
  onLoadValues,
  onRemove,
}: {
  fieldValues: Array<string | number>;
  fields: AnalyticsField[];
  filter: FilterDraft;
  onChange: (filter: FilterDraft) => void;
  onLoadValues: (fieldId: string) => void;
  onRemove: (filterId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedField = fields.find((field) => field.id === filter.field);
  const operators = getOperatorsForField(selectedField);
  const shouldUseMultiSelect = filter.operator === "in";
  const visibleValues = useMemo(
    () =>
      fieldValues
        .map((value) => String(value))
        .filter((value) => value.toLowerCase().includes(search.toLowerCase())),
    [fieldValues, search],
  );

  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 p-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_160px_auto]">
        <Select
          value={filter.field}
          onChange={(event) => {
            const nextField = fields.find((field) => field.id === event.target.value);
            const nextFilter = {
              ...filter,
              field: event.target.value,
              operator: getOperatorsForField(nextField)[0],
              value: "",
              values: [],
            };
            onChange(nextFilter);
            onLoadValues(nextFilter.field);
            setSearch("");
          }}
        >
          {fields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.label}
            </option>
          ))}
        </Select>
        <Select
          value={filter.operator}
          onChange={(event) =>
            onChange({
              ...filter,
              operator: event.target.value as FilterOperator,
              value: "",
              values: [],
            })
          }
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </Select>
        <Button onClick={() => onRemove(filter.id)} type="button" variant="outline">
          Удалить
        </Button>
      </div>

      {shouldUseMultiSelect ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-md"
              onFocus={() => onLoadValues(filter.field)}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по значениям"
              value={search}
            />
            <span className="text-sm text-slate-500">
              Выбрано: {filter.values.length}
            </span>
          </div>
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 p-2">
            {visibleValues.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">
                Значения не загружены или ничего не найдено.
              </p>
            ) : (
              <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
                {visibleValues.map((value) => (
                  <label
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                    key={value}
                  >
                    <input
                      checked={filter.values.includes(value)}
                      onChange={() => onChange(toggleFilterValue(filter, value))}
                      type="checkbox"
                    />
                    <span className="truncate" title={value}>
                      {value}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {filter.values.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filter.values.map((value) => (
                <button
                  className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                  key={value}
                  onClick={() => onChange(toggleFilterValue(filter, value))}
                  type="button"
                >
                  {value} x
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Input
          onChange={(event) => onChange({ ...filter, value: event.target.value })}
          placeholder="Значение фильтра"
          value={filter.value}
        />
      )}
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function toggleFilterValue(filter: FilterDraft, value: string): FilterDraft {
  return {
    ...filter,
    values: filter.values.includes(value)
      ? filter.values.filter((selectedValue) => selectedValue !== value)
      : [...filter.values, value],
  };
}

export function getOperatorsForField(field?: AnalyticsField): FilterOperator[] {
  if (!field) {
    return ["in"];
  }
  if (field.type === "string") {
    return ["in", "eq", "contains"];
  }
  return ["eq", "gte", "lte", "in"];
}
