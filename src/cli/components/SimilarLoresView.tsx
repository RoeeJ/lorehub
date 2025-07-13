import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Table } from './Table.js';
import { TruncatedText } from './TruncatedText.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';
import type { Database } from '../../db/database.js';
import type { Lore } from '../../core/types.js';

interface SimilarLoresViewProps {
  db: Database;
  lore: Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean };
  onBack: () => void;
}

export function SimilarLoresView({ db, lore: lore, onBack }: SimilarLoresViewProps) {
  const { columns, rows } = useTerminalDimensions();
  const [currentLore, setCurrentLore] = useState(lore);
  const [similarLores, setSimilarLores] = useState<Array<Lore & { similarity: number; realmName: string; realmPath: string; isCurrentRealm: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [navigationHistory, setNavigationHistory] = useState<Array<typeof lore>>([lore]);
  const [similarLoresCounts, setSimilarLoresCounts] = useState<Map<string, number>>(new Map());

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onBack();
    } else if (key.upArrow || input === 'k') {
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    } else if (key.downArrow || input === 'j') {
      if (selectedIndex < similarLores.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    } else if (input === 's' && similarLores.length > 0 && !loading) {
      // Navigate to the selected similar lore
      const selectedSimilarLore = similarLores[selectedIndex];
      if (selectedSimilarLore) {
        setNavigationHistory([...navigationHistory, currentLore]);
        setCurrentLore(selectedSimilarLore);
        setSelectedIndex(0);
        setLoading(true);
      }
    } else if (input === 'b' && navigationHistory.length > 1) {
      // Go back in navigation history
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current
      const previousLore = newHistory[newHistory.length - 1];
      if (previousLore) {
        setNavigationHistory(newHistory);
        setCurrentLore(previousLore);
        setSelectedIndex(0);
        setLoading(true);
      }
    }
  });

  useEffect(() => {
    const loadSimilarLores = async () => {
      try {
        const similar = await db.findSimilarLores(currentLore.id, { 
          limit: 20, 
          threshold: 0.3 
        });

        // Load realm info for each similar lore
        const loresWithRealms = similar.map(f => {
          const realm = db.findRealm((f as any).realmId || f.realmId);
          const currentRealm = db.findRealmByPath(process.cwd());
          return {
            ...f,
            realmName: realm?.name || 'Unknown',
            realmPath: realm?.path || '',
            isCurrentRealm: currentRealm?.id === ((f as any).realmId || f.realmId)
          };
        });

        setSimilarLores(loresWithRealms);
        
        // Load similar counts for each lore
        const counts = new Map<string, number>();
        await Promise.all(
          loresWithRealms.map(async (f) => {
            try {
              const similar = await db.findSimilarLores(f.id, { 
                limit: 10, 
                threshold: 0.5 
              });
              counts.set(f.id, similar.length);
            } catch (error) {
              counts.set(f.id, 0);
            }
          })
        );
        setSimilarLoresCounts(counts);
      } catch (error) {
        console.error('Failed to load similar lores:', error);
        setSimilarLores([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadSimilarLores();
  }, [db, currentLore]);

  if (loading) {
    return <Text>Loading similar lores...</Text>;
  }

  if (similarLores.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No similar lores found</Text>
        <Box marginTop={1}>
          <Text dimColor>Press q or ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  // Calculate dimensions early before using them
  const headerHeight = 4;
  const footerHeight = 2;
  const contentHeight = rows - headerHeight - footerHeight - 1;
  
  // Use same split as main view
  const loresWidth = columns > 120 ? Math.floor(columns * 0.6) : Math.floor(columns * 0.5);
  const detailsWidth = columns - loresWidth - 3;

  // Helper function to get status letter
  const getStatusLetter = (status: string): string => {
    switch (status) {
      case 'living': return 'L';
      case 'archived': return 'A';
      case 'whispered': return 'W';
      case 'proclaimed': return 'P';
      default: return '?';
    }
  };

  // Prepare table data
  const tableData = similarLores.map((lore, index) => {
    const similarCount = similarLoresCounts.get(lore.id) || 0;
    const isSelected = index === selectedIndex;
    const similarityPercent = Math.round(lore.similarity * 100);
    
    // Calculate max content length
    const contentMaxLength = Math.max(30, loresWidth - 40);
    const content = lore.content.length > contentMaxLength 
      ? lore.content.substring(0, contentMaxLength - 3) + '...' 
      : lore.content;
    
    return {
      '': isSelected ? '→' : ' ',
      'Match': `${similarityPercent}%`,
      'Sim': similarCount > 0 ? `${similarCount}≈` : '-',
      'Type': lore.type.substring(0, 3).toUpperCase(),
      'S': getStatusLetter(lore.status || 'living'),
      'Content': content,
    };
  });

  const selectedLore = similarLores[selectedIndex];

  return (
    <Box flexDirection="column" height={rows - 1}>
      {/* Header */}
      <Box height={4} flexDirection="column">
        <Box flexDirection="row">
          <Text bold>Similar lores to</Text>
          {navigationHistory.length > 1 && (
            <Text dimColor> (depth: {navigationHistory.length - 1})</Text>
          )}
          <Text bold>:</Text>
        </Box>
        <Text color="cyan">[{currentLore.type}] {currentLore.content.substring(0, 60)}{currentLore.content.length > 60 ? '...' : ''}</Text>
        <Box marginTop={1}>
          <Text dimColor>Found {similarLores.length} similar lore{similarLores.length !== 1 ? 's' : ''}</Text>
        </Box>
      </Box>

      {/* Main content */}
      <Box flexDirection="row" height={contentHeight} overflow="hidden">
        {/* Left pane - similar lores list */}
        <Box flexDirection="column" width={loresWidth} marginRight={2}>
          <Box marginBottom={1}>
            <Text bold dimColor>Similar Lores</Text>
          </Box>
          <Box flexDirection="column">
            {similarLores.length > 0 ? (
              <Table data={tableData} />
            ) : (
              <Text dimColor>No similar lores found</Text>
            )}
          </Box>
        </Box>

        {/* Right pane - details */}
        <Box flexDirection="column" width={detailsWidth} overflow="hidden">
          <Text bold dimColor>Details</Text>
          {selectedLore && (
            <Box flexDirection="column" marginTop={1}>
              {/* Metadata section - at top */}
              <Box flexDirection="column" marginBottom={1}>
                <Text dimColor>
                  Similarity: {(selectedLore.similarity * 100).toFixed(1)}%
                </Text>
                <Text dimColor>
                  Realm: {selectedLore.realmName}{selectedLore.isCurrentRealm ? ' •' : ''}
                </Text>
                <Text dimColor>
                  Type: {selectedLore.type} | Status: {selectedLore.status || 'living'} | Confidence: {selectedLore.confidence}%
                </Text>
                <Text dimColor>
                  Created: {selectedLore.createdAt.toLocaleDateString()} {selectedLore.createdAt.toLocaleTimeString()}
                </Text>
                <Text dimColor>
                  Sigils: {selectedLore.sigils.length > 0 ? selectedLore.sigils.join(', ') : 'none'}
                </Text>
                <Text dimColor>
                  Provinces: {selectedLore.provinces.length > 0 ? selectedLore.provinces.join(', ') : 'none'}
                </Text>
              </Box>

              {/* Divider */}
              <Text dimColor>{'─'.repeat(Math.min(detailsWidth - 2, 50))}</Text>

              {/* Content section */}
              <Box flexDirection="column" marginTop={1}>
                <Box marginBottom={1}>
                  <Text wrap="wrap">{selectedLore.content}</Text>
                </Box>
                {selectedLore.why && (
                  <Box marginTop={1} flexDirection="column">
                    <Box marginBottom={0}>
                      <Text bold dimColor>Why:</Text>
                    </Box>
                    <Box>
                      <Text wrap="wrap" dimColor>{selectedLore.why}</Text>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box height={2} marginTop={1}>
        <Text dimColor>
          q/ESC: exit | ↑↓: navigate | s: dive deeper
          {navigationHistory.length > 1 && ' | b: back'}
        </Text>
      </Box>
    </Box>
  );
}