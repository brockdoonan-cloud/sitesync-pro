# Production Hardening Plan

This branch depends on `feat/multitenancy-and-marketplace`.

## Index Plan

The codebase filters, joins, or sorts on these patterns:

- `organization_members.user_id`, `organization_members.organization_id`, and `role`
- `quote_requests.access_token`, `status`, `created_at`, and `organization_id`
- `quote_responses.quote_request_id`, `operator_user_id`, `organization_id`, `price_quote`, and `created_at`
- `service_requests.customer_id`, `status`, `created_at`, `jobsite_id`, `bin_number`, and `preferred_date`
- `equipment.organization_id`, `status`, `jobsite_id`, and `bin_number`
- `jobsites.organization_id`, `status`, `client_id`, `address`, and `name`
- `jobs.organization_id`, `scheduled_date`, `status`, and `service_request_id`
- `invoices.organization_id`, `client_id`, `status`, `created_at`, `invoice_date`, and `invoice_number`
- `driver_routes.route_date`, `route_stops.route_id`, and `truck_locations.recorded_at`
- import and billing trace lookups on `daily_operation_events.source_file`, `event_date`, and `bin_number`

`0003_org_defaults_and_scale_indexes.sql` already covers the largest fleet/map indexes. `0004_indexes.sql` adds the remaining indexes safely with `IF NOT EXISTS`.

## Rate Limit Plan

- Quote submissions: 5 per IP per hour
- Operator quote responses: 100 per authenticated user per hour
- Quote token lookups: 60 per IP per minute

Upstash Redis is used when configured. Local memory fallback keeps preview builds usable but should not be the production source of truth.

## Audit Plan

`0005_audit_log.sql` creates immutable audit logs plus database triggers on business tables. API helpers also write request-context audit events for key public/operator flows.

## Follow-Up TODOs

- Add Sentry API token integration to show the last 20 Sentry issues in `/dashboard/admin`.
- Add a Supabase RPC for pg_stat_statements once the extension is enabled.
