declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      NODE_ENV?: "development" | "production" | "test";
      LOG_LEVEL?: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";
      ALLOY_API_URL: string;
      ALLOY_API_KEY: string;
      INTERNAL_SYSTEM: string;
      INTERNAL_SYSTEM_URL: string;
      INTERNAL_AUTHORIZATION_HEADER_NAME?: string;
      INTERNAL_AUTHORIZATION_HEADER_VALUE?: string;
      LOGS_PATH?: string;
    }
  }
}

export {};
