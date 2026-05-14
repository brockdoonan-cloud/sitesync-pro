-- Allow billing profile-sheet imports from PDFs, plain text, CSVs, and common image scans.

begin;

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
where id = 'profile-sheets';

commit;
