# cloud/analytics

Audit trail and usage metrics. Source: `server/src/audit/`.

All write operations that modify business data inject `AuditService` to record who changed what and when.
Admin stats are aggregated via `server/src/admin/admin.service.ts`.
