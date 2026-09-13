/**
 * fast-formula-parser ships no type declarations. This describes only the
 * surface src/lib/excel actually uses, rather than the whole library — a
 * narrower lie is easier to keep true.
 */
declare module "fast-formula-parser" {
  export interface CellPosition {
    sheet: string;
    row: number;
    col: number;
  }

  export interface RangePosition {
    sheet: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
  }

  /**
   * How an argument arrives inside a custom function: never a bare value.
   * `value` is a 2D array when the argument was a range or an array literal,
   * which is why every adapter has to flatten before handing it to formulajs.
   */
  export interface FormulaArg {
    value: unknown;
    isArray?: boolean;
    isRangeRef?: boolean;
    isCellRef?: boolean;
    isOmitted?: boolean;
    /** The parser spells it this way when an optional argument was left out. */
    omitted?: boolean;
    ref?: unknown;
  }

  /**
   * The parser passes itself as the first argument to any function named in
   * its `funsNeedContextAndNoDataRetrieve` list (SUMIF and AVERAGEIF among
   * them), and leaves those arguments as unresolved references.
   */
  export interface ParserContext {
    utils: {
      extractRefValue(arg: unknown): { val: unknown; isArray: boolean };
    };
  }

  export type CustomFunction = (...args: FormulaArg[]) => unknown;

  export interface ParserConfig {
    functions?: Record<string, CustomFunction>;
    onCell?: (position: CellPosition) => unknown;
    onRange?: (position: RangePosition) => unknown[][];
    onVariable?: (name: string, sheet: string) => unknown;
  }

  export class FormulaError extends Error {
    constructor(error: string, details?: unknown, message?: string);
    readonly name: string;
    readonly details?: unknown;
    static readonly VALUE: FormulaError;
    static readonly NAME: FormulaError;
    static readonly DIV0: FormulaError;
    static readonly NA: FormulaError;
    static readonly REF: FormulaError;
    static readonly NUM: FormulaError;
    static readonly NULL: FormulaError;
    static readonly ERROR: FormulaError;
  }

  export const FormulaHelpers: {
    flattenDeep(value: unknown[]): unknown[];
    accept(
      param: FormulaArg,
      type?: number | null,
      defValue?: unknown,
      flat?: boolean,
      allowSingleValue?: boolean,
    ): unknown;
  };

  export const Types: {
    NUMBER: 0;
    ARRAY: 1;
    BOOLEAN: 2;
    STRING: 3;
    RANGE_REF: 4;
    CELL_REF: 5;
    COLLECTIONS: 6;
    NUMBER_NO_BOOLEAN: 10;
  };

  export default class FormulaParser {
    constructor(config?: ParserConfig);
    parse(formula: string, position: CellPosition, returnAllError?: boolean): unknown;
  }
}
