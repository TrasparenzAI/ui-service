(function(window) {
    window.env = window.env || {};
  
    // Environment variables
    window["env"]["apiUrl"] = "${API_URL}";
    window["env"]["theme"] = "${THEME}";
    
    window["env"]["companyApiUrl"] = "${COMPANY_API_URL}";
    window["env"]["conductorApiUrl"] = "${CONDUCTOR_API_URL}";
    window["env"]["resultApiUrl"] = "${RESULT_API_URL}";
    window["env"]["resultAggregatorapiUrl"] = "${RESULT_AGGREGATOR_API_URL}";
    window["env"]["ruleApiUrl"] = "${RULE_API_URL}";
    window["env"]["taskSchedulerApiUrl"] = "${TASK_SCHEDULER_API_URL}";
    window["env"]["crawlerApiUrl"] = "${CRAWLER_API_URL}";

    window["env"]["baseHref"] = "${BASE_HREF}";
    window["env"]["oidc.enable"] = ${OIDC_ENABLE};
    window["env"]["oidc.force"] = ${OIDC_FORCE};
    window["env"]["oidc.authority"] = "${OIDC_AUTHORITY}";
    window["env"]["oidc.redirectUrl"] = "${OIDC_REDIRECTURL}";
    window["env"]["oidc.clientId"] = "${OIDC_CLIENTID}";
    window["env"]["oidc.postLogoutRedirectUri"] = "${OIDC_POSTLOGOUTREDIRECTURL}";

    window["env"]["matomo.enable"] = ${MATOMO_ENABLE};
    window["env"]["matomo.trackerUser.enable"] = ${MATOMO_TRACKER_USER_ENABLE};
    window["env"]["matomo.trackerUrl"] = "${MATOMO_TRAKER_URL}";
    window["env"]["matomo.siteId"] = "${MATOMO_SITE_ID}";

})(this);