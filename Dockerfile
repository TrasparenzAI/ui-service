FROM node:alpine AS builder

COPY package.json package-lock.json ./

RUN npm set progress=false && npm config set depth 0 && npm cache clean --force

RUN npm i --legacy-peer-deps && mkdir /ng-app && cp -R ./node_modules ./ng-app

WORKDIR /ng-app

COPY . .

RUN node_modules/.bin/ng build --configuration production --aot --output-hashing=all --base-href /


### STAGE 2: Build Badge Service ###
FROM node:20-bookworm AS badge-builder

WORKDIR /badge

COPY badge-service/package*.json ./
RUN npm install

COPY badge-service/index.js .
COPY badge-service/tsconfig.json .
COPY shared/gauge-options.ts .


### STAGE 3: Final ###
FROM node:alpine
LABEL maintainer="Marco Spasiano <marco.spasiano@cnr.it>"
RUN apk add --no-cache \
    nginx supervisor \
    vips \
    gettext ttf-dejavu

# ts-node globale
RUN npm install -g ts-node typescript

# nginx
RUN rm -rf /usr/share/nginx/html/*
COPY nginx/default.conf /etc/nginx/http.d/default.conf
COPY --from=builder /ng-app/dist/browser /usr/share/nginx/html

# badge service
COPY --from=badge-builder /badge /app/badge

# supervisord
COPY supervisord.conf /etc/supervisord.conf

ENV THEME=
ENV API_URL=https://dica33.ba.cnr.it
ENV COMPANY_API_URL=$API_URL/public-sites-service
ENV CONDUCTOR_API_URL=$API_URL/conductor-server
ENV RESULT_API_URL=$API_URL/result-service
ENV RESULT_AGGREGATOR_API_URL=$API_URL/result-aggregator-service
ENV TASK_SCHEDULER_API_URL=$API_URL/task-scheduler-service
ENV RULE_API_URL=$API_URL/rule-service
ENV CRAWLER_API_URL=$API_URL/crawl
ENV AI_API_URL=$API_URL/ai-integration-service
ENV MCP_API_URL=$API_URL/mcp-server
ENV DEV_BYPASS_ADMIN_AUTH=false
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

EXPOSE 80

CMD ["/bin/sh", "-c", "\
  HASH=$(date +%s) && \
  envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.${HASH}.js && \
  rm -f /usr/share/nginx/html/assets/env.js && \
  sed -i \
    -e 's;<base href=\"/\">;<base href=\"'$BASE_HREF'\">;' \
    -e 's;assets/env\\.js;assets/env.'${HASH}'.js;g' \
    /usr/share/nginx/html/index.html && \
  exec /usr/bin/supervisord -c /etc/supervisord.conf"]