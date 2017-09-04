 # BSD 3-Clause License
 # Copyright (c) 2017, Jembi Health Systems NPC
 # All rights reserved.

 # Redistribution and use in source and binary forms, with or without
 # modification, are permitted provided that the following conditions are met:

 # * Redistributions of source code must retain the above copyright notice, this
 #   list of conditions and the following disclaimer.

 # * Redistributions in binary form must reproduce the above copyright notice,
 #   this list of conditions and the following disclaimer in the documentation
 #   and/or other materials provided with the distribution.

 # * Neither the name of the copyright holder nor the names of its
 #   contributors may be used to endorse or promote products derived from
 #   this software without specific prior written permission.

 # THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 # AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 # IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 # DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 # FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 # DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 # SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 # CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 # OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 # OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 
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
