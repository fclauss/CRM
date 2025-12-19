/**
 * Simple function to get the web app URL
 * Run this in Apps Script editor to get your deployment URL
 */
function getWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('Web App URL: ' + url);
  return url;
}
