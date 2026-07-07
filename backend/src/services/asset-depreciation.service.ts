import type {
  IAssetScheduleRow,
  AssetScheduleRowSource,
} from "../models/asset.model";
import type { AssetDepreciationMethod } from "../models/asset-category.model";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DepreciationParamsInput {
  purchaseCost: number;
  availableForUseDate: Date;
  method: AssetDepreciationMethod;
  usefulLifeMonths: number;
  salvagePercentage: number;
  wdvRatePercentage: number;
  openingAccumulatedDepreciation: number;
}

export interface ScheduleRow {
  periodStartDate: Date;
  periodEndDate: Date;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValueAtEnd: number;
  source: AssetScheduleRowSource;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Normalize to UTC midnight so day math is timezone-safe. */
export function toUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function addMonthsUtc(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate()
    )
  );
}

/** Inclusive day count between two UTC-midnight dates. */
function dayCount(startInclusive: Date, endInclusive: Date): number {
  return Math.round((endInclusive.getTime() - startInclusive.getTime()) / MS_PER_DAY) + 1;
}

/** Indian fiscal year: April 1 – March 31. Returns the March 31 ending the FY containing `date`. */
function fiscalYearEndInclusive(date: Date): Date {
  const year = date.getUTCMonth() >= 3 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  return new Date(Date.UTC(year, 2, 31));
}

function fiscalYearStart(fyEndInclusive: Date): Date {
  return new Date(Date.UTC(fyEndInclusive.getUTCFullYear() - 1, 3, 1));
}

function salvageValueOf(params: Pick<DepreciationParamsInput, "purchaseCost" | "salvagePercentage">): number {
  return round2((params.purchaseCost * params.salvagePercentage) / 100);
}

interface SegmentGenerationInput {
  segmentsStart: Date;
  endOfLifeInclusive: Date;
  startingBookValue: number;
  purchaseCost: number;
  salvageValue: number;
  method: AssetDepreciationMethod;
  wdvRatePercentage: number;
  source: AssetScheduleRowSource;
}

/**
 * Generates fiscal-year rows from `segmentsStart` to the end of life, depreciating
 * `startingBookValue` down towards the salvage floor. Shared by initial schedule
 * generation and post-adjustment regeneration.
 */
function generateSegments(input: SegmentGenerationInput): ScheduleRow[] {
  const {
    segmentsStart,
    endOfLifeInclusive,
    startingBookValue,
    purchaseCost,
    salvageValue,
    method,
    wdvRatePercentage,
    source,
  } = input;

  const rows: ScheduleRow[] = [];
  if (segmentsStart > endOfLifeInclusive) return rows;

  const totalDays = dayCount(segmentsStart, endOfLifeInclusive);
  const straightLineBase = Math.max(0, startingBookValue - salvageValue);
  const dailyRate = straightLineBase / totalDays;

  let bookValue = startingBookValue;
  let segStart = segmentsStart;

  while (segStart <= endOfLifeInclusive) {
    const fyEnd = fiscalYearEndInclusive(segStart);
    const segEnd = fyEnd < endOfLifeInclusive ? fyEnd : endOfLifeInclusive;
    const segDays = dayCount(segStart, segEnd);
    const isLastSegment = segEnd.getTime() === endOfLifeInclusive.getTime();

    let amount: number;
    if (method === "straight_line") {
      amount = isLastSegment
        ? round2(Math.max(0, bookValue - salvageValue))
        : round2(dailyRate * segDays);
    } else {
      const fullFyDays = dayCount(fiscalYearStart(fyEnd), fyEnd);
      amount = round2(bookValue * (wdvRatePercentage / 100) * (segDays / fullFyDays));
    }

    amount = Math.min(amount, round2(Math.max(0, bookValue - salvageValue)));
    bookValue = round2(bookValue - amount);

    rows.push({
      periodStartDate: segStart,
      periodEndDate: segEnd,
      depreciationAmount: amount,
      accumulatedDepreciation: round2(purchaseCost - bookValue),
      bookValueAtEnd: bookValue,
      source,
    });

    if (bookValue <= salvageValue) break;
    segStart = addDays(segEnd, 1);
  }

  return rows;
}

/**
 * Builds the full depreciation schedule from the available-for-use date over the
 * useful life. For imported mid-life assets, `openingAccumulatedDepreciation` is
 * treated as already booked: the remaining base is spread over the configured life.
 */
export function generateSchedule(params: DepreciationParamsInput): ScheduleRow[] {
  const start = toUtcDay(params.availableForUseDate);
  const endOfLifeInclusive = addDays(addMonthsUtc(start, params.usefulLifeMonths), -1);
  const salvageValue = salvageValueOf(params);
  const startingBookValue = round2(
    Math.max(0, params.purchaseCost - params.openingAccumulatedDepreciation)
  );

  return generateSegments({
    segmentsStart: start,
    endOfLifeInclusive,
    startingBookValue,
    purchaseCost: params.purchaseCost,
    salvageValue,
    method: params.method,
    wdvRatePercentage: params.wdvRatePercentage,
    source: "auto",
  });
}

export interface BookValueInput {
  purchaseCost: number;
  openingAccumulatedDepreciation: number;
  depreciationSchedule: Array<Pick<IAssetScheduleRow, "periodStartDate" | "periodEndDate" | "depreciationAmount" | "bookValueAtEnd">>;
}

/** Book value at end of day `asOf`, pro-rated daily within the containing schedule row. */
export function bookValueAsOf(input: BookValueInput, asOf: Date): number {
  const date = toUtcDay(asOf);
  const schedule = input.depreciationSchedule;
  const preScheduleValue = round2(
    Math.max(0, input.purchaseCost - input.openingAccumulatedDepreciation)
  );

  if (schedule.length === 0) return preScheduleValue;

  const first = schedule[0]!;
  if (date < toUtcDay(first.periodStartDate)) return preScheduleValue;

  let bookValueAtRowStart = preScheduleValue;
  for (const row of schedule) {
    const rowStart = toUtcDay(row.periodStartDate);
    const rowEnd = toUtcDay(row.periodEndDate);
    if (date <= rowEnd) {
      const rowDays = dayCount(rowStart, rowEnd);
      const elapsedDays = dayCount(rowStart, date);
      const accrued = row.depreciationAmount * (elapsedDays / rowDays);
      return round2(bookValueAtRowStart - accrued);
    }
    bookValueAtRowStart = row.bookValueAtEnd;
  }

  return schedule[schedule.length - 1]!.bookValueAtEnd;
}

/** Total depreciation booked up to `asOf` (purchase cost minus book value). */
export function accumulatedDepreciationAsOf(input: BookValueInput, asOf: Date): number {
  return round2(input.purchaseCost - bookValueAsOf(input, asOf));
}

export interface ValueAdjustmentInput {
  params: DepreciationParamsInput;
  schedule: IAssetScheduleRow[];
  adjustmentDate: Date;
  newValue: number;
}

export interface ValueAdjustmentResult {
  schedule: ScheduleRow[];
  previousBookValue: number;
}

/**
 * Revalues the asset at `adjustmentDate`: the schedule is truncated at that date
 * (with the containing row pro-rated) and future rows are regenerated from the
 * new value over the remaining useful life, keeping the original salvage floor.
 */
export function applyValueAdjustment(input: ValueAdjustmentInput): ValueAdjustmentResult {
  const { params, schedule, adjustmentDate, newValue } = input;
  const date = toUtcDay(adjustmentDate);
  const bookValueInput: BookValueInput = {
    purchaseCost: params.purchaseCost,
    openingAccumulatedDepreciation: params.openingAccumulatedDepreciation,
    depreciationSchedule: schedule,
  };
  const previousBookValue = bookValueAsOf(bookValueInput, date);

  const start = toUtcDay(params.availableForUseDate);
  const endOfLifeInclusive = addDays(addMonthsUtc(start, params.usefulLifeMonths), -1);
  const salvageValue = salvageValueOf(params);
  const preScheduleValue = round2(
    Math.max(0, params.purchaseCost - params.openingAccumulatedDepreciation)
  );

  const truncated: ScheduleRow[] = [];
  let bookValueAtRowStart = preScheduleValue;
  for (const row of schedule) {
    const rowStart = toUtcDay(row.periodStartDate);
    const rowEnd = toUtcDay(row.periodEndDate);

    if (rowEnd < date) {
      truncated.push({
        periodStartDate: rowStart,
        periodEndDate: rowEnd,
        depreciationAmount: row.depreciationAmount,
        accumulatedDepreciation: row.accumulatedDepreciation,
        bookValueAtEnd: row.bookValueAtEnd,
        source: row.source,
      });
      bookValueAtRowStart = row.bookValueAtEnd;
      continue;
    }

    if (rowStart <= date) {
      const clippedAmount = round2(bookValueAtRowStart - previousBookValue);
      truncated.push({
        periodStartDate: rowStart,
        periodEndDate: date,
        depreciationAmount: Math.max(0, clippedAmount),
        accumulatedDepreciation: round2(params.purchaseCost - previousBookValue),
        bookValueAtEnd: previousBookValue,
        source: row.source,
      });
    }
    break;
  }

  const regenerated = generateSegments({
    segmentsStart: addDays(date, 1),
    endOfLifeInclusive,
    startingBookValue: round2(Math.max(0, newValue)),
    purchaseCost: params.purchaseCost,
    salvageValue,
    method: params.method,
    wdvRatePercentage: params.wdvRatePercentage,
    source: "adjustment",
  });

  return { schedule: [...truncated, ...regenerated], previousBookValue };
}
