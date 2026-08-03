import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';

export interface InputProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  mono?: boolean;
  /** Label starts inside the field and rises on focus/fill. Opt-in. */
  floatLabel?: boolean;
  iconLeft?: ReactNode;
  trailing?: ReactNode;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  testID?: string;
}

/**
 * ISP text field — ported from components/forms/Input.jsx. Surface-1,
 * hairline border, md radius, visible amber focus ring (approximated with
 * a border-color change plus a soft outer glow via a second border layer,
 * since RN has no CSS box-shadow ring primitive).
 */
export function Input({
  label,
  value,
  defaultValue,
  placeholder,
  hint,
  error,
  multiline = false,
  rows = 3,
  disabled = false,
  mono = false,
  floatLabel = false,
  iconLeft,
  trailing,
  onChangeText,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType,
  testID,
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [dirty, setDirty] = useState(!!(value ?? defaultValue));
  const shakeX = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(value || defaultValue ? 1 : 0)).current;
  const hadError = useRef(!!error);

  useEffect(() => {
    if (error && !hadError.current) {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -3, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 3, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -2, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
    hadError.current = !!error;
  }, [error, shakeX]);

  const filled = value !== undefined ? !!value : dirty;
  const raised = !floatLabel || focused || filled || !!placeholder;

  useEffect(() => {
    Animated.timing(floatAnim, {
      toValue: raised ? 1 : 0,
      duration: theme.duration.base,
      useNativeDriver: false,
    }).start();
  }, [raised, floatAnim, theme.duration.base]);

  const borderColor = error
    ? theme.colors.textAttention
    : focused
      ? theme.colors.borderFocus
      : theme.colors.borderHairline;

  return (
    <Animated.View
      style={{ gap: floatLabel ? 0 : theme.space.xs, transform: [{ translateX: shakeX }] }}
    >
      {label && !floatLabel ? (
        <Text
          style={{
            fontFamily: theme.font.textMedium,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textBody,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            alignItems: multiline ? 'flex-start' : 'center',
            gap: theme.space.xs,
            paddingHorizontal: floatLabel ? theme.space.sm : theme.padding.input.horizontal,
            paddingTop: floatLabel ? 20 : theme.padding.input.vertical,
            paddingBottom: floatLabel ? 8 : theme.padding.input.vertical,
            minHeight: theme.touch.min,
            backgroundColor: disabled ? theme.colors.surfaceCanvas : theme.colors.surfaceCard,
            borderColor,
            borderRadius: theme.radius.md,
            borderWidth: focused && !error ? theme.borderWidth.focus : theme.borderWidth.hairline,
          },
        ]}
      >
        {label && floatLabel ? (
          <Animated.Text
            style={{
              position: 'absolute',
              left: iconLeft ? 34 : 13,
              top: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 7] }),
              fontFamily: theme.font.textMedium,
              fontSize: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] }),
              color: error
                ? theme.colors.textAttention
                : focused
                  ? theme.colors.signalActive
                  : theme.colors.textTertiary,
            }}
          >
            {label}
          </Animated.Text>
        ) : null}
        {iconLeft ? <View style={{ opacity: 0.8 }}>{iconLeft}</View> : null}
        <TextInput
          value={value}
          defaultValue={defaultValue}
          placeholder={floatLabel && !raised ? undefined : placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? rows : undefined}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={(text) => {
            if (value === undefined) setDirty(!!text);
            onChangeText?.(text);
          }}
          style={[
            styles.control,
            {
              color: disabled ? theme.colors.textDisabled : theme.colors.textHeading,
              fontFamily: mono ? theme.font.mono : theme.font.text,
              fontSize: mono ? theme.type.mono.fontSize : theme.type.bodySm.fontSize,
              minHeight: multiline ? rows * 21 : 26,
            },
          ]}
          testID={testID}
        />
        {trailing ? <View style={{ opacity: 0.8 }}>{trailing}</View> : null}
      </View>
      {error || hint ? (
        <Text
          style={{
            marginTop: theme.space.xs,
            fontFamily: theme.font.text,
            fontSize: theme.type.caption.fontSize,
            color: error ? theme.colors.textAttention : theme.colors.textSubtle,
          }}
        >
          {error || hint}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    position: 'relative',
    flexDirection: 'row',
  },
  control: {
    flex: 1,
    padding: 0,
  },
});
