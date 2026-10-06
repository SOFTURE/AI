# The throwaway SSH server of deploy-app.yml's end-to-end test (DF-3), built by ../start-server.sh in the deploy job.
# The deploy key reaches only the forced command record.sh, the shape `softure-deploy init` documents for a real
# server's authorized_keys. ALPINE_IMAGE names another copy of alpine (Docker Hub limits anonymous pulls).
ARG ALPINE_IMAGE=alpine:3.22
FROM ${ALPINE_IMAGE}
# adduser -D locks the account (`!` in /etc/shadow) and sshd refuses a locked account even for a key; `*` means no
# password without locking it.
RUN apk add --no-cache openssh-server \
 && adduser -D -s /bin/sh deploy \
 && sed -i 's/^deploy:!:/deploy:*:/' /etc/shadow
COPY --chmod=0755 entrypoint.sh record.sh /usr/local/bin/
EXPOSE 22
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
