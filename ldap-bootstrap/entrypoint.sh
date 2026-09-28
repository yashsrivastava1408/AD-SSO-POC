#!/bin/sh
# Builds and seeds the LDAP database on first boot, then starts slapd once and
# leaves it running for the container's whole life — deliberately never stopping
# or restarting it. osixia/openldap's bootstrap does start-bootstrap-then-kill,
# which Render's sandboxed runtime blocks ("kill: Operation not permitted"); this
# avoids that failure mode entirely by only ever starting slapd once, after all
# seeding is already done offline via slapadd.
set -e

DATA_DIR=/var/lib/ldap
CONF=/etc/ldap/slapd.conf

mkdir -p "$DATA_DIR" /var/run/slapd

if [ ! -f "$DATA_DIR/data.mdb" ]; then
  echo "First boot: building LDAP database from bootstrap LDIF..."
  : "${LDAP_ADMIN_PASSWORD:?LDAP_ADMIN_PASSWORD must be set}"

  ADMIN_HASH=$(slappasswd -s "$LDAP_ADMIN_PASSWORD")
  sed "s#__ADMIN_PW_HASH__#${ADMIN_HASH}#" /etc/ldap/slapd.conf.template > "$CONF"

  : > /tmp/combined.ldif
  for f in /bootstrap/*.ldif; do
    cat "$f" >> /tmp/combined.ldif
    printf '\n' >> /tmp/combined.ldif
  done
  slapadd -f "$CONF" -l /tmp/combined.ldif
  rm -f /tmp/combined.ldif

  chown -R openldap:openldap "$DATA_DIR"
fi

exec slapd -f "$CONF" -h "ldap:/// ldapi:///" -u openldap -g openldap -d 0
