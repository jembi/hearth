#!/usr/bin/env bash
set -ex

# automate tagging with the short commit hash
docker build --no-cache -t intrahealth/hearth:$(git rev-parse --short HEAD) .
docker tag intrahealth/hearth:$(git rev-parse --short HEAD) intrahealth/hearth:latest
docker push intrahealth/hearth:$(git rev-parse --short HEAD)
docker push intrahealth/hearth:latest