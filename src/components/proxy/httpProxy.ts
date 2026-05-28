import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { logger } from "../logs/logger.js";

const httpProxy = process.env.HTTP_PROXY;
const httpsProxy = process.env.HTTPS_PROXY;

if (httpProxy || httpsProxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
  logger.info("http_proxy_enabled", {
    httpProxy,
    httpsProxy,
    noProxy: process.env.NO_PROXY,
  });
}
