export function getVersionBadgeVariant(
  frontendBuildVersion: string,
  backendBuildVersion?: string | null,
): "default" | "warning" | "secondary" {
  if (!backendBuildVersion) {
    return "secondary";
  }

  return frontendBuildVersion === backendBuildVersion ? "default" : "warning";
}
