import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TruncatedText } from './TruncatedText.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';
import type { Database } from '../../db/database.js';
import type { Fact } from '../../core/types.js';

interface SimilarFactsViewProps {
  db: Database;
  fact: Fact & { projectName: string; projectPath: string; isCurrentProject: boolean };
  onBack: () => void;
}

export function SimilarFactsView({ db, fact, onBack }: SimilarFactsViewProps) {
  const { columns, rows } = useTerminalDimensions();
  const [currentFact, setCurrentFact] = useState(fact);
  const [similarFacts, setSimilarFacts] = useState<Array<Fact & { similarity: number; projectName: string; projectPath: string; isCurrentProject: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [navigationHistory, setNavigationHistory] = useState<Array<typeof fact>>([fact]);
  const [similarFactsCounts, setSimilarFactsCounts] = useState<Map<string, number>>(new Map());

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onBack();
    } else if (input === 's' && similarFacts.length > 0 && !loading) {
      // Navigate to the selected similar fact
      const selectedSimilarFact = similarFacts[selectedIndex];
      if (selectedSimilarFact) {
        setNavigationHistory([...navigationHistory, currentFact]);
        setCurrentFact(selectedSimilarFact);
        setSelectedIndex(0);
        setLoading(true);
      }
    } else if (input === 'b' && navigationHistory.length > 1) {
      // Go back in navigation history
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current
      const previousFact = newHistory[newHistory.length - 1];
      if (previousFact) {
        setNavigationHistory(newHistory);
        setCurrentFact(previousFact);
        setSelectedIndex(0);
        setLoading(true);
      }
    }
  });

  useEffect(() => {
    const loadSimilarFacts = async () => {
      try {
        const similar = await db.findSimilarFacts(currentFact.id, { 
          limit: 20, 
          threshold: 0.3 
        });

        // Load project info for each similar fact
        const factsWithProjects = similar.map(f => {
          const project = db.findProject(f.projectId);
          const currentProject = db.findProjectByPath(process.cwd());
          return {
            ...f,
            projectName: project?.name || 'Unknown',
            projectPath: project?.path || '',
            isCurrentProject: currentProject?.id === f.projectId
          };
        });

        setSimilarFacts(factsWithProjects);
        
        // Load similar counts for each fact
        const counts = new Map<string, number>();
        await Promise.all(
          factsWithProjects.map(async (f) => {
            try {
              const similar = await db.findSimilarFacts(f.id, { 
                limit: 10, 
                threshold: 0.5 
              });
              counts.set(f.id, similar.length);
            } catch (error) {
              counts.set(f.id, 0);
            }
          })
        );
        setSimilarFactsCounts(counts);
      } catch (error) {
        console.error('Failed to load similar facts:', error);
        setSimilarFacts([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadSimilarFacts();
  }, [db, currentFact]);

  if (loading) {
    return <Text>Loading similar facts...</Text>;
  }

  if (similarFacts.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No similar facts found</Text>
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
  const factsWidth = columns > 120 ? Math.floor(columns * 0.6) : Math.floor(columns * 0.5);
  const detailsWidth = columns - factsWidth - 3;

  const items = similarFacts.map((f, index) => {
    const typeStr = `[${f.type.substring(0, 3).toUpperCase()}]`;
    const similarityStr = `${(f.similarity * 100).toFixed(0)}%`;
    const similarCount = similarFactsCounts.get(f.id) || 0;
    
    // Use fixed-width formatting similar to main view
    // Fixed width similarity percentage (4 chars)
    // Fixed width similar count (3 chars + ≈)
    const similarityFixed = similarityStr.padStart(4);
    const similarCountStr = similarCount > 0 ? `${similarCount.toString().padStart(3)}≈` : '    ';
    
    // Calculate available width
    // Account for: similarity% (4), space (1), similar count (4), space (1), type (5), space (1)
    const prefixLength = 4 + 1 + 4 + 1 + 5 + 1;
    const availableWidth = factsWidth - prefixLength - 4;
    const contentMaxLength = Math.max(20, availableWidth);
    
    const content = f.content.length > contentMaxLength 
      ? f.content.substring(0, contentMaxLength - 3) + '...' 
      : f.content;
    
    return {
      label: `${similarityFixed} ${similarCountStr} ${typeStr} ${content}`,
      value: index,
    };
  });

  const selectedFact = similarFacts[selectedIndex];

  return (
    <Box flexDirection="column" height={rows - 1}>
      {/* Header */}
      <Box height={4} flexDirection="column">
        <Box flexDirection="row">
          <Text bold>Similar facts to</Text>
          {navigationHistory.length > 1 && (
            <Text dimColor> (depth: {navigationHistory.length - 1})</Text>
          )}
          <Text bold>:</Text>
        </Box>
        <Text color="cyan">[{currentFact.type}] {currentFact.content.substring(0, 60)}{currentFact.content.length > 60 ? '...' : ''}</Text>
        <Box marginTop={1}>
          <Text dimColor>Found {similarFacts.length} similar fact{similarFacts.length !== 1 ? 's' : ''}</Text>
        </Box>
      </Box>

      {/* Main content */}
      <Box flexDirection="row" height={contentHeight} overflow="hidden">
        {/* Left pane - similar facts list */}
        <Box flexDirection="column" width={factsWidth} marginRight={2}>
          <Text bold dimColor>Similar Facts</Text>
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
          {selectedFact && (
            <Box flexDirection="column" marginTop={1} height={contentHeight - 2} overflow="hidden">
              {/* Content section - flexible height */}
              <Box flexDirection="column" flexGrow={1} overflow="hidden">
                <TruncatedText 
                  text={selectedFact.content} 
                  maxLines={selectedFact.why ? Math.floor((contentHeight - 10) * 0.6) : contentHeight - 10} 
                  width={detailsWidth} 
                />
                {selectedFact.why && (
                  <Box marginTop={1} flexDirection="column">
                    <TruncatedText 
                      text={`Why: ${selectedFact.why}`} 
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
                  text={`Similarity: ${(selectedFact.similarity * 100).toFixed(1)}%`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Project: ${selectedFact.projectName}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Type: ${selectedFact.type} | Confidence: ${selectedFact.confidence}%`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Created: ${selectedFact.createdAt.toLocaleDateString()}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                {selectedFact.tags.length > 0 && (
                  <TruncatedText 
                    text={`Tags: ${selectedFact.tags.join(', ')}`}
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