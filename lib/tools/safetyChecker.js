/**
 * SQL Safety Checker
 * Validates SQL queries to ensure they are safe to execute
 */

const DESTRUCTIVE_KEYWORDS = [
  "DROP",
  "DELETE",
  "UPDATE",
  "INSERT",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
];

const DANGEROUS_PATTERNS = [
  /;\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE)/i,  // Multiple statements
  /--/,  // SQL comments (can hide malicious code)
  /\/\*/,  // Block comments
  /xp_/i,  // SQL Server extended procedures
  /sp_/i,  // SQL Server system procedures
];

export function checkQuerySafety(sqlQuery) {
  const result = {
    safe: true,
    issues: [],
    warnings: [],
  };

  // Normalize query for checking
  const normalizedQuery = sqlQuery.trim().toUpperCase();

  // Check if it starts with SELECT
  if (!normalizedQuery.startsWith("SELECT")) {
    result.safe = false;
    result.issues.push("Query must be a SELECT statement");
  }

  // Check for destructive keywords
  for (const keyword of DESTRUCTIVE_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(sqlQuery)) {
      result.safe = false;
      result.issues.push(`Destructive keyword detected: ${keyword}`);
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sqlQuery)) {
      result.safe = false;
      result.issues.push(`Dangerous pattern detected: ${pattern.toString()}`);
    }
  }

  // Check for semicolons (potential multi-statement injection)
  const semicolonCount = (sqlQuery.match(/;/g) || []).length;
  if (semicolonCount > 1) {
    result.safe = false;
    result.issues.push("Multiple statements detected (SQL injection risk)");
  } else if (semicolonCount === 1 && !sqlQuery.trim().endsWith(";")) {
    result.safe = false;
    result.issues.push("Semicolon in middle of query (SQL injection risk)");
  }

  // Warnings (not blocking, but noteworthy)
  if (normalizedQuery.includes("SELECT *")) {
    result.warnings.push("Using SELECT * - consider specifying columns");
  }

  if (!normalizedQuery.includes("LIMIT") && !normalizedQuery.includes("TOP")) {
    result.warnings.push("No LIMIT clause - query might return many rows");
  }

  return result;
}

/**
 * Extract and clean SQL from LLM response
 */
export function extractSQL(text) {
  // Remove markdown code blocks if present
  let sql = text.trim();
  
  // Remove ```sql or ``` markers
  sql = sql.replace(/```sql\n?/gi, "");
  sql = sql.replace(/```\n?/g, "");
  
  // Remove leading/trailing whitespace
  sql = sql.trim();
  
  return sql;
}
