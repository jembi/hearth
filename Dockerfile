FROM node:boron

# install dependencies
ADD package-lock.json /src/frontend/
ADD package.json /src/hearth/
WORKDIR /src/hearth/
RUN npm install

# add app
ADD . /src/hearth/

CMD ["npm", "start"]
