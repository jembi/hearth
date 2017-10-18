#!/bin/bash

if ([ "$TRAVIS_BRANCH" == "master" ]) && [ "$TRAVIS_PULL_REQUEST" == "false" ]; then
    curl -H 'Content-Type: application/json' --data '{"source_type": "Branch", "source_name": "master"}' -X POST https://registry.hub.docker.com/u/jembi/hearth/trigger/d59c88be-3118-4d70-980a-0d2d19971aa5/
else
    echo "Docker image will only be built for commits to master"
fi
