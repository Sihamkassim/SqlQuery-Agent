# SQL Query Agent - Architecture Diagram

## Complete Agent Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                                 │
│         POST /ask { "question": "How many users?" }                 │
└────────────────────────────┬────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    TOOLS NODE - Schema Extractor                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Query: information_schema.columns                           │    │
│  │ Output: { users: [{ column: "id", type: "integer" }, ...] }│    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   QUERY GENERATOR NODE (LLM)                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Input: User question + Database schema                      │    │
│  │ LLM: Gemini 1.5 Pro                                         │    │
│  │ Output: "SELECT COUNT(*) FROM users"                        │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     SAFETY CHECK NODE                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Code-based validation:                                      │    │
│  │ ✓ Starts with SELECT?                                       │    │
│  │ ✓ No DROP/DELETE/UPDATE?                                    │    │
│  │ ✓ No multi-statement injection?                             │    │
│  │ ✓ No SQL comments?                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────┬────────────────────────────────────┬─────────────────────┘
           ↓ SAFE                                ↓ UNSAFE
           │                          ┌──────────────────────┐
           │                          │  Refinement Loop     │
           │                          │  (Max 3 attempts)    │
           │                          │  Feedback: "Query    │
           │                          │  contains DROP"      │
           │                          └──────┬───────────────┘
           │                                 │
           │                                 ↓
           │                          Back to Query Generator
           │                          with feedback
           ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        EXECUTION NODE                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ TOOLS NODE - Query Executor                                 │    │
│  │ - Auto-add LIMIT if missing                                 │    │
│  │ - Execute via PostgreSQL pool                               │    │
│  │ - Return: { rows: [...], rowCount: 3, time: "15ms" }      │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        SUMMARY NODE (LLM)                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Input: User question + SQL query + Query results            │    │
│  │ LLM: Gemini 1.5 Pro                                         │    │
│  │ Output: "There are 3 users in the database."               │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          FINAL RESPONSE                              │
│  {                                                                   │
│    "success": true,                                                  │
│    "answer": "There are 3 users in the database.",                  │
│    "query": "SELECT COUNT(*) FROM users",                           │
│    "data": { "rows": [...], "rowCount": 3, "executionTime": "15ms"}│
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Node Details

### 1. Query Generator Node (LLM)
- **Type**: LLM-powered
- **Model**: Gemini 1.5 Pro
- **Inputs**: 
  - User's natural language question
  - Database schema from Schema Extractor
  - Optional: Previous attempt + Safety feedback
- **Output**: Draft SQL query
- **Refinement**: Can receive feedback from Safety Check for retry

### 2. Tools Node
Three independent tools that nodes can access:

#### Schema Extractor Tool
```javascript
extractSchema() → {
  users: [
    { column: "id", type: "integer", nullable: false },
    { column: "name", type: "varchar(100)", nullable: true }
  ]
}
```

#### Safety Checker Tool
```javascript
checkQuerySafety(sql) → {
  safe: true/false,
  issues: ["Destructive keyword: DROP"],
  warnings: ["No LIMIT clause"]
}
```

#### Query Executor Tool
```javascript
executeQuery(sql) → {
  success: true,
  rows: [...],
  rowCount: 3,
  executionTime: "15ms"
}
```

### 3. Safety Check Node
- **Type**: Logic-based
- **Function**: Validates SQL query safety
- **Branching**:
  - `safe: true` → Proceed to Execution Node
  - `safe: false` → Return to Query Generator with feedback
- **Max Attempts**: 3 refinement loops

### 4. Execution Node
- **Type**: Logic-based
- **Function**: Executes approved SQL
- **Safety**: Auto-adds LIMIT if missing (default: 100)
- **Tool Used**: Query Executor

### 5. Summary Node (LLM)
- **Type**: LLM-powered
- **Model**: Gemini 1.5 Pro
- **Inputs**:
  - Original user question
  - Executed SQL query
  - Query results
- **Output**: Human-readable natural language answer

## Safety Features

### Multi-Layer Protection
1. **Query Generator**: Instructed to create SELECT-only queries
2. **Safety Check**: Code-based validation blocks destructive operations
3. **Refinement Loop**: Up to 3 attempts with specific feedback
4. **Execution Safety**: Auto-limits row count
5. **Database Permissions**: User has SELECT-only grants

### Blocked Operations
```
❌ DROP     (tables/databases)
❌ DELETE   (removing records)
❌ UPDATE   (modifying data)
❌ INSERT   (adding data)
❌ TRUNCATE (clearing tables)
❌ ALTER    (schema changes)
❌ GRANT    (permission changes)
❌ REVOKE   (permission changes)
✅ SELECT   (read-only queries)
```

## Example Execution Trace

```json
{
  "trace": [
    {
      "step": "schema_extraction",
      "success": true
    },
    {
      "step": "query_generation",
      "attempt": 1,
      "success": true,
      "query": "SELECT COUNT(*) as total FROM users"
    },
    {
      "step": "safety_check",
      "attempt": 1,
      "safe": true,
      "issues": [],
      "warnings": ["No LIMIT clause"]
    },
    {
      "step": "execution",
      "success": true,
      "rowCount": 1,
      "executionTime": "12ms"
    },
    {
      "step": "summarization",
      "success": true
    }
  ]
}
```

## Refinement Loop Example

**Question**: "Delete all old users"

### Attempt 1:
```sql
Query: DELETE FROM users WHERE created_at < NOW() - INTERVAL '1 year'
Safety: ❌ FAIL - "Destructive keyword detected: DELETE"
→ Return to Query Generator with feedback
```

### Attempt 2:
```sql
Query: SELECT * FROM users WHERE created_at < NOW() - INTERVAL '1 year' FOR UPDATE
Safety: ❌ FAIL - "Destructive keyword detected: UPDATE"
→ Return to Query Generator with feedback
```

### Attempt 3:
```sql
Query: SELECT * FROM users WHERE created_at < NOW() - INTERVAL '1 year'
Safety: ✅ PASS - Read-only SELECT query
→ Proceed to Execution
```

## File Structure

```
lib/
├── agent.js                    # Main orchestration & workflow
├── db.js                       # PostgreSQL connection pool
├── nodes/
│   ├── llmNodes.js             # Query Generator + Summary (LLM nodes)
│   └── executionNodes.js       # Safety Check + Execution (logic nodes)
└── tools/
    ├── schemaExtractor.js      # Database schema extraction
    ├── safetyChecker.js        # SQL safety validation
    └── queryExecutor.js        # Safe query execution
```
