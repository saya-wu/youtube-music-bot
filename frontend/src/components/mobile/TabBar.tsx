import { usePlayerStore } from "@/stores/playerStore";

export const TabBar = () => {
  const activeTab = usePlayerStore((state) => state.mobileActiveTab);
  const setActiveTab = usePlayerStore((state) => state.setMobileActiveTab);

  const tabs = [
    {
      id: "search" as const,
      label: "搜尋",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      id: "discover" as const,
      label: "Discover",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4zm0 5l2.5 2.5L12 18l-2.5-7.5L12 8z"
          />
        </svg>
      ),
    },
    {
      id: "library" as const,
      label: "資料庫",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="surface-card grid min-h-20 grid-cols-3 rounded-[30px] border p-1.5 shadow-[0_22px_44px_-32px_rgba(15,23,42,0.3)]">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[22px] transition-all ${
              activeTab === tab.id
                ? "bg-[var(--surface-elevated)] text-[var(--accent)] shadow-[0_14px_28px_-24px_var(--accent-glow)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            <div
              className={`transition-transform ${
                activeTab === tab.id ? "scale-110" : "scale-100"
              }`}
            >
              {tab.icon}
            </div>
            <span
              className={`text-xs font-medium ${
                activeTab === tab.id ? "font-semibold" : ""
              }`}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
