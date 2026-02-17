(function(window) {
    window["env"] = window["env"] || {};
  
    // Environment variables
    window["env"]["theme"] = "tema-verde";
    window["env"]["apiUrl"] = "https://dica33.ba.cnr.it";
    window["env"]["companyApiUrl"] = window["env"]["apiUrl"] + "/public-sites-service";
    window["env"]["conductorApiUrl"] = "https://monitorai.ba.cnr.it" + "/conductor-server";
    window["env"]["resultApiUrl"] = window["env"]["apiUrl"] + "/result-service";
    window["env"]["resultAggregatorapiUrl"] = window["env"]["apiUrl"] + "/result-aggregator-service";
    window["env"]["ruleApiUrl"] = "https://monitorai.ba.cnr.it" + "/rule-service";
    window["env"]["taskSchedulerApiUrl"] = window["env"]["apiUrl"] + "/task-scheduler-service";    
    window["env"]["crawlerApiUrl"] = "http://150.145.95.77:8080/crawl";

    window["env"]["baseHref"] = "/";
    window["env"]["production"] = false;
    window["env"]["oidc.enable"] = true;
    window["env"]["oidc.force"] = false;
    window["env"]["oidc.authority"] = "https://dica33.ba.cnr.it/keycloak/realms/trasparenzai/.well-known/openid-configuration";
    window["env"]["oidc.redirectUrl"] = "http://localhost:4200/#/";
    window["env"]["oidc.clientId"] = "angular-public";
    window["env"]["oidc.postLogoutRedirectUri"] = "http://localhost:4200/#/";

    window["env"]["matomo.enable"] = false;
    window["env"]["matomo.trackerUrl"] = "";
    window["env"]["matomo.siteId"] = "";

  })(this);