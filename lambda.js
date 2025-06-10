const serverlessExpress = require("@vendia/serverless-express");
const app = require("./index");

// Export the Lambda handler
exports.handler = serverlessExpress({ app });
