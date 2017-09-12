FROM node:boron

RUN npm install -g nodemon

# install dependencies
ADD package.json /src/hearth/
WORKDIR /src/hearth/
RUN npm install

# add app
ADD . /src/hearth/

CMD nodemon lib/server.js
