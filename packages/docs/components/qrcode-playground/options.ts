import { fallbackContent } from './constants';
import type { QRCodeOptions, PlaygroundState } from './types';

function colorOrGradient(useGradient: boolean, colorFrom: string, colorTo: string) {
  return useGradient
    ? { gradient: { colorFrom, colorTo } }
    : { color: colorFrom };
}

export function buildQRCodeOptions(state: PlaygroundState, logoBytes: Uint8Array | null): QRCodeOptions {
  const data = state.content.trim() || fallbackContent;

  return {
    data,
    size: state.size,
    margin: state.margin,
    shape: state.shape,
    dotsOptions: {
      dotType: state.dotType,
      ...colorOrGradient(state.useDotGradient, state.dotColor, state.dotGradientTo),
    },
    cornersSquareOptions: {
      cornerType: state.cornerSquareType,
      ...colorOrGradient(
        state.useCornerSquareGradient,
        state.cornerSquareColor,
        state.cornerSquareGradientTo,
      ),
    },
    cornersDotOptions: {
      cornerType: state.cornerDotType,
      ...colorOrGradient(state.useCornerDotGradient, state.cornerDotColor, state.cornerDotGradientTo),
    },
    backgroundOptions: state.transparentBackground
      ? { transparent: true }
      : {
          ...(state.useBackgroundGradient
            ? {
                gradient: {
                  colorFrom: state.backgroundColor,
                  colorTo: state.backgroundGradientTo,
                },
              }
            : { color: state.backgroundColor }),
          round: state.backgroundRound,
        },
    ...(logoBytes
      ? {
          image: logoBytes,
          imageOptions: {
            imageSize: state.imageSize,
            margin: state.logoMargin,
            round: state.logoRound,
            hideBackgroundDots: state.hideBackgroundDots,
          },
        }
      : {}),
  };
}
