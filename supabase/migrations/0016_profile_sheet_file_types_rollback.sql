-- Restore the original profile-sheet storage MIME allow-list.

begin;

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword'
  ]
where id = 'profile-sheets';

commit;
