#!/usr/bin/env bash
# An S3-compatible store for the off-site backup's integration test (modules/backup/tests/offsite-store.test.ts,
# e2e.yml backup-integration): SeaweedFS's S3 gateway on 127.0.0.1:8333 with three identities, an admin that creates
# the bucket, a writer that may only write to it and a reader that may only read and list it. The credentials come
# from BACKUP_IT_* (throwaway values of the job). WEED_BIN runs a local `weed` binary instead of the container.
set -euo pipefail

: "${BACKUP_IT_S3_BUCKET:?}" "${BACKUP_IT_WRITER_ID:?}" "${BACKUP_IT_WRITER_SECRET:?}"
: "${BACKUP_IT_READER_ID:?}" "${BACKUP_IT_READER_SECRET:?}"
IMAGE="chrislusf/seaweedfs:4.51"
ADMIN_ID="backup-admin"
ADMIN_SECRET="backup-admin-secret-1"
ENDPOINT="http://127.0.0.1:8333"
work="${RUNNER_TEMP:-$(mktemp -d)}/seaweedfs"
mkdir -p "$work/data"

bucket="$BACKUP_IT_S3_BUCKET"
cat > "$work/s3.json" <<JSON
{
  "identities": [
    { "name": "admin", "credentials": [{ "accessKey": "$ADMIN_ID", "secretKey": "$ADMIN_SECRET" }], "actions": ["Admin", "Read", "List", "Write"] },
    { "name": "writer", "credentials": [{ "accessKey": "$BACKUP_IT_WRITER_ID", "secretKey": "$BACKUP_IT_WRITER_SECRET" }], "actions": ["Write:$bucket"] },
    { "name": "reader", "credentials": [{ "accessKey": "$BACKUP_IT_READER_ID", "secretKey": "$BACKUP_IT_READER_SECRET" }], "actions": ["Read:$bucket", "List:$bucket"] }
  ]
}
JSON

if [ -n "${WEED_BIN:-}" ]; then
  "$WEED_BIN" server -dir="$work/data" -ip=127.0.0.1 -s3 -s3.port=8333 -s3.config="$work/s3.json" > "$work/weed.log" 2>&1 &
else
  # The image runs as its own user: only the config comes from the host, the data stays in the image's /data.
  docker run --detach --name softure-backup-s3 --publish 8333:8333 --volume "$work/s3.json:/etc/seaweedfs/s3.json:ro" "$IMAGE" \
    server -dir=/data -s3 -s3.port=8333 -s3.config=/etc/seaweedfs/s3.json > /dev/null
fi

# The gateway answers once the master, volume and filer are up.
for _ in $(seq 1 60); do
  if curl --silent --output /dev/null "$ENDPOINT/"; then break; fi
  sleep 1
done

created=""
for _ in $(seq 1 30); do
  if curl --silent --fail --aws-sigv4 "aws:amz:us-east-1:s3" --user "$ADMIN_ID:$ADMIN_SECRET" --request PUT "$ENDPOINT/$bucket" > /dev/null; then
    created="yes"
    break
  fi
  sleep 1
done
if [ -z "$created" ]; then
  echo "backup-s3: the bucket $bucket could not be created" >&2
  if [ -n "${WEED_BIN:-}" ]; then tail -n 40 "$work/weed.log" >&2; else docker logs --tail 40 softure-backup-s3 >&2; fi
  exit 1
fi
echo "backup-s3: $ENDPOINT serves the bucket $bucket"
