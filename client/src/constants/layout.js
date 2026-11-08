/**
 * Layout & Spacing Constants
 * Canonical source for z-index layers, maximum widths, spacing and layout dimensions.
 * No magic z-index numbers should appear elsewhere in the codebase.
 */

export const Z_INDEX = {
    BASE: 0,
    ELEVATED: 10,
    CARD_HOVER: 20,
    CURSOR: 30,
    BAR: 40,
    SHEET: 50,
    MODAL: 60,
    TOAST: 70,
};

export const MAX_WIDTHS = {
    LANDING: 1100, // 1100px
    LOBBY: 1000,   // 1000px
    GAME: 1280,    // 1280px
    GAME_END: 1000, // 1000px
};

export const SPACING = {
    PAGE_PADDING: 16,
    CONTAINER_GAP: 24,
};

export const TOP_BAR_HEIGHT = {
    DESKTOP: 56, // 56px
    MOBILE: 48,  // 48px
};

export const PAGE_TRANSITION = {
    ENTER_DURATION: 0.2, // 200ms
    EXIT_DURATION: 0.12, // 120ms
    OFFSET_Y: 12,
};
