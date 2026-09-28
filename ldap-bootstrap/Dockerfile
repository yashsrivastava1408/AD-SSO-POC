# docker-compose bind-mounts this folder straight into osixia/openldap's bootstrap
# path for local dev. Render (and most hosts) can't bind-mount a repo folder into a
# pulled image, so this Dockerfile bakes the same seed data in instead — deploy this
# as a "build from Dockerfile" service pointing at this file, one image, same result.
FROM osixia/openldap:1.5.0
COPY *.ldif /container/service/slapd/assets/config/bootstrap/ldif/custom/
