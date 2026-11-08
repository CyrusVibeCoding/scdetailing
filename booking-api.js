// Only public credentials belong in browser code.
window.scApi = async body => {
  const config = window.SC_CONFIG;
  if (!config?.aiEndpoint || !config?.publishableKey) throw Error('The request service is unavailable. Please try again later.');
  const response = await fetch(config.aiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: 'Bearer ' + config.publishableKey },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = Error(data.error || 'Please try again shortly.');
    error.status = response.status;
    throw error;
  }
  return data;
};
