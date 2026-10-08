# Grafana Dashboards

## How these dashboards are used

The JSON files in this directory are Grafana dashboard definitions. They specify
panel layouts, visualization settings, filters, and queries.

The Grafana service in [docker-compose-monitoring.yml](../../../docker-compose-monitoring.yml)
mounts this directory at `/etc/grafana/dashboards` and mounts
[dashboard.yml](../dashboard.yml) as its dashboard provisioning configuration.
That configuration tells Grafana to load the files at startup and check for
changes every 30 seconds. No manual import is needed when using this Compose
configuration.

To view the dashboards:

1. Complete the [monitoring configuration](../../../README.md#5-monitoring-stack),
   then start Grafana and Prometheus from the repository root:
   `docker compose --profile grafana --profile prometheus up -d grafana prometheus`.
2. Open `http://localhost:3000` and sign in using the configured Grafana credentials.
3. Open Dashboards and select **ODE FFMLib Decode** or **ODE Kafka Produced**.
4. Select the Prometheus datasource and use the dashboard filters as needed.

For the ODE dashboards, the data flow is:

`ODE /actuator/prometheus -> Prometheus -> Grafana dashboard panels`

[datasource.yml](../datasource.yml) configures Grafana to query Prometheus at
`http://prometheus:9090`. The `ode` job in
[prometheus.yml](../../prometheus/prometheus.yml) scrapes
`ode:8080/actuator/prometheus`. ODE must be running separately and reachable from
the Prometheus container, with the dashboard metrics exposed. This repository
does not define an ODE service; use a shared Docker network with the `ode`
hostname, or update the scrape target to the reachable ODE address for your
deployment.

The FFMLib dashboard displays decode and delivery metrics. The Kafka Produced
dashboard displays ODE publication counters by topic and metadata origin IP;
Grafana obtains these measurements from Prometheus rather than consuming Kafka
records. Check the `ode` target at `http://localhost:9090/targets` to confirm that
Prometheus can scrape ODE. Some dashboard stats fall back to zero when metrics
are absent, so a zero display alone does not confirm a working scrape.

## Node Exporter Full

https://grafana.com/grafana/dashboards/10242-node-exporter-full/

## Kafka Lag Exporter

https://github.com/seglo/kafka-lag-exporter/blob/master/grafana/Kafka_Lag_Exporter_Dashboard.json

## MongoDB Dashboard

[20867](https://grafana.com/grafana/dashboards/20867-mongodb-dashboard/)

## ODE FFMLib Decode

`ffmlib-decode.json` graphs in-process FFMLib decode rate, failures, drops, latency, raw UDP publication, routed output delivery, and offset-commit health from the ODE Prometheus endpoint.

## ODE Kafka Produced

`ode-kafka-produced.json` graphs Kafka records published by the ODE, including counts by topic and by metadata origin IP.
