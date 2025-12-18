import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, typography, TypographyKey } from '../theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyKey;
  color?: string;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = colors.textPrimary,
  align = 'left',
  style,
  children,
  ...props
}) => {
  return (
    <RNText
      style={[
        typography[variant],
        { color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};
