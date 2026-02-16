### STAGE 1: Build ###

# We label our stage as 'builder'
FROM node:alpine as builder

COPY package.json package-lock.json ./

RUN npm set progress=false && npm config set depth 0 && npm cache clean --force

## Storing node modules on a separate layer will prevent unnecessary npm installs at each build
RUN npm i --legacy-peer-deps && mkdir /ng-app && cp -R ./node_modules ./ng-app

WORKDIR /ng-app

COPY . .

## Build the angular app in production mode and store the artifacts in dist folder
RUN node_modules/.bin/ng build --configuration production --aot --output-hashing=all --base-href /


### STAGE 2: Setup ###

FROM nginx:alpine

## Copy our default nginx config
COPY nginx/default.conf /etc/nginx/conf.d/

## Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

## From 'builder' stage copy over the artifacts in dist folder to default nginx public folder
COPY --from=builder /ng-app/dist/browser /usr/share/nginx/html

ENV API_URL=https://dica33.ba.cnr.it
ENV COMPANY_API_URL=$API_URL/public-sites-service
ENV CONDUCTOR_API_URL=$API_URL/conductor-server
ENV RESULT_API_URL=$API_URL/result-service
ENV RESULT_AGGREGATOR_API_URL=$API_URL/result-aggregator-service
ENV TASK_SCHEDULER_API_URL=$API_URL/task-scheduler-service
ENV RULE_API_URL=$API_URL/rule-service
ENV CRAWLER_API_URL=$API_URL/crawl

ENV BASE_HREF=/
ENV OIDC_ENABLE=false
ENV OIDC_FORCE=false
ENV OIDC_AUTHORITY=
ENV OIDC_REDIRECTURL=http://localhost/auth/signin
ENV OIDC_CLIENTID=angular-public
ENV OIDC_POSTLOGOUTREDIRECTURL=

ENV MATOMO_ENABLE=false
ENV MATOMO_TRACKER_USER_ENABLE=true
ENV MATOMO_TRAKER_URL=
ENV MATOMO_SITE_ID=

# When the container starts, replace the env.js with values from environment variables
CMD ["/bin/sh",  "-c",  "sed -i -e 's;<base href=\"/\">;<base href=\"'$BASE_HREF'\">;' /usr/share/nginx/html/index.html && envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]