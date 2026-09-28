# A minimal, self-built OpenLDAP image. We build our own instead of relying on
# osixia/openldap (whose bootstrap does start-then-kill, blocked by Render's
# sandboxed runtime — see entrypoint.sh) or bitnami/openldap (paywalled as of
# 2025 — no longer pullable for free). Debian's own slapd package gives full
# control with no third-party image dependency.
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends slapd ldap-utils && \
    rm -rf /var/lib/apt/lists/* /etc/ldap/slapd.d /var/lib/ldap/*

COPY slapd.conf.template /etc/ldap/slapd.conf.template
COPY *.ldif /bootstrap/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 389
ENTRYPOINT ["/entrypoint.sh"]
