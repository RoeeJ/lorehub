import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Help } from './Help.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SimilarLoresView } from './SimilarLoresView.js';
import { TruncatedText } from './TruncatedText.js';
import { AlternativeScreenView } from './AlternativeScreenView.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';
import type { Database } from '../../db/database.js';
import type { Lore, LoreType } from '../../core/types.js';

interface LoresViewProps {
  db: Database;
  realmPath: string;
  // Search-specific props
  initialQuery?: string;
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
  type,
  province,
  limit = 100,
  filterRealmPath,
  currentRealmOnly,
}: LoresViewProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalDimensions();
  const [lores, setLores] = useState<Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLores, setFilteredLores] = useState<Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean }>>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [similarLoresCounts, setSimilarLoresCounts] = useState<Map<string, number>>(new Map());
  const [loadingSimilarCounts, setLoadingSimilarCounts] = useState(false);
  const [showSimilarLores, setShowSimilarLores] = useState(false);

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
        filterLores(newSearchTerm);
      } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        const newSearchTerm = searchTerm + input;
        setSearchTerm(newSearchTerm);
        filterLores(newSearchTerm);
      }
    } else {
      if (input === 'q' || key.escape) {
        exit();
      } else if (input === '/') {
        setIsSearching(true);
        setSearchTerm('');
      } else if (input === '?') {
        setShowHelp(true);
      } else if (input === 'd' && filteredLores.length > 0) {
        setShowDeleteConfirm(true);
      } else if (input === 's' && filteredLores.length > 0) {
        setShowSimilarLores(true);
      }
    }
  });

  const filterLores = (term: string) => {
    if (!term) {
      setFilteredLores(lores);
      return;
    }
    
    const lowerTerm = term.toLowerCase();
    const filtered = lores.filter(lore => 
      lore.content.toLowerCase().includes(lowerTerm) ||
      lore.type.toLowerCase().includes(lowerTerm) ||
      lore.sigils.some((sigil: string) => sigil.toLowerCase().includes(lowerTerm)) ||
      lore.realmName.toLowerCase().includes(lowerTerm)
    );
    
    setFilteredLores(filtered);
    setSelectedIndex(0);
  };

  useEffect(() => {
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

    let results: Array<Lore & { realmName: string; realmPath: string; isCurrentRealm: boolean }> = [];
    
    // Get lores from selected realms
    for (const proj of realmsToSearch) {
      let realmLores: Lore[] = [];
      
      if (initialQuery) {
        // Search mode
        realmLores = db.searchLores(proj.id, initialQuery);
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
  }, [db, realmPath, initialQuery, type, province, limit, filterRealmPath, currentRealmOnly]);

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

  if (loading) {
    return <Text>Loading lores...</Text>;
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
  const headerHeight = 3;
  const footerHeight = 2;
  const contentHeight = rows - headerHeight - footerHeight - 1; // -1 for padding
  
  // Split width: 60% for lores list, 40% for details on wide screens
  // On narrow screens, use 50/50 split
  const loresWidth = columns > 120 ? Math.floor(columns * 0.6) : Math.floor(columns * 0.5);
  const detailsWidth = columns - loresWidth - 3; // -3 for margins and borders

  const items = filteredLores.map((lore, index) => {
    const typeStr = `[${lore.type.substring(0, 3).toUpperCase()}]`;
    const similarCount = similarLoresCounts.get(lore.id) || 0;
    
    // Use fixed-width formatting
    // • for current realm (instead of star for predictable width)
    // Fixed width similarity count (3 chars + ≈)
    const realmMarker = lore.isCurrentRealm ? '•' : ' ';
    const similarStr = similarCount > 0 ? `${similarCount.toString().padStart(3)}≈` : '    ';
    
    // Calculate available width for content
    // Account for: realm marker (1), space (1), similar count (4), space (1), type (5), space (1)
    const prefixLength = 1 + 1 + 4 + 1 + 5 + 1;
    const availableWidth = loresWidth - prefixLength - 4; // -4 for padding/margins
    const contentMaxLength = Math.max(20, availableWidth); // minimum 20 chars
    
    const content = lore.content.length > contentMaxLength 
      ? lore.content.substring(0, contentMaxLength - 3) + '...' 
      : lore.content;
    
    return {
      label: `${realmMarker} ${similarStr} ${typeStr} ${content}`,
      value: index,
    };
  });

  const selectedLore = filteredLores[selectedIndex];

  // Handle selection changes
  const handleSelect = (item: { label: string; value: number }) => {
    setSelectedIndex(item.value);
  };

  const handleDelete = () => {
    const loreToDelete = filteredLores[selectedIndex];
    if (loreToDelete) {
      db.softDeleteLore(loreToDelete.id);
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
      {/* Header - fixed height */}
      <Box height={3} flexDirection="column">
        <Text bold>
          {initialQuery
            ? `Found ${filteredLores.length} lore${filteredLores.length !== 1 ? 's' : ''} matching "${initialQuery}"`
            : `Found ${filteredLores.length} lore${filteredLores.length !== 1 ? 's' : ''}`}
          {searchTerm && ` (filtered: "${searchTerm}")`}
        </Text>
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
          </Box>
        )}
      </Box>

      {/* Main content area - dynamic height */}
      <Box flexDirection="row" height={contentHeight} overflow="hidden">
        {/* Left pane - lore list */}
        <Box flexDirection="column" width={loresWidth} marginRight={2}>
          <Text bold dimColor>{initialQuery ? 'Results' : 'Lores'}</Text>
          <Box marginTop={1} width="100%">
            <SelectInput
              items={items}
              onSelect={handleSelect}
              onHighlight={handleSelect}
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
                  text={`Realm: ${selectedLore.realmName}${selectedLore.isCurrentRealm ? ' •' : ''}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Type: ${selectedLore.type} | Status: ${selectedLore.status}`}
                  maxLines={1}
                  width={detailsWidth}
                  dimColor={true}
                />
                <TruncatedText 
                  text={`Confidence: ${selectedLore.confidence}% | ${selectedLore.createdAt.toLocaleDateString()}`}
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
                {selectedLore.provinces.length > 0 && (
                  <TruncatedText 
                    text={`Provinces: ${selectedLore.provinces.join(', ')}`}
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

      {/* Footer - fixed position */}
      <Box height={2} marginTop={1}>
        <Text dimColor>
          {isSearching 
            ? 'Type to filter | Enter: confirm | Esc: cancel' 
            : 'q: quit | ↑↓: navigate | /: filter | d: delete | s: similar | ?: help'}
        </Text>
      </Box>
    </Box>
    </AlternativeScreenView>
  );
}