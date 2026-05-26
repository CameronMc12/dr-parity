// Core domain entity definitions for the webapp backend projection layer.
// Each entity maps to a source export file and the internal endpoint(s) that
// return it. The generator reads these to emit Zod schemas, TS types and DDL.

export type SqlType = "TEXT" | "INTEGER" | "REAL" | "BLOB";

export interface ColumnDef {
  name: string;
  /** Zod leaf type for the column. */
  zod: "string" | "number" | "boolean" | "json";
  sql: SqlType;
  nullable: boolean;
  primaryKey?: boolean;
  /** Closed set of allowed string values, emitted as a Zod enum. */
  enum?: string[];
  /** FK note for the DDL comment (informational, not enforced). */
  fkNote?: string;
}

export interface EntityDef {
  /** PascalCase entity name. */
  name: string;
  /** snake_case projection table name. */
  table: string;
  /** Source export file under the clickup-export dir. */
  sourceFile: string;
  /** Internal endpoint path templates that return this entity. */
  endpoints: string[];
  columns: ColumnDef[];
}

const pk = (name: string): ColumnDef => ({
  name,
  zod: "string",
  sql: "TEXT",
  nullable: false,
  primaryKey: true,
});

const text = (name: string, nullable = false, opts: Partial<ColumnDef> = {}): ColumnDef => ({
  name,
  zod: "string",
  sql: "TEXT",
  nullable,
  ...opts,
});

const int = (name: string, nullable = false): ColumnDef => ({
  name,
  zod: "number",
  sql: "INTEGER",
  nullable,
});

const bool = (name: string, nullable = false): ColumnDef => ({
  name,
  zod: "boolean",
  sql: "INTEGER",
  nullable,
});

const json = (name: string, nullable = false): ColumnDef => ({
  name,
  zod: "json",
  sql: "TEXT",
  nullable,
});

export const CORE_ENTITIES: EntityDef[] = [
  {
    name: "Workspace",
    table: "workspaces",
    sourceFile: "workspace.json",
    endpoints: [
      "/workspace-v3/core/workspace/{workspaceId}",
      "/workspace-v3/experience/bootstrap/{workspaceId}",
    ],
    columns: [
      pk("id"),
      text("name"),
      text("color", true),
      text("avatar", true),
    ],
  },
  {
    name: "Space",
    table: "spaces",
    sourceFile: "spaces.json",
    endpoints: [
      "/hierarchy/v3/experience/sidebar/workspaces/{workspaceId}/tree",
      "/workspace-v3/experience/bootstrap/{workspaceId}",
    ],
    columns: [
      pk("id"),
      text("name"),
      text("color", true),
      text("avatar", true),
      bool("private"),
      bool("admin_can_manage", true),
      bool("multiple_assignees", true),
      bool("archived"),
      json("features", true),
    ],
  },
  {
    name: "Folder",
    table: "folders",
    sourceFile: "folders.json",
    endpoints: [
      "/hierarchy/v3/experience/sidebar/workspaces/{workspaceId}/tree",
      "/hierarchy/v1/team/{workspaceId}/tray/{categoryId}/{subcategoryId}",
    ],
    columns: [
      pk("id"),
      text("name"),
      int("orderindex"),
      text("space_id", false, { fkNote: "spaces(id)" }),
      bool("override_statuses"),
      bool("hidden"),
      bool("archived"),
      int("task_count", true),
      text("permission_level", true),
    ],
  },
  {
    name: "List",
    table: "lists",
    sourceFile: "lists.json",
    endpoints: [
      "/hierarchy/v3/experience/sidebar/workspaces/{workspaceId}/tree",
      "/task-v3/experience/{workspaceId}/tasks/bulk",
    ],
    columns: [
      pk("id"),
      text("name"),
      int("orderindex"),
      text("content", true),
      text("folder_id", true, { fkNote: "folders(id)" }),
      text("space_id", false, { fkNote: "spaces(id)" }),
      int("task_count", true),
      text("status", true),
      text("priority", true),
      text("due_date", true),
      text("start_date", true),
      bool("override_statuses"),
      bool("archived"),
      text("permission_level", true),
    ],
  },
  {
    name: "Task",
    table: "tasks",
    sourceFile: "tasks.json",
    endpoints: [
      "/task-v3/experience/{workspaceId}/tasks/bulk",
      "/tasks/v1/task/{taskId}/memberHierarchy",
    ],
    columns: [
      pk("id"),
      text("custom_id", true),
      int("custom_item_id", true),
      text("name"),
      text("text_content", true),
      text("description", true),
      text("status_id", true, { fkNote: "statuses(id)" }),
      text("orderindex", true),
      text("date_created", true),
      text("date_updated", true),
      text("date_closed", true),
      text("date_done", true),
      bool("archived"),
      text("creator_id", true, { fkNote: "users(id)" }),
      json("assignees", true),
      json("watchers", true),
      json("tags", true),
      json("checklists", true),
      text("parent_id", true, { fkNote: "tasks(id)" }),
      text("top_level_parent_id", true, { fkNote: "tasks(id)" }),
      json("priority", true),
      text("due_date", true),
      text("start_date", true),
      int("points", true),
      int("time_estimate", true),
      int("time_spent", true),
      json("dependencies", true),
      json("linked_tasks", true),
      text("list_id", true, { fkNote: "lists(id)" }),
      text("folder_id", true, { fkNote: "folders(id)" }),
      text("space_id", true, { fkNote: "spaces(id)" }),
      text("team_id", true, { fkNote: "workspaces(id)" }),
      text("url", true),
      json("sharing", true),
      text("permission_level", true),
    ],
  },
  {
    name: "Subtask",
    table: "subtasks",
    sourceFile: "tasks.json",
    endpoints: ["/task-v3/experience/{workspaceId}/tasks/bulk"],
    columns: [
      pk("id"),
      text("parent_id", false, { fkNote: "tasks(id)" }),
      text("top_level_parent_id", true, { fkNote: "tasks(id)" }),
      text("name"),
      text("status_id", true, { fkNote: "statuses(id)" }),
      int("orderindex", true),
    ],
  },
  {
    name: "Status",
    table: "statuses",
    sourceFile: "spaces.json",
    endpoints: ["/customFields/v2/team/{workspaceId}/fields/taskStatuses"],
    columns: [
      pk("id"),
      text("status"),
      text("type", false, {
        enum: ["open", "custom", "closed", "done"],
      }),
      int("orderindex"),
      text("color", true),
      text("scope_id", true, { fkNote: "space/folder/list owning the status set" }),
    ],
  },
  {
    name: "CustomFieldDef",
    table: "custom_field_defs",
    sourceFile: "custom-fields.json",
    endpoints: ["/customFields/v1/team/{workspaceId}/fields"],
    columns: [
      pk("id"),
      text("list_id", true, { fkNote: "lists(id)" }),
      text("name"),
      text("type"),
      json("type_config", true),
      text("date_created", true),
      bool("hide_from_guests", true),
      bool("required", true),
    ],
  },
  {
    name: "TaskFieldValue",
    table: "task_field_values",
    sourceFile: "tasks.json",
    endpoints: ["/task-v3/experience/{workspaceId}/tasks/bulk"],
    columns: [
      { ...pk("task_id"), fkNote: "tasks(id)" },
      { ...pk("field_id"), fkNote: "custom_field_defs(id)" },
      text("type", true),
      json("value", true),
    ],
  },
  {
    name: "Comment",
    table: "comments",
    sourceFile: "task-comments.json",
    endpoints: [
      "/comment-service/v3/workspaces/{workspaceId}/comments/last_read_at/search_threads",
    ],
    columns: [
      pk("id"),
      text("task_id", false, { fkNote: "tasks(id)" }),
      text("user_id", true, { fkNote: "users(id)" }),
      text("comment_text", true),
      text("date", true),
      bool("resolved", true),
    ],
  },
  {
    name: "User",
    table: "users",
    sourceFile: "workspace.json",
    endpoints: ["/user/v1/user", "/user/v1/team/{workspaceId}/member"],
    columns: [
      pk("id"),
      text("username", true),
      text("email", true),
      text("color", true),
      text("initials", true),
      text("profile_picture", true),
    ],
  },
  {
    name: "Membership",
    table: "memberships",
    sourceFile: "members.json",
    endpoints: ["/user/v1/team/{workspaceId}/member"],
    columns: [
      { ...pk("user_id"), fkNote: "users(id)" },
      { ...pk("workspace_id"), fkNote: "workspaces(id)" },
      int("role", true),
      text("role_key", true, {
        enum: ["owner", "admin", "member", "guest"],
      }),
      int("role_subtype", true),
      text("date_joined", true),
      text("date_invited", true),
      text("last_active", true),
    ],
  },
];
