import { create } from "zustand";
import { api } from "@/services/api";
import type {
  DiscoverFeedResponse,
  DiscoverMarketCode,
  DiscoverMarketsResponse,
} from "@/types";

interface DiscoverStore {
  initialized: boolean;
  markets: DiscoverMarketsResponse["markets"];
  defaultMarket: DiscoverMarketCode;
  topRequested: DiscoverMarketsResponse["topRequested"];
  selectedMarket: DiscoverMarketCode;
  selectedMoodKey: string | null;
  moods: DiscoverFeedResponse["moods"];
  sections: DiscoverFeedResponse["sections"];
  warnings: string[];
  fetchedAt: string | null;
  isMarketsLoading: boolean;
  isFeedLoading: boolean;
  marketsError: string | null;
  feedError: string | null;
  initialize: () => Promise<void>;
  refreshMarkets: () => Promise<DiscoverMarketsResponse | null>;
  loadFeed: (options?: {
    market?: DiscoverMarketCode;
    moodKey?: string | null;
  }) => Promise<DiscoverFeedResponse | null>;
  selectMarket: (market: DiscoverMarketCode) => Promise<void>;
  selectMood: (moodKey: string | null) => Promise<void>;
  refreshFeed: () => Promise<void>;
}

const DEFAULT_DISCOVER_MARKET: DiscoverMarketCode = "TW";

let initializePromise: Promise<void> | null = null;
let marketsPromise: Promise<DiscoverMarketsResponse | null> | null = null;
let feedRequestSequence = 0;

export const useDiscoverStore = create<DiscoverStore>((set, get) => ({
  initialized: false,
  markets: [],
  defaultMarket: DEFAULT_DISCOVER_MARKET,
  topRequested: [],
  selectedMarket: DEFAULT_DISCOVER_MARKET,
  selectedMoodKey: null,
  moods: [],
  sections: [],
  warnings: [],
  fetchedAt: null,
  isMarketsLoading: false,
  isFeedLoading: false,
  marketsError: null,
  feedError: null,
  initialize: async () => {
    if (get().initialized) {
      return;
    }

    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      const marketsResponse = await get().refreshMarkets();
      const targetMarket =
        marketsResponse?.markets.some(
          (market) => market.code === get().selectedMarket,
        )
          ? get().selectedMarket
          : marketsResponse?.defaultMarket ?? DEFAULT_DISCOVER_MARKET;

      await get().loadFeed({
        market: targetMarket,
        moodKey: get().selectedMoodKey,
      });

      set({ initialized: true });
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },
  refreshMarkets: async () => {
    if (marketsPromise) {
      return marketsPromise;
    }

    set({ isMarketsLoading: true, marketsError: null });

    marketsPromise = (async () => {
      const response = await api.getDiscoverMarkets();

      if (!response.success || !response.data) {
        const errorMessage = response.error || "無法載入 Discover 市場資訊";
        set({
          isMarketsLoading: false,
          marketsError: errorMessage,
        });
        return null;
      }

      const nextDefaultMarket = response.data.defaultMarket;
      const hasSelectedMarket = response.data.markets.some(
        (market) => market.code === get().selectedMarket,
      );
      const nextSelectedMarket = hasSelectedMarket
        ? get().selectedMarket
        : nextDefaultMarket;

      set({
        markets: response.data.markets,
        defaultMarket: nextDefaultMarket,
        selectedMarket: nextSelectedMarket,
        topRequested: response.data.topRequested,
        isMarketsLoading: false,
        marketsError: null,
      });

      return response.data;
    })().finally(() => {
      marketsPromise = null;
    });

    return marketsPromise;
  },
  loadFeed: async (options) => {
    const market = options?.market ?? get().selectedMarket;
    const moodKey =
      options?.moodKey === undefined ? get().selectedMoodKey : options.moodKey;
    const requestId = ++feedRequestSequence;

    set({
      isFeedLoading: true,
      feedError: null,
      selectedMarket: market,
      selectedMoodKey: moodKey ?? null,
    });

    const response = await api.getDiscoverFeed(market, moodKey);

    if (requestId !== feedRequestSequence) {
      return null;
    }

    if (!response.success || !response.data) {
      set({
        isFeedLoading: false,
        feedError: response.error || "無法載入 Discover 內容",
      });
      return null;
    }

    const selectedMoodKey = response.data.selectedMood?.key ?? null;

    set({
      selectedMarket: response.data.market,
      selectedMoodKey,
      moods: response.data.moods,
      sections: response.data.sections,
      warnings: response.data.warnings,
      fetchedAt: response.data.fetchedAt,
      isFeedLoading: false,
      feedError: null,
    });

    return response.data;
  },
  selectMarket: async (market) => {
    if (market === get().selectedMarket && get().selectedMoodKey === null) {
      return;
    }

    await get().loadFeed({
      market,
      moodKey: null,
    });
  },
  selectMood: async (moodKey) => {
    const nextMoodKey = moodKey?.trim() || null;

    if (nextMoodKey === get().selectedMoodKey) {
      return;
    }

    await get().loadFeed({
      market: get().selectedMarket,
      moodKey: nextMoodKey,
    });
  },
  refreshFeed: async () => {
    await get().loadFeed({
      market: get().selectedMarket,
      moodKey: get().selectedMoodKey,
    });
  },
}));
