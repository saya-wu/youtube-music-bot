export function deferDialogNavigation(action: () => void): void {
  if (typeof window === "undefined") {
    action();
    return;
  }

  window.setTimeout(action, 0);
}
