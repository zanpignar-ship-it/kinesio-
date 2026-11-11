-- Windows reports .csv files as application/vnd.ms-excel: keep those originals too.
update storage.buckets
set allowed_mime_types = array[
  'application/geo+json', 'application/json', 'application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz',
  'application/zip', 'application/x-zip-compressed', 'text/csv', 'text/plain', 'application/octet-stream', 'application/vnd.ms-excel'
]
where id = 'plot-imports';
