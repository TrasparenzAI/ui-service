export const environment = {
  production: false,
  apiUrl: window["env"]["apiUrl"],
  companyApiUrl: window["env"]["companyApiUrl"],
  conductorApiUrl: window["env"]["conductorApiUrl"],
  resultApiUrl: window["env"]["resultApiUrl"],
  resultAggregatorapiUrl: window["env"]["resultAggregatorapiUrl"],
  ruleApiUrl: window["env"]["ruleApiUrl"],
  taskSchedulerApiUrl: window["env"]["taskSchedulerApiUrl"],
  crawlerApiUrl: window["env"]["crawlerApiUrl"],  
  debug: window["env"]["debug"] || false,
  baseHref: window["env"]["baseHref"] || "/",
  oidc: {
    enable: window["env"]["oidc.enable"] || false,
    force: window["env"]["oidc.force"] || false,
    authority: window["env"]["oidc.authority"],
    redirectUrl: window["env"]["oidc.redirectUrl"],
    clientId: window["env"]["oidc.clientId"],
    postLogoutRedirectUri: window["env"]["oidc.postLogoutRedirectUri"] || window.location.origin
  },
  matomo: {
    enabled: window["env"]["matomo.enable"] || false,
    trackerUrl: window["env"]["matomo.trackerUrl"],
    siteId: window["env"]["matomo.siteId"]
  }
};