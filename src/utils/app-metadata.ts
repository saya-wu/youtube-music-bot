import { execSync } from "node:child_process";
import packageJson from "../../package.json";

export interface AppMetadata {
  appVersion: string;
  gitSha: string;
  buildVersion: string;
  environment: string;
}

function readGitSha(): string {
  if (process.env.APP_GIT_SHA) {
    return process.env.APP_GIT_SHA;
  }

  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export function getAppMetadata(): AppMetadata {
  const appVersion = process.env.APP_VERSION || packageJson.version;
  const gitSha = readGitSha();

  return {
    appVersion,
    gitSha,
    buildVersion: gitSha ? `${appVersion}+${gitSha}` : appVersion,
    environment: process.env.NODE_ENV || "development",
  };
}
