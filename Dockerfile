 # * Copyright (c) 2017-present, Jembi Health Systems NPC.
 # * All rights reserved.
 # *
 # * This source code is licensed under the BSD-style license found in the
 # * LICENSE file in the root directory of this source tree.
 
FROM node:boron

RUN npm install -g nodemon

# install dependencies
ADD package.json /src/hearth/
WORKDIR /src/hearth/
RUN npm install

# add app
ADD . /src/hearth/

CMD nodemon lib/server.js
