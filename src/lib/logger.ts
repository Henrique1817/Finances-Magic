import pino from "pino";
import { env } from "../config/env";

const isProd = env.nodeEnv === "production";

export const logger = pino({
  level: env.logLevel,
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
});
