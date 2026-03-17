export interface AppMetadata {
  appVersion: string;
  gitSha: string;
  buildVersion: string;
  environment: string;
}

export const frontendAppMetadata: AppMetadata = {
  appVersion: import.meta.env.VITE_APP_VERSION,
  gitSha: import.meta.env.VITE_APP_GIT_SHA,
  buildVersion: import.meta.env.VITE_APP_BUILD_VERSION,
  environment: import.meta.env.VITE_APP_ENVIRONMENT,
};
