FROM node:carbon

# install dependencies
ADD package.json yarn.lock /src/hearth/
WORKDIR /src/hearth/
RUN yarn

# add app
ADD . /src/hearth/

CMD ["yarn", "start"]
