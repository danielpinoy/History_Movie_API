const awsServerlessExpress = require("aws-serverless-express");
const app = require("./index");

// Create server with proper MIME type handling
const server = awsServerlessExpress.createServer(app, null, [
  "application/json",
  "application/x-www-form-urlencoded",
  "text/plain",
  "text/html",
]);

exports.handler = (event, context) => {
  // Debug logging
  console.log("=== Incoming Event ===");
  console.log(
    "HTTP Method:",
    event.requestContext?.http?.method || event.httpMethod
  );
  console.log("Path:", event.rawPath || event.path);
  console.log("Headers:", JSON.stringify(event.headers, null, 2));
  console.log("Body:", event.body);
  console.log("===================");

  // Ensure the HTTP method is preserved
  if (event.requestContext?.http?.method && !event.httpMethod) {
    event.httpMethod = event.requestContext.http.method;
  }

  if (!event.httpMethod && event.requestContext?.http?.method) {
    event.httpMethod = event.requestContext.http.method;
  }

  if (!event.path && event.rawPath) {
    event.path = event.rawPath;
  }

  if (!event.queryStringParameters && event.rawQueryString) {
    event.queryStringParameters = event.rawQueryString
      ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
      : {};
  }

  console.log("Processed HTTP Method:", event.httpMethod);
  console.log("Processed Path:", event.path);

  return awsServerlessExpress.proxy(server, event, context);
};
