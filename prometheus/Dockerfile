FROM quay.io/prometheus/prometheus:v2.55.1
COPY --chmod=755 entry /
ENTRYPOINT ["/entry"]
CMD        [ "--config.file=/etc/prometheus/prometheus.yml", \
             "--storage.tsdb.path=/prometheus", \
             "--web.console.libraries=/usr/share/prometheus/console_libraries", \
             "--web.console.templates=/usr/share/prometheus/consoles" ]