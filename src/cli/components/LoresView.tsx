import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Table } from './Table.js';
import TextInput from 'ink-text-input';
import { Help } from './Help.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SimilarLoresView } from './SimilarLoresView.js';
import { TruncatedText } from './TruncatedText.js';
import { AlternativeScreenView } from './AlternativeScreenView.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';
import { ConfigManager } from '../../core/config.js';
import type { Database } from '../../db/database.js';
import type { Lore, LoreType } from '../../core/types.js';

interface LoresViewProps {
  db: Database;
  realmPath: string;
  // Search-specific props
  initialQuery?: string;
  searchMode?: 'literal' | 'semantic' | 'hybrid';
  // Filter props
  type?: string;
  province?: string;
  limit?: number;
  filterRealmPath?: string;
  currentRealmOnly?: boolean;
}

export function LoresView({
  db,
  realmPath,
  initialQuery = '',
  searchMode: initialSearchMode,
  type,
  province,
  limit = 100,
  filterRealmPath,
  currentRealmOnly,
}: LoresViewProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalDimensions();
  const config = ConfigManager.getInstance();
  const [lores, setLores] = useState<Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean; similarity?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLores, setFilteredLores] = useState<Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean; similarity?: number }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [similarLoresCounts, setSimilarLoresCounts] = useState<Map<string, number>>(new Map());
  const [loadingSimilarCounts, setLoadingSimilarCounts] = useState(false);
  const [showSimilarLores, setShowSimilarLores] = useState(false);
  const [searchMode, setSearchMode] = useState<'literal' | 'semantic' | 'hybrid'>(
    initialSearchMode || config.get('searchMode') || 'literal'
  );
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  useInput((input, key) => {
    if (showHelp) {
      if (input === '?' || key.escape) {
        setShowHelp(false);
      }
      return;
    }

    if (showDeleteConfirm) {
      // Let ConfirmDialog handle input
      return;
    }

    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        setSearchTerm('');
        setFilteredLores(lores);
      } else if (key.return) {
        setIsSearching(false);
      } else if (key.backspace || key.delete) {
        const newSearchTerm = searchTerm.slice(0, -1);
        setSearchTerm(newSearchTerm);
        filterLores(newSearchTerm); // async but we don't await
      } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        const newSearchTerm = searchTerm + input;
        setSearchTerm(newSearchTerm);
        filterLores(newSearchTerm); // async but we don't await
      }
    } else {
      if (input === 'q' || key.escape) {
        exit();
        // Ensure process exits immediately
        process.exit(0);
      } else if (input === '/') {
        setIsSearching(true);
        setSearchTerm('');
      } else if (input === '?') {
        setShowHelp(true);
      } else if (input === 'd' && filteredLores.length > 0) {
        setShowDeleteConfirm(true);
      } else if (input === 's' && filteredLores.length > 0) {
        setShowSimilarLores(true);
      } else if (input === 'm' || input === 'M') {
        // Switch search mode
        const modes: Array<'literal' | 'semantic' | 'hybrid'> = ['literal', 'semantic', 'hybrid'];
        const currentIndex = modes.indexOf(searchMode);
        const newMode = modes[(currentIndex + 1) % modes.length];
        if (newMode) {
          setSearchMode(newMode);
          // Save preference
          config.set('searchMode', newMode);
        }
      } else if (key.upArrow || input === 'k') {
        if (selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        }
      } else if (key.downArrow || input === 'j') {
        if (selectedIndex < filteredLores.length - 1) {
          setSelectedIndex(selectedIndex + 1);
        }
      } else if (key.return && filteredLores.length > 0) {
        // Enter pressed - could open details or perform action
        const selectedLore = filteredLores[selectedIndex];
        if (selectedLore) {
          // For now, just log - could open details view
          console.log('Selected:', selectedLore.content);
        }
      }
    }
  });

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

  const filterLores = async (term: string) => {
    if (!term) {
      setFilteredLores(lores);
      return;
    }
    
    // For literal search, use substring matching
    if (searchMode === 'literal') {
      const lowerTerm = term.toLowerCase();
      const filtered = lores.filter(lore => 
        lore.content.toLowerCase().includes(lowerTerm) ||
        lore.type.toLowerCase().includes(lowerTerm) ||
        lore.sigils.some((sigil: string) => sigil.toLowerCase().includes(lowerTerm)) ||
        lore.realmName.toLowerCase().includes(lowerTerm)
      );
      
      setFilteredLores(filtered);
      setSelectedIndex(0);
    } else {
      // For semantic or hybrid search, query the database
      setIsFilterLoading(true);
      try {
        let results: Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean; similarity?: number }> = [];
        
        // Get all realms we're searching
        const realms = currentRealmOnly ? 
          [db.findRealmByPath(realmPath)].filter(Boolean) : 
          (filterRealmPath ? [db.findRealmByPath(filterRealmPath)].filter(Boolean) : db.listRealms());
        
        for (const realm of realms) {
          if (!realm) continue;
          
          if (searchMode === 'semantic') {
            const semanticResults = await db.semanticSearchLores(term, {
              realmId: realm.id,
              includeScore: true,
              threshold: config.get('semanticSearchThreshold') || 0.5
            });
            
            results.push(...semanticResults.map(f => ({
              ...f,
              realmName: realm.name,
              realmPath: realm.path,
              isCurrentRealm: realmPath === realm.path
            })));
          } else if (searchMode === 'hybrid') {
            // Hybrid: combine literal and semantic
            const literalResults = db.searchLores(realm.id, term);
            const semanticResults = await db.semanticSearchLores(term, {
              realmId: realm.id,
              includeScore: true,
              threshold: config.get('semanticSearchThreshold') || 0.5
            });
            
            // Merge and deduplicate
            const loreMap = new Map<string, Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean; similarity?: number }>();
            
            literalResults.forEach(lore => loreMap.set(lore.id, {
              ...lore,
              realmName: realm.name,
              realmPath: realm.path,
              isCurrentRealm: realmPath === realm.path,
              similarity: 1.0 // Perfect match for literal
            }));
            
            semanticResults.forEach(lore => {
              if (!loreMap.has(lore.id)) {
                loreMap.set(lore.id, {
                  ...lore,
                  realmName: realm.name,
                  realmPath: realm.path,
                  isCurrentRealm: realmPath === realm.path
                });
              }
            });
            
            results.push(...Array.from(loreMap.values()));
          }
        }
        
        // Filter out archived
        results = results.filter(f => f.status !== 'archived');
        
        // Sort by similarity (if available) then by date
        results.sort((a, b) => {
          if (a.similarity !== undefined && b.similarity !== undefined) {
            return b.similarity - a.similarity;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        setFilteredLores(results);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
        setFilteredLores([]);
      } finally {
        setIsFilterLoading(false);
      }
    }
  };

  useEffect(() => {
    async function loadLores() {
      const currentRealm = db.findRealmByPath(realmPath);
      const realms = db.listRealms();
      
      // Filter realms based on options
      let realmsToSearch = realms;
      
      if (currentRealmOnly) {
        if (!currentRealm) {
          setLores([]);
          setLoading(false);
          return;
        }
        realmsToSearch = [currentRealm];
      } else if (filterRealmPath) {
        const specificRealm = db.findRealmByPath(filterRealmPath);
        if (!specificRealm) {
          setLores([]);
          setLoading(false);
          return;
        }
        realmsToSearch = [specificRealm];
      }

      let results: Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean; similarity?: number }> = [];
      
      // Get lores from selected realms
      for (const proj of realmsToSearch) {
        let realmLores: Array<Lore & { similarity?: number }> = [];
        
        if (initialQuery) {
          // Search mode based on searchMode state
          if (searchMode === 'semantic') {
            realmLores = await db.semanticSearchLores(initialQuery, {
              realmId: proj.id,
              includeScore: true,
              threshold: config.get('semanticSearchThreshold') || 0.5
            });
          } else if (searchMode === 'hybrid') {
            // Hybrid search - combine literal and semantic
            const literalResults = db.searchLores(proj.id, initialQuery);
            const semanticResults = await db.semanticSearchLores(initialQuery, {
              realmId: proj.id,
              includeScore: true,
              threshold: config.get('semanticSearchThreshold') || 0.5
            });
            
            // Merge and deduplicate
            const loreMap = new Map<string, Lore & { similarity?: number }>();
            literalResults.forEach(lore => loreMap.set(lore.id, lore));
            semanticResults.forEach(lore => {
              if (!loreMap.has(lore.id)) {
                loreMap.set(lore.id, lore);
              }
            });
            
            realmLores = Array.from(loreMap.values());
          } else {
            // Literal search (default)
            realmLores = db.searchLores(proj.id, initialQuery);
          }
        } else if (type) {
          realmLores = db.listLoresByType(proj.id, type as LoreType);
        } else if (province) {
          realmLores = db.listLoresByProvince(proj.id, province);
        } else {
          realmLores = db.listLoresByRealm(proj.id);
        }
        
        // Add realm info to each lore
        results.push(...realmLores.map(f => ({
          ...f,
          realmName: proj.name,
          realmPath: proj.path,
          isCurrentRealm: currentRealm?.id === proj.id
        })));
      }

    // Apply additional filters
    if (initialQuery && type) {
      results = results.filter(f => f.type === type);
    }
    
    if (initialQuery && province) {
      results = results.filter(f => f.provinces.includes(province));
    }

    // Filter out archived lores unless specifically requested
    results = results.filter(f => f.status !== 'archived');

    // Sort by current realm first, then by date
    results.sort((a, b) => {
      // Prioritize current realm
      if (a.isCurrentRealm && !b.isCurrentRealm) return -1;
      if (!a.isCurrentRealm && b.isCurrentRealm) return 1;
      // Then by date
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    
    // Apply limit
    if (results.length > limit) {
      results = results.slice(0, limit);
    }
    
      setLores(results);
      setFilteredLores(results);
      setLoading(false);
    }
    
    loadLores();
  }, [db, realmPath, initialQuery, type, province, limit, filterRealmPath, currentRealmOnly, searchMode, config]);

  // Load similar lores counts
  useEffect(() => {
    const loadSimilarCounts = async () => {
      if (lores.length === 0) return;
      
      setLoadingSimilarCounts(true);
      const counts = new Map<string, number>();
      
      // Load counts in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < lores.length && i < limit; i += batchSize) {
        const batch = lores.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (lore) => {
            try {
              const similar = await db.findSimilarLores(lore.id, { 
                limit: 10, 
                threshold: 0.5 
              });
              counts.set(lore.id, similar.length);
            } catch (error) {
              counts.set(lore.id, 0);
            }
          })
        );
      }
      
      setSimilarLoresCounts(counts);
      setLoadingSimilarCounts(false);
    };

    loadSimilarCounts();
  }, [lores, db, limit]);

  // Always render inside AlternativeScreenView
  if (loading) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" padding={1}>
          <Text>Loading lores...</Text>
        </Box>
      </AlternativeScreenView>
    );
  }

  if (lores.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">
          {initialQuery 
            ? `No lores found matching "${initialQuery}"`
            : 'No lores found'}
        </Text>
        {type && <Text dimColor>Filter: type = {type}</Text>}
        {province && <Text dimColor>Filter: province = {province}</Text>}
        {!initialQuery && (
          <Box marginTop={1}>
            <Text dimColor>Try adding lores with: lh add "Your lore here"</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Calculate dimensions early so we can use them in items mapping
  // Header is now dynamic - base 1 line + additional lines for filters/search
  const headerHeight = 1 + (deleteSuccess ? 1 : 0) + ((type || province) ? 1 : 0) + (isSearching ? 1 : 0);
  const footerHeight = 2;
  const contentHeight = rows - headerHeight - footerHeight - 1; // -1 for padding
  
  // Split width: 70% for lores list, 30% for details on wide screens
  // On narrow screens, use 60/40 split
  const loresWidth = columns > 120 ? Math.floor(columns * 0.7) : Math.floor(columns * 0.6);
  const detailsWidth = columns - loresWidth - 3; // -3 for margins and borders

  // Calculate visible rows for scrolling
  const visibleRows = Math.max(10, contentHeight - 6); // Reserve space for headers and padding
  const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(visibleRows / 2), filteredLores.length - visibleRows));
  const endIndex = Math.min(startIndex + visibleRows, filteredLores.length);
  
  // Prepare data for our table with scrolling
  const visibleLores = filteredLores.slice(startIndex, endIndex);
  const tableData = visibleLores.map((lore, index) => {
    const actualIndex = startIndex + index;
    const similarCount = similarLoresCounts.get(lore.id) || 0;
    const isSelected = actualIndex === selectedIndex;
    
    // Calculate max content length based on available width
    const showDistance = (searchMode === 'semantic' || searchMode === 'hybrid') && lore.similarity !== undefined;
    const contentMaxLength = Math.max(30, loresWidth - (showDistance ? 42 : 35)); // Reserve space for columns
    const content = lore.content.length > contentMaxLength 
      ? lore.content.substring(0, contentMaxLength - 3) + '...' 
      : lore.content;
    
    const row: any = {
      '': isSelected ? '→' : ' ',
      'R': lore.isCurrentRealm ? '•' : ' ',
    };
    
    // Add distance column if in semantic/hybrid mode
    if (showDistance) {
      // Convert similarity back to L2 distance for display
      // similarity = 1 / (1 + distance), so distance = (1 / similarity) - 1
      // Lower distance = more similar
      let distance = '-';
      if (lore.similarity !== undefined && lore.similarity > 0) {
        const l2Distance = (1 / lore.similarity) - 1;
        distance = l2Distance.toFixed(2);
      }
      row['Dist'] = distance;
    }
    
    row['Sim'] = similarCount > 0 ? `${similarCount}≈` : '-';
    row['Type'] = lore.type.substring(0, 3).toUpperCase();
    row['S'] = getStatusLetter(lore.status);
    row['Content'] = content;
    
    return row;
  });

  const selectedLore = filteredLores[selectedIndex];

  const handleDelete = async () => {
    const loreToDelete = filteredLores[selectedIndex];
    if (loreToDelete) {
      await db.softDeleteLore(loreToDelete.id);
      // Remove from local state
      const newLores = lores.filter(f => f.id !== loreToDelete.id);
      const newFilteredLores = filteredLores.filter(f => f.id !== loreToDelete.id);
      setLores(newLores);
      setFilteredLores(newFilteredLores);
      setShowDeleteConfirm(false);
      setDeleteSuccess(true);
      
      // Reset success message after 2 seconds
      setTimeout(() => setDeleteSuccess(false), 2000);
      
      // Adjust selected index if needed
      if (selectedIndex >= newFilteredLores.length && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    }
  };

  // Show help screen if requested
  if (showHelp) {
    return (
      <AlternativeScreenView>
        <Help context={initialQuery ? 'search' : 'list'} />
      </AlternativeScreenView>
    );
  }

  // Show confirmation dialog instead of normal view
  if (showDeleteConfirm && selectedLore) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" height={20} justifyContent="center" alignItems="center">
          <ConfirmDialog
            message={`Delete lore: "${selectedLore.content.substring(0, 50)}${selectedLore.content.length > 50 ? '...' : ''}"?`}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            dangerous={true}
          />
        </Box>
      </AlternativeScreenView>
    );
  }

  // Show similar lores view
  if (showSimilarLores && selectedLore) {
    return (
      <AlternativeScreenView>
        <SimilarLoresView 
          db={db} 
          lore={selectedLore} 
          onBack={() => setShowSimilarLores(false)}
        />
      </AlternativeScreenView>
    );
  }

  // Full screen container
  return (
    <AlternativeScreenView>
      <Box flexDirection="column" height={rows - 1}>
      {/* Header - compact */}
      <Box flexDirection="column" flexShrink={0}>
        <Box justifyContent="space-between">
          <Text bold>
            {initialQuery
              ? `Found ${filteredLores.length} lore${filteredLores.length !== 1 ? 's' : ''} matching "${initialQuery}"`
              : `Found ${filteredLores.length} lore${filteredLores.length !== 1 ? 's' : ''}`}
            {searchTerm && ` (filtered: "${searchTerm}")`}
          </Text>
          <Text dimColor>Mode: {searchMode} | ? help</Text>
        </Box>
        {(deleteSuccess || type || province || isSearching) && (
          <Box flexDirection="column">
            {deleteSuccess && <Text color="green">✓ Lore deleted (archived)</Text>}
            {(type || province) && (
              <Text dimColor>Filters: {[
                type && `type=${type}`,
                province && `province=${province}`
              ].filter(Boolean).join(', ')}</Text>
            )}
            {isSearching && (
              <Box>
                <Text color="cyan">/</Text>
                <TextInput value={searchTerm} onChange={() => {}} />
                {isFilterLoading && <Text dimColor> (searching...)</Text>}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Main content area - dynamic height */}
      <Box flexDirection="row" height={contentHeight} overflow="hidden">
        {/* Left pane - lore list */}
        <Box flexDirection="column" width={loresWidth} marginRight={2}>
          <Text bold dimColor>{initialQuery ? 'Search Results' : 'Lores'}</Text>
          <Box width="100%" flexDirection="column" marginTop={0}>
            {tableData.length > 0 ? (
              <>
                <Table data={tableData} />
                {filteredLores.length > visibleRows && (
                  <Box marginTop={1}>
                    <Text dimColor>
                      Showing {startIndex + 1}-{endIndex} of {filteredLores.length} | Use ↑↓ or j/k to navigate
                    </Text>
                  </Box>
                )}
              </>
            ) : (
              <Text dimColor>No lores found</Text>
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
                  Realm: {selectedLore.realmName}{selectedLore.isCurrentRealm ? ' •' : ''}
                </Text>
                <Text dimColor>
                  Type: {selectedLore.type} | Status: {selectedLore.status} | Confidence: {selectedLore.confidence}%
                </Text>
                <Text dimColor>
                  Created: {selectedLore.createdAt.toLocaleDateString()} {selectedLore.createdAt.toLocaleTimeString()}
                </Text>
                {selectedLore.similarity !== undefined && (
                  <Text dimColor>
                    Match: {Math.round(selectedLore.similarity * 100)}% ({searchMode} search)
                  </Text>
                )}
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

      {/* Footer - fixed position */}
      <Box height={2} marginTop={1}>
        <Text dimColor>
          {isSearching 
            ? 'Type to filter | Enter: confirm | Esc: cancel' 
            : 'q: quit | ↑↓: navigate | /: filter | d: delete | s: similar | m: mode | ?: help'}
        </Text>
      </Box>
    </Box>
    </AlternativeScreenView>
  );
}