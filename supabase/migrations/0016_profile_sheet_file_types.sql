-- Allow billing profile-sheet imports from PDFs, plain text, CSVs, and common image scans.

begin;

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
where id = 'profile-sheets';

commit;
