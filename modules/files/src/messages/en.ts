export const en = {
  errors: {
    files: {
      link_key_missing: "Links cannot be made: the link signing key is not configured.",
      link_key_invalid: "Links cannot be made: the link signing key is malformed.",
      invalid_input: "The file details are not valid.",
      too_large: "The file is too large.",
      quota_exceeded: "There is no space left for this file.",
      not_found: "The file was not found.",
      range_not_satisfiable: "The requested part of the file is outside it.",
      content_type_not_allowed: "This type of file cannot be uploaded.",
      too_many_uploads: "Too many uploads are in progress. Finish or wait for one first.",
      upload_incomplete: "The upload is not complete yet: some parts have not arrived.",
      checksum_mismatch: "The uploaded file does not match its checksum.",
    },
    core: {
      unexpected: "Something went wrong. Try again.",
    },
  },  uploadPage: {
    title: "Upload a file",
    intro: "Choose the file this upload is waiting for. It is sent in parts, and a broken connection resumes where it stopped.",
    expected: "Expected: {name}, {size}.",
    choose: "Choose a file",
    start: "Upload",
    progress: "Uploaded {done} of {total}.",
    done: "Upload complete. Go back to where you started it to finish.",
    wrongSize: "This file has a different size than the upload expects.",
    failed: "The upload stopped. Press Upload again to resume.",
  },
};
