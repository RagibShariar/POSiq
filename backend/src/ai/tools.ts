// Claude tool definitions for the AI business agent (Section 14 of the project plan).
// Each tool maps to a handler in ./handlers.ts that queries the DB scoped to the
// caller's businessId — the model never sees data outside the tenant.

export const aiTools = [
  {
    name: "get_sales_summary",
    description: "Get sales data for a date range, optionally filtered by branch",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        branchId: { type: "string", description: "Optional branch ID" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_top_products",
    description: "Get best selling products ranked by quantity or revenue",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "How many products to return" },
        from: { type: "string" },
        to: { type: "string" },
        branchId: { type: "string" },
      },
    },
  },
  {
    name: "get_low_stock_items",
    description: "Get products that are below their low stock threshold",
    input_schema: {
      type: "object" as const,
      properties: {
        branchId: { type: "string" },
      },
    },
  },
  {
    name: "get_reorder_suggestions",
    description:
      "Suggest products to reorder based on sales velocity and current stock",
    input_schema: {
      type: "object" as const,
      properties: {
        branchId: { type: "string" },
      },
    },
  },
  {
    name: "compare_branch_performance",
    description: "Compare sales and performance across multiple branches",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
];
