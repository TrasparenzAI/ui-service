(function(window) {
    window.env = window.env || {};
  
    // Environment variables
    window["env"]["apiUrl"] = "${API_URL}";
    
    window["env"]["companyApiUrl"] = "${COMPANY_API_URL}";
    window["env"]["conductorApiUrl"] = "${CONDUCTOR_API_URL}";
    window["env"]["resultApiUrl"] = "${RESULT_API_URL}";
    window["env"]["resultAggregatorapiUrl"] = "${RESULT_AGGREGATOR_API_URL}";
    window["env"]["ruleApiUrl"] = "${RULE_API_URL}";
    window["env"]["crawlerApiUrl"] = "${CRAWLER_API_URL}";

    window["env"]["baseHref"] = "${BASE_HREF}";
    window["env"]["oidc.enable"] = ${OIDC_ENABLE};
    window["env"]["oidc.force"] = ${OIDC_FORCE};
    window["env"]["oidc.authority"] = "${OIDC_AUTHORITY}";
    window["env"]["oidc.redirectUrl"] = "${OIDC_REDIRECTURL}";
    window["env"]["oidc.clientId"] = "${OIDC_CLIENTID}";
    window["env"]["oidc.postLogoutRedirectUri"] = "${OIDC_POSTLOGOUTREDIRECTURL}";
})(this);