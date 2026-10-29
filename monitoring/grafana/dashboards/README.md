# Grafana Dashboards

## Node Exporter Full

https://grafana.com/grafana/dashboards/10242-node-exporter-full/

## Kafka Lag Exporter

https://github.com/seglo/kafka-lag-exporter/blob/master/grafana/Kafka_Lag_Exporter_Dashboard.json

## MongoDB Dashboard

[20867](https://grafana.com/grafana/dashboards/20867-mongodb-dashboard/)

## Kafka Connect S3 Archive

[kafka-connect-s3-archive.json](kafka-connect-s3-archive.json) shows the health, archive latency, consumer lag, throughput and errors of the S3 archive sink connector. It uses the Kafka Connect JMX exporter metrics (Prometheus job `kafka-connect`) and the Kafka Lag Exporter metrics. See [docs/S3_Archive.md](../../../docs/S3_Archive.md).
