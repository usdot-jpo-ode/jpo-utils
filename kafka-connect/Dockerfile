FROM confluentinc/cp-kafka-connect:8.4.0@sha256:a17ca6c1021f0e46775839c66da169d8e97c206c0b1c17d9c314206f45800fc4 AS connect-base

# Update OS packages outside the runtime image, which has no package manager.
# Keep the RPM inventory consistent with the updated files.
#   ca-certificates: CVE-2026-114406
#   libbrotli:       CVE-2026-111497
FROM registry.access.redhat.com/ubi9/ubi:9.8@sha256:5f08e80aa970ae77712e75e5e857ac0b396abc900823c4d041c1150a9538a13f AS package-updates
ARG UPDATE_PACKAGES="ca-certificates libbrotli"
# DNF needs the runtime filesystem for dependency checks and package scriptlets.
COPY --from=connect-base / /rootfs/
RUN set -eu; rpm --root /rootfs -qa | sort > /packages.before \
    && dnf -y --installroot=/rootfs --releasever=9 \
        --setopt=install_weak_deps=False \
        --disablerepo='*' --enablerepo=ubi-9-baseos-rpms \
        upgrade $UPDATE_PACKAGES \
    # Copy every package DNF changed, including any upgraded dependencies.
    && rpm --root /rootfs -qa | sort | comm -13 /packages.before - > /packages.changed \
    && test -s /packages.changed \
    && xargs rpm --root /rootfs --dbpath /var/lib/rpm -ql < /packages.changed > /updated-packages.files \
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
    done < /updated-packages.files \
    && test ! -s var/lib/rpm/rpmdb.sqlite-wal \
    && cp -a --parents var/lib/rpm/rpmdb.sqlite /updated/ \
    # Generated trust bundles are required whenever ca-certificates changes.
    && if grep -q '^ca-certificates-' /packages.changed; then \
        test -s /updated/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem \
        && test -s /updated/etc/pki/ca-trust/extracted/java/cacerts; \
    fi

FROM connect-base
USER root
COPY --from=package-updates /packages.changed /tmp/packages.changed
# COPY merges directories; when ca-certificates changes, discard generated trust files removed by the update.
RUN if grep -q '^ca-certificates-' /tmp/packages.changed; then \
        rm -rf /etc/pki/ca-trust/extracted; \
    fi \
    && rm -f /tmp/packages.changed /var/lib/rpm/.rpm.lock /var/lib/rpm/rpmdb.sqlite-shm /var/lib/rpm/rpmdb.sqlite-wal
COPY --from=package-updates /updated/ /
USER appuser

# confluent-hub is deprecated; see README image maintenance notes before upgrading.
# MongoDB Kafka Connector
# Docs: https://www.mongodb.com/docs/kafka-connector/current/
RUN confluent-hub install --no-prompt mongodb/kafka-connect-mongodb:1.13.0

# Transforms
# Docs: https://docs.confluent.io/platform/current/connect/transforms/overview.html
RUN confluent-hub install --no-prompt confluentinc/connect-transforms:1.4.7

# Amazon S3 Sink Connector (Confluent Community License)
# Docs: https://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html
# NOTE: Versions 12.1.14+, 12.0.12+ and 11.0.22+ include a preCommit offset fallback (CC-43920) that can commit
# offsets for records that failed to upload after a retriable S3 error. Re-run the S3 outage test in
# docs/S3_Archive.md before upgrading.
RUN confluent-hub install --no-prompt confluentinc/kafka-connect-s3:12.1.13

# Prometheus JMX exporter java agent (Apache 2.0), serves the worker metrics on port 9404
# Docs: https://prometheus.github.io/jmx_exporter/
USER root
RUN mkdir -p /usr/share/jmx-exporter \
    && curl -fsSL -o /usr/share/jmx-exporter/jmx_prometheus_javaagent.jar \
       https://github.com/prometheus/jmx_exporter/releases/download/1.7.0/jmx_prometheus_javaagent-1.7.0.jar \
    && echo "0ad843261c567d1924a017d542e14c40f2afff523d940c25ee000742fde4b3a9  /usr/share/jmx-exporter/jmx_prometheus_javaagent.jar" | sha256sum -c -
COPY jmx-exporter.yml /usr/share/jmx-exporter/jmx-exporter.yml
RUN chmod 755 /usr/share/jmx-exporter && chmod 644 /usr/share/jmx-exporter/*
USER appuser

# The agent is loaded through EXTRA_ARGS, which only the connect-distributed start script passes to java,
# and not through KAFKA_OPTS, which every Kafka CLI tool in the container also reads. A CLI tool run with
# docker exec would otherwise start a second agent on port 9404 and exit. Keeping the setting in the image
# also means an older image without the agent jar still starts. Set EXTRA_ARGS to "-name connectDistributed"
# on the container to disable the agent.
ENV EXTRA_ARGS="-name connectDistributed -javaagent:/usr/share/jmx-exporter/jmx_prometheus_javaagent.jar=9404:/usr/share/jmx-exporter/jmx-exporter.yml"
