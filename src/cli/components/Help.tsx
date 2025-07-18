import React from 'react';
import { Box, Text } from 'ink';

interface HelpProps {
  context: 'list' | 'search' | 'add' | 'general';
}

export function Help({ context }: HelpProps) {
  return (
    <Box flexDirection="column" height={20} padding={1}>
      <Text bold underline>LoreHub Keyboard Shortcuts</Text>
      
      {/* Common shortcuts */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="yellow">Common</Text>
        <Text><Text color="cyan">q</Text> - Quit/Exit</Text>
        <Text><Text color="cyan">Esc</Text> - Cancel/Go back</Text>
        <Text><Text color="cyan">?</Text> - Show/Hide help</Text>
      </Box>

      {/* List/Search specific */}
      {(context === 'list' || context === 'search') && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Navigation</Text>
          <Text><Text color="cyan">↑/↓</Text> - Navigate items</Text>
          <Text><Text color="cyan">/</Text> - Filter results (vim-style search)</Text>
          <Text><Text color="cyan">d</Text> - Delete selected lore (soft delete)</Text>
          <Text><Text color="cyan">s</Text> - Show similar lores</Text>
          <Text><Text color="cyan">m</Text> - Switch search mode (literal/semantic/hybrid)</Text>
          <Text><Text color="cyan">Enter</Text> - Select item</Text>
        </Box>
      )}

      {/* Add specific */}
      {context === 'add' && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Form Navigation</Text>
          <Text><Text color="cyan">Tab</Text> - Next field</Text>
          <Text><Text color="cyan">Shift+Tab</Text> - Previous field</Text>
          <Text><Text color="cyan">Enter</Text> - Save lore</Text>
          <Text><Text color="cyan">←/→</Text> - Adjust confidence (in confidence field)</Text>
        </Box>
      )}

      {/* Search mode */}
      {(context === 'list' || context === 'search') && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Search Mode (after pressing /)</Text>
          <Text><Text color="cyan">Type</Text> - Filter by content</Text>
          <Text><Text color="cyan">Enter</Text> - Confirm search</Text>
          <Text><Text color="cyan">Esc</Text> - Cancel search</Text>
          <Text><Text color="cyan">Backspace</Text> - Delete character</Text>
        </Box>
      )}

      {/* Column Legend for list view */}
      {(context === 'list' || context === 'search') && (
        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Column Legend</Text>
          <Text><Text color="cyan">R</Text> - Realm indicator (• = current realm)</Text>
          <Text><Text color="cyan">Sim</Text> - Similar lores count (≈ = approximately)</Text>
          <Text><Text color="cyan">Type</Text> - Lore type (DEC/ASS/CON/REQ/RIS/LES/QUE/OTH)</Text>
          <Text><Text color="cyan">S</Text> - Status (L=Living, W=Whispered, P=Proclaimed, A=Archived)</Text>
        </Box>
      )}

      {/* Tips */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="yellow">Tips</Text>
        {context === 'search' && <Text>• Use wildcards: * (any chars) or ? (single char)</Text>}
        {context === 'add' && <Text>• All fields except content are optional</Text>}
        <Text>• Lores are stored globally across all realms</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press ? or Esc to return</Text>
      </Box>
    </Box>
  );
}