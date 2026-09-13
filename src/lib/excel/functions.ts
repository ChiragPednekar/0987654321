/**
 * The function surface of the Excel evaluator.
 *
 * fast-formula-parser implements much of Excel but not the criteria family —
 * SUMIFS, COUNTIFS, MATCH and friends are exactly what an analytics round asks
 * about, so the parser alone is not enough. @formulajs/formulajs implements
 * them. Bridging the two is where the care goes:
 *
 *   1. The parser hands a custom function wrapped arguments whose `value` is a
 *      2D array for a range; formulajs expects a flat array. Wiring them up
 *      naively produces a WRONG NUMBER rather than an error — COUNTIFS counted
 *      1 where Excel counts 2 until the flattening below was written.
 *   2. Worse, the parser special-cases eight names in a hardcoded list
 *      (`funsNeedContextAndNoDataRetrieve` in grammar/hooks.js). For those it
 *      passes its own context as the FIRST argument and does NOT resolve the
 *      references, so an override receives something completely different.
 *      SUMIF and AVERAGEIF are on that list, and both silently returned 0.
 *
 * Because both failure modes are silent, the rule here is: a function is
 * available to students only if it is in ALLOWED, and it only goes in ALLOWED
 * once tests/excel-runner.test.ts pins it to a hand-computed Excel value.
 */
import FormulaParser, {
  FormulaError,
  FormulaHelpers,
  type CustomFunction,
  type FormulaArg,
  type ParserContext,
} from "fast-formula-parser";
import * as formulajs from "@formulajs/formulajs";

function lookup(name: string): (...args: unknown[]) => unknown {
  const implementation = (formulajs as unknown as Record<string, unknown>)[name];
  if (typeof implementation !== "function") {
    throw new Error(`formulajs does not export a ${name} function`);
  }
  return implementation as (...args: unknown[]) => unknown;
}

function flatten(value: unknown): unknown {
  return Array.isArray(value) ? FormulaHelpers.flattenDeep(value) : value;
}

/** Unwrap an argument the parser has already resolved. */
function unwrap(arg: FormulaArg): unknown {
  if (arg === undefined || arg === null) return undefined;
  if (arg.isOmitted || arg.omitted) return undefined;
  if (arg.isArray || arg.isRangeRef) return flatten(arg.value ?? []);
  return arg.value;
}

/** Unwrap a raw reference, for the names the parser refuses to resolve for us. */
function unwrapRaw(context: ParserContext, arg: unknown): unknown {
  if (arg === undefined || arg === null) return undefined;
  return flatten(context.utils.extractRefValue(arg).val);
}

/**
 * formulajs signals failure by RETURNING an error object rather than throwing,
 * so an unmapped result would flow onward and be compared as though it were an
 * answer. Map it onto the parser's own error type, which the caller renders.
 */
function toFormulaError(value: unknown): FormulaError | null {
  if (!(value instanceof Error)) return null;
  switch (value.name) {
    case "#DIV/0!":
      return FormulaError.DIV0;
    case "#N/A":
      return FormulaError.NA;
    case "#NAME?":
      return FormulaError.NAME;
    case "#NUM!":
      return FormulaError.NUM;
    case "#REF!":
      return FormulaError.REF;
    case "#NULL!":
      return FormulaError.NULL;
    default:
      return FormulaError.VALUE;
  }
}

function finish(result: unknown): unknown {
  const error = toFormulaError(result);
  if (error) throw error;
  // Some formulajs lookups return a 1x1 array where Excel returns a scalar.
  if (Array.isArray(result) && result.length === 1 && !Array.isArray(result[0])) {
    return result[0];
  }
  return result;
}

/**
 * Names bridged from formulajs, mapped to the formulajs export that implements
 * them. Excel's plain RANK is RANK.EQ, which formulajs exports as RANKEQ.
 */
const BRIDGE_SOURCE: Record<string, string> = {
  SUMIFS: "SUMIFS",
  COUNTIF: "COUNTIF",
  COUNTIFS: "COUNTIFS",
  AVERAGEIFS: "AVERAGEIFS",
  MAXIFS: "MAXIFS",
  MINIFS: "MINIFS",
  MATCH: "MATCH",
  IFS: "IFS",
  SWITCH: "SWITCH",
  TEXTJOIN: "TEXTJOIN",
  COUNTA: "COUNTA",
  MIN: "MIN",
  MAX: "MAX",
  MEDIAN: "MEDIAN",
  LARGE: "LARGE",
  SMALL: "SMALL",
  // Excel's STDEV is the sample standard deviation, which formulajs calls STDEVS
  // (its bare STDEV export is a namespace object, not a function).
  STDEV: "STDEVS",
  RANK: "RANKEQ",
  UPPER: "UPPER",
  SUBSTITUTE: "SUBSTITUTE",
  VALUE: "VALUE",
};

/**
 * The two bridged names the parser special-cases. Keep this in step with
 * `funsNeedContextAndNoDataRetrieve` in fast-formula-parser: if a future
 * version adds a name we bridge, its arguments will arrive unresolved and the
 * answer will be quietly wrong. The conformance test is what catches that.
 */
const CONTEXT_SOURCE: Record<string, string> = {
  SUMIF: "SUMIF",
  AVERAGEIF: "AVERAGEIF",
};

export const BRIDGED = [
  ...Object.keys(BRIDGE_SOURCE),
  ...Object.keys(CONTEXT_SOURCE),
] as readonly string[];

/**
 * Implemented by the parser itself and verified in the conformance test. The
 * parser knows more than this, but an exercise may only depend on a function
 * we have actually checked — several names that look obviously present (MIN,
 * MAX, COUNTA, UPPER) are in fact NOT implemented by it, which is why they are
 * bridged above instead.
 */
export const NATIVE = [
  "SUM",
  "AVERAGE",
  "COUNT",
  "ROUND",
  "ROUNDUP",
  "ROUNDDOWN",
  "ABS",
  "IF",
  "AND",
  "OR",
  "NOT",
  "IFERROR",
  "VLOOKUP",
  "HLOOKUP",
  "INDEX",
  "SUMPRODUCT",
  "CONCATENATE",
  "LEFT",
  "RIGHT",
  "MID",
  "LEN",
  "TRIM",
  "LOWER",
  "PROPER",
  "TEXT",
  "ISBLANK",
  "ISNUMBER",
  "ISTEXT",
  "DATE",
  "YEAR",
  "MONTH",
  "DAY",
] as const;

export const ALLOWED: ReadonlySet<string> = new Set<string>([...NATIVE, ...BRIDGED]);

/** Suggestions for the functions people most often reach for and won't find. */
const SUBSTITUTES: Record<string, string> = {
  XLOOKUP: "INDEX with MATCH",
  FILTER: "SUMIFS or COUNTIFS",
  UNIQUE: "COUNTIF",
  SORT: "LARGE or SMALL",
  LET: "a plain formula",
  LAMBDA: "a plain formula",
  TEXTSPLIT: "LEFT, RIGHT or MID",
  SUMPRODUCTIF: "SUMPRODUCT with a comparison",
  AVERAGEX: "AVERAGEIFS",
};

export function substituteFor(name: string): string | null {
  return SUBSTITUTES[name.toUpperCase()] ?? null;
}

export function buildFunctions(): Record<string, CustomFunction> {
  const functions: Record<string, CustomFunction> = {};

  for (const [name, source] of Object.entries(BRIDGE_SOURCE)) {
    const fn = lookup(source);
    functions[name] = (...args: FormulaArg[]) => finish(fn(...args.map(unwrap)));
  }

  for (const [name, source] of Object.entries(CONTEXT_SOURCE)) {
    const fn = lookup(source);
    functions[name] = ((context: ParserContext, ...args: unknown[]) =>
      finish(fn(...args.map((arg) => unwrapRaw(context, arg))))) as unknown as CustomFunction;
  }

  return functions;
}

export { FormulaParser, FormulaError };
