import { checkQuerySafety } from "../tools/safetyChecker.js";
import { executeQuerySafe } from "../tools/queryExecutor.js";

/**
 * Safety Check Node
 * Validates SQL query safety with branching logic
 */
export async function safetyCheckNode(sqlQuery) {
  const safetyResult = checkQuerySafety(sqlQuery);
  
  return {
    safe: safetyResult.safe,
    issues: safetyResult.issues,
    warnings: safetyResult.warnings,
    query: sqlQuery,
  };
}

/**
 * Execution Node
 * Executes safe SQL queries
 */
export async function executionNode(sqlQuery, maxRows = 100) {
  const result = await executeQuerySafe(sqlQuery, maxRows);
  
  return {
    success: result.success,
    data: result.success ? {
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime: result.executionTime,
      fields: result.fields,
    } : null,
    error: result.success ? null : {
      message: result.error,
      code: result.code,
      detail: result.detail,
    },
  };
}
