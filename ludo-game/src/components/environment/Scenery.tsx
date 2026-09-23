/**
 * Code-drawn scenery behind the board. PLACEHOLDER for the painted layers
 * listed in docs/ASSETS.md (bg_far / bg_mid / bg_near): it only uses shapes
 * and gradients, and it never touches the game state.
 */
import {LinearGradient} from 'expo-linear-gradient';
import {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import type {SceneryDefinition} from '../../themes/types.ts';

function Triangle({
  left,
  top,
  width,
  height,
  color,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderBottomWidth: height,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
  );
}

function Fuji({
  width,
  horizon,
  color,
}: {
  width: number;
  horizon: number;
  color: string;
}) {
  const w = width * 0.78;
  const h = horizon * 0.62;
  const left = (width - w) / 2;
  const top = horizon - h;
  const capW = w * 0.3;
  const capH = h * 0.3;
  return (
    <>
      <Triangle left={left} top={top} width={w} height={h} color={color} />
      <Triangle
        left={left + (w - capW) / 2}
        top={top}
        width={capW}
        height={capH}
        color="#F3EEF8"
      />
      {/* snow teeth hanging below the cap */}
      {[-1, 0, 1].map(i => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: left + w / 2 + i * capW * 0.26 - capW * 0.1,
            top: top + capH - 1,
            width: 0,
            height: 0,
            borderLeftWidth: capW * 0.1,
            borderRightWidth: capW * 0.1,
            borderTopWidth: capH * 0.4,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: '#F3EEF8',
          }}
        />
      ))}
    </>
  );
}

function Torii({
  left,
  bottom,
  size,
}: {
  left: number;
  bottom: number;
  size: number;
}) {
  const post = size * 0.09;
  const red = '#A3232A';
  return (
    <View
      style={{
        position: 'absolute',
        left,
        bottom,
        width: size,
        height: size * 0.9,
      }}>
      <View
        style={[
          styles.part,
          {
            left: 0,
            right: 0,
            top: 0,
            height: post * 1.1,
            backgroundColor: '#2A0E10',
            borderRadius: post,
          },
        ]}
      />
      <View
        style={[
          styles.part,
          {
            left: size * 0.04,
            right: size * 0.04,
            top: post * 1.1,
            height: post * 0.8,
            backgroundColor: red,
          },
        ]}
      />
      <View
        style={[
          styles.part,
          {
            left: size * 0.1,
            right: size * 0.1,
            top: post * 2.8,
            height: post * 0.7,
            backgroundColor: red,
          },
        ]}
      />
      <View
        style={[
          styles.part,
          {
            left: size * 0.2,
            width: post,
            top: post,
            bottom: 0,
            backgroundColor: red,
          },
        ]}
      />
      <View
        style={[
          styles.part,
          {
            right: size * 0.2,
            width: post,
            top: post,
            bottom: 0,
            backgroundColor: red,
          },
        ]}
      />
    </View>
  );
}

export const Scenery = memo(function Scenery({
  scenery,
  width,
  height,
}: {
  readonly scenery: SceneryDefinition;
  readonly width: number;
  readonly height: number;
}) {
  const horizon = height * 0.27;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...scenery.sky]}
        style={[
          styles.part,
          {left: 0, right: 0, top: 0, height: horizon * 1.05},
        ]}
      />
      {scenery.sun ? (
        <>
          <View
            style={[
              styles.part,
              {
                left: width * 0.66,
                top: horizon * 0.5,
                width: width * 0.2,
                height: width * 0.2,
                borderRadius: width,
                backgroundColor: scenery.sun,
                opacity: 0.25,
              },
            ]}
          />
          <View
            style={[
              styles.part,
              {
                left: width * 0.7,
                top: horizon * 0.5 + width * 0.04,
                width: width * 0.12,
                height: width * 0.12,
                borderRadius: width,
                backgroundColor: scenery.sun,
              },
            ]}
          />
        </>
      ) : null}
      {scenery.landmark === 'fuji' ? (
        <Fuji width={width} horizon={horizon} color={scenery.hills} />
      ) : null}
      {/* distant hills */}
      <View
        style={[
          styles.part,
          {
            left: -width * 0.2,
            top: horizon * 0.82,
            width: width * 0.8,
            height: horizon * 0.5,
            borderRadius: width,
            backgroundColor: scenery.hills,
          },
        ]}
      />
      <View
        style={[
          styles.part,
          {
            left: width * 0.45,
            top: horizon * 0.86,
            width: width * 0.8,
            height: horizon * 0.5,
            borderRadius: width,
            backgroundColor: scenery.hills,
          },
        ]}
      />
      {scenery.water ? (
        <LinearGradient
          colors={[scenery.water, scenery.sky[1]]}
          style={[
            styles.part,
            {left: 0, right: 0, top: horizon, height: horizon * 0.3},
          ]}
        />
      ) : null}
      {scenery.landmark === 'fuji' ? (
        <Torii
          left={width * 0.06}
          bottom={height - horizon * 1.12}
          size={width * 0.22}
        />
      ) : null}
      {/* wooden floor under the board */}
      <LinearGradient
        colors={['#3B2314', '#2A170C', '#1C0F07']}
        style={[
          styles.part,
          {left: 0, right: 0, top: horizon * 1.3, bottom: 0},
        ]}
      />
      <LinearGradient
        colors={[scenery.water ?? scenery.sky[2], 'transparent']}
        style={[
          styles.part,
          {
            left: 0,
            right: 0,
            top: horizon * 1.28,
            height: horizon * 0.25,
            opacity: 0.4,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({part: {position: 'absolute'}});
