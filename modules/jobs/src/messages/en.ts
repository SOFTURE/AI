export const en = {
  errors: {
    invalid_payload: "The job's data is not valid.",
    handler_threw: "The job failed unexpectedly. It will be tried again.",
    lease_expired: "The job did not finish in time.",
    not_found: "The job does not exist.",
    not_cancellable: "Only a job that has not started can be cancelled.",
    not_retryable: "Only a failed or cancelled job can be run again.",
    dedup_key_taken: "Another job for the same work is already waiting or running.",
    sync_cursor_moved: "Another run moved the sync position first.",
    sync_item_threw: "Handling the item failed unexpectedly.",
  },
};
