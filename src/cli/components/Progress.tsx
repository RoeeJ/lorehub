import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface ProgressProps {
  message: string;
  current?: number;
  total?: number;
  showSpinner?: boolean;
}

export function Progress({ message, current, total, showSpinner = true }: ProgressProps) {
  const [frame, setFrame] = useState(0);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  useEffect(() => {
    if (!showSpinner) return;
    
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    
    return () => clearInterval(timer);
  }, [showSpinner]);

  const hasProgress = current !== undefined && total !== undefined && total > 0;
  const percentage = hasProgress ? Math.round((current / total) * 100) : 0;
  const progressBarWidth = 20;
  const filled = hasProgress ? Math.round((current / total) * progressBarWidth) : 0;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        {showSpinner && <Text color="cyan">{spinnerFrames[frame]} </Text>}
        <Text>{message}</Text>
        {hasProgress && <Text dimColor> ({current}/{total})</Text>}
      </Box>
      
      {hasProgress && (
        <Box marginTop={1}>
          <Text>
            [{'█'.repeat(filled)}{'░'.repeat(progressBarWidth - filled)}] {percentage}%
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface LoadingProps {
  message?: string;
}

export function Loading({ message = 'Loading...' }: LoadingProps) {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
      <Progress message={message} />
    </Box>
  );
}