import React from 'react';
import { Box, Text } from 'ink';

interface ErrorMessageProps {
  error: Error | string;
  context?: string;
  suggestions?: string[];
}

export function ErrorMessage({ error, context, suggestions }: ErrorMessageProps) {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Map common errors to user-friendly messages
  const friendlyMessages: Record<string, { message: string; suggestions: string[] }> = {
    'ENOENT': {
      message: 'File or directory not found',
      suggestions: ['Check if you\'re in the right directory', 'Ensure the realm exists'],
    },
    'EACCES': {
      message: 'Permission denied',
      suggestions: ['Check file permissions', 'Try running with appropriate permissions'],
    },
    'SQLITE_BUSY': {
      message: 'Database is locked',
      suggestions: ['Another process might be using the database', 'Try again in a moment'],
    },
    'Content is required': {
      message: 'Lore content cannot be empty',
      suggestions: ['Enter a meaningful lore description', 'Press Tab to navigate to the content field'],
    },
    'Failed to load realm': {
      message: 'Could not load realm information',
      suggestions: ['Ensure you\'re in a valid realm directory', 'Check if package.json exists'],
    },
  };

  // Find matching friendly message
  let displayMessage = errorMessage;
  let displaySuggestions = suggestions || [];
  
  for (const [key, value] of Object.entries(friendlyMessages)) {
    if (errorMessage.includes(key)) {
      displayMessage = value.message;
      displaySuggestions = [...value.suggestions, ...(suggestions || [])];
      break;
    }
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="red" bold>⚠ Error{context ? ` (${context})` : ''}: </Text>
        <Text color="red">{displayMessage}</Text>
      </Box>
      
      {displaySuggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text dimColor>Suggestions:</Text>
          {displaySuggestions.map((suggestion, index) => (
            <Text key={index} dimColor>• {suggestion}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}