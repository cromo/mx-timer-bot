FROM node:12.13.0

WORKDIR /src
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm install
COPY . .
RUN mv config.example.toml config.toml

CMD ["npm", "start"]