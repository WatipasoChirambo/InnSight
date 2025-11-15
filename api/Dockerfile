FROM node:20-alpine

WORKDIR /usr/src/app

# copy ONLY package files first
COPY ./package*.json ./

RUN npm install

# now copy everything else
COPY . .

EXPOSE 5000

CMD ["node", "src/index.js"]
