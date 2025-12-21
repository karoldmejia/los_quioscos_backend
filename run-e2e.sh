#!/usr/bin/env bash

docker compose up -d postgres redis

echo "Waiting for microservices..."
sleep 5

MICROSERVICIOS=("users")

for svc in "${MICROSERVICIOS[@]}"
do
  echo "Executing e2e tests for $svc..."

  docker compose run --rm $svc sh -c "npm run test:e2e:$svc"

  echo "Tests e2e completed $svc"
done

echo "All tests have been completed! :)"