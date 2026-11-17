# Research: connections-fake-github-repository-contents

- GitHub REST (API version 2022-11-28): `GET /repos/{o}/{r}/commits/{ref}` answers `sha` and `commit.tree.sha` (422 for
  an unknown sha); `GET /repos/{o}/{r}/git/trees/{sha}?recursive=1` answers `tree[]` with `path`, `mode`, `type`
  (`blob`, `tree`, `commit`), `sha`, `size` on blobs, and `truncated`; `GET /repos/{o}/{r}/git/blobs/{sha}` answers JSON
  with base64 content, or the raw bytes with `Accept: application/vnd.github.raw`; `GET /repos/{o}/{r}/compare/{base}...{head}`
  answers `status` (`ahead`, `behind`, `identical`, `diverged`) and `files[]` with `filename`, `status`, `sha`,
  `previous_filename` for renames; 404 for a commit it does not know.
- A private repository the token cannot reach answers 404, an invalid token 401.
- A git blob id is the sha1 of `blob <size>\0<bytes>`; using it makes the fake's versions match git's, so an app can
  compare a version with one computed locally.
- The fake keeps installations per id; contents belong to the repository (by full name), so an uninstall and a new
  installation of the same repository see the same history.
