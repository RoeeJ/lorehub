import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  dangerous?: boolean;
}

export function ConfirmDialog({ message, onConfirm, onCancel, dangerous = false }: ConfirmDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'yes' | 'no'>('no');

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow || key.tab) {
      setSelectedOption(prev => prev === 'yes' ? 'no' : 'yes');
    } else if (key.return) {
      if (selectedOption === 'yes') {
        onConfirm();
      } else {
        onCancel();
      }
    } else if (key.escape || input === 'n' || input === 'N') {
      onCancel();
    } else if (input === 'y' || input === 'Y') {
      onConfirm();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={dangerous ? 'red' : 'yellow'} padding={1}>
      <Text>{message}</Text>
      <Box marginTop={1}>
        <Box marginRight={2}>
          <Text 
            color={selectedOption === 'yes' ? (dangerous ? 'red' : 'green') : undefined}
            bold={selectedOption === 'yes'}
          >
            {selectedOption === 'yes' ? '▶ ' : '  '}Yes
          </Text>
        </Box>
        <Box>
          <Text 
            color={selectedOption === 'no' ? 'cyan' : undefined}
            bold={selectedOption === 'no'}
          >
            {selectedOption === 'no' ? '▶ ' : '  '}No
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Y/N or use ←/→ then Enter</Text>
      </Box>
    </Box>
  );
}