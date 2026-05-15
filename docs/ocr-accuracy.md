# OCR Accuracy Notes

Batch 2 changed profile-sheet extraction from a J. Raymond-specific parser toward a generic semantic parser for equipment rental paperwork.

## Current Supported Inputs

- Text-based PDF
- Scanned PDF through Claude OCR when `ANTHROPIC_API_KEY` is available
- DOCX
- XLSX / CSV / TXT / Markdown
- JPG / PNG / WEBP scans through Claude OCR

## Generic Field Targets

- Client company and billing contact
- Billing address
- Jobsite name, address, job number, PO number
- Monthly/rental/service rate
- Delivery, pickup, relocate, environmental, and fuel surcharge fees
- Billing terms, credit limit, signature name/date

## Review Requirement

The importer stores `ocr_raw_response`, `ocr_model_version`, and `ocr_confidence_notes` on `customer_profile_sheets`. Operators should review extracted values before saving, especially where a document uses unusual labels or handwritten values.

## Test Corpus To Add Before Launch

Place anonymized examples in `docs/sample-profile-sheets/`:

- J. Raymond construction profile sheet
- Dumpster / roll-off rental agreement
- Portable toilet service agreement
- General equipment rental quote
- Hand-filled credit application

Target acceptance is at least 80% field accuracy before onboarding production operators outside Atlantic Concrete.

