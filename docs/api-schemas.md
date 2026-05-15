# API Input Schemas

This audit documents the request shape expected by each API route. Routes marked `zod` validate with a runtime schema. Routes marked `guarded parser` validate fields manually with explicit rejects for malformed input.

| Route | Methods | Validation | Request schema |
|---|---|---|---|
| `/api/admin/site-doctor` | `GET` | auth guard | No body. Super admin/operator admin only. |
| `/api/assistant` | `POST` | guarded parser + rate limit | `{ message: string, language?: "en" \| "es", context?: string }` |
| `/api/customer/link-account` | `POST` | guarded parser | `{ access_code: string }` |
| `/api/customer/service-requests` | `POST` | guarded parser + rate limit | `{ service_type, jobsite_address, service_address?, preferred_date?, time_preference?, bin_number?, notes?, client_id?, job_id?, jobsite_id? }` |
| `/api/customer/tracking` | `GET` | auth guard | No body. Uses current user/customer access. |
| `/api/driver/routes/[routeId]/action` | `POST` | guarded parser + rate limit | `{ action: "open" \| "start" \| "close" \| "complete", eta_minutes?: number, notes?: string, force?: boolean }` |
| `/api/driver/stops/[stopId]/action` | `POST` | guarded parser + rate limit | `{ action: "eta" \| "en_route" \| "arrived" \| "complete" \| "cancel", eta_minutes?: number, lat?: number, lng?: number, notes?: string, reason?: string, proof_notes?: string, pickup_bin_number?: string, delivery_bin_number?: string, landfill?: string, dropoff_jobsite?: string, dropoff_address?: string }` |
| `/api/driver/stops/[stopId]/charge` | `POST` | zod + rate limit | `multipart/form-data`: `photo`, `charge_type`, `amount`, `note?` |
| `/api/health` | `GET` | lightweight health check | No body. |
| `/api/operator/clients/[clientId]/access-code` | `POST` | auth guard | No body; creates/rotates a customer access code. |
| `/api/operator/profile-sheets/archive` | `POST` | guarded parser + rate limit | `multipart/form-data`: `file` PDF/DOC/DOCX/XLSX/TXT/CSV/JPG/PNG/WEBP/HEIC, max 30 MB. |
| `/api/operator/profile-sheets/extract` | `POST` | guarded parser + rate limit | `multipart/form-data`: `file` PDF/DOCX/XLSX/TXT/CSV/JPG/PNG/WEBP, max 30 MB, PDFs max 100 pages. |
| `/api/operator/profile-sheets/save` | `POST` | zod + rate limit | `{ source?: "ocr_import" \| "manual_entry", extraction: ProfileSheetExtraction }` with required company, jobsite name/address, and one-bin service rate. |
| `/api/quote-requests` | `POST` | guarded parser + rate limit | Public quote request payload from `/quotes`. |
| `/api/quote-requests/[id]` | `DELETE` | auth guard | No body. Deletes/spam-closes lead by id for operators. |
| `/api/quote-requests/[id]/select-response` | `POST` | guarded parser | `{ token: uuid, response_id: uuid }` |
| `/api/quote-requests/by-token/[token]` | `GET` | token guard + rate limit | No body. Public magic-link read. |
| `/api/quote-responses` | `POST` | guarded parser + rate limit | `{ quote_request_id: uuid, price_quote: number, notes?: string, available_date?: string, division_id?: uuid }` |
| `/api/quotes` | `POST` | guarded parser | Compatibility quote endpoint. Prefer `/api/quote-requests`. |
| `/api/sms` | `POST` | guarded parser | `{ to: string, message: string, request_id?: uuid, type?: string }` |
| `/api/truck-tracking/import` | `POST` | guarded parser | `{ rows: TrackingImportRow[], provider_id?: uuid }` |
| `/api/truck-tracking/integrations` | `POST` | guarded parser | Provider metadata: name, auth type, base URL, external account id, notes. |
| `/api/truck-tracking/webhook/[token]` | `POST` | token guard | Tracking provider webhook payload. |

Hardening rule going forward: new mutating endpoints should use `zod` first, then rate limit, then auth/tenant checks, then write. Existing guarded-parser routes are documented here and should be converted to `zod` as they are touched.
