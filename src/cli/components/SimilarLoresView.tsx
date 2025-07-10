import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
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

  const items = similarLores.map((f, index) => {
    const typeStr = `[${f.type.substring(0, 3).toUpperCase()}]`;
    const similarityStr = `${(f.similarity * 100).toFixed(0)}%`;
    const similarCount = similarLoresCounts.get(f.id) || 0;
    
    // Use fixed-width formatting similar to main view
    // Fixed width similarity percentage (4 chars)
    // Fixed width similar count (3 chars + ≈)
    const similarityFixed = similarityStr.padStart(4);
    const similarCountStr = similarCount > 0 ? `${similarCount.toString().padStart(3)}≈` : '    ';
    
    // Calculate available width
    // Account for: similarity% (4), space (1), similar count (4), space (1), type (5), space (1)
    const prefixLength = 4 + 1 + 4 + 1 + 5 + 1;
    const availableWidth = loresWidth - prefixLength - 4;
    const contentMaxLength = Math.max(20, availableWidth);
    
    const content = f.content.length > contentMaxLength 
      ? f.content.substring(0, contentMaxLength - 3) + '...' 
      : f.content;
    
    return {
      label: `${similarityFixed} ${similarCountStr} ${typeStr} ${content}`,
      value: index,
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
          <Text bold dimColor>Similar Lores</Text>
          <Box marginTop={1}>
            <SelectInput
              items={items}
              onHighlight={(item) => setSelectedIndex(item.value)}
              initialIndex={0}
              limit={contentHeight - 2}
            />
          </Box>
        </Box>

        {/* Right pane - details */}
        <Box flexDirection="column" width={detailsWidth} overflow="hidden">
          <Text bold dimColor>Details</Text>
          {selectedLore && (
            <Box flexDirection="column" marginTop={1} height={contentHeight - 2} overflow="hidden">
              {/* Content section - flexible height */}
              <Box flexDirection="column" flexGrow={1} overflow="hidden">
                <TruncatedText 
                  text={selectedLore.content} 
                  maxLines={selectedLore.why ? Math.floor((contentHeight - 10) * 0.6) : contentHeight - 10} 
                  width={detailsWidth} 
                />
                {selectedLore.why && (
                  <Box marginTop={1} flexDirection="column">
                    <TruncatedText 
                      text={`Why: ${selectedLore.why}`} 
                      maxLines={Math.floor((contentHeight - 10) * 0.4)} 
                      width={detailsWidth} 
                      dimColor={true}
                    />
                  </Box>
                )}
              </Box>

              {/* Metadata section - fixed at bottom */}
              <Box flexDirection="column" flexShrink={0} marginTop={1}>
                <TruncatedText 
                  text={`Similarity: ${(selectedLore.similarity * 100).toFixed(1)}%`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Realm: ${selectedLore.realmName}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Type: ${selectedLore.type} | Confidence: ${selectedLore.confidence}%`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Created: ${selectedLore.createdAt.toLocaleDateString()}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                {selectedLore.sigils.length > 0 && (
                  <TruncatedText 
                    text={`Sigils: ${selectedLore.sigils.join(', ')}`}
                    maxLines={1}
                    width={detailsWidth}
                    dimColor={true}
                  />
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