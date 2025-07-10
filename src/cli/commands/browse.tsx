import React from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { ConfigManager } from '../../core/config.js';
import { AlternativeScreenView } from '../components/AlternativeScreenView.js';
import type { Lore } from '../../core/types.js';

interface BrowseOptions {
  query?: string;
  type?: string;
  province?: string;
  realmPath?: string;
  currentRealmOnly?: boolean;
  searchMode?: 'literal' | 'semantic' | 'hybrid';
}

interface BrowseViewProps {
  db: Database;
  initialOptions: BrowseOptions;
}

function BrowseView({ db, initialOptions }: BrowseViewProps) {
  const { exit } = useApp();
  const config = ConfigManager.getInstance();
  
  // State
  const [searchQuery, setSearchQuery] = React.useState(initialOptions.query || '');
  const [searchMode, setSearchMode] = React.useState<'literal' | 'semantic' | 'hybrid'>(
    initialOptions.searchMode || config.get('searchMode') || 'literal'
  );
  const [filterType, setFilterType] = React.useState(initialOptions.type);
  const [filterProvince, setFilterProvince] = React.useState(initialOptions.province);
  const [lores, setLores] = React.useState<Lore[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [scrollOffset, setScrollOffset] = React.useState(0);
  const [showHelp, setShowHelp] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [pendingSearch, setPendingSearch] = React.useState(searchQuery);
  const [selectedLore, setSelectedLore] = React.useState<Lore | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const [showSimilar, setShowSimilar] = React.useState(false);
  const [similarLores, setSimilarLores] = React.useState<(Lore & { similarity?: number })[]>([]);
  const [navigationHistory, setNavigationHistory] = React.useState<Lore[]>([]);
  const [loadingSimilar, setLoadingSimilar] = React.useState(false);
  
  // Constants
  const VISIBLE_ITEMS = 15; // Number of items visible at once
  
  // Handle search changes (debounced)
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(pendingSearch);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [pendingSearch]);
  
  React.useEffect(() => {
    setSearchQuery(debouncedSearch);
    setSelectedIndex(0);
    setScrollOffset(0);
  }, [debouncedSearch]);
  
  // Load lores based on current filters and search
  React.useEffect(() => {
    async function loadLores() {
      setLoading(true);
      try {
        let results: Lore[] = [];
        const realms = db.listRealms();
        
        // Filter realms based on options
        let realmsToSearch = realms;
        if (initialOptions.currentRealmOnly) {
          const currentRealm = db.findRealmByPath(process.cwd());
          if (currentRealm) {
            realmsToSearch = [currentRealm];
          }
        } else if (initialOptions.realmPath) {
          const specificRealm = db.findRealmByPath(initialOptions.realmPath);
          if (specificRealm) {
            realmsToSearch = [specificRealm];
          }
        }
        
        // Search or list based on query
        if (debouncedSearch) {
          // Search mode
          for (const realm of realmsToSearch) {
            if (searchMode === 'semantic') {
              const semanticResults = await db.semanticSearchLores(debouncedSearch, {
                realmId: realm.id,
                includeScore: true,
                threshold: config.get('semanticSearchThreshold')
              });
              results.push(...semanticResults);
            } else if (searchMode === 'hybrid') {
              // Hybrid search logic (combine literal and semantic)
              const literalResults = db.searchLores(realm.id, debouncedSearch);
              const semanticResults = await db.semanticSearchLores(debouncedSearch, {
                realmId: realm.id,
                includeScore: true
              });
              
              // Merge and deduplicate
              const loreMap = new Map<string, Lore>();
              literalResults.forEach(lore => loreMap.set(lore.id, lore));
              semanticResults.forEach(lore => {
                if (!loreMap.has(lore.id)) {
                  loreMap.set(lore.id, lore);
                }
              });
              
              results.push(...Array.from(loreMap.values()));
            } else {
              // Literal search (default)
              const literalResults = db.searchLores(realm.id, debouncedSearch);
              results.push(...literalResults);
            }
          }
        } else {
          // List mode
          for (const realm of realmsToSearch) {
            if (filterType) {
              results.push(...db.listLoresByType(realm.id, filterType as any));
            } else if (filterProvince) {
              results.push(...db.listLoresByProvince(realm.id, filterProvince));
            } else {
              results.push(...db.listLoresByRealm(realm.id));
            }
          }
        }
        
        // Sort by creation date (newest first)
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setLores(results);
        setSelectedIndex(0);
        setScrollOffset(0);
      } catch (error) {
        console.error('Error loading lores:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadLores();
  }, [debouncedSearch, searchMode, filterType, filterProvince]);

  // Input handling when not searching
  useInput((input, key) => {
    // Don't process inputs while searching (except escape/ctrl+c)
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        setPendingSearch(debouncedSearch);
        return;
      }
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }
      return; // Ignore all other keys while searching
    }
    
    // Always handle escape
    if (key.escape) {
      exit();
      return;
    }
    
    // Always handle Ctrl+C
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    
    // Toggle help
    if (input === '?') {
      setShowHelp(!showHelp);
      return;
    }
    
    // Close help or details if open
    if (showHelp) {
      setShowHelp(false);
      return;
    }
    
    if (showDetails) {
      setShowDetails(false);
      return;
    }
    
    if (showSimilar && navigationHistory.length === 0) {
      setShowSimilar(false);
      return;
    }
    
    // Navigation
    if (key.upArrow || input === 'k') {
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
        // Adjust scroll if needed
        if (selectedIndex - 1 < scrollOffset) {
          setScrollOffset(scrollOffset - 1);
        }
      }
    } else if (key.downArrow || input === 'j') {
      if (selectedIndex < displayLores.length - 1) {
        setSelectedIndex(selectedIndex + 1);
        // Adjust scroll if needed
        if (selectedIndex + 1 >= scrollOffset + VISIBLE_ITEMS) {
          setScrollOffset(scrollOffset + 1);
        }
      }
    } else if (key.pageUp) {
      const newIndex = Math.max(0, selectedIndex - VISIBLE_ITEMS);
      setSelectedIndex(newIndex);
      setScrollOffset(Math.max(0, scrollOffset - VISIBLE_ITEMS));
    } else if (key.pageDown) {
      const newIndex = Math.min(displayLores.length - 1, selectedIndex + VISIBLE_ITEMS);
      setSelectedIndex(newIndex);
      const maxScroll = Math.max(0, displayLores.length - VISIBLE_ITEMS);
      setScrollOffset(Math.min(maxScroll, scrollOffset + VISIBLE_ITEMS));
    }
    
    // Search mode switching
    if (input === 'm' || input === 'M') {
      const modes: Array<'literal' | 'semantic' | 'hybrid'> = ['literal', 'semantic', 'hybrid'];
      const currentIndex = modes.indexOf(searchMode);
      const newMode = modes[(currentIndex + 1) % modes.length];
      if (newMode) {
        setSearchMode(newMode);
        // Save preference
        config.set('searchMode', newMode);
      }
    }
    
    // Clear search
    if (input === 'c' || input === 'C') {
      setSearchQuery('');
      setPendingSearch('');
    }
    
    // Start search
    if (input === '/') {
      setIsSearching(true);
    }
    
    // View details (only when not searching)
    if (key.return && lores[selectedIndex] && !isSearching) {
      setSelectedLore(lores[selectedIndex]);
      setShowDetails(true);
    }
    
    // View similar lores
    if ((input === 's' || input === 'S') && lores[selectedIndex]) {
      const lore = lores[selectedIndex];
      setNavigationHistory([...navigationHistory, lore]);
      loadSimilarLores(lore);
    }
    
    // Go back in navigation
    if ((input === 'b' || input === 'B') && navigationHistory.length > 0) {
      const previousLore = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(navigationHistory.slice(0, -1));
      if (navigationHistory.length === 1) {
        // Going back to original list
        setShowSimilar(false);
      } else {
        // Load similar for previous lore
        const prevLore = navigationHistory[navigationHistory.length - 2];
        if (prevLore) {
          loadSimilarLores(prevLore);
        }
      }
    }
    
    // Quit
    if (input === 'q' || input === 'Q') {
      exit();
    }
  });
  
  
  // Load similar lores
  const loadSimilarLores = async (lore: Lore) => {
    setLoadingSimilar(true);
    try {
      const similar = await db.findSimilarLores(lore.id, {
        limit: 20,
        threshold: 0.5
      });
      setSimilarLores(similar);
      setShowSimilar(true);
      setSelectedIndex(0);
      setScrollOffset(0);
    } catch (error) {
      console.error('Failed to load similar lores:', error);
    } finally {
      setLoadingSimilar(false);
    }
  };
  
  // Virtual scrolling - only render visible items
  const displayLores = showSimilar ? similarLores : lores;
  const visibleLores = displayLores.slice(scrollOffset, scrollOffset + VISIBLE_ITEMS);
  
  if (showDetails && selectedLore) {
    const realm = db.findRealm(selectedLore.realmId);
    const isCurrentRealm = realm?.path === process.cwd();
    
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" padding={1}>
        <Text bold underline>Lore Details</Text>
        <Text> </Text>
        <Box flexDirection="column">
          <Text>[{selectedLore.type}] {selectedLore.content}</Text>
          <Text dimColor>   Realm: {realm?.name || 'Unknown'}{isCurrentRealm ? ' ⭐' : ''} ({realm?.path || 'Unknown'})</Text>
          {selectedLore.why && <Text dimColor>   Why: {selectedLore.why}</Text>}
          <Text dimColor>   Created: {selectedLore.createdAt.toLocaleString()}</Text>
          {selectedLore.sigils && selectedLore.sigils.length > 0 && (
            <Text dimColor>   Sigils: {selectedLore.sigils.join(', ')}</Text>
          )}
          {selectedLore.provinces && selectedLore.provinces.length > 0 && (
            <Text dimColor>   Provinces: {selectedLore.provinces.join(', ')}</Text>
          )}
          <Text dimColor>   Confidence: {selectedLore.confidence}%</Text>
          <Text dimColor>   Status: {selectedLore.status}</Text>
          <Text dimColor>   ID: {selectedLore.id}</Text>
        </Box>
        <Text> </Text>
        <Text dimColor>Press ESC to go back</Text>
      </Box>
      </AlternativeScreenView>
    );
  }
  
  if (showHelp) {
    return (
      <AlternativeScreenView>
        <Box flexDirection="column" padding={1}>
        <Text bold underline>LoreHub Browse - Help</Text>
        <Text> </Text>
        <Text>Navigation:</Text>
        <Text>  ↑/↓      - Navigate through lores</Text>
        <Text>  PgUp/PgDn - Page up/down</Text>
        <Text>  Enter    - View lore details</Text>
        <Text>  s        - View similar lores</Text>
        <Text>  b        - Go back (in similar lores view)</Text>
        <Text> </Text>
        <Text>Search:</Text>
        <Text>  m        - Switch search mode (literal/semantic/hybrid)</Text>
        <Text>  c        - Clear search</Text>
        <Text>  /        - Focus search input</Text>
        <Text> </Text>
        <Text>Other:</Text>
        <Text>  ?        - Toggle this help</Text>
        <Text>  q/Esc    - Exit</Text>
        <Text> </Text>
        <Text dimColor>Press any key to continue... (ESC to exit)</Text>
      </Box>
      </AlternativeScreenView>
    );
  }
  
  return (
    <AlternativeScreenView>
      <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="column">
          <Box justifyContent="space-between">
            <Text bold>LoreHub Browse</Text>
            <Text dimColor>
              {displayLores.length} lores | Mode: {searchMode} | Press ? for help
            </Text>
          </Box>
          {showSimilar && (
            <Text dimColor>
              Similar to: {navigationHistory[navigationHistory.length - 1]?.content.substring(0, 50)}...
            </Text>
          )}
        </Box>
        
        {/* Search/Filter Bar */}
        <Box marginTop={1}>
          <Text>Search: </Text>
          {isSearching ? (
            <TextInput
              value={pendingSearch}
              onChange={setPendingSearch}
              onSubmit={() => setIsSearching(false)}
              placeholder="Enter search query..."
            />
          ) : (
            <Text color={debouncedSearch ? 'green' : 'gray'}>
              {debouncedSearch || '(press / to search)'}
            </Text>
          )}
          {filterType && <Text dimColor> | Type: {filterType}</Text>}
          {filterProvince && <Text dimColor> | Province: {filterProvince}</Text>}
        </Box>
      </Box>
      
      {/* Lore List with Virtual Scrolling */}
      {loading || loadingSimilar ? (
        <Text>{loadingSimilar ? 'Loading similar lores...' : 'Loading lores...'}</Text>
      ) : displayLores.length === 0 ? (
        <Text dimColor>{showSimilar ? 'No similar lores found' : 'No lores found'}</Text>
      ) : (
        <Box flexDirection="column">
          {visibleLores.map((lore, index) => {
            const actualIndex = scrollOffset + index;
            const isSelected = actualIndex === selectedIndex;
            const realm = db.findRealm(lore.realmId);
            
            const isCurrentRealm = realm?.path === process.cwd();
            
            return (
              <Box key={lore.id} flexDirection="column" marginBottom={1}>
                <Text color={isSelected ? 'blue' : undefined}>
                  {actualIndex + 1}. [{lore.type}] {lore.content}
                </Text>
                <Text dimColor>
                  {'   '}Realm: {realm?.name || 'Unknown'}{isCurrentRealm ? ' ⭐' : ''} ({realm?.path || 'Unknown'})
                </Text>
                {lore.why && (
                  <Text dimColor>
                    {'   '}Why: {lore.why}
                  </Text>
                )}
                <Text dimColor>
                  {'   '}Created: {lore.createdAt.toLocaleString()}
                  {(searchMode === 'semantic' || searchMode === 'hybrid') && (lore as any).similarity && (
                    <> | Match: {((lore as any).similarity * 100).toFixed(0)}%</>
                  )}
                </Text>
                {lore.sigils && lore.sigils.length > 0 && (
                  <Text dimColor>
                    {'   '}Sigils: {lore.sigils.join(', ')}
                  </Text>
                )}
              </Box>
            );
          })}
          
          {/* Scroll indicator */}
          {displayLores.length > VISIBLE_ITEMS && (
            <Box marginTop={1}>
              <Text dimColor>
                Showing {scrollOffset + 1}-{Math.min(scrollOffset + VISIBLE_ITEMS, displayLores.length)} of {displayLores.length}
                {navigationHistory.length > 0 && <> | Press 'b' to go back</>}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
    </AlternativeScreenView>
  );
}

export async function renderBrowse(options: BrowseOptions): Promise<void> {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  const config = ConfigManager.getInstance();
  
  // Non-interactive fallback
  if (!process.stdin.isTTY) {
    try {
      let results: any[] = [];
      const realms = db.listRealms();
      
      // Filter realms
      let realmsToSearch = realms;
      if (options.currentRealmOnly) {
        const currentRealm = db.findRealmByPath(process.cwd());
        if (currentRealm) realmsToSearch = [currentRealm];
      } else if (options.realmPath) {
        const specificRealm = db.findRealmByPath(options.realmPath);
        if (specificRealm) realmsToSearch = [specificRealm];
      }
      
      const searchMode = options.searchMode || config.get('searchMode') || 'literal';
      
      // Search or list
      for (const realm of realmsToSearch) {
        if (options.query) {
          if (searchMode === 'semantic') {
            const semanticResults = await db.semanticSearchLores(options.query, {
              realmId: realm.id,
              includeScore: true,
              threshold: config.get('semanticSearchThreshold')
            });
            results.push(...semanticResults);
          } else {
            const literalResults = db.searchLores(realm.id, options.query);
            results.push(...literalResults);
          }
        } else {
          if (options.type) {
            results.push(...db.listLoresByType(realm.id, options.type as any));
          } else if (options.province) {
            results.push(...db.listLoresByProvince(realm.id, options.province));
          } else {
            results.push(...db.listLoresByRealm(realm.id));
          }
        }
      }
      
      // Sort and limit
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limit = config.get('defaultListLimit');
      if (results.length > limit) {
        results = results.slice(0, limit);
      }
      
      // Display results
      console.log(`\nLores (${results.length}):\n`);
      results.forEach((lore, index) => {
        const realm = db.findRealm(lore.realmId);
        console.log(`${index + 1}. [${lore.type}] ${lore.content}`);
        console.log(`   Realm: ${realm?.name || 'Unknown'} (${realm?.path || 'Unknown'})`);
        if (lore.why) console.log(`   Why: ${lore.why}`);
        console.log(`   Created: ${lore.createdAt.toLocaleString()}`);
        if (lore.sigils && lore.sigils.length > 0) {
          console.log(`   Sigils: ${lore.sigils.join(', ')}`);
        }
        console.log('');
      });
    } finally {
      db.close();
    }
    return;
  }
  
  // Interactive mode
  try {
    const { waitUntilExit } = render(
      <BrowseView db={db} initialOptions={options} />,
      { 
        exitOnCtrlC: false // We handle Ctrl+C ourselves
      }
    );
    
    await waitUntilExit();
  } finally {
    db.close();
  }
}