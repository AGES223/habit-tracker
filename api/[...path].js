const { handleApi } = require("../server");

module.exports = async function handler(req, res) {
  const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  return handleApi(req, res, pathname);
};
