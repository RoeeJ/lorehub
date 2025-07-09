import React from 'react';
import { Box } from 'ink';
import { useAlternativeScreen } from '../hooks/useAlternativeScreen.js';

interface AlternativeScreenViewProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that renders children in alternative screen mode
 * This prevents terminal scrollback issues and provides a clean full-screen UI
 */
export function AlternativeScreenView({ children }: AlternativeScreenViewProps) {
  useAlternativeScreen();

  return (
    <Box width="100%" height="100%">
      {children}
    </Box>
  );
}