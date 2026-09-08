export const PHONE_MAX_WIDTH = 767;
export const TABLET_MIN_WIDTH = 768;
export const TABLET_WIDTH = 1100;
export const TABLET_HEIGHT = 700;
export const TABLET_MAX_WIDTH = TABLET_WIDTH;
export const DESKTOP_MIN_WIDTH = TABLET_MAX_WIDTH + 1;

export const phoneMedia = `(max-width: ${PHONE_MAX_WIDTH}px)`;
export const tabletMedia = `(max-width: ${TABLET_MAX_WIDTH}px) and (min-width: ${TABLET_MIN_WIDTH}px)`;
export const tabletOrPhoneMedia = `(max-width: ${TABLET_MAX_WIDTH}px)`;
export const desktopMedia = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;
export const landscapeTabletMedia = `${tabletMedia} and (orientation: landscape)`;
export const compactLandscapeMedia = `(orientation: landscape) and (max-height: ${TABLET_HEIGHT}px)`;

export const isPhoneWidth = (width: number) => width <= PHONE_MAX_WIDTH;
export const isTabletWidth = (width: number) => width >= TABLET_MIN_WIDTH && width <= TABLET_MAX_WIDTH;
