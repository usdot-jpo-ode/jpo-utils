FROM confluentinc/cp-kafka-connect:8.4.0@sha256:a17ca6c1021f0e46775839c66da169d8e97c206c0b1c17d9c314206f45800fc4 AS connect-base

# Update CA certificates outside the runtime image, which has no package manager.
# Keep the RPM inventory consistent with the updated files.
FROM registry.access.redhat.com/ubi9/ubi:9.8@sha256:5f08e80aa970ae77712e75e5e857ac0b396abc900823c4d041c1150a9538a13f AS certificates
# DNF needs the runtime filesystem for dependency checks and package scriptlets.
COPY --from=connect-base / /rootfs/
RUN set -eu; dnf -y --installroot=/rootfs --releasever=9 \
        --setopt=install_weak_deps=False \
        --disablerepo='*' --enablerepo=ubi-9-baseos-rpms \
        upgrade ca-certificates \
    && rpm --root /rootfs --dbpath /var/lib/rpm -ql ca-certificates > /ca-certificates.files \
    && mkdir /updated \
    && cd /rootfs \
    # Shared package directories must not be copied recursively.
    && while read -r file; do \
        if [ -d ".$file" ] && [ ! -L ".$file" ]; then \
            mkdir -p "/updated$file"; \
            chmod --reference=".$file" "/updated$file"; \
            chown --reference=".$file" "/updated$file"; \
        elif [ -e ".$file" ] || [ -L ".$file" ]; then \
            cp -a --parents ".$file" /updated/; \
        fi; \
    done < /ca-certificates.files \
    && test ! -s var/lib/rpm/rpmdb.sqlite-wal \
    && cp -a --parents var/lib/rpm/rpmdb.sqlite /updated/

FROM connect-base
USER root
# COPY merges directories; discard generated trust files removed by the update.
RUN rm -rf /etc/pki/ca-trust/extracted \
    && rm -f /var/lib/rpm/.rpm.lock /var/lib/rpm/rpmdb.sqlite-shm /var/lib/rpm/rpmdb.sqlite-wal
COPY --from=certificates /updated/ /
USER appuser

# MongoDB Kafka Connector
# Docs: https://www.mongodb.com/docs/kafka-connector/current/
RUN confluent-hub install --no-prompt mongodb/kafka-connect-mongodb:1.13.0

# Transforms
# Docs: https://docs.confluent.io/platform/current/connect/transforms/overview.html
RUN confluent-hub install --no-prompt confluentinc/connect-transforms:1.4.7