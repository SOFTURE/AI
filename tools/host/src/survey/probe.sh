#!/bin/sh
# The read-only probe `softure-host survey` and `app add` run on the server as the admin user
# (`sh -s -- <deploy user> <firewall name>`, this file on stdin). POSIX sh, since Ubuntu's sh is dash. It only
# reads: every line it prints is `<kind><TAB><fields...>` (src/survey/facts.ts). Reads that need root go through
# `sudo -n` when the admin has passwordless sudo and are reported as unreadable otherwise, never asked for.
set -u
deploy_user="$1"
firewall_name="$2"
tab="$(printf '\t')"
line() { (IFS="$tab"; printf '%s\n' "$*"); }

if [ "$(id -u)" = 0 ]; then as_root=""; line sudo root
elif sudo -n true > /dev/null 2>&1; then as_root="sudo -n"; line sudo passwordless
elif command -v sudo > /dev/null 2>&1; then as_root="none"; line sudo password
else as_root="none"; line sudo absent; fi

if [ -r /etc/os-release ]; then line os "$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-unknown}")"; fi

# People and service accounts that can log in, plus the deploy user whatever its shell.
for entry in $(getent passwd | awk -F: -v deploy="$deploy_user" '(($3 >= 1000 && $3 < 65534) && $7 !~ /(nologin|false)$/) || $1 == deploy { print $1 }' | sort -u); do
  groups="$(id -nG "$entry" 2> /dev/null | tr ' ' ',')"
  rights="no"
  case ",$groups," in *,sudo,* | *,wheel,* | *,admin,*) rights="group" ;; esac
  if [ "$rights" = no ] && [ "$as_root" != none ]; then
    if $as_root sudo -n -l -U "$entry" 2> /dev/null | grep -q 'may run the following'; then rights="sudoers"; fi
  elif [ "$rights" = no ]; then rights="unknown"; fi
  line user "$entry" "$groups" "$rights"
done

sshd_bin="$(command -v sshd 2> /dev/null || echo /usr/sbin/sshd)"
if [ "$as_root" != none ] && [ -x "$sshd_bin" ] && settings="$($as_root "$sshd_bin" -T -C "user=$deploy_user,host=localhost,addr=127.0.0.1" 2> /dev/null)"; then
  line sshd-source effective
  printf '%s\n' "$settings" | while read -r keyword values; do
    case "$keyword" in allowusers | allowgroups | denyusers | denygroups) line sshd "$keyword" "$values" ;; esac
  done
else
  line sshd-source files
  for file in /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf; do
    [ -r "$file" ] || continue
    grep -iE '^[[:space:]]*(AllowUsers|AllowGroups|DenyUsers|DenyGroups)[[:space:]]' "$file" | while read -r keyword values; do
      line sshd "$(printf '%s' "$keyword" | tr 'A-Z' 'a-z')" "$values"
    done
  done
fi

if ! command -v docker > /dev/null 2>&1; then line docker absent
else
  if docker info > /dev/null 2>&1; then docker_cmd="docker"
  elif [ "$as_root" != none ] && $as_root docker info > /dev/null 2>&1; then docker_cmd="$as_root docker"
  else docker_cmd=""; fi
  if [ -z "$docker_cmd" ]; then line docker denied
  else
    line docker "$($docker_cmd version --format '{{.Server.Version}}' 2> /dev/null)"
    $docker_cmd network ls --format '{{.Name}}' | while read -r name; do line network "$name"; done
    ids="$($docker_cmd ps -q)"
    for id in $ids; do
      image="$($docker_cmd inspect --format '{{.Config.Image}}' "$id")"
      case "$image" in
        *traefik*)
          line edge \
            "$($docker_cmd inspect --format '{{.Name}}' "$id" | sed 's|^/||')" \
            "$image" \
            "$($docker_cmd inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$id")" \
            "$($docker_cmd inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}},{{end}}' "$id")" \
            "$($docker_cmd inspect --format '{{join .Args " "}}' "$id")"
          ;;
      esac
    done
    if [ -n "$ids" ]; then
      $docker_cmd inspect --format '{{range $key, $value := .Config.Labels}}{{$key}}={{$value}}{{"\n"}}{{end}}' $ids \
        | grep -E '^traefik\.http\.routers\.[^=]*\.tls\.certresolver=' | sed 's/^[^=]*=//' | sort -u \
        | while read -r name; do line router-resolver "$name"; done
    fi
  fi
fi

for dir in /srv/*/; do [ -d "$dir" ] && line app-folder "${dir%/}"; done

if command -v systemctl > /dev/null 2>&1 && systemctl list-unit-files --no-legend "$firewall_name.*" 2> /dev/null | grep -q .; then
  line firewall "$firewall_name" present
else
  line firewall "$firewall_name" absent
fi
