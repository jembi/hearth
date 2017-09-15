 # * Copyright (c) 2017-present, Jembi Health Systems NPC.
 # * All rights reserved.
 # *
 # * This source code is licensed under the BSD-style license found in the
 # * LICENSE file in the root directory of this source tree.
 
#!/bin/bash

# copy of https://github.com/jembi/openhim-core-js/blob/master/resources/openhim-api-curl.sh

if (( $# < 2)); then
	echo "PSHR API: Curl wrapper that sets up the appropriate authentication headers";
	echo "Usage: $0 USERNAME PASSWORD [CURL_ARGS...]";
	exit 0;
fi

username=$1;
pass=$2;
shift;
shift;

# which server?
server=""
for arg in $@; do
    match=`echo $arg | grep http | perl -pe 's|(https?://.*?)/.*|\1|'`;
    if [ "$match" ]; then
        server=$match;
    fi
done

if [ ! "$server" ]; then
    echo "PSHR server not specified";
    exit 0;
fi

auth=`curl -k -s $server/api/authenticate/$username`;
salt=`echo $auth | perl -pe 's|.*"salt":"(.*?)".*|\1|'`;
ts=`echo $auth | perl -pe 's|.*"ts":"(.*?)".*|\1|'`;

passhash=`echo -n "$salt$pass" | shasum -a 512 | awk '{print $1}'`;
token=`echo -n "$passhash$salt$ts" | shasum -a 512 | awk '{print $1}'`;

curl -k -H "auth-username: $username" -H "auth-ts: $ts" -H "auth-salt: $salt" -H "auth-token: $token" $@;
echo "";
