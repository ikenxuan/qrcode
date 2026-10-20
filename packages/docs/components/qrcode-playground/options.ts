import { dyFallbackContent, fallbackContent } from './constants';
import type { DyCodeOptions, PlaygroundState, QRCodeOptions } from './types';

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

/** 构造抖音码生成配置；图片会放到右上角圆形槽位，中心图片会覆盖中心圆盘。 */
export function buildDyOptions(
  state: PlaygroundState,
  badgeBytes: Uint8Array | null,
  centerBytes: Uint8Array | null,
): DyCodeOptions {
  const data = state.content.trim() || dyFallbackContent;

  return {
    data,
    size: state.dySize,
    margin: state.dyMargin,
    darkColor: state.dyDarkColor,
    lightColor: state.dyLightColor,
    transparent: state.dyTransparent,
    moduleStyle: state.dyModuleStyle,
    moduleRadius: state.dyModuleRadius,
    frame: state.dyFrame,
    frameStyle: state.dyFrameStyle,
    frameWidth: state.dyFrameWidth,
    frameRadius: state.dyFrameRadius,
    frameSpan: state.dyFrameSpan,
    frameCount: state.dyFrameCount,
    logo: state.dyLogo,
    badge: state.dyBadge,
    badgeRadius: state.dyBadgeRadius,
    ...(state.dyBadge && badgeBytes ? { badgeImage: badgeBytes } : {}),
    ...(centerBytes ? { centerImage: centerBytes } : {}),
  };
}
